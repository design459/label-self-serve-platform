"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Undo2, Redo2 } from "lucide-react";
import { CanvasElement } from "@/lib/canvasLayout";
import { THEME_PRESETS } from "@/lib/types";
import { Summary, safeJson } from "./types";
import CanvasEditor from "./CanvasEditor";
import LayersPanel from "./LayersPanel";

interface Snapshot {
  elements: CanvasElement[];
  backgroundColor: string;
}

// How long a run of coalescing edits (typing, dragging a slider) stays
// merged into a single undo step before the next edit starts a fresh one —
// long enough that fast typing doesn't fragment into one step per
// keystroke, short enough that a deliberate pause reads as "done editing
// this thing."
const COALESCE_MS = 600;

// Full dedicated editor page (not a modal) — closer to how a real design
// tool devotes the whole window to editing. Reachable from "Edit label" in
// LabelPreview.tsx, returns to /workspace/[token] on Cancel/Save.
export default function EditorPage({ token }: { token: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [elements, setElementsRaw] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColorRaw] = useState(THEME_PRESETS[0].backgroundColor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Undo/redo history over {elements, backgroundColor} together, so
  // undoing a background change and undoing an element edit share one
  // timeline, matching how a single Ctrl+Z is expected to behave.
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const lastEditAtRef = useRef(0);

  function commit(patch: Partial<Snapshot>, coalesce: boolean) {
    const now = Date.now();
    if (!coalesce || now - lastEditAtRef.current >= COALESCE_MS) {
      setPast((p) => [...p, { elements, backgroundColor }]);
      setFuture([]);
    }
    lastEditAtRef.current = now;
    if (patch.elements !== undefined) setElementsRaw(patch.elements);
    if (patch.backgroundColor !== undefined) setBackgroundColorRaw(patch.backgroundColor);
  }

  function setElements(els: CanvasElement[], opts?: { coalesce?: boolean }) {
    commit({ elements: els }, opts?.coalesce ?? false);
  }

  function setBackgroundColor(color: string, opts?: { coalesce?: boolean }) {
    commit({ backgroundColor: color }, opts?.coalesce ?? false);
  }

  function undo() {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setFuture((f) => [{ elements, backgroundColor }, ...f]);
    setPast((p) => p.slice(0, -1));
    setElementsRaw(prev.elements);
    setBackgroundColorRaw(prev.backgroundColor);
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setPast((p) => [...p, { elements, backgroundColor }]);
    setFuture((f) => f.slice(1));
    setElementsRaw(next.elements);
    setBackgroundColorRaw(next.backgroundColor);
  }

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
      setElementsRaw((prev) => (prev.length === 0 ? data.elements : prev));
      if (data.order.theme?.backgroundColor) setBackgroundColorRaw(data.order.theme.backgroundColor);
      setPast([]);
      setFuture([]);
    } catch {
      setLoadError("Couldn't reach the server. Please try again shortly.");
    }
  }, [token]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Ctrl/Cmd+Z to undo, Ctrl/Cmd+Shift+Z or Ctrl+Y to redo — skipped while
  // focus is inside a text field so the browser's own native undo for
  // typed text still works there instead of fighting our history stack.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function refreshLogo() {
    const res = await fetch(`/api/workspace/${token}/summary?t=${Date.now()}`, { cache: "no-store" });
    const data = await safeJson(res);
    if (res.ok && data?.logoUrl) setLogoUrl(data.logoUrl);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const [layoutRes, bgRes] = await Promise.all([
      fetch(`/api/workspace/${token}/layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements }),
      }),
      fetch(`/api/workspace/${token}/marketing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backgroundColor }),
      }),
    ]);
    const layoutData = await safeJson(layoutRes);
    const bgData = await safeJson(bgRes);
    setBusy(false);
    if (!layoutRes.ok) return setError(layoutData?.error || "Couldn't save your design.");
    if (!bgRes.ok) return setError(bgData?.error || "Couldn't save the background color.");
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
        <span className="editor-topbar-history">
          <button type="button" className="icon-btn" title="Undo (Ctrl+Z)" onClick={undo} disabled={past.length === 0}>
            <Undo2 size={16} />
          </button>
          <button type="button" className="icon-btn" title="Redo (Ctrl+Y)" onClick={redo} disabled={future.length === 0}>
            <Redo2 size={16} />
          </button>
        </span>
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
            backgroundColor={backgroundColor}
            onBackgroundColorChange={setBackgroundColor}
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
