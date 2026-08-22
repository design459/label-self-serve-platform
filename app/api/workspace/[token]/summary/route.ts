import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, signedUrlFor } from "@/lib/supabaseServer";
import { buildDefaultLayout, CanvasElement } from "@/lib/canvasLayout";
import { PackFormatTemplate } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";
import { deepEqualJson } from "@/lib/deepEqualJson";

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

  const [{ data: templates }, { data: latestDesign }, { data: latestReview }, { data: logo }, { data: regulatory }, { data: panel }, { count: submittedCount }] =
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
      db.from("category_panel_templates").select("*").eq("category", order.category).maybeSingle(),
      // lg_spend_revision() (the RPC behind "Generate artwork") resets
      // label_orders.status to 'in_progress' on every single call, even
      // right after a submission — so order.status alone can't tell the
      // UI "this order has been submitted before" once the customer
      // regenerates. Whether any past revision was ever submitted can.
      db.from("label_designs").select("id", { count: "exact", head: true }).eq("label_order_id", order.id).eq("is_submitted", true),
    ]);
  const hasSubmittedBefore = (submittedCount ?? 0) > 0;

  const logoUrl = logo?.storage_path ? await signedUrlFor(logo.storage_path) : null;
  const proofUrl = latestDesign?.proof_storage_path ? await signedUrlFor(latestDesign.proof_storage_path) : null;
  const proofPaths: string[] = Array.isArray(latestDesign?.proof_storage_paths)
    ? latestDesign.proof_storage_paths
    : latestDesign?.proof_storage_path
    ? [latestDesign.proof_storage_path]
    : [];
  const proofUrls = await Promise.all(proofPaths.map((p) => signedUrlFor(p)));
  const printUrl =
    order.status === "approved" && latestDesign?.print_storage_path
      ? await signedUrlFor(latestDesign.print_storage_path)
      : null;

  const selectedTemplate = (templates ?? []).find((t) => t.id === order.selected_template_id) ?? null;
  const elements =
    order.canvas_layout ??
    (selectedTemplate
      ? buildDefaultLayout(selectedTemplate as PackFormatTemplate, order.category, panel, { fontId: order.font_id })
      : []);
  // Extra pages (front/back, ...) beyond page 1 — returned as-stored, same
  // as page 1's canvas_layout above (already validated at write time by
  // app/api/workspace/[token]/layout/route.ts; no re-validation on read).
  const extraPages: CanvasElement[][] = Array.isArray(order.extra_pages) ? order.extra_pages : [];

  // True when the customer has saved layout/theme edits since the latest
  // generated proof — that proof (and whatever staff would see in review)
  // no longer matches what "Current design" shows. null canvas_layout/theme
  // (never customized) is treated as unchanged rather than compared against
  // whatever default the last generate happened to compute, since nothing
  // was actually edited in that case.
  const latestRenderInput = latestDesign?.render_input as { elements?: CanvasElement[] } | null | undefined;
  const elementsChanged = order.canvas_layout !== null && !deepEqualJson(latestRenderInput?.elements ?? null, order.canvas_layout);
  const latestExtraPagesElements = Array.isArray(latestDesign?.extra_pages_elements) ? latestDesign.extra_pages_elements : [];
  const extraPagesChanged = !deepEqualJson(latestExtraPagesElements, extraPages);
  const themeChanged = order.theme !== null && !deepEqualJson(latestDesign?.theme ?? null, order.theme);
  const needsRegeneration = Boolean(latestDesign?.proof_storage_path) && (elementsChanged || extraPagesChanged || themeChanged);

  return NextResponse.json({
    order: {
      id: order.id,
      customerName: order.customer_name,
      skuCode: order.sku_code,
      productName: order.product_name,
      packFormat: order.pack_format,
      category: order.category,
      displayName: order.display_name,
      marketingTagline: order.marketing_tagline,
      fontId: order.font_id,
      imagePosition: order.image_position,
      status: order.status,
      revisionLimit: order.revision_limit,
      revisionsUsed: order.revisions_used,
      selectedTemplateId: order.selected_template_id,
      theme: order.theme,
    },
    templates: templates ?? [],
    hasLogo: Boolean(logo),
    logoUrl,
    regulatory: regulatory ?? null,
    panel: panel ?? null,
    canvasLayout: order.canvas_layout ?? null,
    elements,
    extraPages,
    pageCount: 1 + extraPages.length,
    latestDesign: latestDesign
      ? { id: latestDesign.id, revisionNumber: latestDesign.revision_number, isSubmitted: latestDesign.is_submitted }
      : null,
    needsRegeneration,
    hasSubmittedBefore,
    proofUrl,
    proofUrls,
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
