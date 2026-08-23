"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Copy, Plus, Trash2, PanelRightClose, PanelRightOpen } from "lucide-react";
import { CanvasElement } from "@/lib/canvasLayout";
import { Summary } from "./types";
import LabelStagePreview from "./LabelStagePreview";

interface Props {
  pages: CanvasElement[][];
  summary: Summary;
  logoUrl: string | null;
  activePageIndex: number;
  maxPages: number;
  onGoTo: (index: number) => void;
  onDuplicate: () => void;
  onAdd: () => void;
  onDelete: () => void;
}

// Always-visible right-hand page navigator, matching the reference design
// tool's page panel — a page is a separate label face (front/back, ...)
// within the same order, not a separate document; see EditorPage.tsx for
// how the "current page" is threaded through the rest of the editor. The
// thumbnails are live renders (LabelStagePreview, the same component used
// for the customer's free workspace-page preview), not static icons — they
// stay in sync with whatever's currently in the local draft.
export default function PagesPanel({ pages, summary, logoUrl, activePageIndex, maxPages, onGoTo, onDuplicate, onAdd, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {!collapsed && (
        <div className="pages-thumbs">
          {pages.map((pageElements, i) => (
            <div key={i} className="pages-thumb-row" onClick={() => onGoTo(i)}>
              <span className="pages-thumb-index">{i + 1}</span>
              <div className={`pages-thumb-card ${i === activePageIndex ? "selected" : ""}`}>
                <LabelStagePreview summary={summary} elements={pageElements} logoUrl={logoUrl} imageUrls={summary.imageUrls} maxWidth={120} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pages-panel">
        <button type="button" className="icon-btn" title={collapsed ? "Show pages" : "Hide pages"} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
        </button>

        {!collapsed && (
          <>
            <div className="pages-stepper">
              <button
                type="button"
                className="icon-btn"
                title="Previous page"
                disabled={activePageIndex === 0}
                onClick={() => onGoTo(activePageIndex - 1)}
              >
                <ChevronUp size={14} />
              </button>
              <div className="pages-stepper-count">{activePageIndex + 1}</div>
              <span className="pages-stepper-of">of {pages.length}</span>
              <button
                type="button"
                className="icon-btn"
                title="Next page"
                disabled={activePageIndex === pages.length - 1}
                onClick={() => onGoTo(activePageIndex + 1)}
              >
                <ChevronDown size={14} />
              </button>
            </div>

            <span className="pages-panel-divider" />

            <button type="button" className="icon-btn" title="Duplicate page" disabled={pages.length >= maxPages} onClick={onDuplicate}>
              <Copy size={16} />
            </button>
            <button type="button" className="icon-btn" title="Add page" disabled={pages.length >= maxPages} onClick={onAdd}>
              <Plus size={16} />
            </button>
            <button type="button" className="icon-btn icon-btn-danger" title="Delete page" disabled={pages.length <= 1} onClick={onDelete}>
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </>
  );
}
