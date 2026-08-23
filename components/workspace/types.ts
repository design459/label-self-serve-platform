import { CategoryPanelTemplate, ImagePosition, NutritionPanel, PackFormatTemplate, ProductCategory, Theme } from "@/lib/types";
import { CanvasElement, BackgroundGradient } from "@/lib/canvasLayout";

// The background-related theme fields the full-page editor (EditorPage.tsx)
// keeps as live, undo/redo-tracked state and threads down through
// CanvasEditor.tsx to BackgroundPanel.tsx — a subset of Theme (lib/types.ts)
// since primaryColor/accentColor aren't customer-editable here.
export interface ThemeEdits {
  backgroundColor: string;
  backgroundType: "color" | "gradient";
  backgroundGradient: BackgroundGradient | null;
  customColors: string[];
}

// Mirrors the JSON shape returned by
// app/api/workspace/[token]/summary/route.ts — kept local to the
// workspace components rather than in lib/types.ts since it's an API
// response shape, not a DB row shape.
export interface Summary {
  order: {
    id: string;
    customerName: string;
    skuCode: string;
    productName: string;
    packFormat: string;
    category: ProductCategory;
    displayName: string | null;
    marketingTagline: string | null;
    fontId: string;
    imagePosition: ImagePosition;
    status: "draft" | "in_progress" | "submitted" | "approved" | "rejected";
    revisionLimit: number;
    revisionsUsed: number;
    selectedTemplateId: string | null;
    theme: Theme | null;
  };
  templates: PackFormatTemplate[];
  hasLogo: boolean;
  logoUrl: string | null;
  imageUrls: Record<string, string>;
  regulatory: {
    ingredients: string | null;
    claims: string | null;
    statutory_marks: string | null;
    batch_code: string | null;
    manufacture_date: string | null;
    expiry_date: string | null;
    nutrition_panel: NutritionPanel | null;
  } | null;
  panel: CategoryPanelTemplate | null;
  canvasLayout: CanvasElement[] | null;
  elements: CanvasElement[];
  extraPages: CanvasElement[][];
  pageCount: number;
  latestDesign: { id: string; revisionNumber: number; isSubmitted: boolean } | null;
  needsRegeneration: boolean;
  hasSubmittedBefore: boolean;
  proofUrl: string | null;
  proofUrls: string[];
  printUrl: string | null;
  lastReview: { decision: string; reason: string | null } | null;
}

export async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
