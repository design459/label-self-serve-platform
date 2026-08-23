import { NextRequest, NextResponse } from "next/server";
import { currentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { renderDesignPdf, withRenderTimeout } from "@/lib/renderOrderPdf";
import { apiCatch } from "@/lib/apiError";

// Staff-only on-demand PDF of the currently submitted proof — separate
// from the official print-ready PDF, which is only ever produced on
// approval (see ../route.ts's POST handler). This one always carries the
// "not approved for print" watermark, same as the on-screen proof image,
// since the label hasn't been approved yet.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const staff = await currentStaff();
    if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const db = supabaseAdmin();
    const { data: order } = await db.from("label_orders").select("id, sku_code").eq("id", params.id).maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const { data: design } = await db
      .from("label_designs")
      .select("*")
      .eq("label_order_id", order.id)
      .eq("is_submitted", true)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!design) return NextResponse.json({ error: "Nothing submitted for this order yet." }, { status: 404 });

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await withRenderTimeout(renderDesignPdf(order.id, design, { watermark: true }));
    } catch (err) {
      return NextResponse.json(
        { error: `PDF rendering failed: ${err instanceof Error ? err.message : "unknown error"}` },
        { status: 500 }
      );
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${order.sku_code}-proof.pdf"`,
      },
    });
  } catch (err) {
    return apiCatch(err);
  }
}
