"use client";

import { useEffect, useState } from "react";
import { Summary, safeJson } from "./types";

interface Props {
  token: string;
  summary: Summary;
  locked: boolean;
  onSaved: () => void;
}

export default function MarketingCopyEditor({ token, summary, locked, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(summary.order.displayName ?? summary.order.productName);
  const [tagline, setTagline] = useState(summary.order.marketingTagline ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(summary.order.displayName ?? summary.order.productName);
    setTagline(summary.order.marketingTagline ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.order.displayName, summary.order.marketingTagline]);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/workspace/${token}/marketing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, marketingTagline: tagline }),
    });
    const data = await safeJson(res);
    setBusy(false);
    if (!res.ok) return setError(data?.error || "Couldn't save your marketing copy.");
    setSaved(true);
    onSaved();
  }

  return (
    <div className="card">
      <h2>5. Marketing copy</h2>
      <p className="field-hint" style={{ marginTop: -8, marginBottom: 16 }}>
        This is the wording shown on your label — brand name and a short tagline. Freely editable.
      </p>
      {error && <div className="error-box">{error}</div>}
      <div className="field">
        <label>Product name shown on the label</label>
        <input type="text" value={displayName} disabled={locked} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div className="field">
        <label>Tagline (optional)</label>
        <input type="text" placeholder="e.g. Pure. Natural. Sri Lankan." value={tagline} disabled={locked} onChange={(e) => setTagline(e.target.value)} />
      </div>
      <button className="btn" type="button" disabled={busy || locked} onClick={save}>
        {busy ? "Saving…" : saved ? "Saved ✓" : "Save marketing copy"}
      </button>
    </div>
  );
}
