import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, uploadAsset, signedUrlFor, logAudit } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

// A customer's freeform image library — distinct from /logo (the one
// required "product photo" slot): any number of these can be uploaded and
// placed on the canvas as "image" elements (lib/canvasLayout.ts), and
// unlike a logo replace, uploading a new one never removes an old one.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });

    const db = supabaseAdmin();
    const { data: assets } = await db
      .from("label_assets")
      .select("*")
      .eq("label_order_id", order.id)
      .eq("kind", "image")
      .order("uploaded_at", { ascending: false });

    const images = await Promise.all(
      (assets ?? []).map(async (a) => ({ id: a.id as string, url: await signedUrlFor(a.storage_path) }))
    );

    return NextResponse.json({ images: images.filter((i) => i.url !== null) });
  } catch (err) {
    return apiCatch(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });
    if (order.status === "approved") {
      return NextResponse.json({ error: "This label is already approved and locked." }, { status: 409 });
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("image");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "Image must be PNG, JPEG or WEBP." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be under 5MB." }, { status: 400 });
    }

    const ext = file.type.split("/")[1];
    const path = `orders/${order.id}/images/${randomBytes(8).toString("hex")}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadAsset(path, buffer, file.type);

    const db = supabaseAdmin();
    const { data: inserted, error: insertError } = await db
      .from("label_assets")
      .insert({ label_order_id: order.id, kind: "image", storage_path: path })
      .select()
      .single();
    if (insertError) {
      return NextResponse.json({ error: `Failed to save image: ${insertError.message}` }, { status: 500 });
    }
    await logAudit(order.id, "customer", "image_uploaded", { path });

    const url = await signedUrlFor(path);
    return NextResponse.json({ id: inserted.id, url });
  } catch (err) {
    return apiCatch(err);
  }
}
