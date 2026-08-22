import { randomBytes } from "crypto";
import {
  CategoryPanelTemplate,
  FONT_PRESETS,
  ImagePosition,
  PackFormatTemplate,
  ProductCategory,
} from "./types";

// Freeform canvas layout — see supabase/migrations/0004_canvas_layout.sql.
// Bound elements (everything except "text") carry NO text content of their
// own: ingredients/nutritionPanel/claims/statutoryMarks/footer/productName/
// tagline still source their actual text from label_regulatory_content /
// label_orders.display_name/marketing_tagline exactly as before — an
// element only carries WHERE/HOW BIG/HOW STYLED. This avoids a second,
// divergent copy of regulatory text living on the element itself. Only the
// freeform "text" type has its own content, since it has no other source.
export const HEX = /^#[0-9a-fA-F]{6}$/;

export interface ElementStyle {
  fontId: string;
  fontSize: number; // mm
  color: string; // #rrggbb
}

interface ElementBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BoundElementType =
  | "photo"
  | "productName"
  | "tagline"
  | "claims"
  | "ingredients"
  | "statutoryMarks"
  | "nutritionPanel"
  | "footer";

export const BOUND_ELEMENT_TYPES: BoundElementType[] = [
  "photo",
  "productName",
  "tagline",
  "claims",
  "ingredients",
  "statutoryMarks",
  "nutritionPanel",
  "footer",
];

// photo carries no URL — the renderer always resolves the actual image from
// the order's single label_assets logo row, so there's no arbitrary-URL
// surface to validate here.
export interface PhotoElement extends ElementBase {
  type: "photo";
  imagePosition: ImagePosition;
}

export interface BoundTextElement extends ElementBase {
  type: Exclude<BoundElementType, "photo" | "claims">;
  style: ElementStyle;
}

export interface ClaimsElement extends ElementBase {
  type: "claims";
  style: ElementStyle & { badgeColor: string };
}

export interface FreeTextElement extends ElementBase {
  type: "text";
  style: ElementStyle;
  content: string; // length-capped, escaped once at render time in lib/artboard.ts
}

export type CanvasElement = PhotoElement | BoundTextElement | ClaimsElement | FreeTextElement;

export function isDeletable(el: CanvasElement): boolean {
  return el.type === "text";
}

function newId(): string {
  return randomBytes(6).toString("hex");
}

function clampPct(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

function clampFontSize(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(12, Math.max(1.5, n));
}

function safeHex(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v : fallback;
}

function safeFontId(v: unknown, fallback: string): string {
  return typeof v === "string" && FONT_PRESETS.some((f) => f.id === v) ? v : fallback;
}

// Maps each seeded pack_format_templates.zone_layout rect (see
// supabase/migrations/0001_init.sql) into starter element positions, so a
// customer who opens the editor for the first time sees their already-
// collected data arranged sensibly instead of a blank canvas — "auto-fill
// the area" without generating any new artwork.
export function buildDefaultLayout(
  template: PackFormatTemplate,
  category: ProductCategory,
  panel: CategoryPanelTemplate | null,
  opts?: { fontId?: string; primaryColor?: string; accentColor?: string }
): CanvasElement[] {
  const fontId = opts?.fontId && FONT_PRESETS.some((f) => f.id === opts.fontId) ? opts.fontId : "sans-modern";
  const primaryColor = opts?.primaryColor && HEX.test(opts.primaryColor) ? opts.primaryColor : "#1f4d38";
  const accentColor = opts?.accentColor && HEX.test(opts.accentColor) ? opts.accentColor : "#2e6b4f";
  const bodyColor = "#1b2430";

  const { zones } = template.zone_layout;
  const widthMm = template.trim_width_mm + template.bleed_mm * 2;
  const heightMm = template.trim_height_mm + template.bleed_mm * 2;

  const header = zones.header;
  // Square photo box sized from the header height, converted to a %-width
  // using the sheet's mm aspect ratio — reproduces the old fixed
  // `.photo-box { aspect-ratio: 1/1 }` behavior without hardcoding it.
  const headerHPct = header.h; // % of heightMm
  const headerHeightMm = (headerHPct / 100) * heightMm;
  const photoWPct = Math.min(header.w * 0.6, (headerHeightMm / widthMm) * 100);
  const gapPct = 2;
  const textX = header.x + photoWPct + gapPct;
  const textW = Math.max(10, header.w - photoWPct - gapPct);

  const left = zones.left;
  const ingredientsH = left.h * 0.6;
  const statutoryH = left.h * 0.4;

  const layout: CanvasElement[] = [
    {
      id: newId(),
      type: "photo",
      x: header.x,
      y: header.y,
      w: photoWPct,
      h: header.h,
      imagePosition: { x: 50, y: 50, scale: 1 },
    },
    {
      id: newId(),
      type: "productName",
      x: textX,
      y: header.y,
      w: textW,
      h: header.h * 0.55,
      style: { fontId, fontSize: 5, color: primaryColor },
    },
    {
      id: newId(),
      type: "tagline",
      x: textX,
      y: header.y + header.h * 0.55,
      w: textW,
      h: header.h * 0.45,
      style: { fontId, fontSize: 2.4, color: "#5b6472" },
    },
    {
      id: newId(),
      type: "claims",
      x: zones.claims.x,
      y: zones.claims.y,
      w: zones.claims.w,
      h: zones.claims.h,
      style: { fontId, fontSize: 2, color: "#ffffff", badgeColor: accentColor },
    },
    {
      id: newId(),
      type: "ingredients",
      x: left.x,
      y: left.y,
      w: left.w,
      h: ingredientsH,
      style: { fontId, fontSize: 2.6, color: bodyColor },
    },
    {
      id: newId(),
      type: "statutoryMarks",
      x: left.x,
      y: left.y + ingredientsH,
      w: left.w,
      h: statutoryH,
      style: { fontId, fontSize: 2.6, color: bodyColor },
    },
    {
      id: newId(),
      type: "nutritionPanel",
      x: zones.right.x,
      y: zones.right.y,
      w: zones.right.w,
      h: zones.right.h,
      style: { fontId, fontSize: 2.6, color: bodyColor },
    },
    {
      id: newId(),
      type: "footer",
      x: zones.footer.x,
      y: zones.footer.y,
      w: zones.footer.w,
      h: zones.footer.h,
      style: { fontId, fontSize: 2.2, color: bodyColor },
    },
  ];

  return layout;
}

function defaultRectFor(type: BoundElementType, fallback: CanvasElement[]): CanvasElement {
  const found = fallback.find((el) => el.type === type);
  if (found) return found;
  // Should never happen (buildDefaultLayout always emits all 8), but keep a
  // safe last-resort rect so self-heal can never throw.
  return { id: newId(), type: "footer", x: 5, y: 90, w: 90, h: 8, style: { fontId: "sans-modern", fontSize: 2.2, color: "#1b2430" } } as CanvasElement;
}

// Validates a client-submitted elements array before it's ever stored or
// rendered. Self-heals a missing required bound type (injects a
// server-computed default) rather than rejecting the whole save — keeps
// "required content always appears somewhere on the label" true even
// against a buggy or tampered client, without failing a customer's entire
// edit session over one dropped element.
export function validateCanvasElements(
  raw: unknown,
  ctx: { orderFontId: string; template: PackFormatTemplate; category: ProductCategory; panel: CategoryPanelTemplate | null }
): CanvasElement[] {
  const MAX_ELEMENTS = 48;
  const MAX_TEXT_LEN = 300;
  const arr = Array.isArray(raw) ? raw.slice(0, MAX_ELEMENTS) : [];
  const fallback = buildDefaultLayout(ctx.template, ctx.category, ctx.panel, { fontId: ctx.orderFontId });

  const validated: CanvasElement[] = [];
  const seenBound = new Set<BoundElementType>();

  for (const raw_ of arr) {
    if (!raw_ || typeof raw_ !== "object") continue;
    const el = raw_ as Record<string, unknown>;
    const type = el.type;
    const base = {
      id: typeof el.id === "string" && el.id ? el.id : newId(),
      x: clampPct(el.x, 5),
      y: clampPct(el.y, 5),
      w: clampPct(el.w, 20),
      h: clampPct(el.h, 10),
    };

    if (type === "photo") {
      if (seenBound.has("photo")) continue;
      seenBound.add("photo");
      const pos = (el.imagePosition ?? {}) as Record<string, unknown>;
      validated.push({
        ...base,
        type: "photo",
        imagePosition: {
          x: clampPct(pos.x, 50),
          y: clampPct(pos.y, 50),
          scale: Math.min(2, Math.max(1, Number(pos.scale) || 1)),
        },
      });
    } else if (type === "claims") {
      if (seenBound.has("claims")) continue;
      seenBound.add("claims");
      const style = (el.style ?? {}) as Record<string, unknown>;
      validated.push({
        ...base,
        type: "claims",
        style: {
          fontId: safeFontId(style.fontId, ctx.orderFontId),
          fontSize: clampFontSize(style.fontSize, 2),
          color: safeHex(style.color, "#ffffff"),
          badgeColor: safeHex(style.badgeColor, "#2e6b4f"),
        },
      });
    } else if (type === "text") {
      const style = (el.style ?? {}) as Record<string, unknown>;
      validated.push({
        ...base,
        type: "text",
        content: typeof el.content === "string" ? el.content.slice(0, MAX_TEXT_LEN) : "",
        style: {
          fontId: safeFontId(style.fontId, ctx.orderFontId),
          fontSize: clampFontSize(style.fontSize, 3),
          color: safeHex(style.color, "#1b2430"),
        },
      });
    } else if (BOUND_ELEMENT_TYPES.includes(type as BoundElementType)) {
      const boundType = type as BoundElementType;
      if (seenBound.has(boundType)) continue;
      seenBound.add(boundType);
      const style = (el.style ?? {}) as Record<string, unknown>;
      validated.push({
        ...base,
        type: boundType as BoundTextElement["type"],
        style: {
          fontId: safeFontId(style.fontId, ctx.orderFontId),
          fontSize: clampFontSize(style.fontSize, 2.6),
          color: safeHex(style.color, "#1b2430"),
        },
      });
    }
    // unknown type -> dropped silently
  }

  for (const type of BOUND_ELEMENT_TYPES) {
    if (!seenBound.has(type)) {
      validated.push(defaultRectFor(type, fallback));
    }
  }

  return validated;
}
