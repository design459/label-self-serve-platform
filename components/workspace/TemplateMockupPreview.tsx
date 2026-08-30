"use client";

import { LabelTemplate } from "@/lib/canvasLayout";
import { FONT_PRESETS, ProductCategory } from "@/lib/types";

// Roughly where the printed label sits on each category's real container,
// as a % box within the reference photo (public/template-previews/) — eyeballed
// per shape, shared by every template in that category since they all share
// the same photographic framing (only color/font differ within a category).
// Used ONLY to place this live "how it'll look on the shelf" preview's
// product-name overlay — never the actual print geometry, which stays the
// server-computed zone_layout the flat editing canvas uses (see
// lib/canvasLayout.ts). A rough visual approximation, not a pixel-exact mask.
const LABEL_REGION_BY_CATEGORY: Partial<Record<ProductCategory, { x: number; y: number; w: number; h: number }>> = {
  capsule_tablet: { x: 28, y: 42, w: 44, h: 28 },
  powder: { x: 20, y: 28, w: 60, h: 24 },
  juice_beverage: { x: 27, y: 48, w: 46, h: 24 },
  bar: { x: 22, y: 28, w: 56, h: 28 },
  spread: { x: 12, y: 40, w: 76, h: 22 },
  sachet: { x: 24, y: 27, w: 52, h: 18 },
  box: { x: 16, y: 32, w: 44, h: 20 },
  stick_pack: { x: 33, y: 34, w: 34, h: 18 },
  tube: { x: 31, y: 31, w: 38, h: 18 },
  dropper_bottle: { x: 27, y: 44, w: 46, h: 22 },
  spray_bottle: { x: 29, y: 43, w: 42, h: 24 },
};
const DEFAULT_REGION = { x: 20, y: 35, w: 60, h: 26 };

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
            fontFamily: font,
            color: template.primaryColor,
          }}
        >
          {productName}
        </div>
      </div>
    </div>
  );
}
