import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, storageBucket, signedUrlFor, logAudit } from "@/lib/supabaseServer";
import { buildArtboardHtml, ArtboardInput } from "@/lib/artboard";
import { buildDefaultLayout } from "@/lib/canvasLayout";
import { generateQrDataUrl } from "@/lib/labelCodes";
import { launchBrowser } from "@/lib/launchBrowser";
import { CategoryPanelTemplate, FONT_PRESETS, PackFormatTemplate, RegulatoryContent, Theme } from "@/lib/types";
import { apiCatch } from "@/lib/apiError";

const HEX = /^#[0-9a-fA-F]{6}$/;

function validTheme(theme: unknown): Theme | null {
  if (!theme || typeof theme !== "object") return null;
  const t = theme as Record<string, unknown>;
  if (typeof t.primaryColor !== "string" || !HEX.test(t.primaryColor)) return null;
  if (typeof t.accentColor !== "string" || !HEX.test(t.accentColor)) return null;
  if (typeof t.backgroundColor !== "string" || !HEX.test(t.backgroundColor)) return null;
  return { primaryColor: t.primaryColor, accentColor: t.accentColor, backgroundColor: t.backgroundColor };
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const order = await getOrderByToken(params.token);
    if (!order) return NextResponse.json({ error: "Link not found or expired." }, { status: 404 });

    const body = await req.json().catch(() => null);
    const theme = validTheme(body?.theme);
    if (!theme) return NextResponse.json({ error: "A valid theme (three hex colors) is required." }, { status: 400 });
    if (!order.selected_template_id) {
      return NextResponse.json({ error: "Pick a template before generating." }, { status: 400 });
    }

    const db = supabaseAdmin();

    const { data: newDesign, error: spendError } = await db.rpc("lg_spend_revision", { p_order_id: order.id });
    if (spendError) {
      const status =
        spendError.message.includes("already approved") || spendError.message.includes("cap reached") ? 409 : 500;
      return NextResponse.json({ error: spendError.message }, { status });
    }

    const [{ data: template }, { data: regulatory }, { data: logo }, { data: panelTemplate }] = await Promise.all([
      db.from("pack_format_templates").select("*").eq("id", order.selected_template_id).single(),
      db.from("label_regulatory_content").select("*").eq("label_order_id", order.id).maybeSingle(),
      db.from("label_assets").select("*").eq("label_order_id", order.id).eq("kind", "logo").maybeSingle(),
      db.from("category_panel_templates").select("*").eq("category", order.category).maybeSingle(),
    ]);

    const panel = panelTemplate as CategoryPanelTemplate | null;
    const font = FONT_PRESETS.find((f) => f.id === order.font_id) || FONT_PRESETS[0];
    const elements =
      order.canvas_layout ?? buildDefaultLayout(template as PackFormatTemplate, order.category, panel, { fontId: order.font_id });

    let logoDataUrl: string | null = null;
    if (logo?.storage_path) {
      const { data: fileBlob } = await db.storage.from(storageBucket()).download(logo.storage_path);
      if (fileBlob) {
        const buf = Buffer.from(await fileBlob.arrayBuffer());
        const contentType = fileBlob.type || "image/png";
        logoDataUrl = `data:${contentType};base64,${buf.toString("base64")}`;
      }
    }

    const reg: RegulatoryContent = regulatory
      ? {
          ingredients: regulatory.ingredients ?? "",
          nutrition_panel: regulatory.nutrition_panel ?? {},
          claims: regulatory.claims ?? "",
          batch_code: regulatory.batch_code ?? "",
          manufacture_date: regulatory.manufacture_date ?? "",
          expiry_date: regulatory.expiry_date ?? "",
          statutory_marks: regulatory.statutory_marks ?? "",
        }
      : {
          ingredients: "",
          nutrition_panel: {},
          claims: "",
          batch_code: "",
          manufacture_date: "",
          expiry_date: "",
          statutory_marks: "",
        };

    const qrDataUrl = await generateQrDataUrl(reg.batch_code || order.sku_code);

    const renderInput: Omit<ArtboardInput, "watermark"> = {
      productName: order.product_name || order.sku_code,
      displayName: order.display_name,
      marketingTagline: order.marketing_tagline,
      skuCode: order.sku_code,
      customerName: order.customer_name,
      category: order.category,
      panelStyle: panel?.panel_style ?? "blank",
      fieldSchema: panel?.field_schema ?? [],
      template: template as PackFormatTemplate,
      theme,
      font,
      elements,
      logoDataUrl,
      regulatory: reg,
      qrDataUrl,
    };

    const html = buildArtboardHtml({ ...renderInput, watermark: true });

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
        { error: `Proof rendering failed: ${err instanceof Error ? err.message : "unknown error"}` },
        { status: 500 }
      );
    }

    const proofPath = `orders/${order.id}/designs/${newDesign.id}/proof.pdf`;
    const { error: uploadError } = await db.storage.from(storageBucket()).upload(proofPath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    const { error: designUpdateError } = await db
      .from("label_designs")
      .update({ theme, render_input: renderInput, proof_storage_path: proofPath })
      .eq("id", newDesign.id);
    if (designUpdateError) {
      return NextResponse.json({ error: `Failed to save rendered proof: ${designUpdateError.message}` }, { status: 500 });
    }

    await logAudit(order.id, "customer", "revision_generated", {
      designId: newDesign.id,
      revisionNumber: newDesign.revision_number,
    });

    const proofUrl = await signedUrlFor(proofPath);

    return NextResponse.json({
      designId: newDesign.id,
      revisionNumber: newDesign.revision_number,
      proofUrl,
    });
  } catch (err) {
    return apiCatch(err);
  }
}
