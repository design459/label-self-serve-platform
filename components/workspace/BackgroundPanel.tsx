"use client";

import { useRef } from "react";
import { X } from "lucide-react";

const HEX = /^#[0-9a-fA-F]{6}$/;

interface ChangeOpts {
  coalesce?: boolean;
}

interface Props {
  value: string;
  onChange: (hex: string, opts?: ChangeOpts) => void;
  projectColors: string[];
  brandColors: { label: string; color: string }[];
  onClose: () => void;
}

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

// A right-docked panel matching the reference design tool's "Edit
// background" panel — the parts of it with a real equivalent in this app
// (a hex color, the preset swatches, the order's own brand colors) plus a
// self-contained hue/saturation-value picker. Pattern/Gradient/Opacity
// controls from the reference are left out: this app's background is a
// single solid hex (lib/artboard.ts renders it as plain CSS `background`),
// so those would just be inert chrome with nothing behind them.
export default function BackgroundPanel({ value, onChange, projectColors, brandColors, onClose }: Props) {
  const safeHex = HEX.test(value) ? value : "#ffffff";
  const { h, s, v } = rgbToHsv(hexToRgb(safeHex).r, hexToRgb(safeHex).g, hexToRgb(safeHex).b);
  const svRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);

  function dragSv(startEvent: React.PointerEvent) {
    const rect = svRef.current!.getBoundingClientRect();
    const move = (clientX: number, clientY: number) => {
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      onChange(hsvToHex(h, x * 100, (1 - y) * 100), { coalesce: true });
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
      onChange(hsvToHex(x * 360, s, v), { coalesce: true });
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

      <p className="bg-side-panel-tab">Color</p>

      <div className="field" style={{ marginBottom: 0 }}>
        <label>Project colors</label>
        <div className="palette-row">
          {projectColors.map((color, i) => (
            <div
              key={i}
              className={`swatch ${value === color ? "selected" : ""}`}
              style={{ background: color, boxShadow: "inset 0 0 0 1px var(--line)" }}
              onClick={() => onChange(color)}
              title={color}
            />
          ))}
        </div>
      </div>

      {brandColors.length > 0 && (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Brand colors</label>
          <div className="palette-row">
            {brandColors.map((bc) => (
              <div
                key={bc.label}
                className={`swatch ${value === bc.color ? "selected" : ""}`}
                style={{ background: bc.color, boxShadow: "inset 0 0 0 1px var(--line)" }}
                onClick={() => onChange(bc.color)}
                title={`${bc.label} — ${bc.color}`}
              />
            ))}
          </div>
        </div>
      )}

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
          value={value}
          maxLength={7}
          onChange={(e) => {
            const v2 = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
            onChange(v2, { coalesce: true });
          }}
        />
      </div>
    </div>
  );
}
