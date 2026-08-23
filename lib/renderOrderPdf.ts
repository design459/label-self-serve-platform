import { supabaseAdmin, storageBucket } from "./supabaseServer";
import { buildMultiPageArtboardHtml, ArtboardInput } from "./artboard";
import { CanvasElement } from "./canvasLayout";
import { launchBrowser } from "./launchBrowser";
import { embeddedDataUrl } from "./resizeImage";

// Netlify kills a hung Function invocation itself, past whatever its own
// platform limit is — silently, as a bare 502 with none of our own error
// handling ever getting to run. Racing our own render against a shorter
// deadline turns that into an actual JSON error the caller can show,
// instead of a dead end. The exact platform ceiling isn't something this
// app's config can see or change; this number is a guess kept comfortably
// under it based on observed successful renders, not a confirmed limit.
const RENDER_TIMEOUT_MS = 22000;

export async function withRenderTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Rendering took longer than ${RENDER_TIMEOUT_MS / 1000}s — try removing or shrinking large images on this label.`)),
      RENDER_TIMEOUT_MS
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

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

  // Phase timing, greppable in Netlify's function logs by this prefix —
  // added while chasing a 502 on this route with no other way to see
  // where the time (or a crash) was actually going.
  const t0 = Date.now();
  const log = (msg: string) => console.log(`[renderDesignPdf ${orderId}] +${Date.now() - t0}ms ${msg}`);

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
  // 800, not 1200: this whole render happens as ONE Puppeteer page.pdf()
  // call across every page of the order (unlike the customer proof, which
  // screenshots each page separately/in parallel — see generate/route.ts),
  // so a multi-page order with several large images all lands in a single
  // page.setContent() + page.pdf() call with no per-page parallelism to
  // absorb the extra decode/encode work. Still meaningfully sharper than
  // the customer-facing proof's 600px cap, and the photo box is still a
  // small fraction of the label either way — nowhere near needing an
  // arbitrarily large original upload's full resolution.
  const STAFF_PDF_IMAGE_MAX_DIM = 800;

  async function fetchLogoDataUrl(): Promise<string | null> {
    const { data: logo } = await db.from("label_assets").select("*").eq("label_order_id", orderId).eq("kind", "logo").maybeSingle();
    if (!logo?.storage_path) return null;
    const { data: fileBlob } = await db.storage.from(storageBucket()).download(logo.storage_path);
    if (!fileBlob) return null;
    const buf = Buffer.from(await fileBlob.arrayBuffer());
    return embeddedDataUrl(buf, STAFF_PDF_IMAGE_MAX_DIM);
  }

  const extraPagesElements: CanvasElement[][] = Array.isArray(design.extra_pages_elements) ? design.extra_pages_elements : [];
  const page1Elements = (design.render_input as Omit<ArtboardInput, "watermark">).elements;
  // Chromium cold start (@sparticuz/chromium unpacking its binary on a
  // fresh Netlify Function instance) has no dependency on the asset
  // fetch/resize work above — starting it in the same Promise.all overlaps
  // that latency instead of paying for it after assets are already ready.
  log(`starting fetch+launch (pages=${1 + extraPagesElements.length})`);
  const [logoDataUrl, imageAssets, browser] = await Promise.all([
    fetchLogoDataUrl(),
    fetchImageAssets(orderId, [page1Elements, ...extraPagesElements], STAFF_PDF_IMAGE_MAX_DIM),
    launchBrowser(),
  ]);
  log(
    `fetch+launch done — logo=${logoDataUrl ? `${Math.round(logoDataUrl.length / 1024)}KB` : "none"}, images=${
      Object.keys(imageAssets).length
    } (${Math.round(Object.values(imageAssets).reduce((n, v) => n + v.length, 0) / 1024)}KB total)`
  );

  const page1Input = { ...(design.render_input as Omit<ArtboardInput, "watermark">), logoDataUrl, imageAssets };
  const allInputs: Omit<ArtboardInput, "watermark">[] = [page1Input, ...extraPagesElements.map((els) => ({ ...page1Input, elements: els }))];

  const html = buildMultiPageArtboardHtml(allInputs.map((input) => ({ ...input, watermark: opts.watermark })));
  const template = page1Input.template;
  log(`built HTML (${Math.round(html.length / 1024)}KB)`);

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    log("page.setContent done");
    const widthMm = template.trim_width_mm + template.bleed_mm * 2;
    const heightMm = template.trim_height_mm + template.bleed_mm * 2;
    // Every page shares the same physical sheet size (one template per
    // order), so a single width/height applies document-wide; .sheet's own
    // page-break-after CSS (see buildMultiPageArtboardHtml) is what
    // actually splits the content into separate PDF pages.
    const pdf = Buffer.from(await page.pdf({ width: `${widthMm}mm`, height: `${heightMm}mm`, printBackground: true }));
    log(`page.pdf done (${Math.round(pdf.length / 1024)}KB)`);
    return pdf;
  } finally {
    await browser.close();
    log("browser closed");
  }
}
