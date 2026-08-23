-- Splits the old bundled "statutory_marks" suggested-use + warnings text
-- into two real fields that already exist in the Supplement Facts panel's
-- schema (suggestedUse / warnings — see 0003_customer_self_serve.sql).
-- This frees up statutory_marks to hold an AI-drafted product description
-- instead (see CategoryPanelEditor.tsx's "Description" field and
-- app/api/workspace/[token]/regulatory/generate-description/route.ts).
--
-- The suggested_use / warnings text below is the exact wording already in
-- 0002_products.sql's statutory_marks column, split at its existing
-- sentence boundary — nothing reworded or invented.
--
-- DEPLOY TARGET / APPLY METHOD: same shared MULTI-X project as the other
-- migrations — apply by hand via the Dashboard SQL Editor.

alter table public.lg_products
  add column if not exists suggested_use text not null default '',
  add column if not exists warnings text not null default '';

update public.lg_products set
  suggested_use = 'Take 1 capsule with a meal, once or twice daily.',
  warnings = 'Not recommended during pregnancy, on thyroid medication, or with sedatives without medical advice. Food supplement — not a substitute for medical treatment.'
where name = 'Ashwagandha';

update public.lg_products set
  suggested_use = 'Take 1 capsule with a meal, up to 2 capsules per day, in 60-90 day cycles followed by a break.',
  warnings = 'Consult your doctor if you have a diagnosed liver condition. Food supplement — not a substitute for medical treatment.'
where name = 'Heenbovitiya';

update public.lg_products set
  suggested_use = 'Take 1 capsule with a meal, up to 2 capsules per day.',
  warnings = 'Consult your doctor if pregnant or taking blood-thinning or thyroid medication. Food supplement — not a substitute for medical treatment.'
where name = 'Moringa';

update public.lg_products set
  suggested_use = 'Take 1 capsule before a meal, up to 2 capsules per day.',
  warnings = 'Consult your doctor if taking any medication; avoid eating cassava while using this product. Food supplement — not a substitute for medical treatment.'
where name = 'Garcinia';

update public.lg_products set
  suggested_use = 'Take 1 capsule with a meal, up to 2 capsules per day, in 30-60 day cycles.',
  warnings = 'Consult your doctor if taking medication for blood sugar or thyroid. Food supplement — not a substitute for medical treatment.'
where name = 'Beli';

update public.lg_products set
  suggested_use = 'Take 1 capsule before your two largest meals of the day; an optional third capsule may be taken mid-afternoon.',
  warnings = 'If you take metformin, insulin, or other blood-sugar medication, speak with your doctor first — this product can amplify their effect and cause low blood sugar. Food supplement — not a substitute for prescribed treatment.'
where name = 'Gurmar (Masbedda)';

update public.lg_products set
  suggested_use = 'Take 1 capsule with a meal, up to 2 capsules per day.',
  warnings = 'Consult your doctor before use if taking medication. Food supplement — not a substitute for medical treatment.'
where name = 'Turmeric & Black Pepper';
