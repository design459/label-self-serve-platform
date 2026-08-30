"use client";

import { useEffect, useState } from "react";
import { CanvasElement, LABEL_TEMPLATES, LabelTemplate } from "@/lib/canvasLayout";
import { Summary, safeJson } from "./types";
import LabelStagePreview from "./LabelStagePreview";

interface Props {
  token: string;
  summary: Summary;
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
// color (see lib/canvasLayout.ts's LABEL_TEMPLATES). Each card previews
// the customer's OWN real product data (name, ingredients, uploaded photo,
// ...) arranged in that template — not a stock mockup or an abstract
// placeholder sketch — fetched once from layout-variant/preview/route.ts.
// Distinct from LAYOUT_VARIANTS (which this also applies under the hood):
// a template additionally sets the order's font and theme colors.
export default function LayoutVariantPicker({ token, summary, onApplied, onThemeChange, apply: applyImmediately = true }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, CanvasElement[]>>({});

  useEffect(() => {
    fetch(`/api/workspace/${token}/layout-variant/preview`)
      .then((res) => (res.ok ? res.json() : { templates: {} }))
      .then((data) => setPreviews(data.templates ?? {}))
      .catch(() => setPreviews({}));
  }, [token]);

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
        {LABEL_TEMPLATES.map((t) => (
          <button
            type="button"
            key={t.id}
            className={`template-gallery-card ${busy === t.id ? "busy" : ""}`}
            disabled={busy !== null}
            onClick={() => apply(t)}
          >
            <div className="template-thumb" style={{ background: t.backgroundColor }}>
              {previews[t.id] ? (
                <LabelStagePreview
                  summary={summary}
                  elements={previews[t.id]}
                  logoUrl={summary.logoUrl}
                  imageUrls={summary.imageUrls}
                  maxWidth={100}
                />
              ) : (
                <div className="template-thumb-loading" />
              )}
            </div>
            <p className="template-gallery-name">{busy === t.id ? "Applying…" : t.name}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
