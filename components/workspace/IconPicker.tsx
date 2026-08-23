"use client";

import { useState } from "react";
import { ICON_ALLOWLIST, IconId } from "@/lib/canvasLayout";
import { ICON_COMPONENTS } from "./iconRegistry";

interface Props {
  value?: IconId;
  onSelect: (id: IconId) => void;
}

// A curated grid (48 icons), not a searchable browser over the full lucide
// library — the search box below only filters this fixed set by name.
export default function IconPicker({ value, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = q ? ICON_ALLOWLIST.filter((id) => id.replace("-", " ").includes(q)) : ICON_ALLOWLIST;

  return (
    <>
      <input
        type="text"
        placeholder="Search icons…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      {visible.length === 0 ? (
        <p className="field-hint">No icons match &quot;{query}&quot;.</p>
      ) : (
        <div className="template-grid icon-picker-grid">
          {visible.map((id) => {
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
      )}
    </>
  );
}
