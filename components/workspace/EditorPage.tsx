"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Undo2, Redo2 } from "lucide-react";
import { CanvasElement } from "@/lib/canvasLayout";
import { THEME_PRESETS } from "@/lib/types";
import { Summary, ThemeEdits, safeJson } from "./types";
import CanvasEditor from "./CanvasEditor";
import PagesPanel from "./PagesPanel";

interface Snapshot {
  pages: CanvasElement[][];
  theme: ThemeEdits;
}

const DEFAULT_THEME_EDITS: ThemeEdits = {
  backgroundColor: THEME_PRESETS[0].backgroundColor,
  backgroundType: "color",
  backgroundGradient: null,
  customColors: [],
};

// Matches lib/canvasLayout.ts's MAX_LABEL_PAGES — kept as a plain literal
// here rather than imported, since importing it would pull the whole
// (Node-crypto-dependent) canvasLayout module's non-type exports into the
// client bundle just for one constant.
const MAX_LABEL_PAGES = 6;

// How long a run of coalescing edits (typing, dragging a slider) stays
// merged into a single undo step before the next edit starts a fresh one —
// long enough that fast typing doesn't fragment into one step per
// keystroke, short enough that a deliberate pause reads as "done editing
// this thing."
const COALESCE_MS = 600;

function randomId(): string {
  return Math.random().toString(16).slice(2, 10);
}

// Full dedicated editor page (not a modal) — closer to how a real design
// tool devotes the whole window to editing. Reachable from "Edit label" in
// LabelPreview.tsx, returns to /workspace/[token] on Cancel/Save.
//
// A label order can have more than one page (e.g. front + back), all
// sharing the same product data/theme/font/template — `pages[0]` is always
// what used to be the order's single `elements` array; `pages[1:]` are the
// extra faces. `activePageIndex` says which page the canvas/toolbar/rail
// are currently editing; switching pages is not itself an undoable action.
export default function EditorPage({ token }: { token: string }) {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pages, setPagesRaw] = useState<CanvasElement[][]>([]);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [theme, setThemeRaw] = useState<ThemeEdits>(DEFAULT_THEME_EDITS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const elements = pages[activePageIndex] ?? [];

  // Undo/redo history over {pages, theme} together, so undoing a
  // background change and undoing an element edit (on any page) share one
  // timeline, matching how a single Ctrl+Z is expected to behave.
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const lastEditAtRef = useRef(0);

  function commit(patch: Partial<Snapshot>, coalesce: boolean) {
    const now = Date.now();
    if (!coalesce || now - lastEditAtRef.current >= COALESCE_MS) {
      setPast((p) => [...p, { pages, theme }]);
      setFuture([]);
    }
    lastEditAtRef.current = now;
    if (patch.pages !== undefined) setPagesRaw(patch.pages);
    if (patch.theme !== undefined) setThemeRaw(patch.theme);
  }

  function setElements(els: CanvasElement[], opts?: { coalesce?: boolean }) {
    commit({ pages: pages.map((p, i) => (i === activePageIndex ? els : p)) }, opts?.coalesce ?? false);
  }

  function setTheme(patch: Partial<ThemeEdits>, opts?: { coalesce?: boolean }) {
    commit({ theme: { ...theme, ...patch } }, opts?.coalesce ?? false);
  }

  function undo() {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setFuture((f) => [{ pages, theme }, ...f]);
    setPast((p) => p.slice(0, -1));
    setPagesRaw(prev.pages);
    setThemeRaw(prev.theme);
    setActivePageIndex((i) => Math.min(i, prev.pages.length - 1));
  }

  function redo() {
    if (future.length === 0) return;
    const next = future[0];
    setPast((p) => [...p, { pages, theme }]);
    setFuture((f) => f.slice(1));
    setPagesRaw(next.pages);
    setThemeRaw(next.theme);
    setActivePageIndex((i) => Math.min(i, next.pages.length - 1));
  }

  function goToPage(index: number) {
    if (index < 0 || index >= pages.length) return;
    setActivePageIndex(index);
    setSelectedId(null);
  }

  async function addPage() {
    if (pages.length >= MAX_LABEL_PAGES) return;
    setError(null);
    // A fresh default layout comes from the server (buildDefaultLayout()
    // uses Node's crypto for element ids, so it can't run client-side) —
    // apply:false means this is a pure compute, not an immediate save; it
    // joins the local draft like any other edit, persisted on Save & close.
    const res = await fetch(`/api/workspace/${token}/layout-variant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variant: "classic", apply: false }),
    });
    const data = await safeJson(res);
    if (!res.ok) return setError(data?.error || "Couldn't add a new page.");
    const nextPages = [...pages, data.elements as CanvasElement[]];
    commit({ pages: nextPages }, false);
    setActivePageIndex(nextPages.length - 1);
    setSelectedId(null);
  }

  function duplicatePage() {
    if (pages.length >= MAX_LABEL_PAGES) return;
    const copy = pages[activePageIndex].map((el) => ({ ...el, id: randomId() }));
    const nextPages = [...pages.slice(0, activePageIndex + 1), copy, ...pages.slice(activePageIndex + 1)];
    commit({ pages: nextPages }, false);
    setActivePageIndex(activePageIndex + 1);
    setSelectedId(null);
  }

  function deletePage() {
    if (pages.length <= 1) return;
    const nextPages = pages.filter((_, i) => i !== activePageIndex);
    commit({ pages: nextPages }, false);
    setActivePageIndex((i) => Math.min(i, nextPages.length - 1));
    setSelectedId(null);
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
      setPagesRaw((prev) => (prev.length === 0 ? [data.elements, ...(data.extraPages ?? [])] : prev));
      if (data.order.theme) {
        const t = data.order.theme;
        setThemeRaw({
          backgroundColor: t.backgroundColor ?? DEFAULT_THEME_EDITS.backgroundColor,
          backgroundType: t.backgroundType === "gradient" ? "gradient" : "color",
          backgroundGradient: t.backgroundGradient ?? null,
          customColors: Array.isArray(t.customColors) ? t.customColors : [],
        });
      }
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

  // After the canvas editor's own content editor retypes/clears a bound
  // text element (product name, tagline, claims, ingredients, description)
  // straight through to the marketing/regulatory routes — refetches
  // `summary` so the on-canvas preview picks up the new value immediately,
  // without touching pages/theme (those are this page's own live draft,
  // not server-derived).
  async function refreshSummary() {
    const res = await fetch(`/api/workspace/${token}/summary?t=${Date.now()}`, { cache: "no-store" });
    const data = await safeJson(res);
    if (res.ok) setSummary(data);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const [layoutRes, bgRes] = await Promise.all([
      fetch(`/api/workspace/${token}/layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements: pages[0] ?? [], extraPages: pages.slice(1) }),
      }),
      fetch(`/api/workspace/${token}/marketing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backgroundColor: theme.backgroundColor,
          backgroundType: theme.backgroundType,
          backgroundGradient: theme.backgroundGradient,
          customColors: theme.customColors,
        }),
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
            onContentSaved={refreshSummary}
            selectedId={selectedId}
            onSelectedIdChange={setSelectedId}
            theme={theme}
            onThemeChange={setTheme}
          />
        </div>
      </div>

      <PagesPanel
        pages={pages}
        summary={summary}
        logoUrl={logoUrl}
        activePageIndex={activePageIndex}
        maxPages={MAX_LABEL_PAGES}
        onGoTo={goToPage}
        onDuplicate={duplicatePage}
        onAdd={addPage}
        onDelete={deletePage}
      />
    </div>
  );
}
