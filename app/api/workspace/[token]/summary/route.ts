import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, signedUrlFor } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

// Without this, Next.js statically caches this GET handler's response in
// production (it has no cookies()/headers() call to imply per-request
// data, so it defaults to cacheable) — every customer would see the same
// frozen snapshot from the first request forever, regardless of template
// selection, logo upload, or generation happening afterward. Found live:
// selecting a template returned 200 and wrote to the DB, but this endpoint
// kept serving `selectedTemplateId: null` from the very first request.
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
  const order = await getOrderByToken(params.token);
  if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });

  const db = supabaseAdmin();

  const [{ data: templates }, { data: latestDesign }, { data: latestReview }, { data: logo }, { data: regulatory }] =
    await Promise.all([
      db.from("pack_format_templates").select("*").eq("pack_format", order.pack_format).eq("is_active", true),
      db
        .from("label_designs")
        .select("*")
        .eq("label_order_id", order.id)
        .order("revision_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("compliance_reviews")
        .select("*")
        .eq("label_order_id", order.id)
        .order("decided_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("label_assets").select("*").eq("label_order_id", order.id).eq("kind", "logo").maybeSingle(),
      db.from("label_regulatory_content").select("*").eq("label_order_id", order.id).maybeSingle(),
    ]);

  const proofUrl = latestDesign?.proof_storage_path ? await signedUrlFor(latestDesign.proof_storage_path) : null;
  const printUrl =
    order.status === "approved" && latestDesign?.print_storage_path
      ? await signedUrlFor(latestDesign.print_storage_path)
      : null;

  return NextResponse.json({
    order: {
      id: order.id,
      customerName: order.customer_name,
      skuCode: order.sku_code,
      productName: order.product_name,
      packFormat: order.pack_format,
      status: order.status,
      revisionLimit: order.revision_limit,
      revisionsUsed: order.revisions_used,
      selectedTemplateId: order.selected_template_id,
      theme: order.theme,
    },
    templates: templates ?? [],
    hasLogo: Boolean(logo),
    regulatory: regulatory ?? null,
    latestDesign: latestDesign
      ? { id: latestDesign.id, revisionNumber: latestDesign.revision_number, isSubmitted: latestDesign.is_submitted }
      : null,
    proofUrl,
    printUrl,
    lastReview:
      order.status === "rejected" && latestReview ? { decision: latestReview.decision, reason: latestReview.reason } : null,
  }, {
    // Belt-and-suspenders on top of `dynamic = "force-dynamic"`: explicit
    // no-store so neither the browser nor Netlify's CDN caches this
    // response either. Observed live: a plain navigation reused a stale
    // cached copy showing the previous revision even after force-dynamic
    // was deployed and confirmed working via a fresh (uncached) fetch.
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
  } catch (err) {
    return apiCatch(err);
  }
}
