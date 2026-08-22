"use client";

import { useRef, useState } from "react";
import { X, Ban, Plus, Trash2 } from "lucide-react";
import { HEX, BackgroundGradient, GradientStop } from "@/lib/canvasLayout";
import { ThemeEdits } from "./types";

interface ChangeOpts {
  coalesce?: boolean;
}

interface Props {
  theme: ThemeEdits;
  onChange: (patch: Partial<ThemeEdits>, opts?: ChangeOpts) => void;
  brandColors: { label: string; color: string }[];
  gradientPresets: BackgroundGradient[];
  onClose: () => void;
}

const MAX_CUSTOM_COLORS = 12;
const MAX_STOPS = 6;

function hexToRgb(hex: string) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return { r: 255, g: 255, b: 255 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s: s * 100, v: max * 100 };
}

function hsvToHex(h: number, s: number, v: number) {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function gradientCss(g: BackgroundGradient): string {
  const stops = [...g.stops]
    .sort((a, b) => a.offset - b.offset)
    .map((s) => `${s.color} ${s.offset}%`)
    .join(", ");
  return `linear-gradient(90deg, ${stops})`;
}

function defaultGradient(seed: string): BackgroundGradient {
  return { angle: 45, stops: [{ offset: 0, color: seed }, { offset: 100, color: "#ffffff" }] };
}

// A right-docked panel matching the reference design tool's "Edit
// background" panel: Color/Gradient modes, a project-colors row the
// customer can add to, the order's own brand colors, a self-contained
// hue/saturation-value picker for solid colors, and a real angle+stops
// gradient editor. The "Pattern" tab is shown but disabled — this app's
// background is always a solid color or a linear gradient end to end
// (lib/artboard.ts), so a pattern-fill tab would have nothing behind it.
export default function BackgroundPanel({ theme, onChange, brandColors, gradientPresets, onClose }: Props) {
  const [selectedStop, setSelectedStop] = useState(0);
  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const gradientBarRef = useRef<HTMLDivElement | null>(null);

  const isGradient = theme.backgroundType === "gradient";
  const gradient = theme.backgroundGradient ?? defaultGradient(theme.backgroundColor);
  const activeColor = HEX.test(theme.backgroundColor) ? theme.backgroundColor : "#ffffff";
  const { h, s, v } = rgbToHsv(hexToRgb(activeColor).r, hexToRgb(activeColor).g, hexToRgb(activeColor).b);

  function setSolidColor(color: string, opts?: ChangeOpts) {
    onChange({ backgroundType: "color", backgroundColor: color }, opts);
  }

  function addCurrentColorToProject() {
    if (!HEX.test(activeColor) || theme.customColors.includes(activeColor)) return;
    onChange({ customColors: [...theme.customColors, activeColor].slice(-MAX_CUSTOM_COLORS) });
  }

  function dragSv(startEvent: React.PointerEvent) {
    const rect = svRef.current!.getBoundingClientRect();
    const move = (clientX: number, clientY: number) => {
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      setSolidColor(hsvToHex(h, x * 100, (1 - y) * 100), { coalesce: true });
    };
    move(startEvent.clientX, startEvent.clientY);
    const onMove = (e: PointerEvent) => move(e.clientX, e.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function dragHue(startEvent: React.PointerEvent) {
    const rect = hueRef.current!.getBoundingClientRect();
    const move = (clientX: number) => {
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      setSolidColor(hsvToHex(x * 360, s, v), { coalesce: true });
    };
    move(startEvent.clientX);
    const onMove = (e: PointerEvent) => move(e.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function updateGradient(patch: Partial<BackgroundGradient>, coalesce = true) {
    onChange({ backgroundGradient: { ...gradient, ...patch } }, { coalesce });
  }

  function updateStop(i: number, patch: Partial<GradientStop>, coalesce = true) {
    updateGradient({ stops: gradient.stops.map((st, idx) => (idx === i ? { ...st, ...patch } : st)) }, coalesce);
  }

  function addStop() {
    if (gradient.stops.length >= MAX_STOPS) return;
    const stops = [...gradient.stops, { offset: 50, color: "#ffffff" }];
    updateGradient({ stops }, false);
    setSelectedStop(stops.length - 1);
  }

  function removeStop(i: number) {
    if (gradient.stops.length <= 2) return;
    updateGradient({ stops: gradient.stops.filter((_, idx) => idx !== i) }, false);
    setSelectedStop(0);
  }

  function dragStop(i: number, startEvent: React.PointerEvent) {
    const rect = gradientBarRef.current!.getBoundingClientRect();
    const move = (clientX: number) => {
      const pct = Math.round(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
      updateStop(i, { offset: pct }, true);
    };
    move(startEvent.clientX);
    const onMove = (e: PointerEvent) => move(e.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="bg-side-panel">
      <div className="bg-side-panel-header">
        <span>Edit background</span>
        <button type="button" className="icon-btn" title="Close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="bg-tab-row">
        <button type="button" className="bg-tab active">
          Color
        </button>
        <button type="button" className="bg-tab" disabled title="Pattern fills aren't available for label backgrounds">
          Pattern
        </button>
      </div>

      <div className="bg-segmented">
        <button
          type="button"
          className={`bg-segment ${!isGradient ? "active" : ""}`}
          onClick={() => onChange({ backgroundType: "color" })}
        >
          Color
        </button>
        <button
          type="button"
          className={`bg-segment ${isGradient ? "active" : ""}`}
          onClick={() => onChange({ backgroundType: "gradient", backgroundGradient: theme.backgroundGradient ?? defaultGradient(theme.backgroundColor) })}
        >
          Gradient
        </button>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label>Project colors</label>
        <div className="bg-swatch-row">
          <button
            type="button"
            className="bg-swatch bg-swatch-none"
            title="Reset to white"
            onClick={() => setSolidColor("#ffffff")}
          >
            <Ban size={16} />
          </button>
          <button
            type="button"
            className={`bg-swatch ${!isGradient && activeColor === "#ffffff" ? "selected" : ""}`}
            style={{ background: "#ffffff" }}
            title="#ffffff"
            onClick={() => setSolidColor("#ffffff")}
          />
          {theme.customColors.map((color) => (
            <button
              key={color}
              type="button"
              className={`bg-swatch ${!isGradient && activeColor === color ? "selected" : ""}`}
              style={{ background: color }}
              title={color}
              onClick={() => setSolidColor(color)}
            />
          ))}
          <button type="button" className="bg-swatch bg-swatch-add" title="Save the current color" onClick={addCurrentColorToProject}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      {brandColors.length > 0 && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Brand colors</label>
          <div className="bg-swatch-row">
            {brandColors.map((bc) => (
              <button
                key={bc.label}
                type="button"
                className={`bg-swatch ${!isGradient && activeColor === bc.color ? "selected" : ""}`}
                style={{ background: bc.color }}
                title={`${bc.label} — ${bc.color}`}
                onClick={() => setSolidColor(bc.color)}
              />
            ))}
          </div>
        </div>
      )}

      {!isGradient ? (
        <>
          <div
            ref={svRef}
            className="bg-sv-square"
            style={{ backgroundColor: hsvToHex(h, 100, 100) }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragSv(e);
            }}
          >
            <div className="bg-sv-handle" style={{ left: `${s}%`, top: `${100 - v}%` }} />
          </div>

          <div
            ref={hueRef}
            className="bg-hue-bar"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              dragHue(e);
            }}
          >
            <div className="bg-hue-handle" style={{ left: `${(h / 360) * 100}%` }} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Hex color</label>
            <input
              type="text"
              value={theme.backgroundColor}
              maxLength={7}
              onChange={(e) => {
                const v2 = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                setSolidColor(v2, { coalesce: true });
              }}
            />
          </div>
        </>
      ) : (
        <>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Angle</label>
            <div className="bg-angle-row">
              <input
                type="range"
                min={0}
                max={360}
                value={gradient.angle}
                onChange={(e) => updateGradient({ angle: Number(e.target.value) }, true)}
              />
              <input
                type="number"
                min={0}
                max={360}
                value={Math.round(gradient.angle)}
                onChange={(e) => updateGradient({ angle: Math.min(360, Math.max(0, Number(e.target.value))) }, true)}
              />
              <span>°</span>
            </div>
          </div>

          <div
            ref={gradientBarRef}
            className="bg-gradient-bar"
            style={{ background: gradientCss(gradient) }}
          >
            {gradient.stops.map((stop, i) => (
              <div
                key={i}
                className={`bg-gradient-stop ${selectedStop === i ? "selected" : ""}`}
                style={{ left: `${stop.offset}%`, background: stop.color }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedStop(i);
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  dragStop(i, e);
                }}
              />
            ))}
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <div className="bg-stops-header">
              <label>Stops</label>
              <button type="button" className="icon-btn" title="Add stop" onClick={addStop} disabled={gradient.stops.length >= MAX_STOPS}>
                <Plus size={14} />
              </button>
            </div>
            {gradient.stops.map((stop, i) => (
              <div key={i} className={`bg-stop-row ${selectedStop === i ? "selected" : ""}`} onClick={() => setSelectedStop(i)}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(stop.offset)}
                  onChange={(e) => updateStop(i, { offset: Math.min(100, Math.max(0, Number(e.target.value))) }, true)}
                />
                <span>%</span>
                <input
                  type="text"
                  value={stop.color}
                  maxLength={7}
                  onChange={(e) => {
                    const v2 = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                    updateStop(i, { color: v2 }, true);
                  }}
                />
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  title="Remove stop"
                  disabled={gradient.stops.length <= 2}
                  onClick={() => removeStop(i)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Gradient presets</label>
            <div className="bg-swatch-row">
              {gradientPresets.map((preset, i) => (
                <button
                  key={i}
                  type="button"
                  className="bg-swatch"
                  style={{ background: gradientCss(preset) }}
                  title={`Preset ${i + 1}`}
                  onClick={() => onChange({ backgroundGradient: preset })}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
