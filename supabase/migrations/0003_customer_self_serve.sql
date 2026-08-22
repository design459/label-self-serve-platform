-- Public self-serve ordering: product categories (decoupled from the
-- physical pack_format enum), category-specific nutrition/supplement panel
-- field schemas, customer-editable marketing/style fields on label_orders,
-- and a DB-backed rate limiter for the new public unauthenticated
-- endpoints.
--
-- DEPLOY TARGET / APPLY METHOD: same shared MULTI-X project as
-- 0001_init.sql / 0002_products.sql — apply by hand via the Dashboard SQL
-- Editor, not `supabase db push` (see 0001's header for why). Uses
-- `add column if not exists` so it's safe to re-run.

-- Product category ---------------------------------------------------------
-- pack_format (pouch/capsule_bottle/jar/sachet) describes physical
-- packaging only. category describes product TYPE, which determines the
-- nutrition-panel shape (Supplement Facts vs Nutrition Facts vs a blank
-- panel for anything that doesn't fit) — the two are orthogonal, so this is
-- a new enum, not a repurposing of lg_pack_format.
create type lg_product_category as enum (
  'capsule_tablet', 'powder', 'juice_beverage', 'bar', 'other'
);

-- One editable-via-SQL row per category — same pattern as
-- pack_format_templates in 0001_init.sql (a starter library, not
-- hardcoded in app code, editable without a redeploy). field_schema drives
-- BOTH the customer-facing input form and lib/artboard.ts's nutritionRows(),
-- so there is one source of truth for "what fields exist for this
-- category", not a hand-synced TS constant.
create table public.category_panel_templates (
  id uuid primary key default gen_random_uuid(),
  category lg_product_category not null unique,
  display_label text not null,
  panel_style text not null check (panel_style in ('supplement_facts', 'nutrition_facts', 'blank')),
  default_pack_format lg_pack_format not null,
  field_schema jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.category_panel_templates enable row level security;

insert into public.category_panel_templates (category, display_label, panel_style, default_pack_format, field_schema)
values
  ('capsule_tablet', 'Capsule / Tablet', 'supplement_facts', 'capsule_bottle', '[
    {"key":"servingSize","label":"Serving Size","type":"text"},
    {"key":"servingsPerContainer","label":"Servings Per Container","type":"text"},
    {"key":"calories","label":"Calories","type":"text"},
    {"key":"suggestedUse","label":"Suggested Use","type":"textarea"},
    {"key":"warnings","label":"Warnings","type":"textarea"}
  ]'::jsonb),
  ('powder', 'Powder', 'supplement_facts', 'jar', '[
    {"key":"servingSize","label":"Serving Size (scoops)","type":"text"},
    {"key":"servingsPerContainer","label":"Servings Per Container","type":"text"},
    {"key":"calories","label":"Calories","type":"text"},
    {"key":"totalCarb","label":"Total Carbohydrate","type":"text"},
    {"key":"protein","label":"Protein","type":"text"},
    {"key":"suggestedUse","label":"Suggested Use","type":"textarea"}
  ]'::jsonb),
  ('juice_beverage', 'Juice / Beverage', 'nutrition_facts', 'jar', '[
    {"key":"servingSize","label":"Serving Size","type":"text"},
    {"key":"servingsPerContainer","label":"Servings Per Container","type":"text"},
    {"key":"calories","label":"Calories","type":"text"},
    {"key":"totalFat","label":"Total Fat","type":"text"},
    {"key":"sodium","label":"Sodium","type":"text"},
    {"key":"totalCarb","label":"Total Carbohydrate","type":"text"},
    {"key":"totalSugars","label":"Total Sugars","type":"text"},
    {"key":"protein","label":"Protein","type":"text"}
  ]'::jsonb),
  ('bar', 'Bar', 'nutrition_facts', 'sachet', '[
    {"key":"servingSize","label":"Serving Size (1 bar)","type":"text"},
    {"key":"calories","label":"Calories","type":"text"},
    {"key":"totalFat","label":"Total Fat","type":"text"},
    {"key":"totalCarb","label":"Total Carbohydrate","type":"text"},
    {"key":"totalSugars","label":"Total Sugars","type":"text"},
    {"key":"protein","label":"Protein","type":"text"}
  ]'::jsonb),
  ('other', 'Other', 'blank', 'pouch', '[]'::jsonb)
on conflict do nothing;

-- lg_products: catalog products now carry a category. All 7 existing seed
-- rows (0002_products.sql) are real capsule products, so this default
-- backfills them correctly, not as a placeholder.
alter table public.lg_products
  add column if not exists category lg_product_category not null default 'capsule_tablet';

-- label_orders: category, plus new customer-editable marketing/style
-- fields. These are deliberately NOT on label_regulatory_content — they
-- carry no regulatory meaning (a display name/tagline/photo position/font
-- choice), so that table's "exact text, never AI-generated" compliance
-- boundary is untouched by this migration.
alter table public.label_orders
  add column if not exists category lg_product_category not null default 'capsule_tablet',
  add column if not exists display_name text,
  add column if not exists marketing_tagline text,
  add column if not exists font_id text not null default 'sans-modern',
  add column if not exists image_position jsonb not null default '{"x":50,"y":50,"scale":1}'::jsonb,
  add column if not exists source text not null default 'staff' check (source in ('staff', 'customer'));

create index if not exists label_orders_category_idx on public.label_orders (category);

-- Note: label_orders.created_by is already `references auth.users(id)`
-- with no NOT NULL constraint (see 0001_init.sql) — customer-originated
-- orders simply leave it null, no migration needed for that.

-- Rate limiting for the new public order-creation endpoint -----------------
-- The one genuinely new abuse surface in this app: opening an
-- unauthenticated POST endpoint with zero existing captcha/throttle infra.
-- A single atomic upsert per (bucket, identifier, hour) is "good enough"
-- deterrence — it doesn't need lg_spend_revision's `for update` row lock,
-- because the real backstop against a spam order ever reaching print is
-- the unchanged staff compliance-review step, not this counter.
create table public.lg_rate_limit_counters (
  bucket text not null,
  identifier text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, identifier, window_start)
);

alter table public.lg_rate_limit_counters enable row level security;

create or replace function public.lg_check_rate_limit(p_bucket text, p_identifier text, p_max_per_hour int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count int;
begin
  insert into public.lg_rate_limit_counters (bucket, identifier, window_start, count)
  values (p_bucket, p_identifier, v_window, 1)
  on conflict (bucket, identifier, window_start)
  do update set count = lg_rate_limit_counters.count + 1
  returning count into v_count;

  return v_count <= p_max_per_hour;
end;
$$;

-- security definer functions are callable by PUBLIC by default regardless
-- of RLS — lock this down to the service role, same pattern as
-- lg_spend_revision in 0001_init.sql.
revoke execute on function public.lg_check_rate_limit(text, text, int) from public;
grant execute on function public.lg_check_rate_limit(text, text, int) to service_role;
