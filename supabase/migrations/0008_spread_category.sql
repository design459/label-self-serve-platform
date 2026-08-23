-- Adds a "Spread" product category (jars of things like fruit spreads,
-- nut butters, chocolate spreads, ...) with a wide jar-wrap layout of its
-- own — see buildSpreadLayout() in lib/canvasLayout.ts.
--
-- IMPORTANT — run this as TWO SEPARATE statements, not pasted/run together:
-- Postgres cannot add an enum value and use it in the same transaction, and
-- the Supabase SQL Editor runs everything you paste as one transaction.
-- Run the first block, wait for it to say Success, THEN run the second.

-- ── Step 1 — run this first, on its own ──────────────────────────────────
alter type lg_product_category add value if not exists 'spread';


-- ── Step 2 — run this after Step 1 succeeds ──────────────────────────────
-- howToEnjoy / storageInstructions are real fields the customer fills in
-- themselves (same as every other field_schema entry) — nothing here is
-- generated or invented, just two more real-content textareas alongside
-- the standard Nutrition Facts fields.
insert into public.category_panel_templates (category, display_label, panel_style, default_pack_format, field_schema)
values (
  'spread',
  'Spread',
  'nutrition_facts',
  'jar',
  '[
    {"key":"servingSize","label":"Serving Size","type":"text"},
    {"key":"servingsPerContainer","label":"Servings Per Container","type":"text"},
    {"key":"calories","label":"Calories","type":"text"},
    {"key":"totalFat","label":"Total Fat","type":"text"},
    {"key":"totalCarb","label":"Total Carbohydrate","type":"text"},
    {"key":"totalSugars","label":"Total Sugars","type":"text"},
    {"key":"protein","label":"Protein","type":"text"},
    {"key":"howToEnjoy","label":"How to Enjoy It","type":"textarea"},
    {"key":"storageInstructions","label":"Storage","type":"textarea"}
  ]'::jsonb
)
on conflict (category) do nothing;
