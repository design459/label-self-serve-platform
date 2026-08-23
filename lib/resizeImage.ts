import sharp from "sharp";

// A customer's logo (or, since the freeform image library shipped, any
// uploaded image) can legitimately be up to 5MB (see the logo/images
// routes' caps) at whatever pixel dimensions their file happened to be —
// but embedding that directly as a base64 data URL in the HTML fed to a
// memory-constrained serverless Puppeteer instance measured out to a 30+
// second hang on a real 2176x1632/2.8MB upload (Netlify's own gateway
// inactivity timeout kills the request before it ever completes). Resizing
// down before it ever reaches Puppeteer fixes the hang at the source
// instead of trying to make Chromium cope with it.
//
// Format: PNG only when the source actually has an alpha channel (a logo
// or badge cut out with a transparent background) — otherwise JPEG, which
// compresses a detailed/photographic image (a botanical illustration, a
// product photo) far smaller than PNG ever will at the same dimensions.
// This mattered in practice: a real customer's decorative background
// illustration + a badge image, both forced through PNG, pushed a single
// staff PDF render (which now also embeds every freeform "image" element,
// not just the one logo) well past what one Netlify function invocation
// can finish in, surfacing as a 502 on /admin/review/[id]/download-pdf.
export async function resizeForEmbedding(buffer: Buffer, maxDim: number): Promise<Buffer> {
  const pipeline = sharp(buffer).resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
  const { hasAlpha } = await pipeline.clone().metadata();
  return hasAlpha ? pipeline.png({ compressionLevel: 9 }).toBuffer() : pipeline.jpeg({ quality: 82 }).toBuffer();
}

export async function embeddedDataUrl(buffer: Buffer, maxDim: number): Promise<string> {
  const pipeline = sharp(buffer).resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });
  const { hasAlpha } = await pipeline.clone().metadata();
  const resized = hasAlpha ? await pipeline.png({ compressionLevel: 9 }).toBuffer() : await pipeline.jpeg({ quality: 82 }).toBuffer();
  return `data:${hasAlpha ? "image/png" : "image/jpeg"};base64,${resized.toString("base64")}`;
}
