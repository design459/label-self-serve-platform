import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, logAudit } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });
    if (order.status === "approved") {
      return NextResponse.json({ error: "This label is already approved and locked." }, { status: 409 });
    }

    const body = await req.json().catch(() => null);
    const templateId = body?.templateId;
    if (!templateId) return NextResponse.json({ error: "templateId is required." }, { status: 400 });

    const db = supabaseAdmin();
    const { data: template } = await db
      .from("pack_format_templates")
      .select("id")
      .eq("id", templateId)
      .eq("pack_format", order.pack_format)
      .maybeSingle();

    if (!template) {
      return NextResponse.json({ error: "That template doesn't match this order's pack format." }, { status: 400 });
    }

    const { data: updated, error: updateError } = await db
      .from("label_orders")
      .update({ selected_template_id: templateId, updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .select()
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: `Failed to save template selection: ${updateError.message}` }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: "Template update affected 0 rows — order id mismatch." }, { status: 500 });
    }

    await logAudit(order.id, "customer", "template_selected", { templateId });

    return NextResponse.json({ ok: true, selectedTemplateId: updated.selected_template_id });
  } catch (err) {
    return apiCatch(err);
  }
}
