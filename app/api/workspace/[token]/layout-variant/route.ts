import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, logAudit } from "@/lib/supabaseServer";
import { buildDefaultLayout, validateCanvasElements, LayoutVariant } from "@/lib/canvasLayout";
import { CategoryPanelTemplate, PackFormatTemplate } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";

const VALID_VARIANTS: LayoutVariant[] = ["classic", "photo-focus", "centered"];

// Applies one of a few hand-designed starting arrangements (the "template
// gallery" — see lib/canvasLayout.ts's LAYOUT_VARIANTS) as the order's
// canvas_layout. Distinct from layout/route.ts (which saves a customer's
// own edited arrangement) — this always starts from a fresh, server-
// computed default, so it's meant to be used before or instead of manual
// customization, never merged with it.
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
    const variant: LayoutVariant = VALID_VARIANTS.includes(body?.variant) ? body.variant : "classic";

    const db = supabaseAdmin();
    const [{ data: template }, { data: panelTemplate }] = await Promise.all([
      db.from("pack_format_templates").select("*").eq("id", order.selected_template_id).single(),
      db.from("category_panel_templates").select("*").eq("category", order.category).maybeSingle(),
    ]);
    if (!template) return NextResponse.json({ error: "Selected label size not found." }, { status: 400 });

    const panel = panelTemplate as CategoryPanelTemplate | null;
    const draft = buildDefaultLayout(template as PackFormatTemplate, order.category, panel, {
      fontId: order.font_id,
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

    const { error: updateError } = await db
      .from("label_orders")
      .update({ canvas_layout: validated, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (updateError) {
      return NextResponse.json({ error: `Failed to apply layout: ${updateError.message}` }, { status: 500 });
    }

    await logAudit(order.id, "customer", "layout_variant_applied", { variant });

    return NextResponse.json({ ok: true, elements: validated });
  } catch (err) {
    return apiCatch(err);
  }
}
