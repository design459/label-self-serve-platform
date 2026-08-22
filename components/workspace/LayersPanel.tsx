"use client";

import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { CanvasElement, describeElement, isDeletable } from "@/lib/canvasLayout";

interface Props {
  elements: CanvasElement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (next: CanvasElement[]) => void;
  onDelete: (id: string) => void;
}

// Front-most element (last in the array — array order IS z-order) is
// listed first, matching how a design tool's layers list usually reads
// top-to-bottom = front-to-back.
export default function LayersPanel({ elements, selectedId, onSelect, onReorder, onDelete }: Props) {
  function moveForward(id: string) {
    const idx = elements.findIndex((e) => e.id === id);
    if (idx < 0 || idx >= elements.length - 1) return;
    const next = [...elements];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onReorder(next);
  }

  function moveBackward(id: string) {
    const idx = elements.findIndex((e) => e.id === id);
    if (idx <= 0) return;
    const next = [...elements];
    [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
    onReorder(next);
  }

  const reversed = [...elements].map((el, i) => ({ el, i })).reverse();

  return (
    <div className="layers-panel">
      <p className="wizard-section-label" style={{ marginBottom: 10 }}>
        Layers
      </p>
      {reversed.map(({ el, i }) => (
        <div key={el.id} className={`layer-row ${selectedId === el.id ? "selected" : ""}`} onClick={() => onSelect(el.id)}>
          <span className="layer-row-label">{describeElement(el)}</span>
          <span className="layer-row-actions">
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              title="Move forward"
              disabled={i === elements.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                moveForward(el.id);
              }}
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-sm"
              title="Move backward"
              disabled={i === 0}
              onClick={(e) => {
                e.stopPropagation();
                moveBackward(el.id);
              }}
            >
              <ChevronDown size={14} />
            </button>
            {isDeletable(el) && (
              <button
                type="button"
                className="icon-btn icon-btn-sm icon-btn-danger"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(el.id);
                }}
              >
                <Trash2 size={14} />
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
