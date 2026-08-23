"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Theme } from "@/lib/types";
import { Summary, safeJson } from "./types";
import LayoutVariantPicker from "./LayoutVariantPicker";
import LabelStagePreview from "./LabelStagePreview";

interface Props {
  token: string;
  summary: Summary;
  theme: Theme;
  onGenerated: () => void;
}

export default function LabelPreview({ token, summary, theme, onGenerated }: Props) {
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
      {order.selectedTemplateId && (
        <div className="field">
          <label>{summary.pageCount > 1 ? `Current design (${summary.pageCount} pages)` : "Current design"}</label>
          <p className="field-hint" style={{ marginTop: 0 }}>
            Always up to date with your saved edits — free to check anytime, doesn't use a revision.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[summary.elements, ...summary.extraPages].map((pageElements, i) => (
              <div key={i}>
                {summary.pageCount > 1 && (
                  <p className="field-hint" style={{ margin: "0 0 4px" }}>
                    Page {i + 1} of {summary.pageCount}
                  </p>
                )}
                <LabelStagePreview summary={summary} elements={pageElements} logoUrl={summary.logoUrl} imageUrls={summary.imageUrls} maxWidth={480} />
              </div>
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
}
