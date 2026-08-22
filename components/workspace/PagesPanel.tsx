"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Copy, Plus, Trash2, PanelRightClose, PanelRightOpen } from "lucide-react";

interface Props {
  pageCount: number;
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
// how the "current page" is threaded through the rest of the editor.
export default function PagesPanel({ pageCount, activePageIndex, maxPages, onGoTo, onDuplicate, onAdd, onDelete }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
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
            <span className="pages-stepper-of">of {pageCount}</span>
            <button
              type="button"
              className="icon-btn"
              title="Next page"
              disabled={activePageIndex === pageCount - 1}
              onClick={() => onGoTo(activePageIndex + 1)}
            >
              <ChevronDown size={14} />
            </button>
          </div>

          <span className="pages-panel-divider" />

          <button type="button" className="icon-btn" title="Duplicate page" disabled={pageCount >= maxPages} onClick={onDuplicate}>
            <Copy size={16} />
          </button>
          <button type="button" className="icon-btn" title="Add page" disabled={pageCount >= maxPages} onClick={onAdd}>
            <Plus size={16} />
          </button>
          <button type="button" className="icon-btn icon-btn-danger" title="Delete page" disabled={pageCount <= 1} onClick={onDelete}>
            <Trash2 size={16} />
          </button>
        </>
      )}
    </div>
  );
}
