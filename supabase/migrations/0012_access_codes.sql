-- One-time codes gating the public "Start your label" flow. A customer
-- requests a code (POST /api/public/request-code); it's emailed only to
-- staff (design@esilkroute.com.lk), never to the customer — staff decide
-- whether to relay it. The code is then required alongside the rest of the
-- "Start your label" form (POST /api/public/orders) before a workspace is
-- created. Only ever touched via service_role from these two API routes,
-- same pattern as lg_rate_limit_counters below.
create table if not exists public.lg_access_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code text not null,
  customer_name text,
  company_name text,
  context text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists lg_access_codes_email_code_idx on public.lg_access_codes (lower(email), code);

alter table public.lg_access_codes enable row level security;
