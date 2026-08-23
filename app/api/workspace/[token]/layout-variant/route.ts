import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, logAudit } from "@/lib/supabaseServer";
import { buildDefaultLayout, validateCanvasElements, LayoutVariant, LABEL_TEMPLATES } from "@/lib/canvasLayout";
import { CategoryPanelTemplate, PackFormatTemplate } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";

const VALID_VARIANTS: LayoutVariant[] = ["classic", "photo-focus", "centered"];

// Applies either a plain layout variant or a full LABEL_TEMPLATES preset
// (variant + font + colors) as the order's canvas_layout. Distinct from
// layout/route.ts (which saves a customer's own edited arrangement) — this
// always starts from a fresh, server-computed default, so it's meant to be
// used before or instead of manual customization, never merged with it.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });
    if (order.status === "approved") {
      return NextResponse.json({ error: "This label is already approved and locked." }, { status: 409 });
    }
    if (!order.selected_template_id) {
      return NextResponse.json({ error: "Pick a label size before designing." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const chosenTemplate = LABEL_TEMPLATES.find((t) => t.id === body?.templateId) ?? null;
    const variant: LayoutVariant = chosenTemplate ? chosenTemplate.variant : VALID_VARIANTS.includes(body?.variant) ? body.variant : "classic";
    // Defaults to true (the original behavior: immediately overwrite the
    // order's page-1 canvas_layout) — the full-page editor's Templates tab
    // passes apply:false instead, since there it's just computing a fresh
    // default for whichever page is currently active (which might not be
    // page 1) and relies on its own local draft + Save & close to persist,
    // same as every other edit made in that editor.
    const shouldSave = body?.apply !== false;

    const db = supabaseAdmin();
    const [{ data: template }, { data: panelTemplate }] = await Promise.all([
      db.from("pack_format_templates").select("*").eq("id", order.selected_template_id).single(),
      db.from("category_panel_templates").select("*").eq("category", order.category).maybeSingle(),
    ]);
    if (!template) return NextResponse.json({ error: "Selected label size not found." }, { status: 400 });

    const panel = panelTemplate as CategoryPanelTemplate | null;
    const draft = buildDefaultLayout(template as PackFormatTemplate, order.category, panel, {
      fontId: chosenTemplate?.fontId ?? order.font_id,
      primaryColor: chosenTemplate?.primaryColor,
      accentColor: chosenTemplate?.accentColor,
      variant,
    });
    // Run through the same validator as a manual save — cheap, and keeps
    // "every write to canvas_layout is validated" true with no special case.
    const validated = validateCanvasElements(draft, {
      orderFontId: order.font_id,
      template: template as PackFormatTemplate,
      category: order.category,
      panel,
    });

    if (shouldSave) {
      const updatePatch: Record<string, unknown> = { canvas_layout: validated, updated_at: new Date().toISOString() };
      // A chosen LABEL_TEMPLATES preset also resets the order's default
      // font and theme colors to match — a plain variant (no templateId)
      // only ever touches the arrangement, never these.
      if (chosenTemplate) {
        updatePatch.font_id = chosenTemplate.fontId;
        updatePatch.theme = {
          primaryColor: chosenTemplate.primaryColor,
          accentColor: chosenTemplate.accentColor,
          backgroundColor: chosenTemplate.backgroundColor,
          backgroundType: "color",
          backgroundGradient: null,
          customColors: [],
        };
      }
      const { error: updateError } = await db.from("label_orders").update(updatePatch).eq("id", order.id);
      if (updateError) {
        return NextResponse.json({ error: `Failed to apply layout: ${updateError.message}` }, { status: 500 });
      }
      await logAudit(order.id, "customer", "layout_variant_applied", { variant, templateId: chosenTemplate?.id ?? null });
    }

    return NextResponse.json({ ok: true, elements: validated, backgroundColor: chosenTemplate?.backgroundColor ?? null });
  } catch (err) {
    return apiCatch(err);
  }
}
