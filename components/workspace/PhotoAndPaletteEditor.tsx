"use client";

import { useState } from "react";
import { FONT_PRESETS, ImagePosition, THEME_PRESETS, Theme } from "@/lib/types";
import { Summary, safeJson } from "./types";

interface Props {
  token: string;
  summary: Summary;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  locked: boolean;
  onSaved: () => void;
}

export default function PhotoAndPaletteEditor({ token, summary, theme, onThemeChange, locked, onSaved }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { order } = summary;

  async function selectTemplate(id: string) {
    setBusy("template");
    setError(null);
    const res = await fetch(`/api/workspace/${token}/template`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: id }),
    });
    const data = await safeJson(res);
    setBusy(null);
    if (!res.ok) return setError(data?.error || "Couldn't select that template.");
    onSaved();
  }

  async function uploadLogo(file: File) {
    setBusy("logo");
    setError(null);
    const form = new FormData();
    form.append("logo", file);
    const res = await fetch(`/api/workspace/${token}/logo`, { method: "POST", body: form });
    const data = await safeJson(res);
    setBusy(null);
    if (!res.ok) return setError(data?.error || "Couldn't upload that photo.");
    onSaved();
  }

  async function saveImagePosition(next: ImagePosition) {
    const res = await fetch(`/api/workspace/${token}/marketing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePosition: next }),
    });
    if (res.ok) onSaved();
  }

  async function saveFont(fontId: string) {
    const res = await fetch(`/api/workspace/${token}/marketing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fontId }),
    });
    if (res.ok) onSaved();
  }

  return (
    <>
      <div className="card">
        <h2>1. Pick a template</h2>
        {error && <div className="error-box">{error}</div>}
        <div className="template-grid">
          {summary.templates.map((t) => (
            <div
              key={t.id}
              className={`template-card ${order.selectedTemplateId === t.id ? "selected" : ""}`}
              onClick={() => !locked && busy === null && selectTemplate(t.id)}
            >
              <strong>{t.name}</strong>
              <p className="field-hint">
                {t.trim_width_mm}mm × {t.trim_height_mm}mm trim
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>2. Your product photo</h2>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          disabled={locked}
          onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
        />
        {summary.hasLogo && <p className="field-hint">Photo uploaded ✓ — choose a file again to replace it.</p>}
        {summary.hasLogo && (
          <div style={{ marginTop: 16, maxWidth: 320 }}>
            <div className="range-field">
              <label>
                <span>Horizontal position</span>
                <span>{order.imagePosition.x}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                disabled={locked}
                value={order.imagePosition.x}
                onChange={(e) => saveImagePosition({ ...order.imagePosition, x: Number(e.target.value) })}
              />
            </div>
            <div className="range-field">
              <label>
                <span>Vertical position</span>
                <span>{order.imagePosition.y}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                disabled={locked}
                value={order.imagePosition.y}
                onChange={(e) => saveImagePosition({ ...order.imagePosition, y: Number(e.target.value) })}
              />
            </div>
            <div className="range-field">
              <label>
                <span>Zoom</span>
                <span>{order.imagePosition.scale.toFixed(1)}×</span>
              </label>
              <input
                type="range"
                min={1}
                max={2}
                step={0.1}
                disabled={locked}
                value={order.imagePosition.scale}
                onChange={(e) => saveImagePosition({ ...order.imagePosition, scale: Number(e.target.value) })}
              />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h2>3. Choose a color palette</h2>
        <div className="palette-row">
          {THEME_PRESETS.map((preset, i) => (
            <div
              key={i}
              className={`swatch ${theme.primaryColor === preset.primaryColor ? "selected" : ""}`}
              style={{ background: preset.primaryColor }}
              onClick={() => !locked && onThemeChange(preset)}
              title={preset.primaryColor}
            />
          ))}
        </div>
      </div>

      <div className="card">
        <h2>4. Choose a font pairing</h2>
        <div className="palette-row">
          {FONT_PRESETS.map((f) => (
            <div
              key={f.id}
              className={`font-chip ${order.fontId === f.id ? "selected" : ""}`}
              onClick={() => !locked && saveFont(f.id)}
              style={{ fontFamily: f.heading }}
            >
              {f.label}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
