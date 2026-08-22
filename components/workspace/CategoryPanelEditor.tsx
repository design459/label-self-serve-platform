"use client";

import { useEffect, useState } from "react";
import { CATEGORY_LABELS } from "@/lib/types";
import { Summary, safeJson } from "./types";

interface Props {
  token: string;
  summary: Summary;
  locked: boolean;
  onSaved: () => void;
}

export default function CategoryPanelEditor({ token, summary, locked, onSaved }: Props) {
  const reg = summary.regulatory;
  const panel = summary.panel;

  const [ingredients, setIngredients] = useState(reg?.ingredients ?? "");
  const [claims, setClaims] = useState(reg?.claims ?? "");
  const [statutoryMarks, setStatutoryMarks] = useState(reg?.statutory_marks ?? "");
  const [batchCode, setBatchCode] = useState(reg?.batch_code ?? "");
  const [manufactureDate, setManufactureDate] = useState(reg?.manufacture_date ?? "");
  const [expiryDate, setExpiryDate] = useState(reg?.expiry_date ?? "");
  const [nutrition, setNutrition] = useState<Record<string, string>>((reg?.nutrition_panel as Record<string, string>) ?? {});

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setIngredients(reg?.ingredients ?? "");
    setClaims(reg?.claims ?? "");
    setStatutoryMarks(reg?.statutory_marks ?? "");
    setBatchCode(reg?.batch_code ?? "");
    setManufactureDate(reg?.manufacture_date ?? "");
    setExpiryDate(reg?.expiry_date ?? "");
    setNutrition((reg?.nutrition_panel as Record<string, string>) ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reg]);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/workspace/${token}/regulatory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredients,
        claims,
        statutoryMarks,
        batchCode,
        manufactureDate,
        expiryDate,
        nutritionPanel: nutrition,
      }),
    });
    const data = await safeJson(res);
    setBusy(false);
    if (!res.ok) return setError(data?.error || "Couldn't save regulatory content.");
    setSaved(true);
    onSaved();
  }

  return (
    <div className="card">
      <h2>6. Regulatory details — {CATEGORY_LABELS[summary.order.category]}</h2>
      <p className="field-hint" style={{ marginTop: -8, marginBottom: 16 }}>
        Exact text only — this is what appears on the compliance-checked label. Never invented for you.
      </p>
      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>Ingredients</label>
        <textarea value={ingredients} disabled={locked} onChange={(e) => setIngredients(e.target.value)} />
      </div>
      <div className="field">
        <label>Claims (comma-separated)</label>
        <input type="text" placeholder="Non-GMO, Gluten Free, Vegan" value={claims} disabled={locked} onChange={(e) => setClaims(e.target.value)} />
      </div>
      <div className="field">
        <label>Statutory marks</label>
        <textarea value={statutoryMarks} disabled={locked} onChange={(e) => setStatutoryMarks(e.target.value)} />
      </div>

      {panel && panel.panel_style !== "blank" && panel.field_schema.length > 0 && (
        <>
          <p className="wizard-section-label" style={{ marginTop: 24 }}>
            {panel.panel_style === "supplement_facts" ? "Supplement Facts" : "Nutrition Facts"}
          </p>
          {panel.field_schema.map((f) =>
            f.type === "textarea" ? (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                <textarea
                  value={nutrition[f.key] ?? ""}
                  disabled={locked}
                  onChange={(e) => setNutrition((n) => ({ ...n, [f.key]: e.target.value }))}
                />
              </div>
            ) : (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                <input
                  type="text"
                  value={nutrition[f.key] ?? ""}
                  disabled={locked}
                  onChange={(e) => setNutrition((n) => ({ ...n, [f.key]: e.target.value }))}
                />
              </div>
            )
          )}
        </>
      )}

      <div className="wizard-grid-2">
        <div className="field">
          <label>Batch code</label>
          <input type="text" value={batchCode} disabled={locked} onChange={(e) => setBatchCode(e.target.value)} />
        </div>
        <div />
        <div className="field">
          <label>Manufacture date</label>
          <input type="date" value={manufactureDate} disabled={locked} onChange={(e) => setManufactureDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Expiry date</label>
          <input type="date" value={expiryDate} disabled={locked} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
      </div>

      <button className="btn" type="button" disabled={busy || locked} onClick={save}>
        {busy ? "Saving…" : saved ? "Saved ✓" : "Save regulatory details"}
      </button>
    </div>
  );
}
