-- Freeform canvas layout: replaces fixed zone-based placement with a
-- customer-editable ordered list of positioned/sized/styled elements.
-- Applied by hand via the Supabase Dashboard SQL Editor to the same
-- shared MULTI-X project as 0001-0003 (see those files' headers for why).
--
-- NULL means "customer has not customized their layout yet" --
-- lib/canvasLayout.ts's buildDefaultLayout() computes a sensible default
-- from pack_format_templates.zone_layout + category_panel_templates at
-- read/generate time, so existing orders need zero backfill.

alter table public.label_orders
  add column if not exists canvas_layout jsonb;

comment on column public.label_orders.canvas_layout is
  'Ordered array of CanvasElement (lib/canvasLayout.ts). Array order = z-order (later = on top). NULL = not customized yet, falls back to buildDefaultLayout().';
