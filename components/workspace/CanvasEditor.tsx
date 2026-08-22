"use client";

import { useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { FONT_PRESETS } from "@/lib/types";
import { CanvasElement, isDeletable } from "@/lib/canvasLayout";
import { Summary, safeJson } from "./types";

const STAGE_MAX_WIDTH = 640;

interface Props {
  token: string;
  summary: Summary;
  elements: CanvasElement[];
  onElementsChange: (els: CanvasElement[]) => void;
  logoUrl: string | null;
  onLogoUploaded: () => void;
}

function randomId(): string {
  return Math.random().toString(16).slice(2, 10);
}

export default function CanvasEditor({ token, summary, elements, onElementsChange, logoUrl, onLogoUploaded }: Props) {
  const { order, regulatory, panel } = summary;
  const template = summary.templates.find((t) => t.id === order.selectedTemplateId) ?? summary.templates[0];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { widthMm, heightMm, scale, stageW, stageH } = useMemo(() => {
    if (!template) return { widthMm: 100, heightMm: 100, scale: 1, stageW: STAGE_MAX_WIDTH, stageH: STAGE_MAX_WIDTH };
    const wMm = template.trim_width_mm + template.bleed_mm * 2;
    const hMm = template.trim_height_mm + template.bleed_mm * 2;
    const s = STAGE_MAX_WIDTH / wMm;
    return { widthMm: wMm, heightMm: hMm, scale: s, stageW: wMm * s, stageH: hMm * s };
  }, [template]);

  if (!template) return <p className="field-hint">Pick your label size first.</p>;

  function updateElement(id: string, patch: Partial<CanvasElement>) {
    onElementsChange(elements.map((el) => (el.id === id ? ({ ...el, ...patch } as CanvasElement) : el)));
  }

  function bringToFront(id: string) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    onElementsChange([...elements.filter((e) => e.id !== id), el]);
  }

  function sendToBack(id: string) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    onElementsChange([el, ...elements.filter((e) => e.id !== id)]);
  }

  function deleteElement(id: string) {
    onElementsChange(elements.filter((e) => e.id !== id));
    setSelectedId(null);
  }

  function addText() {
    const el: CanvasElement = {
      id: randomId(),
      type: "text",
      x: 30,
      y: 40,
      w: 40,
      h: 12,
      content: "Your text here",
      style: { fontId: order.fontId, fontSize: 3, color: "#1b2430" },
    };
    onElementsChange([...elements, el]);
    setSelectedId(el.id);
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("logo", file);
    const res = await fetch(`/api/workspace/${token}/logo`, { method: "POST", body: form });
    setUploading(false);
    if (res.ok) onLogoUploaded();
  }

  const selected = elements.find((e) => e.id === selectedId) ?? null;

  return (
    <div>
      <div className="canvas-toolbar">
        <button type="button" className="btn btn-outline" onClick={addText}>
          + Add text
        </button>
      </div>

      <div
        className="canvas-stage"
        style={{ width: stageW, height: stageH }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedId(null);
        }}
      >
        {elements.map((el, i) => {
          const px = { x: (el.x / 100) * stageW, y: (el.y / 100) * stageH };
          const size = { width: (el.w / 100) * stageW, height: (el.h / 100) * stageH };
          return (
            <Rnd
              key={el.id}
              bounds="parent"
              size={size}
              position={px}
              style={{ zIndex: i, outline: selectedId === el.id ? "2px solid var(--accent)" : "1px dashed rgba(0,0,0,0.15)" }}
              onDragStop={(_e, d) => {
                updateElement(el.id, { x: (d.x / stageW) * 100, y: (d.y / stageH) * 100 } as Partial<CanvasElement>);
              }}
              onResizeStop={(_e, _dir, ref, _delta, pos) => {
                updateElement(el.id, {
                  w: (ref.offsetWidth / stageW) * 100,
                  h: (ref.offsetHeight / stageH) * 100,
                  x: (pos.x / stageW) * 100,
                  y: (pos.y / stageH) * 100,
                } as Partial<CanvasElement>);
              }}
              onMouseDown={() => setSelectedId(el.id)}
            >
              <ElementPreview el={el} scale={scale} summary={summary} logoUrl={logoUrl} />
            </Rnd>
          );
        })}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        style={{ display: "none" }}
        onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
      />

      {selected && (
        <div className="card element-toolbar">
          {selected.type === "text" && (
            <div className="field">
              <label>Text</label>
              <textarea
                value={selected.content}
                maxLength={300}
                onChange={(e) => updateElement(selected.id, { content: e.target.value } as Partial<CanvasElement>)}
              />
            </div>
          )}
          <div className="btn-row" style={{ marginTop: 0, flexWrap: "wrap" }}>
            {selected.type === "photo" ? (
              <button type="button" className="btn btn-outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? "Uploading…" : "Replace photo"}
              </button>
            ) : (
              <>
                <select
                  value={selected.style.fontId}
                  onChange={(e) => updateElement(selected.id, { style: { ...selected.style, fontId: e.target.value } } as Partial<CanvasElement>)}
                >
                  {FONT_PRESETS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  Size
                  <input
                    type="range"
                    min={1.5}
                    max={12}
                    step={0.5}
                    value={selected.style.fontSize}
                    onChange={(e) =>
                      updateElement(selected.id, { style: { ...selected.style, fontSize: Number(e.target.value) } } as Partial<CanvasElement>)
                    }
                  />
                </label>
                <input
                  type="color"
                  value={selected.style.color}
                  title="Text color"
                  onChange={(e) => updateElement(selected.id, { style: { ...selected.style, color: e.target.value } } as Partial<CanvasElement>)}
                />
                {selected.type === "claims" && (
                  <input
                    type="color"
                    value={(selected as any).style.badgeColor}
                    title="Badge color"
                    onChange={(e) =>
                      updateElement(selected.id, { style: { ...(selected as any).style, badgeColor: e.target.value } } as Partial<CanvasElement>)
                    }
                  />
                )}
              </>
            )}
            <button type="button" className="btn btn-outline" onClick={() => bringToFront(selected.id)}>
              Bring to front
            </button>
            <button type="button" className="btn btn-outline" onClick={() => sendToBack(selected.id)}>
              Send to back
            </button>
            {isDeletable(selected) && (
              <button type="button" className="btn btn-danger" onClick={() => deleteElement(selected.id)}>
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ElementPreview({ el, scale, summary, logoUrl }: { el: CanvasElement; scale: number; summary: Summary; logoUrl: string | null }) {
  const { order, regulatory, panel } = summary;
  const family = (fontId: string, kind: "heading" | "body") => (FONT_PRESETS.find((f) => f.id === fontId) ?? FONT_PRESETS[0])[kind];
  const px = (mm: number) => Math.max(8, mm * scale * 2.2); // approximate on-screen text size

  switch (el.type) {
    case "photo":
      return (
        <div style={{ width: "100%", height: "100%", background: "#f1efe8", borderRadius: 4, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: `${el.imagePosition.x}% ${el.imagePosition.y}%`,
                transform: `scale(${el.imagePosition.scale})`,
              }}
            />
          ) : (
            <span className="field-hint">Photo</span>
          )}
        </div>
      );
    case "productName":
      return (
        <p style={{ margin: 0, fontFamily: family(el.style.fontId, "heading"), fontWeight: 700, fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden" }}>
          {order.displayName || order.productName || "Product Name"}
        </p>
      );
    case "tagline":
      return (
        <p style={{ margin: 0, fontFamily: family(el.style.fontId, "body"), fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden" }}>
          {order.marketingTagline || ""}
        </p>
      );
    case "claims":
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, overflow: "hidden" }}>
          {(regulatory?.claims || "")
            .split(",")
            .filter((c) => c.trim())
            .map((c, i) => (
              <span
                key={i}
                style={{
                  fontFamily: family(el.style.fontId, "body"),
                  fontSize: px(el.style.fontSize) * 0.8,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: (el as any).style.badgeColor,
                  color: el.style.color,
                }}
              >
                {c.trim()}
              </span>
            ))}
        </div>
      );
    case "ingredients":
      return (
        <div style={{ fontFamily: family(el.style.fontId, "body"), fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden", lineHeight: 1.3 }}>
          <p style={{ margin: 0, fontFamily: family(el.style.fontId, "heading"), fontWeight: 700 }}>Ingredients</p>
          <p style={{ margin: 0 }}>{regulatory?.ingredients || "—"}</p>
        </div>
      );
    case "statutoryMarks":
      return (
        <div style={{ fontFamily: family(el.style.fontId, "body"), fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden", lineHeight: 1.3 }}>
          <p style={{ margin: 0, fontFamily: family(el.style.fontId, "heading"), fontWeight: 700 }}>Statutory marks</p>
          <p style={{ margin: 0 }}>{regulatory?.statutory_marks || "—"}</p>
        </div>
      );
    case "nutritionPanel": {
      const heading = panel?.panel_style === "supplement_facts" ? "Supplement Facts" : panel?.panel_style === "nutrition_facts" ? "Nutrition Facts" : "";
      return (
        <div style={{ fontFamily: family(el.style.fontId, "body"), fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden", lineHeight: 1.3 }}>
          {heading && <p style={{ margin: 0, fontFamily: family(el.style.fontId, "heading"), fontWeight: 700 }}>{heading}</p>}
          {(panel?.field_schema ?? []).map((f) => {
            const v = regulatory?.nutrition_panel?.[f.key];
            if (!v) return null;
            return (
              <div key={f.key} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e2e5ea" }}>
                <span>{f.label}</span>
                <span>{v}</span>
              </div>
            );
          })}
        </div>
      );
    }
    case "footer":
      return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: family(el.style.fontId, "body"), fontSize: px(el.style.fontSize) * 0.85, color: el.style.color, overflow: "hidden", borderTop: "1px solid #e2e5ea", paddingTop: 2 }}>
          <div>
            Batch: {regulatory?.batch_code || "—"} SKU: {order.skuCode}
          </div>
        </div>
      );
    case "text":
      return (
        <div style={{ fontFamily: family(el.style.fontId, "body"), fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden", whiteSpace: "pre-wrap" }}>
          {el.content}
        </div>
      );
    default:
      return null;
  }
}
