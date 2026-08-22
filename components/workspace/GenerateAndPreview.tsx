"use client";

import { useState } from "react";
import { Theme } from "@/lib/types";
import { Summary, safeJson } from "./types";

interface Props {
  token: string;
  summary: Summary;
  theme: Theme;
  onGenerated: () => void;
}

export default function GenerateAndPreview({ token, summary, theme, onGenerated }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { order } = summary;
  const capReached = order.revisionsUsed >= order.revisionLimit;

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
      <h2>7. Generate</h2>
      <div className="revision-meter">
        Revisions used: <strong>{order.revisionsUsed} / {order.revisionLimit}</strong>
        {capReached && " — cap reached, no more regenerations on this label."}
      </div>
      {error && <div className="error-box">{error}</div>}
      <button className="btn" disabled={busy || capReached || !order.selectedTemplateId} onClick={generate}>
        {busy ? "Generating…" : "Generate artwork"}
      </button>
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
