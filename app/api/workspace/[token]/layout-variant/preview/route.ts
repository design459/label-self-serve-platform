import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { buildDefaultLayout, validateCanvasElements, LABEL_TEMPLATES } from "@/lib/canvasLayout";
import { CategoryPanelTemplate, PackFormatTemplate } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";

// Read-only preview of every LABEL_TEMPLATES preset computed against this
// order's own real category/pack-format/panel — lets the Templates tab
// show the customer's own real product data (name, ingredients, uploaded
// photo, ...) inside each template card instead of an abstract mockup.
// Distinct from layout-variant/route.ts: this never persists anything,
// same as that route's apply:false path, just for every preset at once
// instead of one at a time.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });
    if (!order.selected_template_id) return NextResponse.json({ templates: {} });

    const db = supabaseAdmin();
    const [{ data: template }, { data: panelTemplate }] = await Promise.all([
      db.from("pack_format_templates").select("*").eq("id", order.selected_template_id).single(),
      db.from("category_panel_templates").select("*").eq("category", order.category).maybeSingle(),
    ]);
    if (!template) return NextResponse.json({ templates: {} });

    const panel = panelTemplate as CategoryPanelTemplate | null;
    const templates: Record<string, ReturnType<typeof validateCanvasElements>> = {};
    for (const t of LABEL_TEMPLATES) {
      const draft = buildDefaultLayout(template as PackFormatTemplate, order.category, panel, {
        fontId: t.fontId,
        primaryColor: t.primaryColor,
        accentColor: t.accentColor,
        variant: t.variant,
      });
      templates[t.id] = validateCanvasElements(draft, {
        orderFontId: order.font_id,
        template: template as PackFormatTemplate,
        category: order.category,
        panel,
      });
    }

    return NextResponse.json({ templates });
  } catch (err) {
    return apiCatch(err);
  }
}
