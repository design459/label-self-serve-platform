"use client";

import { useState } from "react";
import { Summary, safeJson } from "./types";

interface Props {
  token: string;
  summary: Summary;
  onSubmitted: () => void;
}

export default function SubmitForReview({ token, summary, onSubmitted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { order } = summary;

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/workspace/${token}/submit`, { method: "POST" });
    const data = await safeJson(res);
    setBusy(false);
    if (!res.ok) return setError(data?.error || "Couldn't submit for review.");
    onSubmitted();
  }

  if (order.status === "submitted") {
    return (
      <div className="notice-box">
        Submitted — waiting on compliance review. You can still regenerate if you spot something, which will need
        re-submitting.
      </div>
    );
  }

  if (!summary.latestDesign || summary.latestDesign.isSubmitted) return null;

  return (
    <div className="card">
      <h2>8. Submit for compliance approval</h2>
      <p className="field-hint">A reviewer on our side will approve this or return it with reasons.</p>
      {error && <div className="error-box">{error}</div>}
      <button className="btn" disabled={busy} onClick={submit}>
        {busy ? "Submitting…" : "Submit for review"}
      </button>
    </div>
  );
}
