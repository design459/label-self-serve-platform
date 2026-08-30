"use client";

import { useState } from "react";

export default function QaReview({ orderId }: { orderId: string }) {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch(`/api/admin/review/${orderId}/compliance-check`, { method: "POST" });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(data?.error || "QA check failed.");
    setResult(data.result);
  }

  return (
    <div className="card">
      <h2>Quality Assurance (QA) Review</h2>
      <p className="field-hint" style={{ marginTop: -8, marginBottom: 16 }}>
        Checks this label's actual content against the regulation document(s) uploaded in the Management Dashboard
        and lists anything that needs to change. Advisory only — it doesn't record a decision.
      </p>
      {error && <div className="error-box">{error}</div>}
      <button type="button" className="btn btn-outline" disabled={busy} onClick={runCheck}>
        {busy ? "Checking…" : result ? "Run QA check again" : "Run QA check"}
      </button>
      {result && (
        <div className="notice-box" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
          {result}
        </div>
      )}
    </div>
  );
}
