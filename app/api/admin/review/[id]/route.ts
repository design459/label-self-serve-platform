import { NextRequest, NextResponse } from "next/server";
import { currentStaff } from "@/lib/supabaseAuth";
import { supabaseAdmin, storageBucket, logAudit } from "@/lib/supabaseServer";
import { buildMultiPageArtboardHtml, ArtboardInput } from "@/lib/artboard";
import { CanvasElement } from "@/lib/canvasLayout";
import { launchBrowser } from "@/lib/launchBrowser";
import { resizeForEmbedding } from "@/lib/resizeImage";
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
      // Page 1's full ArtboardInput is design.render_input; extra pages
      // (front/back, ...) share every field with it except `elements` —
      // design.extra_pages_elements holds just the part that varies per
      // page, reconstructed here into full inputs for the multi-page PDF.
      // logoDataUrl is never persisted on render_input (see the comment in
      // generate/route.ts — a multi-MB base64 logo in that jsonb column
      // was blowing past the function's execution time) — re-fetched here
      // from the same label_assets row instead.
      let logoDataUrl: string | null = null;
      const { data: logo } = await db.from("label_assets").select("*").eq("label_order_id", order.id).eq("kind", "logo").maybeSingle();
      if (logo?.storage_path) {
        const { data: fileBlob } = await db.storage.from(storageBucket()).download(logo.storage_path);
        if (fileBlob) {
          const buf = Buffer.from(await fileBlob.arrayBuffer());
          // Larger cap than the customer-facing proof (see lib/resizeImage.ts)
          // since this is the actual print deliverable, but the photo box
          // is still a small fraction of the label — nowhere near needing
          // an arbitrarily large original upload's full resolution.
          const resized = await resizeForEmbedding(buf, 1200);
          logoDataUrl = `data:image/png;base64,${resized.toString("base64")}`;
        }
      }
      const page1Input = { ...(design.render_input as Omit<ArtboardInput, "watermark">), logoDataUrl };
      const extraPagesElements: CanvasElement[][] = Array.isArray(design.extra_pages_elements) ? design.extra_pages_elements : [];
      const allInputs: Omit<ArtboardInput, "watermark">[] = [page1Input, ...extraPagesElements.map((els) => ({ ...page1Input, elements: els }))];

      const html = buildMultiPageArtboardHtml(allInputs.map((input) => ({ ...input, watermark: false })));
      const template = page1Input.template;

      let pdfBuffer: Buffer;
      try {
        const browser = await launchBrowser();
        try {
          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: "networkidle0" });
          const widthMm = template.trim_width_mm + template.bleed_mm * 2;
          const heightMm = template.trim_height_mm + template.bleed_mm * 2;
          // Every page shares the same physical sheet size (one template
          // per order), so a single width/height applies document-wide;
          // .sheet's own page-break-after CSS (see buildMultiPageArtboardHtml)
          // is what actually splits the content into separate PDF pages.
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

// Staff-only, permanent delete from the review queue — cascades to
// label_designs/label_regulatory_content/label_assets/compliance_reviews/
// lg_audit_log the same way as supabase/scripts/reset_all_orders.sql.
// No logAudit call here: lg_audit_log.label_order_id cascades away with the
// order itself, so an audit row for this action couldn't outlive it anyway.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const staff = await currentStaff();
    if (!staff) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

    const db = supabaseAdmin();
    const { data: order } = await db.from("label_orders").select("id").eq("id", params.id).maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const { error } = await db.from("label_orders").delete().eq("id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiCatch(err);
  }
}
