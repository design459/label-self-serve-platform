"use client";

import { useState } from "react";
import { CanvasElement, LAYOUT_VARIANTS, LayoutVariant } from "@/lib/canvasLayout";
import { safeJson } from "./types";

interface Props {
  token: string;
  onApplied: (elements: CanvasElement[]) => void;
}

// A small "template gallery" — a few hand-designed starting arrangements,
// not an external gallery. Text label + one-line description only, no live
// thumbnail — same pattern SheetPicker/category cards already use.
export default function LayoutVariantPicker({ token, onApplied }: Props) {
  const [busy, setBusy] = useState<LayoutVariant | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function apply(variant: LayoutVariant) {
    setBusy(variant);
    setError(null);
    const res = await fetch(`/api/workspace/${token}/layout-variant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant }),
    });
    const data = await safeJson(res);
    setBusy(null);
    if (!res.ok) return setError(data?.error || "Couldn't apply that starting layout.");
    onApplied(data.elements);
  }

  return (
    <div className="field">
      <label>Pick a starting layout</label>
      {error && <div className="error-box">{error}</div>}
      <div className="template-grid">
        {LAYOUT_VARIANTS.map((v) => (
          <div key={v.id} className="template-card" onClick={() => busy === null && apply(v.id)}>
            <strong>{busy === v.id ? "Applying…" : v.label}</strong>
            <p className="field-hint">{v.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
