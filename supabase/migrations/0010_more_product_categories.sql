-- Adds six more product categories to "Browse by Category": Sachet, Box,
-- Stick Pack, Dropper Bottle, and Spray Bottle (all Supplement Facts, same
-- panel as Capsule/Tablet and Powder), plus Tube (blank canvas — tubes are
-- most often topical/cosmetic, so no standard nutrition/supplement claims
-- apply by default).
--
-- Each reuses an EXISTING pack_format_templates entry for its physical
-- trim size (sachet/capsule_bottle/jar/pouch) rather than a shape-accurate
-- one of its own — a real "tube wrap" or "dropper bottle wrap" template
-- would need actual print dimensions, which nobody has supplied yet. This
-- gets the category/compliance-panel picker working now; swap
-- default_pack_format below (or add a new pack_format_templates row) later
-- if real dimensions come in.
--
-- IMPORTANT — run this as TWO SEPARATE statements, not pasted/run together:
-- Postgres cannot add an enum value and use it in the same transaction, and
-- the Supabase SQL Editor runs everything you paste as one transaction.
-- Run the first block, wait for it to say Success, THEN run the second.

-- ── Step 1 — run this first, on its own ──────────────────────────────────
alter type lg_product_category add value if not exists 'sachet';
alter type lg_product_category add value if not exists 'box';
alter type lg_product_category add value if not exists 'stick_pack';
alter type lg_product_category add value if not exists 'tube';
alter type lg_product_category add value if not exists 'dropper_bottle';
alter type lg_product_category add value if not exists 'spray_bottle';


-- ── Step 2 — run this after Step 1 succeeds ──────────────────────────────
insert into public.category_panel_templates (category, display_label, panel_style, default_pack_format, field_schema)
values
  ('sachet', 'Sachet', 'supplement_facts', 'sachet', '[
    {"key":"servingSize","label":"Serving Size (1 sachet)","type":"text"},
    {"key":"servingsPerContainer","label":"Servings Per Container","type":"text"},
    {"key":"calories","label":"Calories","type":"text"},
    {"key":"suggestedUse","label":"Suggested Use","type":"textarea"},
    {"key":"warnings","label":"Warnings","type":"textarea"}
  ]'::jsonb),
  ('box', 'Box', 'supplement_facts', 'jar', '[
    {"key":"servingSize","label":"Serving Size","type":"text"},
    {"key":"servingsPerContainer","label":"Servings Per Container","type":"text"},
    {"key":"calories","label":"Calories","type":"text"},
    {"key":"suggestedUse","label":"Suggested Use","type":"textarea"},
    {"key":"warnings","label":"Warnings","type":"textarea"}
  ]'::jsonb),
  ('stick_pack', 'Stick Pack', 'supplement_facts', 'sachet', '[
    {"key":"servingSize","label":"Serving Size (1 stick)","type":"text"},
    {"key":"servingsPerContainer","label":"Servings Per Container","type":"text"},
    {"key":"calories","label":"Calories","type":"text"},
    {"key":"suggestedUse","label":"Suggested Use","type":"textarea"},
    {"key":"warnings","label":"Warnings","type":"textarea"}
  ]'::jsonb),
  ('tube', 'Tube', 'blank', 'pouch', '[]'::jsonb),
  ('dropper_bottle', 'Dropper Bottle', 'supplement_facts', 'capsule_bottle', '[
    {"key":"servingSize","label":"Serving Size (drops)","type":"text"},
    {"key":"servingsPerContainer","label":"Servings Per Container","type":"text"},
    {"key":"suggestedUse","label":"Suggested Use","type":"textarea"},
    {"key":"warnings","label":"Warnings","type":"textarea"}
  ]'::jsonb),
  ('spray_bottle', 'Spray Bottle', 'supplement_facts', 'capsule_bottle', '[
    {"key":"servingSize","label":"Serving Size (sprays)","type":"text"},
    {"key":"servingsPerContainer","label":"Servings Per Container","type":"text"},
    {"key":"suggestedUse","label":"Suggested Use","type":"textarea"},
    {"key":"warnings","label":"Warnings","type":"textarea"}
  ]'::jsonb)
on conflict (category) do nothing;
