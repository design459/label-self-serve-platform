import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, uploadAsset, logAudit } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });
    if (order.status === "approved") {
      return NextResponse.json({ error: "This label is already approved and locked." }, { status: 409 });
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("logo");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No logo file provided." }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Logo must be PNG, JPEG, WEBP or SVG." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Logo must be under 5MB." }, { status: 400 });
    }

    const ext = file.type.split("/")[1].replace("svg+xml", "svg");
    const path = `orders/${order.id}/logo.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadAsset(path, buffer, file.type);

    const db = supabaseAdmin();
    const { error: deleteError } = await db.from("label_assets").delete().eq("label_order_id", order.id).eq("kind", "logo");
    if (deleteError) {
      return NextResponse.json({ error: `Failed to replace existing logo: ${deleteError.message}` }, { status: 500 });
    }
    const { error: insertError } = await db
      .from("label_assets")
      .insert({ label_order_id: order.id, kind: "logo", storage_path: path });
    if (insertError) {
      return NextResponse.json({ error: `Failed to save logo: ${insertError.message}` }, { status: 500 });
    }
    await logAudit(order.id, "customer", "logo_uploaded", { path });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiCatch(err);
  }
}
