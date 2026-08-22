"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { THEME_PRESETS, Theme } from "@/lib/types";
import { Summary, safeJson } from "./types";
import LayoutVariantPicker from "./LayoutVariantPicker";

interface Props {
  token: string;
  summary: Summary;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onGenerated: () => void;
}

export default function LabelPreview({ token, summary, theme, onThemeChange, onGenerated }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const { order } = summary;
  const capReached = order.revisionsUsed >= order.revisionLimit;
  const hasCustomLayout = summary.canvasLayout !== null;

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/workspace/${token}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    });
    const data = await safeJson(res);
    setBusy(false);
    if (!res.ok) return setError(data?.error || "Couldn't generate a proof.");
    onGenerated();
  }

  return (
    <div className="card">
      <h2>5. Design your label</h2>
      <p className="field-hint" style={{ marginTop: -8, marginBottom: 16 }}>
        Drag, resize, and restyle anything — your photo, brand name, tagline, and the regulatory panel too. Nothing
        prints until staff review it.
      </p>
      <div className="field">
        <label>Label background</label>
        <div className="palette-row">
          {THEME_PRESETS.map((preset, i) => (
            <div
              key={i}
              className={`swatch ${theme.backgroundColor === preset.backgroundColor ? "selected" : ""}`}
              style={{ background: preset.backgroundColor, boxShadow: "inset 0 0 0 1px var(--line)" }}
              onClick={() => onThemeChange(preset)}
              title={preset.backgroundColor}
            />
          ))}
        </div>
      </div>

      {!hasCustomLayout || showVariantPicker ? (
        <LayoutVariantPicker
          token={token}
          onApplied={() => {
            setShowVariantPicker(false);
            onGenerated();
          }}
        />
      ) : (
        <p className="field-hint">
          <button
            type="button"
            className="btn btn-outline"
            style={{ padding: "4px 10px", fontSize: 12 }}
            onClick={() => {
              if (window.confirm("This replaces your current design with a fresh starting layout — continue?")) {
                setShowVariantPicker(true);
              }
            }}
          >
            Reset to a starting layout…
          </button>
        </p>
      )}

      <div className="revision-meter">
        Revisions used: <strong>{order.revisionsUsed} / {order.revisionLimit}</strong>
        {capReached && " — cap reached, no more regenerations on this label."}
      </div>
      {error && <div className="error-box">{error}</div>}
      <div className="btn-row" style={{ marginTop: 0 }}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => router.push(`/workspace/${token}/edit`)}
          disabled={!order.selectedTemplateId}
        >
          Edit label
        </button>
        <button className="btn" disabled={busy || capReached || !order.selectedTemplateId} onClick={generate}>
          {busy ? "Generating…" : "Generate artwork"}
        </button>
      </div>
      {summary.proofUrl && (
        <div style={{ marginTop: 16 }}>
          <div className="watermark-banner">PROOF — NOT APPROVED FOR PRINT</div>
          <iframe
            src={summary.proofUrl}
            title="Label proof"
            style={{ width: "100%", height: 500, border: "1px solid var(--line)", borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );
}
