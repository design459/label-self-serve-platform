import sharp from "sharp";

// A customer's logo (or, since the freeform image library shipped, any
// uploaded image) can legitimately be up to 5MB (see the logo/images
// routes' caps) at whatever pixel dimensions their file happened to be —
// but embedding that directly as a base64 data URL in the HTML fed to a
// memory-constrained serverless Puppeteer instance measured out to a 30+
// second hang on a real 2176x1632/2.8MB upload (Netlify's own gateway
// inactivity timeout kills the request before it ever completes) — a
// WALL-CLOCK budget, not a memory ceiling, confirmed by that fix's own
// before/after timings. Resizing down before it ever reaches Puppeteer
// fixes the hang at the source instead of trying to make Chromium cope
// with it.
//
// Format: PNG only when the source has REAL transparency — not merely an
// alpha channel (checking `metadata().hasAlpha` isn't enough: most PNGs
// exported from design tools carry a fully-opaque alpha channel even when
// nothing is actually see-through, which would defeat this check entirely
// and was the reason a first pass at this fix didn't resolve a real 502).
// `stats()` on the already-resized pipeline reports each channel's actual
// min/max — if channel 4 (alpha) never dips below 255, nothing is
// transparent and JPEG is safe. JPEG compresses a detailed/photographic
// image (a botanical illustration, a product photo) far smaller than PNG
// ever will at the same dimensions: a real 2000x2000 test photo came out
// 91% smaller. This mattered in practice — a real customer's decorative
// background illustration + a badge image, both forced through PNG, pushed
// a single staff PDF render (which now also embeds every freeform "image"
// element, not just the one logo) well past what one Netlify function
// invocation can finish in, surfacing as a 502 on
// /admin/review/[id]/download-pdf.
export async function embeddedDataUrl(buffer: Buffer, maxDim: number): Promise<string> {
  const pipeline = sharp(buffer).resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
  const stats = await pipeline.clone().stats();
  const alphaChannel = stats.channels[3];
  const hasRealTransparency = Boolean(alphaChannel && alphaChannel.min < 255);

  if (hasRealTransparency) {
    const resized = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    return `data:image/png;base64,${resized.toString("base64")}`;
  }
  // flatten() first: a source with an (unused) alpha channel would
  // otherwise still carry it into the JPEG encode step, which either
  // errors or silently drops it — compositing onto white first keeps this
  // branch correct for both the "no alpha channel at all" and "alpha
  // channel present but fully opaque" cases.
  const resized = await pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${resized.toString("base64")}`;
}
