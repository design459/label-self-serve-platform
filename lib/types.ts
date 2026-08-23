// CanvasElement is defined in ./canvasLayout, which itself imports several
// types from this file — kept as a type-only import so there's no runtime
// circular dependency (erased entirely at compile time).
import type { CanvasElement } from "./canvasLayout";

export type PackFormat = "pouch" | "capsule_bottle" | "jar" | "sachet";

export const PACK_FORMATS: PackFormat[] = ["pouch", "capsule_bottle", "jar", "sachet"];

export type LabelOrderStatus = "draft" | "in_progress" | "submitted" | "approved" | "rejected";

// Product type — orthogonal to PackFormat (physical packaging). Drives
// which nutrition/supplement panel field set applies. See
// supabase/migrations/0003_customer_self_serve.sql.
export type ProductCategory = "capsule_tablet" | "powder" | "juice_beverage" | "bar" | "spread" | "other";

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "capsule_tablet",
  "powder",
  "juice_beverage",
  "bar",
  "spread",
  "other",
];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  capsule_tablet: "Capsule / Tablet",
  powder: "Powder",
  juice_beverage: "Juice / Beverage",
  bar: "Bar",
  spread: "Spread",
  other: "Other",
};

export type PanelStyle = "supplement_facts" | "nutrition_facts" | "blank";

export interface NutritionField {
  key: string;
  label: string;
  type: "text" | "textarea";
}

export interface CategoryPanelTemplate {
  id: string;
  category: ProductCategory;
  display_label: string;
  panel_style: PanelStyle;
  default_pack_format: PackFormat;
  field_schema: NutritionField[];
}

export interface FontPairing {
  id: string;
  label: string;
  heading: string;
  body: string;
}

// Generic CSS keyword stacks only — no named webfont families. The
// print-proof renderer runs headless Chromium under @sparticuz/chromium in
// a Netlify Function with a minimal bundled font set and no network
// access, so a named font like "Georgia" isn't guaranteed to exist there
// the way it does on a desktop browser. Generic keywords always resolve.
//
// The three Sinhala/Tamil entries below are the one exception: they name
// real webfont families (loaded via app/globals.css for the live editor/
// preview, and self-hosted as base64 @font-face data in lib/artboard.ts
// for the actual PDF render — see lib/fontAssets.ts) rather than a generic
// keyword, since no generic CSS font keyword renders those scripts at all.
// Latin characters typed alongside Sinhala/Tamil text still fall through
// to each stack's trailing sans-serif, so this doesn't regress the
// "always resolves" guarantee above for everything else on the label.
export const FONT_PRESETS: FontPairing[] = [
  { id: "sans-modern", label: "Modern sans", heading: "system-ui, sans-serif", body: "system-ui, sans-serif" },
  { id: "serif-classic", label: "Classic serif", heading: "serif", body: "sans-serif" },
  { id: "mono-technical", label: "Technical mono", heading: "monospace", body: "sans-serif" },
  { id: "sinhala-noto", label: "Sinhala (Noto Sans)", heading: "'Noto Sans Sinhala', sans-serif", body: "'Noto Sans Sinhala', sans-serif" },
  { id: "tamil-noto", label: "Tamil (Noto Sans)", heading: "'Noto Sans Tamil', sans-serif", body: "'Noto Sans Tamil', sans-serif" },
  { id: "sinhala-yaldevi", label: "Sinhala (Yaldevi)", heading: "'Yaldevi', sans-serif", body: "'Yaldevi', sans-serif" },
];

export interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ZoneLayout {
  zones: {
    header: Zone;
    claims: Zone;
    left: Zone;
    right: Zone;
    footer: Zone;
  };
}

export interface PackFormatTemplate {
  id: string;
  pack_format: PackFormat;
  name: string;
  trim_width_mm: number;
  trim_height_mm: number;
  bleed_mm: number;
  safety_mm: number;
  zone_layout: ZoneLayout;
  is_active: boolean;
}

export interface Theme {
  primaryColor: string;
  accentColor: string;
  // backgroundColor is always kept up to date even in "gradient" mode (the
  // last solid color the customer had), so switching the Color/Gradient
  // toggle back to Color has something sane to land on.
  backgroundColor: string;
  backgroundType?: "color" | "gradient";
  backgroundGradient?: { angle: number; stops: { offset: number; color: string }[] } | null;
  // Colors the customer has explicitly saved to this order's palette via
  // the background editor's "+" button — separate from the fixed
  // THEME_PRESETS swatches, which are the same for every order.
  customColors?: string[];
}

export const THEME_PRESETS: Theme[] = [
  { primaryColor: "#1f4d38", accentColor: "#2e6b4f", backgroundColor: "#ffffff" },
  { primaryColor: "#1d4ed8", accentColor: "#60a5fa", backgroundColor: "#ffffff" },
  { primaryColor: "#9a3412", accentColor: "#f97316", backgroundColor: "#fffaf5" },
  { primaryColor: "#4c1d95", accentColor: "#a78bfa", backgroundColor: "#ffffff" },
  { primaryColor: "#1e293b", accentColor: "#64748b", backgroundColor: "#f8fafc" },
  { primaryColor: "#701a75", accentColor: "#d946ef", backgroundColor: "#fdf4ff" },
];

export interface NutritionPanel {
  servingSize?: string;
  servingsPerContainer?: string;
  calories?: string;
  totalFat?: string;
  sodium?: string;
  totalCarb?: string;
  protein?: string;
  [key: string]: string | undefined;
}

export interface RegulatoryContent {
  ingredients: string;
  nutrition_panel: NutritionPanel;
  claims: string;
  batch_code: string;
  manufacture_date: string;
  expiry_date: string;
  statutory_marks: string;
}

export interface ImagePosition {
  x: number;
  y: number;
  scale: number;
}

export interface LabelOrder {
  id: string;
  customer_name: string;
  company_name: string | null;
  customer_email: string;
  sku_code: string;
  product_name: string;
  pack_format: PackFormat;
  category: ProductCategory;
  display_name: string | null;
  marketing_tagline: string | null;
  font_id: string;
  // Superseded by the photo element's own imagePosition inside
  // canvas_layout (see lib/canvasLayout.ts) — column kept, no longer
  // actively written to.
  image_position: ImagePosition;
  canvas_layout: CanvasElement[] | null;
  // Extra label faces beyond page 1 (front/back, ...) — see
  // supabase/migrations/0005_multi_page.sql. NULL/empty = single-page order.
  extra_pages: CanvasElement[][] | null;
  source: "staff" | "customer";
  access_token: string;
  status: LabelOrderStatus;
  revision_limit: number;
  revisions_used: number;
  selected_template_id: string | null;
  theme: Theme | null;
  created_at: string;
}

export interface LabelDesign {
  id: string;
  label_order_id: string;
  revision_number: number;
  theme: Theme | null;
  proof_storage_path: string | null;
  is_submitted: boolean;
  created_at: string;
}

export const PACK_FORMAT_LABELS: Record<PackFormat, string> = {
  pouch: "Stand-up pouch",
  capsule_bottle: "Capsule bottle",
  jar: "Jar",
  sachet: "Single-serve sachet",
};

// Starter catalog (7 Ancient Nutra bestsellers) for the product picker on
// /admin/orders/new — see supabase/migrations/0002_products.sql.
export interface CatalogProduct {
  id: string;
  name: string;
  pack_format: PackFormat;
  category: ProductCategory;
  ingredients: string;
  claims: string;
  statutory_marks: string;
  // Split out of statutory_marks (see 0007_description_and_warnings.sql) —
  // these feed the Supplement/Nutrition Facts panel's own suggestedUse/
  // warnings fields, not the free-text "Description" field.
  suggested_use: string;
  warnings: string;
  serving_size: string;
  calories: string;
}
