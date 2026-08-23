"use client";

import { useEffect, useMemo, useRef, useState, CSSProperties } from "react";
import { Rnd, HandleStyles } from "react-rnd";
import {
  BringToFront,
  SendToBack,
  Trash2,
  Copy,
  Type,
  Shapes,
  LayoutTemplate,
  ImagePlus,
  ImageUp,
  Minus,
  Plus,
  PaintBucket,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Lock,
  Unlock,
} from "lucide-react";
import { FONT_PRESETS, THEME_PRESETS } from "@/lib/types";
import { CanvasElement, IconId, isDeletable, backgroundCss } from "@/lib/canvasLayout";
import { Summary, ThemeEdits } from "./types";
import IconPicker from "./IconPicker";
import LayoutVariantPicker from "./LayoutVariantPicker";
import BackgroundPanel from "./BackgroundPanel";
import { ElementPreview } from "./LabelStagePreview";

// Fallback before the ResizeObserver below reports the real available
// width, and the floor/ceiling that width gets clamped between — the
// editor should fill the space between the side panels on a normal
// monitor without the label becoming absurdly huge on an ultrawide one.
const STAGE_MAX_WIDTH = 640;
const STAGE_MIN_WIDTH = 420;
const STAGE_MAX_WIDTH_CAP = 1100;

// Circular corner handles, shown only on the selected element — everything
// else about resizing (hit area, cursor) is re-resizable's default; this
// just overlays a visible blue dot on top of it, matching the reference
// editor's "selected object" state.
const HANDLE_BASE: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "#fff",
  border: "2px solid var(--select-blue)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
};
const SELECTED_HANDLE_STYLES: HandleStyles = {
  topLeft: { ...HANDLE_BASE, left: -5, top: -5 },
  topRight: { ...HANDLE_BASE, right: -5, top: -5 },
  bottomLeft: { ...HANDLE_BASE, left: -5, bottom: -5 },
  bottomRight: { ...HANDLE_BASE, right: -5, bottom: -5 },
};

interface ChangeOpts {
  // Hints to the undo/redo history in EditorPage.tsx: a coalescing change
  // (dragging a slider, typing in a text field) shouldn't create a new
  // undo step per keystroke/pixel — only discrete actions (drag stop, add,
  // delete, align, ...) should.
  coalesce?: boolean;
}

interface Props {
  token: string;
  summary: Summary;
  elements: CanvasElement[];
  onElementsChange: (els: CanvasElement[], opts?: ChangeOpts) => void;
  logoUrl: string | null;
  onLogoUploaded: () => void;
  selectedId: string | null;
  onSelectedIdChange: (id: string | null) => void;
  theme: ThemeEdits;
  onThemeChange: (patch: Partial<ThemeEdits>, opts?: ChangeOpts) => void;
}

function randomId(): string {
  return Math.random().toString(16).slice(2, 10);
}

type AlignMode = "left" | "centerH" | "right" | "top" | "centerV" | "bottom";

interface HeadingStylePreset {
  label: string;
  content: string;
  fontSize: number; // mm, same unit every other element's style.fontSize uses
  bold: boolean;
  previewPx: number; // purely for sizing the preview text in the rail panel
}

// mm sizes echo lib/canvasLayout.ts's own defaults (productName: 5mm,
// tagline: 2.4mm) so a "Heading 1" ends up roughly product-name-sized.
const HEADING_STYLE_PRESETS: HeadingStylePreset[] = [
  { label: "Heading 1", content: "Heading 1", fontSize: 6, bold: true, previewPx: 22 },
  { label: "Heading 2", content: "Heading 2", fontSize: 4.5, bold: true, previewPx: 18 },
  { label: "Heading 3", content: "Heading 3", fontSize: 3.2, bold: true, previewPx: 15 },
  { label: "Paragraph", content: "Paragraph text", fontSize: 2.2, bold: false, previewPx: 13 },
];

export default function CanvasEditor({
  token,
  summary,
  elements,
  onElementsChange,
  logoUrl,
  onLogoUploaded,
  selectedId,
  onSelectedIdChange,
  theme,
  onThemeChange,
}: Props) {
  const { order, regulatory, panel } = summary;
  const template = summary.templates.find((t) => t.id === order.selectedTemplateId) ?? summary.templates[0];
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"text" | "icons" | "templates" | "photo" | "background" | null>(null);
  const [zoom, setZoom] = useState(1);
  const [alignMenuOpen, setAlignMenuOpen] = useState(false);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const [effectsMenuOpen, setEffectsMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stageColRef = useRef<HTMLDivElement | null>(null);
  const [availableWidth, setAvailableWidth] = useState(STAGE_MAX_WIDTH);

  // The label used to be capped at a fixed 640px regardless of how much
  // room the editor actually had, leaving a lot of the workspace empty on
  // anything wider than a small laptop — this tracks the real available
  // width so the canvas fills that space instead (clamped so it neither
  // shrinks below a usable size nor balloons on an ultrawide monitor).
  useEffect(() => {
    const el = stageColRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setAvailableWidth(Math.min(STAGE_MAX_WIDTH_CAP, Math.max(STAGE_MIN_WIDTH, width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { widthMm, heightMm, scale, stageW, stageH } = useMemo(() => {
    if (!template) return { widthMm: 100, heightMm: 100, scale: 1, stageW: availableWidth, stageH: availableWidth };
    const wMm = template.trim_width_mm + template.bleed_mm * 2;
    const hMm = template.trim_height_mm + template.bleed_mm * 2;
    const s = availableWidth / wMm;
    return { widthMm: wMm, heightMm: hMm, scale: s, stageW: wMm * s, stageH: hMm * s };
  }, [template, availableWidth]);

  // stageW/stageH above are the 100%-zoom baseline (fit to STAGE_MAX_WIDTH);
  // everything that actually renders/measures the stage uses these zoomed
  // dimensions instead, so zooming just scales the whole layout uniformly —
  // element x/y/w/h stay percentages either way.
  const dispW = stageW * zoom;
  const dispH = stageH * zoom;
  const dispScale = scale * zoom;

  if (!template) return <p className="field-hint">Pick your label size first.</p>;

  function zoomBy(delta: number) {
    setZoom((z) => Math.round(Math.min(2, Math.max(0.4, z + delta)) * 100) / 100);
  }

  function updateElement(id: string, patch: Partial<CanvasElement>, coalesce = false) {
    onElementsChange(
      elements.map((el) => (el.id === id ? ({ ...el, ...patch } as CanvasElement) : el)),
      { coalesce }
    );
  }

  function bringToFront(id: string) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    onElementsChange([...elements.filter((e) => e.id !== id), el]);
    setLayersMenuOpen(false);
  }

  function sendToBack(id: string) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    onElementsChange([el, ...elements.filter((e) => e.id !== id)]);
    setLayersMenuOpen(false);
  }

  function deleteElement(id: string) {
    onElementsChange(elements.filter((e) => e.id !== id));
    onSelectedIdChange(null);
  }

  function toggleLock(id: string) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    updateElement(id, { locked: !el.locked } as Partial<CanvasElement>);
  }

  function duplicateElement(id: string) {
    const el = elements.find((e) => e.id === id);
    if (!el || !isDeletable(el)) return; // only freeform text/icon can be duplicated — bound types must stay exactly one each
    const copy: CanvasElement = { ...el, id: randomId(), x: Math.min(90, el.x + 4), y: Math.min(90, el.y + 4) };
    onElementsChange([...elements, copy]);
    onSelectedIdChange(copy.id);
  }

  function addText(preset?: HeadingStylePreset) {
    const el: CanvasElement = {
      id: randomId(),
      type: "text",
      x: 30,
      y: 40,
      w: 40,
      h: 12,
      content: preset?.content ?? "Your text here",
      style: { fontId: order.fontId, fontSize: preset?.fontSize ?? 3, color: "#1b2430", bold: preset?.bold },
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
    setAlignMenuOpen(false);
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

  function toggleTab(tab: "text" | "icons" | "templates" | "photo" | "background") {
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
        <button type="button" className={`editor-rail-tab ${activeTab === "background" ? "active" : ""}`} onClick={() => toggleTab("background")}>
          <PaintBucket size={20} />
          <span>Background</span>
        </button>
      </div>

      {activeTab && (
        <div className="editor-rail-panel">
          {activeTab === "text" && (
            <>
              <p className="wizard-section-label">Headings styles</p>
              <div className="heading-style-list">
                {HEADING_STYLE_PRESETS.map((preset) => (
                  <button type="button" key={preset.label} className="heading-style-row" onClick={() => addText(preset)}>
                    <span className="heading-style-row-marker" />
                    <span style={{ fontSize: preset.previewPx, fontWeight: preset.bold ? 700 : 400 }}>{preset.label}</span>
                  </button>
                ))}
              </div>
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
              <LayoutVariantPicker token={token} apply={false} onApplied={(els) => onElementsChange(els)} />
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
          {activeTab === "background" && (
            <>
              <p className="wizard-section-label">Background</p>
              <BackgroundPanel
                theme={theme}
                onChange={onThemeChange}
                brandColors={[
                  { label: "Primary", color: order.theme?.primaryColor ?? THEME_PRESETS[0].primaryColor },
                  { label: "Accent", color: order.theme?.accentColor ?? THEME_PRESETS[0].accentColor },
                ]}
                gradientPresets={THEME_PRESETS.map((p) => ({
                  angle: 45,
                  stops: [
                    { offset: 0, color: p.primaryColor },
                    { offset: 100, color: p.accentColor },
                  ],
                }))}
              />
            </>
          )}
        </div>
      )}

      <div className="canvas-stage-col" ref={stageColRef}>
        {selected && (
          <div className="canvas-toolbar" style={{ width: dispW }}>
            {selected.type === "photo" ? (
              <button type="button" className="icon-btn" title="Replace logo" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                <ImageUp size={16} />
              </button>
            ) : selected.type === "icon" ? (
              <input
                type="color"
                value={selected.color}
                title="Icon color"
                onChange={(e) => updateElement(selected.id, { color: e.target.value } as Partial<CanvasElement>, true)}
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

                <span className="toolbar-divider" />

                <div className="stepper">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Smaller"
                    onClick={() => updateElement(selected.id, { style: { ...selected.style, fontSize: Math.max(1.5, selected.style.fontSize - 0.5) } } as Partial<CanvasElement>)}
                  >
                    <Minus size={14} />
                  </button>
                  <span>{selected.style.fontSize}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Larger"
                    onClick={() => updateElement(selected.id, { style: { ...selected.style, fontSize: Math.min(12, selected.style.fontSize + 0.5) } } as Partial<CanvasElement>)}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <span className="toolbar-divider" />

                <input
                  type="color"
                  value={selected.style.color}
                  title="Text color"
                  onChange={(e) =>
                    updateElement(selected.id, { style: { ...selected.style, color: e.target.value } } as Partial<CanvasElement>, true)
                  }
                />
                {selected.type === "claims" && (
                  <input
                    type="color"
                    value={(selected as any).style.badgeColor}
                    title="Badge color"
                    onChange={(e) =>
                      updateElement(
                        selected.id,
                        { style: { ...(selected as any).style, badgeColor: e.target.value } } as Partial<CanvasElement>,
                        true
                      )
                    }
                  />
                )}

                <span className="toolbar-divider" />

                <button
                  type="button"
                  className={`icon-btn ${selected.style.bold ? "icon-btn-choice selected" : ""}`}
                  title="Bold"
                  onClick={() => updateElement(selected.id, { style: { ...selected.style, bold: !selected.style.bold } } as Partial<CanvasElement>)}
                >
                  <Bold size={14} />
                </button>
                <button
                  type="button"
                  className={`icon-btn ${selected.style.italic ? "icon-btn-choice selected" : ""}`}
                  title="Italic"
                  onClick={() => updateElement(selected.id, { style: { ...selected.style, italic: !selected.style.italic } } as Partial<CanvasElement>)}
                >
                  <Italic size={14} />
                </button>
                <button
                  type="button"
                  className={`icon-btn ${selected.style.underline ? "icon-btn-choice selected" : ""}`}
                  title="Underline"
                  onClick={() =>
                    updateElement(selected.id, { style: { ...selected.style, underline: !selected.style.underline } } as Partial<CanvasElement>)
                  }
                >
                  <Underline size={14} />
                </button>

                <span className="toolbar-divider" />

                <button
                  type="button"
                  className={`icon-btn ${(selected.style.textAlign ?? "left") === "left" ? "icon-btn-choice selected" : ""}`}
                  title="Align text left"
                  onClick={() => updateElement(selected.id, { style: { ...selected.style, textAlign: "left" } } as Partial<CanvasElement>)}
                >
                  <AlignLeft size={14} />
                </button>
                <button
                  type="button"
                  className={`icon-btn ${selected.style.textAlign === "center" ? "icon-btn-choice selected" : ""}`}
                  title="Align text center"
                  onClick={() => updateElement(selected.id, { style: { ...selected.style, textAlign: "center" } } as Partial<CanvasElement>)}
                >
                  <AlignCenter size={14} />
                </button>
                <button
                  type="button"
                  className={`icon-btn ${selected.style.textAlign === "right" ? "icon-btn-choice selected" : ""}`}
                  title="Align text right"
                  onClick={() => updateElement(selected.id, { style: { ...selected.style, textAlign: "right" } } as Partial<CanvasElement>)}
                >
                  <AlignRight size={14} />
                </button>

                <span className="toolbar-divider" />

                <div className="stepper" title="Line height">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Tighter line height"
                    onClick={() =>
                      updateElement(selected.id, {
                        style: { ...selected.style, lineHeight: Math.max(0.8, (selected.style.lineHeight ?? 1.35) - 0.1) },
                      } as Partial<CanvasElement>)
                    }
                  >
                    <Minus size={12} />
                  </button>
                  <span>{(selected.style.lineHeight ?? 1.35).toFixed(1)}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Looser line height"
                    onClick={() =>
                      updateElement(selected.id, {
                        style: { ...selected.style, lineHeight: Math.min(2.5, (selected.style.lineHeight ?? 1.35) + 0.1) },
                      } as Partial<CanvasElement>)
                    }
                  >
                    <Plus size={12} />
                  </button>
                </div>

                <div className="stepper" title="Letter spacing">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Tighter letter spacing"
                    onClick={() =>
                      updateElement(selected.id, {
                        style: { ...selected.style, letterSpacing: Math.max(-1, (selected.style.letterSpacing ?? 0) - 0.1) },
                      } as Partial<CanvasElement>)
                    }
                  >
                    <Minus size={12} />
                  </button>
                  <span>{(selected.style.letterSpacing ?? 0).toFixed(1)}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Wider letter spacing"
                    onClick={() =>
                      updateElement(selected.id, {
                        style: { ...selected.style, letterSpacing: Math.min(3, (selected.style.letterSpacing ?? 0) + 0.1) },
                      } as Partial<CanvasElement>)
                    }
                  >
                    <Plus size={12} />
                  </button>
                </div>

                <span className="toolbar-divider" />

                <button
                  type="button"
                  className={`icon-btn ${selected.style.listStyle === "bullet" ? "icon-btn-choice selected" : ""}`}
                  title="Bullet list"
                  onClick={() =>
                    updateElement(selected.id, {
                      style: { ...selected.style, listStyle: selected.style.listStyle === "bullet" ? "none" : "bullet" },
                    } as Partial<CanvasElement>)
                  }
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  className={`icon-btn ${selected.style.listStyle === "number" ? "icon-btn-choice selected" : ""}`}
                  title="Numbered list"
                  onClick={() =>
                    updateElement(selected.id, {
                      style: { ...selected.style, listStyle: selected.style.listStyle === "number" ? "none" : "number" },
                    } as Partial<CanvasElement>)
                  }
                >
                  <ListOrdered size={14} />
                </button>

                <span className="toolbar-divider" />

                <div className="canvas-toolbar-dropdown-wrap">
                  <button
                    type="button"
                    className="canvas-toolbar-text-btn"
                    onClick={() => {
                      setEffectsMenuOpen((o) => !o);
                      setAlignMenuOpen(false);
                      setLayersMenuOpen(false);
                    }}
                  >
                    Effects
                  </button>
                  {effectsMenuOpen && (
                    <div className="canvas-toolbar-dropdown">
                      {(["none", "shadow", "outline"] as const).map((effect) => (
                        <button
                          key={effect}
                          type="button"
                          className={`btn btn-outline ${(selected.style.textEffect ?? "none") === effect ? "canvas-toolbar-dropdown-item-active" : ""}`}
                          style={{ padding: "4px 10px", fontSize: 12, textTransform: "capitalize" }}
                          onClick={() => {
                            updateElement(selected.id, { style: { ...selected.style, textEffect: effect } } as Partial<CanvasElement>);
                            setEffectsMenuOpen(false);
                          }}
                        >
                          {effect}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            <span className="toolbar-divider" />

            <button
              type="button"
              className={`icon-btn ${selected.locked ? "icon-btn-choice selected" : ""}`}
              title={selected.locked ? "Unlock (allow drag/resize)" : "Lock (prevent drag/resize)"}
              onClick={() => toggleLock(selected.id)}
            >
              {selected.locked ? <Lock size={14} /> : <Unlock size={14} />}
            </button>

            <span className="toolbar-divider" />

            <div className="canvas-toolbar-dropdown-wrap">
              <button
                type="button"
                className="canvas-toolbar-text-btn"
                onClick={() => {
                  setAlignMenuOpen((o) => !o);
                  setLayersMenuOpen(false);
                }}
              >
                Align
              </button>
              {alignMenuOpen && (
                <div className="canvas-toolbar-dropdown">
                  <button type="button" className="icon-btn" title="Align left" onClick={() => alignElement(selected.id, "left")}>
                    <AlignHorizontalJustifyStart size={14} />
                  </button>
                  <button type="button" className="icon-btn" title="Align center" onClick={() => alignElement(selected.id, "centerH")}>
                    <AlignHorizontalJustifyCenter size={14} />
                  </button>
                  <button type="button" className="icon-btn" title="Align right" onClick={() => alignElement(selected.id, "right")}>
                    <AlignHorizontalJustifyEnd size={14} />
                  </button>
                  <button type="button" className="icon-btn" title="Align top" onClick={() => alignElement(selected.id, "top")}>
                    <AlignVerticalJustifyStart size={14} />
                  </button>
                  <button type="button" className="icon-btn" title="Align middle" onClick={() => alignElement(selected.id, "centerV")}>
                    <AlignVerticalJustifyCenter size={14} />
                  </button>
                  <button type="button" className="icon-btn" title="Align bottom" onClick={() => alignElement(selected.id, "bottom")}>
                    <AlignVerticalJustifyEnd size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="canvas-toolbar-dropdown-wrap">
              <button
                type="button"
                className="canvas-toolbar-text-btn"
                onClick={() => {
                  setLayersMenuOpen((o) => !o);
                  setAlignMenuOpen(false);
                }}
              >
                Layers
              </button>
              {layersMenuOpen && (
                <div className="canvas-toolbar-dropdown">
                  <button type="button" className="icon-btn" title="Bring to front" onClick={() => bringToFront(selected.id)}>
                    <BringToFront size={14} />
                  </button>
                  <button type="button" className="icon-btn" title="Send to back" onClick={() => sendToBack(selected.id)}>
                    <SendToBack size={14} />
                  </button>
                </div>
              )}
            </div>

            <span className="toolbar-divider" />
            <button
              type="button"
              className="icon-btn"
              title={isDeletable(selected) ? "Duplicate" : "Required label content can't be duplicated"}
              disabled={!isDeletable(selected)}
              onClick={() => duplicateElement(selected.id)}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn-danger"
              title={isDeletable(selected) ? "Delete" : "Required label content can't be deleted"}
              disabled={!isDeletable(selected)}
              onClick={() => deleteElement(selected.id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        <div
          className="canvas-stage"
          style={{ width: dispW, height: dispH, background: backgroundCss(theme) }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onSelectedIdChange(null);
          }}
        >
          {elements.map((el, i) => {
            const px = { x: (el.x / 100) * dispW, y: (el.y / 100) * dispH };
            const size = { width: (el.w / 100) * dispW, height: (el.h / 100) * dispH };
            return (
              <Rnd
                key={el.id}
                bounds="parent"
                size={size}
                position={px}
                style={{ zIndex: i, outline: selectedId === el.id ? "2px solid var(--select-blue)" : "1px dashed rgba(0,0,0,0.15)" }}
                resizeHandleStyles={selectedId === el.id ? SELECTED_HANDLE_STYLES : undefined}
                disableDragging={!!el.locked}
                enableResizing={!el.locked}
                onDragStop={(_e, d) => {
                  updateElement(el.id, { x: (d.x / dispW) * 100, y: (d.y / dispH) * 100 } as Partial<CanvasElement>);
                }}
                onResizeStop={(_e, _dir, ref, _delta, pos) => {
                  updateElement(el.id, {
                    w: (ref.offsetWidth / dispW) * 100,
                    h: (ref.offsetHeight / dispH) * 100,
                    x: (pos.x / dispW) * 100,
                    y: (pos.y / dispH) * 100,
                  } as Partial<CanvasElement>);
                }}
                onMouseDown={() => onSelectedIdChange(el.id)}
              >
                <ElementPreview el={el} scale={dispScale} summary={summary} logoUrl={logoUrl} />
              </Rnd>
            );
          })}
        </div>

        <div className="zoom-control">
          <button type="button" className="icon-btn" title="Zoom out" onClick={() => zoomBy(-0.1)} disabled={zoom <= 0.4}>
            <Minus size={14} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-btn" title="Zoom in" onClick={() => zoomBy(0.1)} disabled={zoom >= 2}>
            <Plus size={14} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
        />

        {selected && (selected.type === "text" || selected.type === "icon") && (
          <div className="card element-content-editor">
            {selected.type === "text" && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Text</label>
                <textarea
                  value={selected.content}
                  maxLength={300}
                  onChange={(e) => updateElement(selected.id, { content: e.target.value } as Partial<CanvasElement>, true)}
                />
              </div>
            )}
            {selected.type === "icon" && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Change icon</label>
                <IconPicker value={selected.iconId} onSelect={(id) => updateElement(selected.id, { iconId: id } as Partial<CanvasElement>)} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

