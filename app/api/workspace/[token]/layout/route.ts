import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, logAudit } from "@/lib/supabaseServer";
import { validateCanvasElements } from "@/lib/canvasLayout";
import { CategoryPanelTemplate, PackFormatTemplate } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";

// Saves the customer's freeform canvas arrangement. Validation
// (validateCanvasElements) clamps every position/size, allowlists
// fonts/colors, length-caps free text, and self-heals any missing required
// bound element with a server-computed default — see lib/canvasLayout.ts.
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
    if (!body || !Array.isArray(body.elements)) {
      return NextResponse.json({ error: "elements array is required." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const [{ data: template }, { data: panelTemplate }] = await Promise.all([
      db.from("pack_format_templates").select("*").eq("id", order.selected_template_id).single(),
      db.from("category_panel_templates").select("*").eq("category", order.category).maybeSingle(),
    ]);
    if (!template) return NextResponse.json({ error: "Selected label size not found." }, { status: 400 });

    const validated = validateCanvasElements(body.elements, {
      orderFontId: order.font_id,
      template: template as PackFormatTemplate,
      category: order.category,
      panel: panelTemplate as CategoryPanelTemplate | null,
    });

    const { error: updateError } = await db
      .from("label_orders")
      .update({ canvas_layout: validated, updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (updateError) {
      return NextResponse.json({ error: `Failed to save layout: ${updateError.message}` }, { status: 500 });
    }

    await logAudit(order.id, "customer", "layout_updated", {});

    return NextResponse.json({ ok: true, elements: validated });
  } catch (err) {
    return apiCatch(err);
  }
}
