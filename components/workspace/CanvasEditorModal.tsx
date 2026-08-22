"use client";

import { useState } from "react";
import { CanvasElement } from "@/lib/canvasLayout";
import CanvasEditor from "./CanvasEditor";
import { Summary, safeJson } from "./types";

interface Props {
  token: string;
  summary: Summary;
  onClose: () => void;
  onSaved: () => void;
}

export default function CanvasEditorModal({ token, summary, onClose, onSaved }: Props) {
  const [elements, setElements] = useState<CanvasElement[]>(summary.elements);
  const [logoUrl, setLogoUrl] = useState(summary.logoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/workspace/${token}/layout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ elements }),
    });
    const data = await safeJson(res);
    setBusy(false);
    if (!res.ok) return setError(data?.error || "Couldn't save your design.");
    onSaved();
    onClose();
  }

  async function refreshLogo() {
    const res = await fetch(`/api/workspace/${token}/summary?t=${Date.now()}`, { cache: "no-store" });
    const data = await safeJson(res);
    if (res.ok && data?.logoUrl) setLogoUrl(data.logoUrl);
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel modal-panel-wide">
        <div className="modal-header">
          <h2 style={{ margin: 0 }}>Edit label</h2>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
        </div>
        {error && <div className="error-box">{error}</div>}
        <CanvasEditor
          token={token}
          summary={summary}
          elements={elements}
          onElementsChange={setElements}
          logoUrl={logoUrl}
          onLogoUploaded={refreshLogo}
        />
        <div className="btn-row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save & close"}
          </button>
        </div>
      </div>
    </div>
  );
}
