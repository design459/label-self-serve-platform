import { FontPairing, NutritionField, PackFormatTemplate, PanelStyle, ProductCategory, RegulatoryContent, Theme, FONT_PRESETS } from "./types";
import { CanvasElement, HEX, backgroundCss } from "./canvasLayout";
import { ICON_SVG_MARKUP } from "./iconAssets";

// Compliance boundary, enforced by construction, not just convention:
//  (a) ALL free-text fields — ingredients, statutory_marks, claims,
//      displayName, marketingTagline, batch/mfd/exp, sku, and the new
//      freeform "text" element's content — are passed through
//      esc()/nl2br() below before ever reaching the HTML string.
//  (b) ALL style-affecting fields — theme background color, and every
//      element's fontId/fontSize/color — are format/allowlist-validated by
//      the caller (see app/api/workspace/[token]/generate/route.ts's
//      validTheme() and lib/canvasLayout.ts's validateCanvasElements())
//      AND re-validated again inside this function via safeFontFamily()/
//      safeColor()/safeFontSize() — never trust a value crossing a network
//      boundary exactly once.
//  (c) Geometry: `template` supplies only the sheet's physical mm size and
//      bleed/safety guides (a server-trusted pack_format_templates row) —
//      every element's own x/y/w/h is customer-controlled and clamped both
//      at the write endpoint (app/api/workspace/[token]/layout/route.ts)
//      and again here.
export interface ArtboardInput {
  productName: string;
  displayName?: string | null;
  marketingTagline?: string | null;
  skuCode: string;
  customerName: string;
  category: ProductCategory;
  panelStyle: PanelStyle;
  fieldSchema: NutritionField[];
  template: PackFormatTemplate;
  theme: Theme;
  font: FontPairing;
  elements: CanvasElement[];
  logoDataUrl?: string | null;
  regulatory: RegulatoryContent;
  qrDataUrl?: string | null;
  watermark: boolean;
}

function esc(value: string | undefined | null): string {
  if (!value) return "";
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nl2br(value: string | undefined | null): string {
  return esc(value).replace(/\n/g, "<br/>");
}

function clampPct(v: number | undefined, fallback: number): number {
  if (typeof v !== "number" || Number.isNaN(v)) return fallback;
  return Math.min(100, Math.max(0, v));
}

function clampScale(v: number | undefined): number {
  if (typeof v !== "number" || Number.isNaN(v)) return 1;
  return Math.min(2, Math.max(1, v));
}

function safeFontFamily(fontId: string, fallback: FontPairing): FontPairing {
  return FONT_PRESETS.find((f) => f.id === fontId) ?? fallback;
}

function safeColor(c: string, fallback = "#1b2430"): string {
  return HEX.test(c) ? c : fallback;
}

function safeFontSize(n: number, fallback = 2.6): number {
  return Math.min(12, Math.max(1.5, Number.isFinite(n) ? n : fallback));
}

const PANEL_HEADING: Record<PanelStyle, string> = {
  supplement_facts: "Supplement Facts",
  nutrition_facts: "Nutrition Facts",
  blank: "",
};

function nutritionRows(input: ArtboardInput): string {
  const n = input.regulatory.nutrition_panel || {};
  const schema = input.fieldSchema && input.fieldSchema.length > 0 ? input.fieldSchema : [];
  const cell = "border-bottom:0.2mm solid #e2e5ea; padding:0.6mm 0;";
  return schema
    .map((f) => [f.label, n[f.key]] as [string, string | undefined])
    .filter(([, v]) => v)
    .map(([label, v]) => `<tr><td style="${cell}">${esc(label)}</td><td style="${cell}">${v && v.includes("\n") ? nl2br(v) : esc(v)}</td></tr>`)
    .join("");
}

function elementRect(el: { x: number; y: number; w: number; h: number }): string {
  return `position:absolute; left:${clampPct(el.x, 0)}%; top:${clampPct(el.y, 0)}%; width:${clampPct(el.w, 10)}%; height:${clampPct(el.h, 10)}%; overflow:hidden;`;
}

interface RenderCtx {
  headingText: string;
  marketingTagline?: string | null;
  regulatory: RegulatoryContent;
  panelHeading: string;
  rows: string;
  skuCode: string;
  logoDataUrl?: string | null;
  qrDataUrl?: string | null;
  font: FontPairing;
}

function renderElement(el: CanvasElement, ctx: RenderCtx): string {
  const rect = elementRect(el);

  switch (el.type) {
    case "photo": {
      if (!ctx.logoDataUrl) return "";
      const posX = clampPct(el.imagePosition?.x, 50);
      const posY = clampPct(el.imagePosition?.y, 50);
      const scale = clampScale(el.imagePosition?.scale);
      return `<div style="${rect} border-radius:2mm; background:#f1efe8;"><img src="${ctx.logoDataUrl}" style="width:100%; height:100%; object-fit:cover; object-position:${posX}% ${posY}%; transform:scale(${scale});" alt="" /></div>`;
    }
    case "productName": {
      const pair = safeFontFamily(el.style.fontId, ctx.font);
      return `<p style="${rect} margin:0; font-family:${pair.heading}; font-weight:700; font-size:${safeFontSize(el.style.fontSize, 5)}mm; color:${safeColor(el.style.color, "#1f4d38")};">${ctx.headingText}</p>`;
    }
    case "tagline": {
      if (!ctx.marketingTagline) return "";
      const pair = safeFontFamily(el.style.fontId, ctx.font);
      return `<p style="${rect} margin:0; font-family:${pair.body}; font-size:${safeFontSize(el.style.fontSize, 2.4)}mm; color:${safeColor(el.style.color, "#5b6472")};">${esc(ctx.marketingTagline)}</p>`;
    }
    case "claims": {
      if (!ctx.regulatory.claims) return "";
      const pair = safeFontFamily(el.style.fontId, ctx.font);
      const size = safeFontSize(el.style.fontSize, 2);
      const textColor = safeColor(el.style.color, "#ffffff");
      const badgeColor = safeColor(el.style.badgeColor, "#2e6b4f");
      const badges = esc(ctx.regulatory.claims)
        .split(",")
        .map(
          (c) =>
            `<span style="display:inline-block; font-family:${pair.body}; font-weight:700; text-transform:uppercase; letter-spacing:0.02em; font-size:${size}mm; padding:0.8mm 2mm; border-radius:3mm; background:${badgeColor}; color:${textColor}; margin:0 1mm 1mm 0;">${c.trim()}</span>`
        )
        .join("");
      return `<div style="${rect} display:flex; align-items:center; gap:2mm; flex-wrap:wrap;">${badges}</div>`;
    }
    case "ingredients": {
      const pair = safeFontFamily(el.style.fontId, ctx.font);
      const size = safeFontSize(el.style.fontSize);
      const color = safeColor(el.style.color);
      return `<div style="${rect} font-family:${pair.body}; font-size:${size}mm; line-height:1.35; color:${color};">
        <p style="margin:0 0 1mm; font-family:${pair.heading}; font-weight:700; font-size:${size}mm; color:${color};">Ingredients</p>
        <p style="margin:0;">${nl2br(ctx.regulatory.ingredients) || "—"}</p>
      </div>`;
    }
    case "statutoryMarks": {
      const pair = safeFontFamily(el.style.fontId, ctx.font);
      const size = safeFontSize(el.style.fontSize);
      const color = safeColor(el.style.color);
      return `<div style="${rect} font-family:${pair.body}; font-size:${size}mm; line-height:1.35; color:${color};">
        <p style="margin:0 0 1mm; font-family:${pair.heading}; font-weight:700; font-size:${size}mm; color:${color};">Statutory marks</p>
        <p style="margin:0;">${nl2br(ctx.regulatory.statutory_marks) || "—"}</p>
      </div>`;
    }
    case "nutritionPanel": {
      if (!ctx.panelHeading) return "";
      const pair = safeFontFamily(el.style.fontId, ctx.font);
      const size = safeFontSize(el.style.fontSize);
      const color = safeColor(el.style.color);
      return `<div style="${rect} font-family:${pair.body}; font-size:${size}mm; line-height:1.35; color:${color};">
        <p style="margin:0 0 1mm; font-family:${pair.heading}; font-weight:700; font-size:${size}mm; color:${color};">${esc(ctx.panelHeading)}</p>
        <table style="width:100%; border-collapse:collapse;">${ctx.rows || "<tr><td>—</td></tr>"}</table>
      </div>`;
    }
    case "footer": {
      const pair = safeFontFamily(el.style.fontId, ctx.font);
      const size = safeFontSize(el.style.fontSize, 2.2);
      const color = safeColor(el.style.color);
      return `<div style="${rect} display:flex; align-items:center; justify-content:space-between; font-family:${pair.body}; font-size:${size}mm; color:${color}; border-top:0.2mm solid #e2e5ea; padding-top:1mm;">
        <div>Batch: ${esc(ctx.regulatory.batch_code) || "—"} &nbsp; Mfd: ${esc(ctx.regulatory.manufacture_date) || "—"} &nbsp; Exp: ${esc(ctx.regulatory.expiry_date) || "—"}<br/>SKU: ${esc(ctx.skuCode)}</div>
        ${ctx.qrDataUrl ? `<img src="${ctx.qrDataUrl}" style="width:14mm; height:14mm;" alt="qr" />` : ""}
      </div>`;
    }
    case "text": {
      const pair = safeFontFamily(el.style.fontId, ctx.font);
      return `<div style="${rect} font-family:${pair.body}; font-size:${safeFontSize(el.style.fontSize, 3)}mm; line-height:1.3; color:${safeColor(el.style.color)};">${nl2br(el.content)}</div>`;
    }
    case "icon": {
      const markup = ICON_SVG_MARKUP[el.iconId] ?? ICON_SVG_MARKUP.leaf;
      return `<div style="${rect} color:${safeColor(el.color)}; display:flex; align-items:center; justify-content:center;"><svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${markup}</svg></div>`;
    }
    default:
      return "";
  }
}

// Single source of layout truth. The customer wizard's generate step and
// the staff approval route (app/api/admin/review/[id]/route.ts) both feed
// this same function — one render target, not two hand-synced copies, so
// what a customer designs can't drift from what gets submitted/approved.
export function buildArtboardHtml(input: ArtboardInput): string {
  const { template, theme, regulatory, font } = input;
  const widthMm = template.trim_width_mm + template.bleed_mm * 2;
  const heightMm = template.trim_height_mm + template.bleed_mm * 2;

  const ctx: RenderCtx = {
    headingText: esc(input.displayName || input.productName || "Product Name"),
    marketingTagline: input.marketingTagline,
    regulatory,
    panelHeading: PANEL_HEADING[input.panelStyle],
    rows: nutritionRows(input),
    skuCode: input.skuCode,
    logoDataUrl: input.logoDataUrl,
    qrDataUrl: input.qrDataUrl,
    font,
  };

  const elementsHtml = (input.elements ?? []).map((el) => renderElement(el, ctx)).join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  .sheet {
    position: relative;
    width: ${widthMm}mm;
    height: ${heightMm}mm;
    background: ${backgroundCss(theme)};
    font-family: ${font.body};
    color: #1b2430;
    overflow: hidden;
  }
  .watermark {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    pointer-events: none; z-index: 5;
  }
  .watermark span {
    transform: rotate(-30deg);
    font-size: 8mm; font-weight: 800; color: rgba(179, 38, 30, 0.28);
    text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap;
  }
</style>
</head>
<body>
  <div class="sheet">
    ${elementsHtml}

    ${input.watermark ? `<div class="watermark"><span>PROOF — NOT APPROVED FOR PRINT</span></div>` : ""}
  </div>
</body>
</html>`;
}
