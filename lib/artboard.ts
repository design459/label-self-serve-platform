import { FontPairing, ImagePosition, NutritionField, PackFormatTemplate, PanelStyle, ProductCategory, RegulatoryContent, Theme } from "./types";

// Compliance boundary, enforced by construction, not just convention:
//  (a) ALL free-text fields — ingredients, statutory_marks, claims,
//      displayName, marketingTagline, batch/mfd/exp, sku — are passed
//      through esc()/nl2br() below before ever reaching the HTML string.
//  (b) ALL style-affecting fields — theme hex colors, font — are
//      format/allowlist-validated by the caller (see
//      app/api/workspace/[token]/generate/route.ts's validTheme() and
//      the FONT_PRESETS allowlist) before they ever reach this function;
//      this function never accepts a raw client string for anything that
//      gets interpolated into <style>.
//  (c) Zone rects/trim/bleed/safety are resolved only from the
//      server-trusted `template` (a pack_format_templates row) — there is
//      no client input path to zone x/y/w/h. The only customer-controlled
//      geometry is `imagePosition` (pan/zoom *within* the still-fixed
//      header zone), clamped both at the write endpoint and again here.
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
  imagePosition?: ImagePosition | null;
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

const PANEL_HEADING: Record<PanelStyle, string> = {
  supplement_facts: "Supplement Facts",
  nutrition_facts: "Nutrition Facts",
  blank: "",
};

function nutritionRows(input: ArtboardInput): string {
  const n = input.regulatory.nutrition_panel || {};
  const schema = input.fieldSchema && input.fieldSchema.length > 0 ? input.fieldSchema : [];
  return schema
    .map((f) => [f.label, n[f.key]] as [string, string | undefined])
    .filter(([, v]) => v)
    .map(([label, v]) => `<tr><td>${esc(label)}</td><td>${v && v.includes("\n") ? nl2br(v) : esc(v)}</td></tr>`)
    .join("");
}

// Single source of layout truth. The customer wizard's live preview embeds
// this same HTML in an <iframe srcDoc=...> (components/Artboard.tsx) and the
// print-proof renderer (app/api/render-proof/route.ts) feeds it to
// puppeteer-core — one render target, not two hand-synced copies, so the
// preview the customer sees can't drift from what gets submitted/approved.
export function buildArtboardHtml(input: ArtboardInput): string {
  const { template, theme, regulatory, font } = input;
  const { zones } = template.zone_layout;
  const widthMm = template.trim_width_mm + template.bleed_mm * 2;
  const heightMm = template.trim_height_mm + template.bleed_mm * 2;
  const bleedPctX = (template.bleed_mm / widthMm) * 100;
  const bleedPctY = (template.bleed_mm / heightMm) * 100;
  const safetyPctX = ((template.bleed_mm + template.safety_mm) / widthMm) * 100;
  const safetyPctY = ((template.bleed_mm + template.safety_mm) / heightMm) * 100;

  const zoneRect = (z: { x: number; y: number; w: number; h: number }) =>
    `position:absolute; left:${z.x}%; top:${z.y}%; width:${z.w}%; height:${z.h}%;`;

  // The one degree of geometric freedom the customer has: pan/zoom of the
  // uploaded photo *within* the still-fixed header rect. Clamped again here
  // even though the write endpoint already clamps it — never trust a value
  // crossing a network boundary exactly once.
  const posX = clampPct(input.imagePosition?.x, 50);
  const posY = clampPct(input.imagePosition?.y, 50);
  const scale = clampScale(input.imagePosition?.scale);

  const headingText = esc(input.displayName || input.productName || "Product Name");
  const panelHeading = PANEL_HEADING[input.panelStyle];
  const rows = nutritionRows(input);

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
    background: ${theme.backgroundColor};
    font-family: ${font.body};
    color: #1b2430;
    overflow: hidden;
  }
  .guide-bleed { position:absolute; inset: 0; border: 0.3mm dashed #cbd5e1; }
  .guide-safety {
    position: absolute;
    left: ${safetyPctX}%; top: ${safetyPctY}%;
    right: ${safetyPctX}%; bottom: ${safetyPctY}%;
    border: 0.3mm dotted #94a3b8;
  }
  .guide-trim {
    position: absolute;
    left: ${bleedPctX}%; top: ${bleedPctY}%;
    right: ${bleedPctX}%; bottom: ${bleedPctY}%;
    border: 0.3mm solid #94a3b8;
  }
  .zone-header { ${zoneRect(zones.header)} display:flex; align-items:center; gap:3mm; }
  .zone-claims { ${zoneRect(zones.claims)} display:flex; align-items:center; gap:2mm; flex-wrap:wrap; }
  .zone-left { ${zoneRect(zones.left)} font-size: 2.6mm; line-height: 1.35; overflow:hidden; }
  .zone-right { ${zoneRect(zones.right)} font-size: 2.6mm; line-height: 1.35; overflow:hidden; }
  .zone-footer { ${zoneRect(zones.footer)} display:flex; align-items:center; justify-content:space-between; font-size: 2.2mm; border-top: 0.2mm solid ${theme.accentColor}; padding-top: 1mm; }
  .photo-box { height: 100%; aspect-ratio: 1 / 1; border-radius: 2mm; overflow: hidden; flex-shrink: 0; background: #f1efe8; }
  .photo-box img { width: 100%; height: 100%; object-fit: cover; object-position: ${posX}% ${posY}%; transform: scale(${scale}); }
  .header-text { min-width: 0; }
  .product-name { font-family: ${font.heading}; font-size: 5mm; font-weight: 700; color: ${theme.primaryColor}; margin: 0; }
  .tagline { font-size: 2.4mm; color: #5b6472; margin: 0.6mm 0 0; }
  .claim-badge {
    font-size: 2mm; font-weight: 700; text-transform: uppercase; letter-spacing: 0.02em;
    padding: 0.8mm 2mm; border-radius: 3mm; background: ${theme.accentColor}; color: #fff;
  }
  .section-title { font-family: ${font.heading}; font-weight: 700; color: ${theme.primaryColor}; margin: 0 0 1mm; font-size: 2.6mm; }
  .section { margin-bottom: 2mm; }
  table.nutrition { width: 100%; border-collapse: collapse; }
  table.nutrition td { border-bottom: 0.2mm solid #e2e5ea; padding: 0.6mm 0; }
  .qr { width: 14mm; height: 14mm; }
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
    <div class="guide-bleed"></div>
    <div class="guide-trim"></div>
    <div class="guide-safety"></div>

    <div class="zone zone-header">
      ${input.logoDataUrl ? `<div class="photo-box"><img src="${input.logoDataUrl}" alt="" /></div>` : ""}
      <div class="header-text">
        <p class="product-name">${headingText}</p>
        ${input.marketingTagline ? `<p class="tagline">${esc(input.marketingTagline)}</p>` : ""}
      </div>
    </div>

    <div class="zone zone-claims">
      ${regulatory.claims
        ? esc(regulatory.claims)
            .split(",")
            .map((c) => `<span class="claim-badge">${c.trim()}</span>`)
            .join("")
        : ""}
    </div>

    <div class="zone zone-left">
      <div class="section">
        <p class="section-title">Ingredients</p>
        <p>${nl2br(regulatory.ingredients) || "—"}</p>
      </div>
      <div class="section">
        <p class="section-title">Statutory marks</p>
        <p>${nl2br(regulatory.statutory_marks) || "—"}</p>
      </div>
    </div>

    <div class="zone zone-right">
      ${panelHeading
        ? `<div class="section">
        <p class="section-title">${esc(panelHeading)}</p>
        <table class="nutrition">${rows || "<tr><td>—</td></tr>"}</table>
      </div>`
        : ""}
    </div>

    <div class="zone zone-footer">
      <div>
        Batch: ${esc(regulatory.batch_code) || "—"} &nbsp; Mfd: ${esc(regulatory.manufacture_date) || "—"} &nbsp; Exp: ${esc(regulatory.expiry_date) || "—"}
        <br/>SKU: ${esc(input.skuCode)}
      </div>
      ${input.qrDataUrl ? `<img class="qr" src="${input.qrDataUrl}" alt="qr" />` : ""}
    </div>

    ${input.watermark ? `<div class="watermark"><span>PROOF — NOT APPROVED FOR PRINT</span></div>` : ""}
  </div>
</body>
</html>`;
}
