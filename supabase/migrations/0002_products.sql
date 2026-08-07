-- Starter product catalog for the "select a product" dropdown on
-- /admin/orders/new, which auto-fills the Regulatory content section.
--
-- DEPLOY TARGET: same shared MULTI-X project as 0001_init.sql — apply by
-- hand via the Dashboard SQL Editor, not `supabase db push` (see that
-- file's header comment for why). Table is named lg_products (prefixed
-- for the same collision-avoidance reason as the other lg_ tables).
--
-- Seed data: 7 real Ancient Nutra bestseller capsule products
-- (ancientnutra.com), with ingredients/claims/dosage/warnings text pulled
-- verbatim from each product's live page — not AI-paraphrased — then
-- mapped onto this app's existing regulatory-content fields (there's no
-- separate "suggested use" field yet, so dosage + warning text lives in
-- statutory_marks, and certification marks live in claims since that's
-- what renders as badges on the label). This is a STARTER set covering
-- the bestsellers shown on the site's homepage, not the full 100+ SKU
-- catalog — add more rows the same way as new products are needed.

create table public.lg_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pack_format lg_pack_format not null default 'capsule_bottle',
  ingredients text not null default '',
  claims text not null default '',
  statutory_marks text not null default '',
  serving_size text not null default '',
  calories text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.lg_products enable row level security;

insert into public.lg_products (name, pack_format, ingredients, claims, statutory_marks, serving_size, calories)
values
  (
    'Ashwagandha',
    'capsule_bottle',
    'Ashwagandha (Withania somnifera) root powder, 500mg per capsule. Vegetarian capsule shell. No fillers, artificial colours, or preservatives.',
    'GMP, HACCP, ISO 22000, FSSC 22000, BRCGS',
    'Suggested use: Take 1 capsule with a meal, once or twice daily. Not recommended during pregnancy, on thyroid medication, or with sedatives without medical advice. Food supplement — not a substitute for medical treatment.',
    '1 capsule (500mg Ashwagandha root powder)',
    ''
  ),
  (
    'Heenbovitiya',
    'capsule_bottle',
    'Heenbovitiya leaf powder, 450mg per capsule. Vegetarian capsule.',
    'GMP, HACCP, ISO 22000, FSSC 22000, BRCGS',
    'Suggested use: Take 1 capsule with a meal, up to 2 capsules per day, in 60-90 day cycles followed by a break. Consult your doctor if you have a diagnosed liver condition. Food supplement — not a substitute for medical treatment.',
    '1 capsule (450mg Heenbovitiya leaf powder)',
    ''
  ),
  (
    'Moringa',
    'capsule_bottle',
    'Moringa oleifera leaf powder, 500mg per capsule. Vegetarian capsule shell. No fillers.',
    'GMP, HACCP, ISO 22000, FSSC 22000, BRCGS',
    'Suggested use: Take 1 capsule with a meal, up to 2 capsules per day. Consult your doctor if pregnant or taking blood-thinning or thyroid medication. Food supplement — not a substitute for medical treatment.',
    '1 capsule (500mg Moringa leaf powder)',
    ''
  ),
  (
    'Garcinia',
    'capsule_bottle',
    'Garcinia extract, 650mg per serving. Vegetarian capsules.',
    'GMP, HACCP, ISO 22000, FSSC 22000, BRCGS',
    'Suggested use: Take 1 capsule before a meal, up to 2 capsules per day. Consult your doctor if taking any medication; avoid eating cassava while using this product. Food supplement — not a substitute for medical treatment.',
    '1 capsule (650mg Garcinia)',
    ''
  ),
  (
    'Beli',
    'capsule_bottle',
    'Beli fruit (Aegle marmelos) powder. Vegetarian capsule.',
    'GMP, HACCP, ISO 22000, FSSC 22000, BRCGS',
    'Suggested use: Take 1 capsule with a meal, up to 2 capsules per day, in 30-60 day cycles. Consult your doctor if taking medication for blood sugar or thyroid. Food supplement — not a substitute for medical treatment.',
    '1 capsule',
    ''
  ),
  (
    'Gurmar (Masbedda)',
    'capsule_bottle',
    'Gymnema sylvestre (Gurmar) leaf powder. Vegetarian capsule.',
    'GMP, HACCP, ISO 22000, FSSC 22000, BRCGS, Sri Lanka Ayurveda Department certified',
    'Suggested use: Take 1 capsule before your two largest meals of the day; an optional third capsule may be taken mid-afternoon. If you take metformin, insulin, or other blood-sugar medication, speak with your doctor first — this product can amplify their effect and cause low blood sugar. Food supplement — not a substitute for prescribed treatment.',
    '1 capsule',
    ''
  ),
  (
    'Turmeric & Black Pepper',
    'capsule_bottle',
    'Turmeric (Curcuma longa) root powder 570mg and black pepper (Piper nigrum) 30mg per capsule. Certified organic.',
    'GMP, HACCP, ISO 22000, FSSC 22000, Certified Organic',
    'Suggested use: Take 1 capsule with a meal, up to 2 capsules per day. Consult your doctor before use if taking medication. Food supplement — not a substitute for medical treatment.',
    '1 capsule (570mg turmeric root powder + 30mg black pepper)',
    ''
  )
on conflict do nothing;
