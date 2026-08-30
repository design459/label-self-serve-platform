"use client";

import { LabelTemplate } from "@/lib/canvasLayout";
import { FONT_PRESETS, ProductCategory } from "@/lib/types";

// Roughly where the reference photo's OWN baked-in "PRODUCT NAME" placeholder
// text sits, as a % box within the image (public/template-previews/) —
// eyeballed per shape (re-checked against the actual photos, tightened to
// just the title band so it stops overlapping the supplement-facts panel
// below it), shared by every template in that category since they all share
// the same photographic framing (only color/font differ within a category).
// Used ONLY to place this live "how it'll look on the shelf" preview's
// product-name overlay — never the actual print geometry, which stays the
// server-computed zone_layout the flat editing canvas uses (see
// lib/canvasLayout.ts). A rough visual approximation, not a pixel-exact mask;
// stick_pack's real placeholder text is printed rotated 90°, which this
// axis-aligned box can only approximate the position of, not the angle.
const LABEL_REGION_BY_CATEGORY: Partial<Record<ProductCategory, { x: number; y: number; w: number; h: number }>> = {
  capsule_tablet: { x: 24, y: 41, w: 52, h: 15 },
  powder: { x: 20, y: 28, w: 60, h: 15 },
  juice_beverage: { x: 25, y: 50, w: 50, h: 15 },
  bar: { x: 18, y: 27, w: 60, h: 20 },
  spread: { x: 14, y: 36, w: 70, h: 20 },
  sachet: { x: 20, y: 26, w: 60, h: 15 },
  box: { x: 15, y: 33, w: 46, h: 15 },
  stick_pack: { x: 28, y: 48, w: 44, h: 22 },
  tube: { x: 28, y: 30, w: 44, h: 15 },
  dropper_bottle: { x: 24, y: 43, w: 52, h: 15 },
  spray_bottle: { x: 25, y: 42, w: 50, h: 15 },
};
const DEFAULT_REGION = { x: 20, y: 35, w: 60, h: 18 };

// A product name is arbitrary length, but the masked box above is fixed —
// shrink the font as the name gets longer so it wraps to at most two lines
// instead of clipping (the box still has overflow:hidden as a last resort
// for a genuinely extreme name).
function fitFontSizePx(text: string): number {
  const len = text.length;
  if (len <= 8) return 20;
  if (len <= 12) return 17;
  if (len <= 18) return 14;
  if (len <= 26) return 11;
  return 9;
}

interface Props {
  template: LabelTemplate;
  productName: string;
}

// A live "how it'll look on the shelf" preview — appears once a template is
// applied (see LayoutVariantPicker.tsx). Distinct from that gallery's static
// thumbnails (a generic style reference) and from the actual flat editing
// canvas (the real, compliance-checked, printable artwork): this overlays
// the order's OWN real product name onto the template's reference photo, in
// the template's own color/font, so the customer can see roughly how their
// actual brand name will look on the real container shape before it's
// printed and wrapped. What actually gets printed is always the flat
// rectangle — a real label is printed flat, then applied to the container
// afterward, so this photo backdrop is a preview stand-in, never the print
// file itself.
export default function TemplateMockupPreview({ template, productName }: Props) {
  const region = LABEL_REGION_BY_CATEGORY[template.category] ?? DEFAULT_REGION;
  const font = FONT_PRESETS.find((f) => f.id === template.fontId)?.heading ?? "system-ui, sans-serif";

  return (
    <div className="template-mockup-preview">
      <p className="field-hint" style={{ marginBottom: 6 }}>Live preview — {template.name}</p>
      <div className="template-mockup-photo" style={{ backgroundImage: `url(${template.previewImage})` }}>
        <div
          className="template-mockup-overlay"
          style={{
            left: `${region.x}%`,
            top: `${region.y}%`,
            width: `${region.w}%`,
            height: `${region.h}%`,
          }}
        >
          {/* A solid backing card, not transparent text straight over the
              photo — the photo's own baked-in "PRODUCT NAME" placeholder
              sits in this exact spot, and drawing new text right on top of
              it without covering it first just produces two overlapping
              strings of text. */}
          <span
            className="template-mockup-overlay-text"
            style={{ fontFamily: font, color: template.primaryColor, fontSize: fitFontSizePx(productName) }}
          >
            {productName}
          </span>
        </div>
      </div>
    </div>
  );
}
