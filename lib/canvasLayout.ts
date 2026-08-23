import { randomBytes } from "crypto";
import {
  CategoryPanelTemplate,
  FONT_PRESETS,
  ImagePosition,
  PackFormatTemplate,
  ProductCategory,
  ZoneLayout,
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

export type TextAlign = "left" | "center" | "right";
export type ListStyle = "none" | "bullet" | "number";
export type TextEffect = "none" | "shadow" | "outline";

export interface ElementStyle {
  fontId: string;
  fontSize: number; // mm
  color: string; // #rrggbb
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  textAlign?: TextAlign;
  lineHeight?: number; // unitless multiplier
  letterSpacing?: number; // mm
  listStyle?: ListStyle;
  textEffect?: TextEffect;
}

interface ElementBase {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  locked?: boolean; // prevents drag/resize on canvas; still editable via the toolbar's text/color/etc. controls
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

// Curated, small set — not the full lucide catalog. Extend by adding an id
// here plus a matching entry in lib/iconAssets.ts (render markup) and
// components/workspace/iconRegistry.ts (picker/preview component).
export const ICON_ALLOWLIST = [
  "leaf", "shield-check", "heart", "droplet", "flame", "recycle",
  "award", "circle-check", "sun", "sprout", "package", "star",
  "sparkles", "zap", "apple", "wheat", "milk", "fish",
  "gem", "crown", "snowflake", "thermometer", "heart-pulse", "truck",
  "square", "circle", "triangle", "hexagon", "pentagon", "diamond",
  "pill", "citrus", "carrot", "cherry", "banana", "egg",
  "coffee", "activity", "dumbbell", "brain", "badge-check", "medal",
  "trophy", "box", "package-check", "droplets", "octagon", "shield",
] as const;

export type IconId = (typeof ICON_ALLOWLIST)[number];

export interface IconElement extends ElementBase {
  type: "icon";
  iconId: IconId;
  color: string; // #rrggbb — no ElementStyle, icons have no font
}

export type CanvasElement = PhotoElement | BoundTextElement | ClaimsElement | FreeTextElement | IconElement;

export function isDeletable(el: CanvasElement): boolean {
  return el.type === "text" || el.type === "icon";
}

export function describeElement(el: CanvasElement): string {
  switch (el.type) {
    case "photo":
      return "Photo";
    case "productName":
      return "Product name";
    case "tagline":
      return "Tagline";
    case "claims":
      return "Claims";
    case "ingredients":
      return "Ingredients";
    case "statutoryMarks":
      return "Statutory marks";
    case "nutritionPanel":
      return "Nutrition panel";
    case "footer":
      return "Footer";
    case "icon":
      return `Icon: ${el.iconId}`;
    case "text":
      return `Text: ${el.content.slice(0, 24)}${el.content.length > 24 ? "…" : ""}`;
    default:
      return "Element";
  }
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

export function safeHex(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v : fallback;
}

export interface GradientStop {
  offset: number; // 0-100
  color: string; // #rrggbb
}

export interface BackgroundGradient {
  angle: number; // degrees, 0-360
  stops: GradientStop[];
}

const MAX_GRADIENT_STOPS = 6;

// Coerces an arbitrary (client-supplied) value into a safe stop list: every
// entry gets a clamped offset and an allowlist-checked color, and the list
// is capped in length — used both when persisting (marketing route) and
// nowhere else needs to trust a stop shape it didn't just build itself.
export function safeGradientStops(stops: unknown): GradientStop[] {
  if (!Array.isArray(stops)) return [];
  return stops.slice(0, MAX_GRADIENT_STOPS).map((s) => {
    const raw = (s ?? {}) as Record<string, unknown>;
    const offset = typeof raw.offset === "number" && Number.isFinite(raw.offset) ? Math.min(100, Math.max(0, raw.offset)) : 0;
    return { offset, color: safeHex(raw.color, "#ffffff") };
  });
}

// Single source of truth for turning a theme's background fields into a CSS
// `background` value — shared by the server renderer (lib/artboard.ts) and
// the client-side live previews (CanvasEditor.tsx, LabelStagePreview.tsx)
// so all three always agree on what a given theme actually looks like.
export function backgroundCss(theme: {
  backgroundColor: string;
  backgroundType?: "color" | "gradient";
  backgroundGradient?: BackgroundGradient | null;
}): string {
  const solid = safeHex(theme.backgroundColor, "#ffffff");
  if (theme.backgroundType === "gradient" && theme.backgroundGradient && theme.backgroundGradient.stops.length >= 2) {
    const angle = Number.isFinite(theme.backgroundGradient.angle) ? ((theme.backgroundGradient.angle % 360) + 360) % 360 : 45;
    const stops = safeGradientStops(theme.backgroundGradient.stops)
      .map((s) => `${s.color} ${s.offset}%`)
      .join(", ");
    return `linear-gradient(${angle}deg, ${stops})`;
  }
  return solid;
}

function safeFontId(v: unknown, fallback: string): string {
  return typeof v === "string" && FONT_PRESETS.some((f) => f.id === v) ? v : fallback;
}

function safeIconId(v: unknown): IconId {
  return typeof v === "string" && (ICON_ALLOWLIST as readonly string[]).includes(v) ? (v as IconId) : "leaf";
}

function safeTextAlign(v: unknown): TextAlign {
  return v === "center" || v === "right" ? v : "left";
}

function safeLineHeight(v: unknown, fallback = 1.35): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(2.5, Math.max(0.8, n)) : fallback;
}

function safeLetterSpacing(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(3, Math.max(-1, n)) : fallback;
}

function safeListStyle(v: unknown): ListStyle {
  return v === "bullet" || v === "number" ? v : "none";
}

function safeTextEffect(v: unknown): TextEffect {
  return v === "shadow" || v === "outline" ? v : "none";
}

// Shared by every text-bearing element type (freeform "text" and the bound
// heading/body types) so the rich-formatting fields get the same
// allowlist/clamp treatment everywhere, regardless of which branch below
// builds the element.
function richStyleFields(style: Record<string, unknown>) {
  return {
    bold: style.bold === true,
    italic: style.italic === true,
    underline: style.underline === true,
    textAlign: safeTextAlign(style.textAlign),
    lineHeight: safeLineHeight(style.lineHeight),
    letterSpacing: safeLetterSpacing(style.letterSpacing),
    listStyle: safeListStyle(style.listStyle),
    textEffect: safeTextEffect(style.textEffect),
  };
}

export type LayoutVariant = "classic" | "photo-focus" | "centered";

interface LayoutCtx {
  zones: ZoneLayout["zones"];
  widthMm: number;
  heightMm: number;
  fontId: string;
  primaryColor: string;
  accentColor: string;
  bodyColor: string;
}

// Shared tail every variant reuses verbatim: claims/ingredients/statutory
// marks/nutrition panel/footer never move between variants — only the
// header block (photo + product name + tagline) differs. Keeping these
// identical across variants means the compliance-relevant content always
// starts in the same well-tested positions regardless of which starting
// look a customer picks.
function sharedTail(ctx: LayoutCtx): CanvasElement[] {
  const { zones, fontId, accentColor, bodyColor } = ctx;
  const left = zones.left;
  const ingredientsH = left.h * 0.6;
  const statutoryH = left.h * 0.4;
  return [
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
}

// Today's exact original arrangement: photo left, name+tagline stacked
// beside it, filling the rest of the header width.
function buildClassicLayout(ctx: LayoutCtx): CanvasElement[] {
  const { zones, widthMm, heightMm, fontId, primaryColor } = ctx;
  const header = zones.header;
  const headerHeightMm = (header.h / 100) * heightMm;
  const photoWPct = Math.min(header.w * 0.6, (headerHeightMm / widthMm) * 100);
  const gapPct = 2;
  const textX = header.x + photoWPct + gapPct;
  const textW = Math.max(10, header.w - photoWPct - gapPct);

  return [
    { id: newId(), type: "photo", x: header.x, y: header.y, w: photoWPct, h: header.h, imagePosition: { x: 50, y: 50, scale: 1 } },
    { id: newId(), type: "productName", x: textX, y: header.y, w: textW, h: header.h * 0.55, style: { fontId, fontSize: 5, color: primaryColor } },
    { id: newId(), type: "tagline", x: textX, y: header.y + header.h * 0.55, w: textW, h: header.h * 0.45, style: { fontId, fontSize: 2.4, color: "#5b6472" } },
    ...sharedTail(ctx),
  ];
}

// Bigger, wide photo across the whole header width; name/tagline stack
// underneath instead of beside it — for customers who want the product
// photo to dominate.
function buildPhotoFocusLayout(ctx: LayoutCtx): CanvasElement[] {
  const { zones, fontId, primaryColor } = ctx;
  const header = zones.header;
  const photoH = header.h * 0.7;
  const nameH = header.h * 0.18;
  const tagH = header.h * 0.12;

  return [
    { id: newId(), type: "photo", x: header.x, y: header.y, w: header.w, h: photoH, imagePosition: { x: 50, y: 50, scale: 1 } },
    { id: newId(), type: "productName", x: header.x, y: header.y + photoH, w: header.w, h: nameH, style: { fontId, fontSize: 5, color: primaryColor } },
    { id: newId(), type: "tagline", x: header.x, y: header.y + photoH + nameH, w: header.w, h: tagH, style: { fontId, fontSize: 2.4, color: "#5b6472" } },
    ...sharedTail(ctx),
  ];
}

// Photo centered above the name/tagline, both narrower than the full
// header width — a calmer, more symmetrical starting look. Ingredients/
// statutory marks/nutrition panel/footer are unchanged from classic (see
// sharedTail) — this variant only changes the header block's arrangement,
// not every element's position, and does not center text within its box.
function buildCenteredLayout(ctx: LayoutCtx): CanvasElement[] {
  const { zones, fontId, primaryColor } = ctx;
  const header = zones.header;
  const photoW = header.w * 0.4;
  const photoX = header.x + (header.w - photoW) / 2;
  const photoH = header.h * 0.55;
  const nameH = header.h * 0.25;
  const tagH = header.h * 0.2;

  return [
    { id: newId(), type: "photo", x: photoX, y: header.y, w: photoW, h: photoH, imagePosition: { x: 50, y: 50, scale: 1 } },
    { id: newId(), type: "productName", x: header.x, y: header.y + photoH, w: header.w, h: nameH, style: { fontId, fontSize: 5, color: primaryColor } },
    { id: newId(), type: "tagline", x: header.x, y: header.y + photoH + nameH, w: header.w, h: tagH, style: { fontId, fontSize: 2.4, color: "#5b6472" } },
    ...sharedTail(ctx),
  ];
}

// Maps each seeded pack_format_templates.zone_layout rect (see
// supabase/migrations/0001_init.sql) into starter element positions, so a
// customer who opens the editor for the first time sees their already-
// collected data arranged sensibly instead of a blank canvas — "auto-fill
// the area" without generating any new artwork. `variant` picks between a
// few hand-designed starting arrangements (a small "template gallery," not
// an external one) — default reproduces the original single arrangement
// byte-for-byte, so every existing caller that doesn't pass a variant is
// unaffected.
export function buildDefaultLayout(
  template: PackFormatTemplate,
  category: ProductCategory,
  panel: CategoryPanelTemplate | null,
  opts?: { fontId?: string; primaryColor?: string; accentColor?: string; variant?: LayoutVariant }
): CanvasElement[] {
  const ctx: LayoutCtx = {
    zones: template.zone_layout.zones,
    widthMm: template.trim_width_mm + template.bleed_mm * 2,
    heightMm: template.trim_height_mm + template.bleed_mm * 2,
    fontId: opts?.fontId && FONT_PRESETS.some((f) => f.id === opts.fontId) ? opts.fontId : "sans-modern",
    primaryColor: opts?.primaryColor && HEX.test(opts.primaryColor) ? opts.primaryColor : "#1f4d38",
    accentColor: opts?.accentColor && HEX.test(opts.accentColor) ? opts.accentColor : "#2e6b4f",
    bodyColor: "#1b2430",
  };

  switch (opts?.variant) {
    case "photo-focus":
      return buildPhotoFocusLayout(ctx);
    case "centered":
      return buildCenteredLayout(ctx);
    default:
      return buildClassicLayout(ctx);
  }
}

export const LAYOUT_VARIANTS: { id: LayoutVariant; label: string; description: string }[] = [
  { id: "classic", label: "Classic", description: "Photo beside your brand name — the standard layout." },
  { id: "photo-focus", label: "Photo focus", description: "A larger photo across the top, name and tagline below it." },
  { id: "centered", label: "Centered", description: "Photo and name centered as a calm, symmetrical block." },
];

export interface LabelTemplate {
  id: string;
  name: string;
  variant: LayoutVariant;
  fontId: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
}

// A small "template" gallery: real combinations of an existing layout
// variant, font pairing, and color pair (the exact same colors as
// THEME_PRESETS in lib/types.ts) — not new invented designs or content.
// Picking one only re-arranges/re-styles the customer's own real data,
// same compliance boundary as buildDefaultLayout below.
export const LABEL_TEMPLATES: LabelTemplate[] = [
  { id: "classic-forest", name: "Classic Forest", variant: "classic", fontId: "sans-modern", primaryColor: "#1f4d38", accentColor: "#2e6b4f", backgroundColor: "#ffffff" },
  { id: "photo-ocean", name: "Photo Focus Blue", variant: "photo-focus", fontId: "sans-modern", primaryColor: "#1d4ed8", accentColor: "#60a5fa", backgroundColor: "#ffffff" },
  { id: "centered-sunset", name: "Centered Sunset", variant: "centered", fontId: "serif-classic", primaryColor: "#9a3412", accentColor: "#f97316", backgroundColor: "#fffaf5" },
  { id: "classic-plum", name: "Classic Plum", variant: "classic", fontId: "serif-classic", primaryColor: "#4c1d95", accentColor: "#a78bfa", backgroundColor: "#ffffff" },
  { id: "photo-slate", name: "Photo Focus Slate", variant: "photo-focus", fontId: "mono-technical", primaryColor: "#1e293b", accentColor: "#64748b", backgroundColor: "#f8fafc" },
  { id: "centered-rose", name: "Centered Rose", variant: "centered", fontId: "sans-modern", primaryColor: "#701a75", accentColor: "#d946ef", backgroundColor: "#fdf4ff" },
];

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
      locked: el.locked === true,
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
    } else if (type === "icon") {
      validated.push({
        ...base,
        type: "icon",
        iconId: safeIconId(el.iconId),
        color: safeHex(el.color, "#1b2430"),
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
          ...richStyleFields(style),
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
          ...richStyleFields(style),
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

// A label order can have more than one page (e.g. front + back), all
// sharing the same template/category/panel/font — page 1 is always
// label_orders.canvas_layout, validated by validateCanvasElements() above;
// this validates the array of EXTRA pages (label_orders.extra_pages), each
// page independently self-healed the same way page 1 is.
export const MAX_LABEL_PAGES = 6;

export function validateExtraPages(
  raw: unknown,
  ctx: { orderFontId: string; template: PackFormatTemplate; category: ProductCategory; panel: CategoryPanelTemplate | null }
): CanvasElement[][] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_LABEL_PAGES - 1).map((pageElements) => validateCanvasElements(pageElements, ctx));
}
