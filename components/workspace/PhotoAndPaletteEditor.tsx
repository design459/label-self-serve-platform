"use client";

import { useState } from "react";
import { Summary, safeJson } from "./types";

interface Props {
  token: string;
  summary: Summary;
  locked: boolean;
  onSaved: () => void;
}

// Pan/zoom, color, and font are now per-element concerns handled inside the
// canvas editor (components/workspace/CanvasEditor.tsx) — this component
// only handles the one thing that isn't an on-canvas property: uploading
// the source photo file itself.
export default function PhotoAndPaletteEditor({ token, summary, locked, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadLogo(file: File) {
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("logo", file);
    const res = await fetch(`/api/workspace/${token}/logo`, { method: "POST", body: form });
    const data = await safeJson(res);
    setBusy(false);
    if (!res.ok) return setError(data?.error || "Couldn't upload that logo.");
    onSaved();
  }

  return (
    <div className="card">
      <h2>2. Upload company logo</h2>
      {error && <div className="error-box">{error}</div>}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        disabled={locked || busy}
        onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
      />
      {summary.hasLogo && (
        <p className="field-hint">Logo uploaded ✓ — choose a file again to replace it, or drag/resize/reposition it directly on the canvas below.</p>
      )}
    </div>
  );
}
