"use client";

import { useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import {
  BringToFront,
  SendToBack,
  Trash2,
  Type,
  Shapes,
  LayoutTemplate,
  ImagePlus,
  ImageUp,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
} from "lucide-react";
import { FONT_PRESETS } from "@/lib/types";
import { CanvasElement, IconId, isDeletable } from "@/lib/canvasLayout";
import { Summary } from "./types";
import IconPicker from "./IconPicker";
import LayoutVariantPicker from "./LayoutVariantPicker";
import { ElementPreview } from "./LabelStagePreview";

const STAGE_MAX_WIDTH = 640;

interface Props {
  token: string;
  summary: Summary;
  elements: CanvasElement[];
  onElementsChange: (els: CanvasElement[]) => void;
  logoUrl: string | null;
  onLogoUploaded: () => void;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
}

function randomId(): string {
  return Math.random().toString(16).slice(2, 10);
}

type AlignMode = "left" | "centerH" | "right" | "top" | "centerV" | "bottom";

export default function CanvasEditor({
  token,
  summary,
  elements,
  onElementsChange,
  logoUrl,
  onLogoUploaded,
  selectedId,
  onSelectedIdChange,
}: Props) {
  const { order, regulatory, panel } = summary;
  const template = summary.templates.find((t) => t.id === order.selectedTemplateId) ?? summary.templates[0];
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"text" | "icons" | "templates" | "photo" | null>(null);
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
    onSelectedIdChange(null);
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
    onSelectedIdChange(el.id);
  }

  function addIcon(iconId: IconId) {
    // Square box, sized the same way the photo box derives squareness from
    // the sheet's mm aspect ratio.
    const wPct = 12;
    const hPct = wPct * (widthMm / heightMm);
    const el: CanvasElement = { id: randomId(), type: "icon", x: 40, y: 40, w: wPct, h: hPct, iconId, color: "#1f4d38" };
    onElementsChange([...elements, el]);
    onSelectedIdChange(el.id);
  }

  function alignElement(id: string, mode: AlignMode) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    const patch: Partial<CanvasElement> =
      mode === "left"
        ? { x: 0 }
        : mode === "centerH"
        ? { x: 50 - el.w / 2 }
        : mode === "right"
        ? { x: 100 - el.w }
        : mode === "top"
        ? { y: 0 }
        : mode === "centerV"
        ? { y: 50 - el.h / 2 }
        : { y: 100 - el.h };
    updateElement(id, patch);
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

  function toggleTab(tab: "text" | "icons" | "templates" | "photo") {
    setActiveTab((cur) => (cur === tab ? null : tab));
  }

  return (
    <div className="canvas-workspace">
      <div className="editor-rail-tabs">
        <button type="button" className={`editor-rail-tab ${activeTab === "text" ? "active" : ""}`} onClick={() => toggleTab("text")}>
          <Type size={20} />
          <span>Text</span>
        </button>
        <button type="button" className={`editor-rail-tab ${activeTab === "icons" ? "active" : ""}`} onClick={() => toggleTab("icons")}>
          <Shapes size={20} />
          <span>Icons</span>
        </button>
        <button type="button" className={`editor-rail-tab ${activeTab === "templates" ? "active" : ""}`} onClick={() => toggleTab("templates")}>
          <LayoutTemplate size={20} />
          <span>Templates</span>
        </button>
        <button type="button" className={`editor-rail-tab ${activeTab === "photo" ? "active" : ""}`} onClick={() => toggleTab("photo")}>
          <ImagePlus size={20} />
          <span>Logo</span>
        </button>
      </div>

      {activeTab && (
        <div className="editor-rail-panel">
          {activeTab === "text" && (
            <>
              <p className="wizard-section-label">Text</p>
              <button type="button" className="btn btn-block" onClick={addText}>
                + Add a text box
              </button>
            </>
          )}
          {activeTab === "icons" && (
            <>
              <p className="wizard-section-label">Icons</p>
              <IconPicker onSelect={addIcon} />
            </>
          )}
          {activeTab === "templates" && (
            <>
              <p className="wizard-section-label">Templates</p>
              <LayoutVariantPicker token={token} onApplied={(els) => onElementsChange(els)} />
            </>
          )}
          {activeTab === "photo" && (
            <>
              <p className="wizard-section-label">Logo</p>
              <button type="button" className="btn btn-block" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload a logo"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="canvas-stage-col">
        <div
          className="canvas-stage"
          style={{ width: stageW, height: stageH }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onSelectedIdChange(null);
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
                onMouseDown={() => onSelectedIdChange(el.id)}
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
            {selected.type === "icon" && (
              <div className="field">
                <label>Icon</label>
                <IconPicker value={selected.iconId} onSelect={(id) => updateElement(selected.id, { iconId: id } as Partial<CanvasElement>)} />
              </div>
            )}
            <div className="btn-row" style={{ marginTop: 0, flexWrap: "wrap", alignItems: "center" }}>
              {selected.type === "photo" ? (
                <button type="button" className="icon-btn" title="Replace logo" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  <ImageUp size={18} />
                </button>
              ) : selected.type === "icon" ? (
                <input
                  type="color"
                  value={selected.color}
                  title="Icon color"
                  onChange={(e) => updateElement(selected.id, { color: e.target.value } as Partial<CanvasElement>)}
                />
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

              <span className="toolbar-divider" />

              <button type="button" className="icon-btn" title="Align left" onClick={() => alignElement(selected.id, "left")}>
                <AlignHorizontalJustifyStart size={16} />
              </button>
              <button type="button" className="icon-btn" title="Align center" onClick={() => alignElement(selected.id, "centerH")}>
                <AlignHorizontalJustifyCenter size={16} />
              </button>
              <button type="button" className="icon-btn" title="Align right" onClick={() => alignElement(selected.id, "right")}>
                <AlignHorizontalJustifyEnd size={16} />
              </button>
              <button type="button" className="icon-btn" title="Align top" onClick={() => alignElement(selected.id, "top")}>
                <AlignVerticalJustifyStart size={16} />
              </button>
              <button type="button" className="icon-btn" title="Align middle" onClick={() => alignElement(selected.id, "centerV")}>
                <AlignVerticalJustifyCenter size={16} />
              </button>
              <button type="button" className="icon-btn" title="Align bottom" onClick={() => alignElement(selected.id, "bottom")}>
                <AlignVerticalJustifyEnd size={16} />
              </button>

              <span className="toolbar-divider" />

              <button type="button" className="icon-btn" title="Bring to front" onClick={() => bringToFront(selected.id)}>
                <BringToFront size={16} />
              </button>
              <button type="button" className="icon-btn" title="Send to back" onClick={() => sendToBack(selected.id)}>
                <SendToBack size={16} />
              </button>
              {isDeletable(selected) && (
                <button type="button" className="icon-btn icon-btn-danger" title="Delete" onClick={() => deleteElement(selected.id)}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

