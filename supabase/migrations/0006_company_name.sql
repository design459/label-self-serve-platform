-- Adds a company name field to the public self-serve order form, alongside
-- the existing customer name/email. Nullable so existing rows (created
-- before this field existed) stay valid.

alter table public.label_orders
  add column if not exists company_name text;
