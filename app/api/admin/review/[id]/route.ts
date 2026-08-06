import { NextRequest, NextResponse } from "next/server";
import { currentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin, storageBucket, logAudit } from "@/lib/supabaseServer";
import { buildArtboardHtml, ArtboardInput } from "@/lib/artboard";
import { launchBrowser } from "@/lib/launchBrowser";
import { apiCatch } from "@/lib/apiError";

// The only code path in this app that can set label_orders.status =
// 'approved'. Requires an authenticated session AND a matching
// public.staff_users row (checked inside currentStaff()) — there is no
// configuration flag, volume threshold, or customer action that reaches
// this branch. See spec boundary: "never auto-approves".
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const staff = await currentStaff();
    if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const body = await req.json().catch(() => null);
    const decision = body?.decision;
    const reason: string | undefined = body?.reason;
    if (decision !== "approved" && decision !== "rejected") {
      return NextResponse.json({ error: "decision must be 'approved' or 'rejected'." }, { status: 400 });
    }
    if (decision === "rejected" && !reason?.trim()) {
      return NextResponse.json({ error: "A reason is required to reject a label." }, { status: 400 });
    }

    const db = supabaseAdmin();
    const { data: order } = await db.from("label_orders").select("*").eq("id", params.id).maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status === "approved") {
      return NextResponse.json({ error: "Already approved." }, { status: 409 });
    }

    const { data: design } = await db
      .from("label_designs")
      .select("*")
      .eq("label_order_id", order.id)
      .eq("is_submitted", true)
      .order("revision_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!design) {
      return NextResponse.json({ error: "Nothing submitted for this order yet." }, { status: 400 });
    }

    if (decision === "approved") {
      if (!design.render_input) {
        return NextResponse.json(
          { error: "Missing render data for this design — cannot produce a print file." },
          { status: 500 }
        );
      }
      const html = buildArtboardHtml({
        ...(design.render_input as Omit<ArtboardInput, "watermark">),
        watermark: false,
      });
      const template = (design.render_input as ArtboardInput).template;

      let pdfBuffer: Buffer;
      try {
        const browser = await launchBrowser();
        try {
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: "networkidle0" });
          const widthMm = template.trim_width_mm + template.bleed_mm * 2;
          const heightMm = template.trim_height_mm + template.bleed_mm * 2;
          pdfBuffer = Buffer.from(
            await page.pdf({ width: `${widthMm}mm`, height: `${heightMm}mm`, printBackground: true })
          );
        } finally {
          await browser.close();
        }
      } catch (err) {
        return NextResponse.json(
          { error: `Print-file rendering failed: ${err instanceof Error ? err.message : "unknown error"}` },
          { status: 500 }
        );
      }

      const printPath = `orders/${order.id}/designs/${design.id}/print.pdf`;
      const { error: uploadError } = await db.storage.from(storageBucket()).upload(printPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
      if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

      const { error: designUpdateError } = await db
        .from("label_designs")
        .update({ print_storage_path: printPath })
        .eq("id", design.id);
      if (designUpdateError) {
        return NextResponse.json({ error: `Failed to save print file: ${designUpdateError.message}` }, { status: 500 });
      }
      const { error: approveError } = await db
        .from("label_orders")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      if (approveError) {
        return NextResponse.json({ error: `Failed to mark order approved: ${approveError.message}` }, { status: 500 });
      }
    } else {
      const { error: rejectError } = await db
        .from("label_orders")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      if (rejectError) {
        return NextResponse.json({ error: `Failed to mark order rejected: ${rejectError.message}` }, { status: 500 });
      }
    }

    const { error: reviewInsertError } = await db.from("compliance_reviews").insert({
      label_order_id: order.id,
      label_design_id: design.id,
      reviewer_id: staff.userId,
      decision,
      reason: reason ?? null,
    });
    if (reviewInsertError) {
      return NextResponse.json({ error: `Failed to record review decision: ${reviewInsertError.message}` }, { status: 500 });
    }

    await logAudit(order.id, `staff:${staff.email ?? staff.userId}`, decision === "approved" ? "approved" : "rejected", {
      designId: design.id,
      reason: reason ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiCatch(err);
  }
}
