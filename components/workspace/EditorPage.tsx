"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CanvasElement } from "@/lib/canvasLayout";
import { Summary, safeJson } from "./types";
import CanvasEditor from "./CanvasEditor";
import LayersPanel from "./LayersPanel";

// Full dedicated editor page (not a modal) — closer to how a real design
// tool devotes the whole window to editing. Reachable from "Edit label" in
// LabelPreview.tsx, returns to /workspace/[token] on Cancel/Save.
export default function EditorPage({ token }: { token: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspace/${token}/summary?t=${Date.now()}`, { cache: "no-store" });
      const data = await safeJson(res);
      if (!res.ok) {
        setLoadError(data?.error || "This link is invalid or has expired.");
        return;
      }
      setLoadError(null);
      setSummary(data);
      setLogoUrl(data.logoUrl);
      setElements((prev) => (prev.length === 0 ? data.elements : prev));
    } catch {
      setLoadError("Couldn't reach the server. Please try again shortly.");
    }
  }, [token]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refreshLogo() {
    const res = await fetch(`/api/workspace/${token}/summary?t=${Date.now()}`, { cache: "no-store" });
    const data = await safeJson(res);
    if (res.ok && data?.logoUrl) setLogoUrl(data.logoUrl);
  }

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
    router.push(`/workspace/${token}`);
  }

  function cancel() {
    router.push(`/workspace/${token}`);
  }

  if (loadError) {
    return (
      <div className="page-narrow">
        <div className="error-box">{loadError}</div>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="page-narrow">
        <p>Loading your label…</p>
      </div>
    );
  }
  if (summary.order.status === "approved") {
    return (
      <div className="page-narrow">
        <div className="notice-box">This label is already approved and locked — it can no longer be edited.</div>
        <button type="button" className="btn" onClick={cancel}>
          Back to workspace
        </button>
      </div>
    );
  }

  return (
    <div className="editor-page">
      <div className="editor-topbar">
        <button type="button" className="icon-btn" title="Back to workspace" onClick={cancel}>
          <ArrowLeft size={18} />
        </button>
        <span className="editor-topbar-title">{summary.order.displayName || summary.order.productName || summary.order.skuCode}</span>
        <div className="btn-row" style={{ margin: 0 }}>
          <button type="button" className="btn btn-outline" onClick={cancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save & close"}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-box" style={{ margin: "0 20px" }}>
          {error}
        </div>
      )}

      <div className="editor-body">
        <div className="canvas-workspace-outer">
          <CanvasEditor
            token={token}
            summary={summary}
            elements={elements}
            onElementsChange={setElements}
            logoUrl={logoUrl}
            onLogoUploaded={refreshLogo}
            selectedId={selectedId}
            onSelectedIdChange={setSelectedId}
          />
          <LayersPanel
            elements={elements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onReorder={setElements}
            onDelete={(id) => {
              setElements(elements.filter((e) => e.id !== id));
              setSelectedId(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
