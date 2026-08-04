"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReviewActions({ orderId, disabled }: { orderId: string; disabled: boolean }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision === "approved" ? "approve" : "reject");
    setError(null);
    const res = await fetch(`/api/admin/review/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reason }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) {
      setError(data.error || "Failed to record decision.");
      return;
    }
    router.refresh();
  }

  if (disabled) return null;

  return (
    <div className="card">
      <h2>Decision</h2>
      {error && <div className="error-box">{error}</div>}
      <div className="field">
        <label>Reason (required to reject, optional otherwise)</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. missing allergen statement" />
      </div>
      <div className="btn-row">
        <button className="btn" disabled={busy !== null} onClick={() => decide("approved")}>
          {busy === "approve" ? "Approving…" : "Approve — print-ready"}
        </button>
        <button className="btn btn-danger" disabled={busy !== null} onClick={() => decide("rejected")}>
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </div>
  );
}
