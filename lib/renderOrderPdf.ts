import { supabaseAdmin, storageBucket } from "./supabaseServer";
import { buildMultiPageArtboardHtml, ArtboardInput } from "./artboard";
import { CanvasElement } from "./canvasLayout";
import { launchBrowser } from "./launchBrowser";
import { embeddedDataUrl } from "./resizeImage";

// Downloads and base64-embeds every freeform "image" element referenced
// anywhere across a set of pages — shared by the customer proof
// (generate/route.ts) and this file's own renderDesignPdf below. Like
// logoDataUrl, never persisted: re-fetched fresh from label_assets/storage
// every time a page actually needs to render.
//
// Parallel on purpose: the original 30+ second hang this app hit (see
// lib/resizeImage.ts's comment) was a Netlify gateway INACTIVITY timeout —
// a wall-clock budget, not a memory ceiling — so serializing several
// independent Storage downloads would only make that worse. The real fix
// for the payload itself is embeddedDataUrl's smart PNG/JPEG choice below;
// this stays concurrent to keep total latency down.
export async function fetchImageAssets(orderId: string, pages: CanvasElement[][], maxDim: number): Promise<Record<string, string>> {
  const assetIds = Array.from(
    new Set(pages.flatMap((els) => els.filter((el): el is Extract<CanvasElement, { type: "image" }> => el.type === "image").map((el) => el.assetId)))
  );
  if (assetIds.length === 0) return {};

  const db = supabaseAdmin();
  const { data: assets } = await db.from("label_assets").select("*").eq("label_order_id", orderId).eq("kind", "image").in("id", assetIds);

  const entries = await Promise.all(
    (assets ?? []).map(async (asset) => {
      const { data: fileBlob } = await db.storage.from(storageBucket()).download(asset.storage_path);
      if (!fileBlob) return null;
      const buf = Buffer.from(await fileBlob.arrayBuffer());
      return [asset.id as string, await embeddedDataUrl(buf, maxDim)] as const;
    })
  );

  return Object.fromEntries(entries.filter((e): e is NonNullable<typeof e> => e !== null));
}

// Shared by the approval PDF (app/api/admin/review/[id]/route.ts, POST) and
// the on-demand review PDF (.../download-pdf) — same render pipeline, the
// only difference is the watermark and whether the result gets persisted.
export async function renderDesignPdf(
  orderId: string,
  design: { render_input: unknown; extra_pages_elements: unknown },
  opts: { watermark: boolean }
): Promise<Buffer> {
  if (!design.render_input) {
    throw new Error("Missing render data for this design — cannot produce a PDF.");
  }

  const db = supabaseAdmin();

  // Page 1's full ArtboardInput is design.render_input; extra pages
  // (front/back, ...) share every field with it except `elements` —
  // design.extra_pages_elements holds just the part that varies per page,
  // reconstructed here into full inputs for the multi-page PDF.
  // logoDataUrl is never persisted on render_input (see the comment in
  // generate/route.ts — a multi-MB base64 logo in that jsonb column was
  // blowing past the function's execution time) — re-fetched here from the
  // same label_assets row instead.
  //
  // Fetched concurrently with the freeform images below (Promise.all) —
  // independent Storage round-trips, no reason to pay for them serially.
  async function fetchLogoDataUrl(): Promise<string | null> {
    const { data: logo } = await db.from("label_assets").select("*").eq("label_order_id", orderId).eq("kind", "logo").maybeSingle();
    if (!logo?.storage_path) return null;
    const { data: fileBlob } = await db.storage.from(storageBucket()).download(logo.storage_path);
    if (!fileBlob) return null;
    const buf = Buffer.from(await fileBlob.arrayBuffer());
    // Larger cap than the customer-facing proof (see lib/resizeImage.ts)
    // since this feeds a print/download-quality PDF, but the photo box is
    // still a small fraction of the label — nowhere near needing an
    // arbitrarily large original upload's full resolution.
    return embeddedDataUrl(buf, 1200);
  }

  const extraPagesElements: CanvasElement[][] = Array.isArray(design.extra_pages_elements) ? design.extra_pages_elements : [];
  const page1Elements = (design.render_input as Omit<ArtboardInput, "watermark">).elements;
  const [logoDataUrl, imageAssets] = await Promise.all([
    fetchLogoDataUrl(),
    fetchImageAssets(orderId, [page1Elements, ...extraPagesElements], 1200),
  ]);

  const page1Input = { ...(design.render_input as Omit<ArtboardInput, "watermark">), logoDataUrl, imageAssets };
  const allInputs: Omit<ArtboardInput, "watermark">[] = [page1Input, ...extraPagesElements.map((els) => ({ ...page1Input, elements: els }))];

  const html = buildMultiPageArtboardHtml(allInputs.map((input) => ({ ...input, watermark: opts.watermark })));
  const template = page1Input.template;

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const widthMm = template.trim_width_mm + template.bleed_mm * 2;
    const heightMm = template.trim_height_mm + template.bleed_mm * 2;
    // Every page shares the same physical sheet size (one template per
    // order), so a single width/height applies document-wide; .sheet's own
    // page-break-after CSS (see buildMultiPageArtboardHtml) is what
    // actually splits the content into separate PDF pages.
    return Buffer.from(await page.pdf({ width: `${widthMm}mm`, height: `${heightMm}mm`, printBackground: true }));
  } finally {
    await browser.close();
  }
}
