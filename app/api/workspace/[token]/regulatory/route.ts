import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, logAudit } from "@/lib/supabaseServer";
import { CategoryPanelTemplate } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// The first customer-facing way to ever write regulatory content — before
// this route, only staff (via NewOrderForm.tsx at order-creation time)
// could ever set ingredients/nutrition/claims/statutory marks. A
// self-serve customer types their own real values here; the platform still
// never invents any of it (see the public order-creation route, which
// always starts these fields blank for a custom/non-catalog product).
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });
    if (order.status === "approved") {
      return NextResponse.json({ error: "This label is already approved and locked." }, { status: 409 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const db = supabaseAdmin();
    const { data: panel } = await db
      .from("category_panel_templates")
      .select("*")
      .eq("category", order.category)
      .maybeSingle();

    // Unknown nutrition_panel keys are stripped here at write time, not
    // just skipped later at render time — keeps stored data honest even if
    // something else ever reads this table directly.
    const allowedKeys = new Set(((panel as CategoryPanelTemplate | null)?.field_schema ?? []).map((f) => f.key));
    const incomingPanel = body.nutritionPanel && typeof body.nutritionPanel === "object" ? body.nutritionPanel : {};
    const nutritionPanel: Record<string, string> = {};
    for (const key of Object.keys(incomingPanel)) {
      if (allowedKeys.has(key) && typeof incomingPanel[key] === "string") {
        nutritionPanel[key] = incomingPanel[key];
      }
    }

    const { error: updateError } = await db
      .from("label_regulatory_content")
      .update({
        ingredients: str(body.ingredients),
        claims: str(body.claims),
        statutory_marks: str(body.statutoryMarks),
        batch_code: str(body.batchCode),
        manufacture_date: body.manufactureDate || null,
        expiry_date: body.expiryDate || null,
        nutrition_panel: nutritionPanel,
        updated_at: new Date().toISOString(),
      })
      .eq("label_order_id", order.id);

    if (updateError) {
      return NextResponse.json({ error: `Failed to save regulatory content: ${updateError.message}` }, { status: 500 });
    }

    await logAudit(order.id, "customer", "regulatory_updated", {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiCatch(err);
  }
}
