-- Label Generator — Customer Self-Serve Label Platform
-- Initial schema.
--
-- DEPLOY TARGET: applied to the shared MULTI-X Supabase project
-- (troxvvwkiontbliwuvkn, Silk Route Ventures org, PRO, production) at the
-- user's explicit choice, after being told that project already hosts
-- unrelated systems (17+ pre-existing migrations) and PackLabel's own
-- `labels` table. Apply this by hand via the Dashboard SQL Editor, NOT
-- `supabase db push` — this repo doesn't have MULTI-X's other migrations
-- locally, and pushing would rewrite its migration-history bookkeeping for
-- unrelated codebases (same reason PackLabel's schema was applied by hand —
-- see its CLAUDE.md). Run the pre-flight collision check first (see README)
-- before applying this file.
--
-- Every table/type/function name below that's generic enough to plausibly
-- collide with an unrelated system is prefixed `lg_` (label-generator) for
-- that reason: lg_pack_format, lg_order_status, lg_review_decision,
-- lg_staff_users, lg_audit_log, lg_spend_revision. The already-specific
-- names (label_orders, label_designs, label_regulatory_content,
-- label_assets, compliance_reviews, pack_format_templates) are left as-is.
--
-- Access model: RLS is enabled on every app table below with NO anon or
-- authenticated policies. Every read/write from this app goes through a
-- Next.js Route Handler using the service-role key server-side (which
-- bypasses RLS by design). The customer workspace is authorized by the
-- Route Handler validating `access_token` against `label_orders` — never by
-- an RLS policy keyed to a Postgres role. This keeps a customer's token from
-- ever reaching a row that isn't theirs, without needing per-token Postgres
-- roles. Do not add anon/authenticated policies to these tables without
-- re-reading why they were left out.

create extension if not exists pgcrypto;

create type lg_pack_format as enum ('pouch', 'capsule_bottle', 'jar', 'sachet');
create type lg_order_status as enum ('draft', 'in_progress', 'submitted', 'approved', 'rejected');
create type lg_review_decision as enum ('approved', 'rejected');

-- Staff / reviewers -----------------------------------------------------
-- One role for this MVP ("reviewer") per the locked scope decision. A user
-- must sign up via Supabase Auth first, then be added here by hand (SQL
-- Editor) before /admin will let them in — see README.
create table public.lg_staff_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'reviewer',
  created_at timestamptz not null default now()
);

alter table public.lg_staff_users enable row level security;

-- Pack-format template library -------------------------------------------
-- Starter library: one working zone layout per pack format, placeholder
-- trim dimensions (not co-packer-verified dielines — see spec open items).
-- zone_layout is percentage-based (0-100) rectangles within the trim area,
-- consumed by lib/artboard.ts. Editable later via SQL/dashboard without a
-- redeploy.
create table public.pack_format_templates (
  id uuid primary key default gen_random_uuid(),
  pack_format lg_pack_format not null,
  name text not null,
  trim_width_mm numeric not null,
  trim_height_mm numeric not null,
  bleed_mm numeric not null default 3,
  safety_mm numeric not null default 5,
  zone_layout jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.pack_format_templates enable row level security;

insert into public.pack_format_templates (pack_format, name, trim_width_mm, trim_height_mm, bleed_mm, safety_mm, zone_layout)
values
  ('pouch', 'Stand-up pouch — starter template', 110, 170, 3, 5, '{
    "zones": {
      "header": { "x": 6, "y": 4, "w": 88, "h": 20 },
      "claims": { "x": 6, "y": 26, "w": 88, "h": 8 },
      "left":   { "x": 6, "y": 36, "w": 41, "h": 48 },
      "right":  { "x": 51, "y": 36, "w": 43, "h": 48 },
      "footer": { "x": 6, "y": 88, "w": 88, "h": 8 }
    }
  }'::jsonb),
  ('capsule_bottle', 'Capsule bottle wrap — starter template', 230, 85, 3, 5, '{
    "zones": {
      "header": { "x": 4, "y": 6, "w": 92, "h": 26 },
      "claims": { "x": 4, "y": 34, "w": 92, "h": 10 },
      "left":   { "x": 4, "y": 46, "w": 44, "h": 42 },
      "right":  { "x": 51, "y": 46, "w": 45, "h": 42 },
      "footer": { "x": 4, "y": 90, "w": 92, "h": 6 }
    }
  }'::jsonb),
  ('jar', 'Jar wrap — starter template', 200, 90, 3, 5, '{
    "zones": {
      "header": { "x": 5, "y": 6, "w": 90, "h": 24 },
      "claims": { "x": 5, "y": 32, "w": 90, "h": 10 },
      "left":   { "x": 5, "y": 44, "w": 43, "h": 44 },
      "right":  { "x": 50, "y": 44, "w": 45, "h": 44 },
      "footer": { "x": 5, "y": 90, "w": 90, "h": 6 }
    }
  }'::jsonb),
  ('sachet', 'Single-serve sachet — starter template', 70, 110, 3, 4, '{
    "zones": {
      "header": { "x": 6, "y": 5, "w": 88, "h": 22 },
      "claims": { "x": 6, "y": 28, "w": 88, "h": 8 },
      "left":   { "x": 6, "y": 38, "w": 88, "h": 30 },
      "right":  { "x": 6, "y": 70, "w": 88, "h": 18 },
      "footer": { "x": 6, "y": 90, "w": 88, "h": 8 }
    }
  }'::jsonb)
on conflict do nothing;

-- Label orders ------------------------------------------------------------
-- The trigger + entitlement (spec: "order confirmed -> link issued"). v1
-- creates these by hand via /admin/orders/new (see spec open items on the
-- real b1/order-flow integration).
create table public.label_orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  customer_email text not null,
  sku_code text not null,
  product_name text not null default '',
  pack_format lg_pack_format not null,
  access_token text not null unique,
  status lg_order_status not null default 'draft',
  revision_limit int not null default 5,
  revisions_used int not null default 0,
  selected_template_id uuid references public.pack_format_templates(id),
  theme jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index label_orders_access_token_idx on public.label_orders (access_token);
create index label_orders_status_idx on public.label_orders (status);

alter table public.label_orders enable row level security;

-- The SKU's regulatory content set — exact text, never AI-generated, since
-- this is the compliance-critical part of the label.
create table public.label_regulatory_content (
  id uuid primary key default gen_random_uuid(),
  label_order_id uuid not null unique references public.label_orders(id) on delete cascade,
  ingredients text,
  nutrition_panel jsonb,
  claims text,
  batch_code text,
  manufacture_date date,
  expiry_date date,
  statutory_marks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.label_regulatory_content enable row level security;

-- Customer-uploaded logo/brand assets. Theirs — no reuse outside their own
-- label without permission (spec boundary); this app never queries across
-- label_order_id, so there is no code path that could leak one customer's
-- asset into another's render.
create table public.label_assets (
  id uuid primary key default gen_random_uuid(),
  label_order_id uuid not null references public.label_orders(id) on delete cascade,
  kind text not null default 'logo',
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

alter table public.label_assets enable row level security;

-- One row per generated revision. Only ever created by lg_spend_revision()
-- below — never directly by app code — so the cap can't be bypassed.
create table public.label_designs (
  id uuid primary key default gen_random_uuid(),
  label_order_id uuid not null references public.label_orders(id) on delete cascade,
  revision_number int not null,
  theme jsonb,
  -- Full snapshot of what buildArtboardHtml() needs (template id, theme,
  -- logo data URL, regulatory content, QR data URL) — captured once at
  -- generation time so both the watermarked proof and the later
  -- unwatermarked print file (rendered only on approval) come from the
  -- exact same inputs, no re-fetching at approval time.
  render_input jsonb,
  proof_storage_path text,
  print_storage_path text,
  is_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (label_order_id, revision_number)
);

alter table public.label_designs enable row level security;

-- Compliance review decisions. A row here is the ONLY thing that can make a
-- label print-ready — see app/api/admin/review/[id]/route.ts, which is the
-- only code path that inserts here and requires an authenticated staff
-- session with a matching public.lg_staff_users row.
create table public.compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  label_order_id uuid not null references public.label_orders(id) on delete cascade,
  label_design_id uuid not null references public.label_designs(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  decision lg_review_decision not null,
  reason text,
  decided_at timestamptz not null default now()
);

alter table public.compliance_reviews enable row level security;

-- Append-only audit trail: link issued, revision spent, submitted,
-- approved/rejected. Satisfies the spec's "audit trail of who approved what
-- and when" output requirement. Named lg_audit_log (not audit_log) since
-- this project already hosts unrelated systems that may well have their own
-- generically-named audit table.
create table public.lg_audit_log (
  id uuid primary key default gen_random_uuid(),
  label_order_id uuid references public.label_orders(id) on delete cascade,
  actor text not null,
  action text not null,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index lg_audit_log_order_idx on public.lg_audit_log (label_order_id, created_at desc);

alter table public.lg_audit_log enable row level security;

-- Revision cap enforcement --------------------------------------------
-- The single place revisions_used changes and label_designs rows are
-- created. Row-locks the order so concurrent "Generate" clicks from the
-- same customer can't both slip through at the cap boundary. Raises if the
-- cap is already spent; the calling Route Handler translates that into the
-- customer-facing "revision limit reached" response.
create or replace function public.lg_spend_revision(p_order_id uuid)
returns public.label_designs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_used int;
  v_next int;
  v_status lg_order_status;
  v_design public.label_designs;
begin
  select revision_limit, revisions_used, status into v_limit, v_used, v_status
  from public.label_orders
  where id = p_order_id
  for update;

  if v_limit is null then
    raise exception 'label order % not found', p_order_id;
  end if;

  if v_status = 'approved' then
    raise exception 'label order % is already approved — no further revisions', p_order_id;
  end if;

  if v_used >= v_limit then
    raise exception 'revision cap reached (% of %)', v_used, v_limit;
  end if;

  v_next := v_used + 1;

  update public.label_orders
  set revisions_used = v_next,
      status = 'in_progress',
      updated_at = now()
  where id = p_order_id;

  insert into public.label_designs (label_order_id, revision_number)
  values (p_order_id, v_next)
  returning * into v_design;

  insert into public.lg_audit_log (label_order_id, actor, action, detail)
  values (
    p_order_id,
    'customer',
    'revision_spent',
    jsonb_build_object('revision_number', v_next, 'revisions_used', v_next, 'revision_limit', v_limit)
  );

  return v_design;
end;
$$;

-- security definer functions are callable by PUBLIC by default regardless
-- of RLS — lock this down to the service role, which is the only caller
-- (see app/api/workspace/[token]/generate/route.ts).
revoke execute on function public.lg_spend_revision(uuid) from public;
grant execute on function public.lg_spend_revision(uuid) to service_role;

-- Storage bucket for logos + rendered proofs. Private — every access goes
-- through the server (service-role key), which mints short-lived signed
-- URLs for the browser. No public storage policies are added. Bucket name
-- is already specific enough to this app that it's left unprefixed.
insert into storage.buckets (id, name, public)
values ('label-assets', 'label-assets', false)
on conflict (id) do nothing;
