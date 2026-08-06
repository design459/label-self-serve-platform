import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, logAudit } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });
    if (order.status === "approved") {
      return NextResponse.json({ error: "This label is already approved." }, { status: 409 });
    }

    const db = supabaseAdmin();
    const { data: latestDesign } = await db
      .from("label_designs")
      .select("*")
      .eq("label_order_id", order.id)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestDesign || !latestDesign.proof_storage_path) {
      return NextResponse.json({ error: "Generate a proof before submitting for review." }, { status: 400 });
    }

    const { error: designError } = await db
      .from("label_designs")
      .update({ is_submitted: true })
      .eq("id", latestDesign.id);
    if (designError) {
      return NextResponse.json({ error: `Failed to mark design submitted: ${designError.message}` }, { status: 500 });
    }
    const { error: orderError } = await db
      .from("label_orders")
      .update({ status: "submitted", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (orderError) {
      return NextResponse.json({ error: `Failed to update order status: ${orderError.message}` }, { status: 500 });
    }
    await logAudit(order.id, "customer", "submitted_for_review", { designId: latestDesign.id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiCatch(err);
  }
}
