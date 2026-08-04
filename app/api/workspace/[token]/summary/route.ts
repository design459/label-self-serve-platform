import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, signedUrlFor } from "@/lib/supabaseServer";
import { apiCatch } from "@/lib/apiError";

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
  });
  } catch (err) {
    return apiCatch(err);
  }
}
