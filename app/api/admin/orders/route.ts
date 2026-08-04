import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { currentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin, logAudit } from "@/lib/supabaseServer";
import { PackFormat } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";

const PACK_FORMATS: PackFormat[] = ["pouch", "capsule_bottle", "jar", "sachet"];

export async function POST(req: NextRequest) {
  try {
    const staff = await currentStaff();
    if (!staff) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid request body." }, { status: 400 });

    const { customerName, customerEmail, skuCode, productName, packFormat, revisionLimit, regulatory } = body;

    if (!customerName || !customerEmail || !skuCode || !packFormat) {
      return NextResponse.json(
        { error: "customerName, customerEmail, skuCode and packFormat are required." },
        { status: 400 }
      );
    }
    if (!PACK_FORMATS.includes(packFormat)) {
      return NextResponse.json({ error: `packFormat must be one of ${PACK_FORMATS.join(", ")}` }, { status: 400 });
    }

    const db = supabaseAdmin();
    const accessToken = randomBytes(24).toString("hex");

    const { data: order, error: orderError } = await db
      .from("label_orders")
      .insert({
        customer_name: customerName,
        customer_email: customerEmail,
        sku_code: skuCode,
        product_name: productName || "",
        pack_format: packFormat,
        access_token: accessToken,
        revision_limit: Number(revisionLimit) > 0 ? Number(revisionLimit) : 5,
        created_by: staff.userId,
      })
      .select()
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: orderError?.message ?? "Failed to create order." }, { status: 500 });
    }

    const { error: contentError } = await db.from("label_regulatory_content").insert({
      label_order_id: order.id,
      ingredients: regulatory?.ingredients ?? "",
      nutrition_panel: regulatory?.nutritionPanel ?? {},
      claims: regulatory?.claims ?? "",
      batch_code: regulatory?.batchCode ?? "",
      manufacture_date: regulatory?.manufactureDate || null,
      expiry_date: regulatory?.expiryDate || null,
      statutory_marks: regulatory?.statutoryMarks ?? "",
    });

    if (contentError) {
      return NextResponse.json({ error: contentError.message }, { status: 500 });
    }

    await logAudit(order.id, `staff:${staff.email ?? staff.userId}`, "link_issued", {
      customer_email: customerEmail,
      sku_code: skuCode,
    });

    return NextResponse.json({ id: order.id, accessToken });
  } catch (err) {
    return apiCatch(err);
  }
}
