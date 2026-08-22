"use client";

import { useState } from "react";
import { Summary, safeJson } from "./types";

interface Props {
  token: string;
  summary: Summary;
  locked: boolean;
  onSaved: () => void;
}

// "Select sheets" = pick your label size/format, Canva-style — reuses the
// same pack_format_templates rows the app has always used, just presented
// as the first step instead of a mid-form card grid.
export default function SheetPicker({ token, summary, locked, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { order } = summary;

  async function selectTemplate(id: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/workspace/${token}/template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: id }),
    });
    const data = await safeJson(res);
    setBusy(false);
    if (!res.ok) return setError(data?.error || "Couldn't select that label size.");
    onSaved();
  }

  return (
    <div className="card">
      <h2>1. Choose your label size</h2>
      {error && <div className="error-box">{error}</div>}
      <div className="template-grid">
        {summary.templates.map((t) => (
          <div
            key={t.id}
            className={`template-card ${order.selectedTemplateId === t.id ? "selected" : ""}`}
            onClick={() => !locked && !busy && selectTemplate(t.id)}
          >
            <strong>{t.name}</strong>
            <p className="field-hint">
              {t.trim_width_mm}mm × {t.trim_height_mm}mm trim
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
