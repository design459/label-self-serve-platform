import { NextRequest, NextResponse } from "next/server";
import { getOrderByToken } from "@/lib/workspaceAuth";
import { supabaseAdmin, storageBucket, signedUrlFor, logAudit } from "@/lib/supabaseServer";
import { buildArtboardHtml, ArtboardInput } from "@/lib/artboard";
import { buildDefaultLayout, CanvasElement } from "@/lib/canvasLayout";
import { generateQrDataUrl } from "@/lib/labelCodes";
import { launchBrowser } from "@/lib/launchBrowser";
import { embeddedDataUrl } from "@/lib/resizeImage";
import { fetchImageAssets } from "@/lib/renderOrderPdf";
import { CategoryPanelTemplate, FONT_PRESETS, PackFormatTemplate, RegulatoryContent, Theme } from "@/lib/types";
import { safeGradientStops } from "@/lib/canvasLayout";
import { apiCatch } from "@/lib/apiError";

const HEX = /^#[0-9a-fA-F]{6}$/;

function validTheme(theme: unknown): Theme | null {
  if (!theme || typeof theme !== "object") return null;
  const t = theme as Record<string, unknown>;
  if (typeof t.primaryColor !== "string" || !HEX.test(t.primaryColor)) return null;
  if (typeof t.accentColor !== "string" || !HEX.test(t.accentColor)) return null;
  if (typeof t.backgroundColor !== "string" || !HEX.test(t.backgroundColor)) return null;

  const backgroundType = t.backgroundType === "gradient" ? "gradient" : "color";
  const rawGradient = t.backgroundGradient as Record<string, unknown> | null | undefined;
  const stops = rawGradient ? safeGradientStops(rawGradient.stops) : [];
  const backgroundGradient =
    backgroundType === "gradient" && stops.length >= 2
      ? { angle: typeof rawGradient?.angle === "number" && Number.isFinite(rawGradient.angle) ? rawGradient.angle : 45, stops }
      : null;
  // Must round-trip the same shape marketing/route.ts saves onto
  // label_orders.theme — summary/route.ts's needsRegeneration deep-compares
  // that against this design's saved theme, and a dropped field (this used
  // to omit customColors entirely) makes them mismatch forever, even right
  // after a fresh regenerate.
  const customColors = Array.isArray(t.customColors)
    ? t.customColors.filter((c): c is string => typeof c === "string" && HEX.test(c))
    : [];

  return {
    primaryColor: t.primaryColor,
    accentColor: t.accentColor,
    backgroundColor: t.backgroundColor,
    backgroundType,
    backgroundGradient,
    customColors,
  };
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
    // Fast-path check using data already on `order` — avoids spinning up
    // headless Chromium just to find out afterward that no revision could
    // be spent anyway. lg_spend_revision() still re-checks both
    // atomically right before it actually spends one (see below), so a
    // race between two concurrent requests still can't over-spend.
    if (order.status === "approved") {
      return NextResponse.json({ error: "This label is already approved — no further revisions." }, { status: 409 });
    }
    if (order.revisions_used >= order.revision_limit) {
      return NextResponse.json(
        { error: `revision cap reached (${order.revisions_used} of ${order.revision_limit})` },
        { status: 409 }
      );
    }

    const db = supabaseAdmin();

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
    // Extra label faces (front/back, ...) beyond page 1 — see
    // supabase/migrations/0005_multi_page.sql. Empty for a single-page order.
    const extraPagesElements: CanvasElement[][] = Array.isArray(order.extra_pages) ? order.extra_pages : [];
    const allPagesElements: CanvasElement[][] = [elements, ...extraPagesElements];

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

    // Rendered (including this fetch/launch phase) BEFORE lg_spend_revision
    // runs, on purpose: launching headless Chromium on a serverless
    // function is the single most failure-prone step here (cold starts,
    // memory pressure), and a customer's limited revisions shouldn't be
    // burned by a render that never produced a proof. Spending only
    // happens once these buffers exist.
    //
    // Chromium's cold start has no dependency on the logo/image/QR fetch
    // work — starting it in the same Promise.all overlaps that latency
    // instead of paying for it afterward. See lib/resizeImage.ts for why
    // the fetch side of this matters at all (a detailed uploaded image
    // forced through PNG was the original cause of a 30+ second hang).
    let logoDataUrl: string | null;
    let imageAssets: Record<string, string>;
    let qrDataUrl: string | null;
    let browser: Awaited<ReturnType<typeof launchBrowser>>;
    try {
      [logoDataUrl, imageAssets, qrDataUrl, browser] = await Promise.all([
        (async () => {
          if (!logo?.storage_path) return null;
          const { data: fileBlob } = await db.storage.from(storageBucket()).download(logo.storage_path);
          if (!fileBlob) return null;
          const buf = Buffer.from(await fileBlob.arrayBuffer());
          // See lib/resizeImage.ts — the on-screen proof only ever needs
          // enough resolution for a small photo box, and embedding the
          // original upload's full size/resolution here is what was
          // hanging the whole request.
          return embeddedDataUrl(buf, 600);
        })(),
        // Only the on-screen proof needs full resolution here — 600px
        // matches the same cap logoDataUrl uses above.
        fetchImageAssets(order.id, allPagesElements, 600),
        generateQrDataUrl(reg.batch_code || order.sku_code),
        launchBrowser(),
      ]);
    } catch (err) {
      return NextResponse.json(
        { error: `Proof rendering failed: ${err instanceof Error ? err.message : "unknown error"}` },
        { status: 500 }
      );
    }

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
      imageAssets,
      regulatory: reg,
      qrDataUrl,
    };

    // The in-app "proof" is a PNG, not a PDF — it's only ever viewed on
    // screen (during editing and by staff during review), never sent to a
    // printer, so an image displays far more predictably in the browser
    // than embedding a PDF viewer. The actual print-ready file (produced
    // only on staff approval, app/api/admin/review/[id]/route.ts) stays a
    // PDF, since that one IS the print production deliverable.
    //
    // One PNG per page (front/back, ...), captured from separate Puppeteer
    // pages within the same browser instance — buildArtboardHtml() always
    // renders exactly one <div class="sheet">, so each page gets its own
    // screenshot rather than trying to paginate a raster image.
    let pngBuffers: Buffer[];
    try {
      const widthMm = template.trim_width_mm + template.bleed_mm * 2;
      const heightMm = template.trim_height_mm + template.bleed_mm * 2;
      pngBuffers = await Promise.all(
        allPagesElements.map(async (pageElements) => {
          const page = await browser.newPage();
          try {
            // deviceScaleFactor gives a sharper capture without changing
            // the mm-based CSS layout math (viewport must be large enough
            // to contain the full .sheet before deviceScaleFactor
            // multiplies it).
            await page.setViewport({
              width: Math.ceil(widthMm * 4) + 40,
              height: Math.ceil(heightMm * 4) + 40,
              deviceScaleFactor: 2,
            });
            const html = buildArtboardHtml({ ...renderInput, elements: pageElements, watermark: true });
            await page.setContent(html, { waitUntil: "networkidle0" });
            // networkidle0 only covers actual network activity — the
            // self-hosted Sinhala/Tamil @font-face data (base64, no
            // request) can still be mid-parse/rasterize at that point, so
            // without this a fresh page can screenshot those glyphs blank.
            await page.evaluate(() => document.fonts.ready);
            const sheet = await page.$(".sheet");
            if (!sheet) throw new Error("Rendered sheet element not found.");
            return Buffer.from(await sheet.screenshot({ type: "png" }));
          } finally {
            await page.close();
          }
        })
      );
    } catch (err) {
      return NextResponse.json(
        { error: `Proof rendering failed: ${err instanceof Error ? err.message : "unknown error"}` },
        { status: 500 }
      );
    } finally {
      await browser.close();
    }

    const { data: newDesign, error: spendError } = await db.rpc("lg_spend_revision", { p_order_id: order.id });
    if (spendError) {
      const status =
        spendError.message.includes("already approved") || spendError.message.includes("cap reached") ? 409 : 500;
      return NextResponse.json({ error: spendError.message }, { status });
    }

    const proofPaths = pngBuffers.map((_, i) => `orders/${order.id}/designs/${newDesign.id}/proof-${i + 1}.png`);
    const uploadResults = await Promise.all(
      pngBuffers.map((buf, i) =>
        db.storage.from(storageBucket()).upload(proofPaths[i], buf, { contentType: "image/png", upsert: true })
      )
    );
    const uploadError = uploadResults.find((r) => r.error)?.error;
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

    // logoDataUrl is a full base64-embedded copy of the logo (up to 5MB of
    // binary → ~6.7MB of base64 text) — fine to include transiently in the
    // HTML fed to Puppeteer above, but never persisted here: storing that
    // in a jsonb column made this update payload large enough to blow past
    // the serverless function's execution time on real (multi-MB) logos,
    // which failed silently after the revision had already been spent
    // (Netlify's own timeout response isn't valid JSON, so the client saw
    // a generic "couldn't generate a proof" with no detail). The actual
    // logo file already lives in label_assets/storage — re-fetched by
    // filename at approval time instead (app/api/admin/review/[id]/route.ts).
    const { error: designUpdateError } = await db
      .from("label_designs")
      .update({
        theme,
        render_input: { ...renderInput, logoDataUrl: null, imageAssets: {} },
        extra_pages_elements: extraPagesElements,
        proof_storage_path: proofPaths[0],
        proof_storage_paths: proofPaths,
      })
      .eq("id", newDesign.id);
    if (designUpdateError) {
      return NextResponse.json({ error: `Failed to save rendered proof: ${designUpdateError.message}` }, { status: 500 });
    }

    await logAudit(order.id, "customer", "revision_generated", {
      designId: newDesign.id,
      revisionNumber: newDesign.revision_number,
      pageCount: allPagesElements.length,
    });

    const proofUrls = await Promise.all(proofPaths.map((p) => signedUrlFor(p)));

    return NextResponse.json({
      designId: newDesign.id,
      revisionNumber: newDesign.revision_number,
      proofUrl: proofUrls[0],
      proofUrls,
    });
  } catch (err) {
    return apiCatch(err);
  }
}
