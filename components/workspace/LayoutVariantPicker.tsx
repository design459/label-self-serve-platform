"use client";

import { useState } from "react";
import { CanvasElement, LABEL_TEMPLATES, LabelTemplate } from "@/lib/canvasLayout";
import { ProductCategory } from "@/lib/types";
import { safeJson } from "./types";

interface Props {
  token: string;
  category: ProductCategory;
  onApplied: (elements: CanvasElement[]) => void;
  // Only meaningful when apply is false (the full-page editor's Templates
  // tab) — background color is customer-editable there, so a picked
  // template's background gets synced into that live draft too. The
  // apply:true caller (LabelPreview.tsx) doesn't need this: the server
  // already persisted the full theme, and it reloads the whole summary.
  onThemeChange?: (patch: { backgroundColor: string; backgroundType: "color"; backgroundGradient: null }) => void;
  // false when the caller manages its own draft/save (the full-page
  // editor's per-page Templates tab) — true (default) immediately
  // overwrites the order's page-1 canvas_layout, for the pre-customization
  // "pick a starting layout" prompt on the main workspace page.
  apply?: boolean;
}

// A visual "template" gallery — real combinations of layout, font, and
// color (see lib/canvasLayout.ts's LABEL_TEMPLATES). Each card shows a
// static, photorealistic reference photo for that style, in the order's
// own real product shape (a capsule bottle, a dropper bottle, ...) — not
// this order's own real data, and not mixed with other categories' shapes.
// A live render of every bound field crammed into a picker-sized thumbnail
// read as illegible clutter rather than a label; the real per-order text
// still renders correctly the moment a template is applied and the actual
// editor canvas takes over. Distinct from LAYOUT_VARIANTS (which this also
// applies under the hood): a template additionally sets the order's font
// and theme colors.
export default function LayoutVariantPicker({ token, category, onApplied, onThemeChange, apply: applyImmediately = true }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "other" has no defined product shape, and a category with no matching
  // template (shouldn't happen for the 11 defined ones, but a future new
  // category would otherwise show nothing) both fall back to the full list
  // rather than an empty gallery.
  const categoryTemplates = LABEL_TEMPLATES.filter((t) => t.category === category);
  const templates = categoryTemplates.length > 0 ? categoryTemplates : LABEL_TEMPLATES;

  async function apply(t: LabelTemplate) {
    setBusy(t.id);
    setError(null);
    const res = await fetch(`/api/workspace/${token}/layout-variant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: t.id, apply: applyImmediately }),
    });
    const data = await safeJson(res);
    setBusy(null);
    if (!res.ok) return setError(data?.error || "Couldn't apply that template.");
    onApplied(data.elements);
    if (onThemeChange && data.backgroundColor) {
      onThemeChange({ backgroundColor: data.backgroundColor, backgroundType: "color", backgroundGradient: null });
    }
  }

  return (
    <div className="field">
      <label>Pick a starting template</label>
      {error && <div className="error-box">{error}</div>}
      <div className="template-gallery">
        {templates.map((t) => (
          <button
            type="button"
            key={t.id}
            className={`template-gallery-card ${busy === t.id ? "busy" : ""}`}
            disabled={busy !== null}
            onClick={() => apply(t)}
          >
            <div className="template-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element -- fixed local asset, no next/image config needed */}
              <img src={t.previewImage} alt="" loading="lazy" />
            </div>
            <p className="template-gallery-name">{busy === t.id ? "Applying…" : t.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
