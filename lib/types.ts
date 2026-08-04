export type PackFormat = "pouch" | "capsule_bottle" | "jar" | "sachet";

export type LabelOrderStatus = "draft" | "in_progress" | "submitted" | "approved" | "rejected";

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
  backgroundColor: string;
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

export interface LabelOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  sku_code: string;
  product_name: string;
  pack_format: PackFormat;
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
