-- Multi-page labels: an order can now have more than one label face (e.g.
-- front + back), all sharing the same product data/theme/font/template.
-- "Page 1" stays exactly what it always was (label_orders.canvas_layout /
-- label_designs.render_input) — everything here is purely additive so
-- existing single-page orders are completely unaffected.

alter table public.label_orders add column if not exists extra_pages jsonb;
comment on column public.label_orders.extra_pages is
  'Array of CanvasElement[] for pages 2+ (page 1 is canvas_layout). NULL or empty = single-page order.';

alter table public.label_designs add column if not exists proof_storage_paths jsonb;
comment on column public.label_designs.proof_storage_paths is
  'Array of proof PNG storage paths, one per page in page order. proof_storage_path mirrors paths[0] for backward compatibility with code that only knows about a single proof.';

alter table public.label_designs add column if not exists extra_pages_elements jsonb;
comment on column public.label_designs.extra_pages_elements is
  'Array of CanvasElement[] for pages 2+ as of this revision (mirrors label_orders.extra_pages at generate time). Combined with render_input''s shared template/theme/font/regulatory/logo fields to reconstruct each extra page''s full ArtboardInput when building the multi-page print PDF on approval.';
