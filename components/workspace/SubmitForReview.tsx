"use client";

import { useState } from "react";
import Link from "next/link";
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

  // A design revision only counts as "under review" once it's been
  // explicitly submitted — regenerating a fresh proof after submission
  // creates a new, unsubmitted revision (staff keep seeing the last
  // submitted one, see app/admin/review/[id]/page.tsx) until the customer
  // submits it too. So the "waiting" notice only applies when the latest
  // revision IS the submitted one; otherwise there's a newer draft that
  // still needs to be submitted.
  const latestIsSubmitted = summary.latestDesign?.isSubmitted ?? false;

  if (order.status === "submitted" && latestIsSubmitted) {
    return (
      <div className="notice-box">
        {summary.needsRegeneration ? (
          <p style={{ margin: "0 0 12px" }}>
            You've made design changes since staff review started — this submission no longer reflects your latest
            edits. Regenerate artwork above and re-submit so what's under review matches what you see here.
          </p>
        ) : (
          <p style={{ margin: "0 0 12px" }}>
            Submitted — waiting on compliance review. You can still regenerate if you spot something, which will need
            re-submitting.
          </p>
        )}
        <Link className="btn btn-outline" href="/">
          Back to home
        </Link>
      </div>
    );
  }

  if (!summary.latestDesign || latestIsSubmitted) return null;

  return (
    <div className="card">
      <h2>6. Submit for compliance approval</h2>
      <p className="field-hint">A reviewer on our side will approve this or return it with reasons.</p>
      {summary.needsRegeneration && (
        <div className="notice-box" style={{ marginBottom: 16 }}>
          You've made design changes since this proof was generated — regenerate artwork above so what you submit
          matches your latest edits.
        </div>
      )}
      {error && <div className="error-box">{error}</div>}
      <button className="btn" disabled={busy} onClick={submit}>
        {busy ? "Submitting…" : summary.hasSubmittedBefore ? "Re-submit for review" : "Submit for review"}
      </button>
    </div>
  );
}
