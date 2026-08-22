"use client";

import { ICON_ALLOWLIST, IconId } from "@/lib/canvasLayout";
import { ICON_COMPONENTS } from "./iconRegistry";

interface Props {
  value?: IconId;
  onSelect: (id: IconId) => void;
}

// A small curated grid, not a searchable browser over the full icon
// library — matches how SheetPicker/category cards already work without
// live previews or search.
export default function IconPicker({ value, onSelect }: Props) {
  return (
    <div className="template-grid icon-picker-grid">
      {ICON_ALLOWLIST.map((id) => {
        const Icon = ICON_COMPONENTS[id];
        return (
          <button
            key={id}
            type="button"
            className={`icon-btn icon-btn-choice ${value === id ? "selected" : ""}`}
            title={id}
            onClick={() => onSelect(id)}
          >
            <Icon size={20} />
          </button>
        );
      })}
    </div>
  );
}
