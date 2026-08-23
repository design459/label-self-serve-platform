"use client";

import { useState } from "react";
import Link from "next/link";
import { Theme } from "@/lib/types";
import { Summary, safeJson } from "./types";

interface Props {
  token: string;
  summary: Summary;
  theme: Theme;
  onSubmitted: () => void;
}

// Always renders the numbered "6. Submit" card, whatever state the order
// is in — it used to return null entirely before a proof existed (or once
// one had already been submitted-and-not-yet-changed), which left step 6
// with nothing on the page at all even though the sidebar still counted it
// as a step. Every state below gets its own explanation instead of the
// section just disappearing.
export default function SubmitForReview({ token, summary, theme, onSubmitted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { order } = summary;

  const latestIsSubmitted = summary.latestDesign?.isSubmitted ?? false;
  // Only "cleanly" waiting — nothing to do — when the submitted revision
  // still matches the customer's current edits. If they kept editing after
  // submitting, this falls through to the actionable branch below instead
  // of leaving them stuck looking at a passive "waiting" notice with no
  // way to fix it from here.
  const cleanlyWaiting = order.status === "submitted" && latestIsSubmitted && !summary.needsRegeneration;
  // Whether clicking the button below can actually bring the submission up
  // to date — false once the revision cap is hit, since there'd be nothing
  // left to regenerate with.
  const canAutoRegenerate = summary.needsRegeneration && order.revisionsUsed < order.revisionLimit;

  async function submit() {
    setBusy(true);
    setError(null);
    // Regenerating and submitting used to be two separate manual steps —
    // easy to submit a proof that no longer matched the latest edits
    // simply by forgetting the first one. Submitting now regenerates first
    // whenever needed (and possible), so "Submit" always means "review
    // what I'm currently looking at," not "review whatever I last
    // remembered to generate."
    if (canAutoRegenerate) {
      const genRes = await fetch(`/api/workspace/${token}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const genData = await safeJson(genRes);
      if (!genRes.ok) {
        setBusy(false);
        setError(genData?.error || "Couldn't regenerate artwork before submitting.");
        return;
      }
    }
    const res = await fetch(`/api/workspace/${token}/submit`, { method: "POST" });
    const data = await safeJson(res);
    setBusy(false);
    if (!res.ok) return setError(data?.error || "Couldn't submit for review.");
    onSubmitted();
  }

  return (
    <div className="card">
      <h2>6. Submit for compliance approval</h2>
      <p className="field-hint">A reviewer on our side will approve this or return it with reasons.</p>

      {cleanlyWaiting ? (
        <>
          <div className="notice-box" style={{ marginBottom: 16 }}>
            Submitted — waiting on compliance review. You can still regenerate if you spot something, which will need
            re-submitting.
          </div>
          <Link className="btn btn-outline" href="/">
            Back to home
          </Link>
        </>
      ) : !summary.latestDesign ? (
        <button className="btn" disabled title="Generate artwork above first">
          Submit for review
        </button>
      ) : (
        <>
          {summary.needsRegeneration && (
            <div className="notice-box" style={{ marginBottom: 16 }}>
              {canAutoRegenerate
                ? "You've made design changes since this proof was generated — submitting will first regenerate artwork (using one of your revisions) so what's reviewed matches your latest edits."
                : "You've made design changes since this proof was generated, but you're out of revisions to regenerate — what gets submitted will still be the last generated proof."}
            </div>
          )}
          {error && <div className="error-box">{error}</div>}
          <button className="btn" disabled={busy} onClick={submit}>
            {busy
              ? "Submitting…"
              : canAutoRegenerate
              ? "Regenerate & submit for review"
              : summary.hasSubmittedBefore
              ? "Re-submit for review"
              : "Submit for review"}
          </button>
        </>
      )}
    </div>
  );
}
