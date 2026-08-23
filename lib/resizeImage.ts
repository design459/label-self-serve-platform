import sharp from "sharp";

// A customer's logo can legitimately be up to 5MB (app/api/workspace/
// [token]/logo/route.ts's cap) at whatever pixel dimensions their file
// happened to be — but embedding that directly as a base64 data URL in the
// HTML fed to a memory-constrained serverless Puppeteer instance measured
// out to a 30+ second hang on a real 2176x1632/2.8MB upload (Netlify's own
// gateway inactivity timeout kills the request before it ever completes).
// The label only ever displays the logo inside a small photo box (well
// under a few hundred px even at 2x device-scale-factor and print
// resolution), so there's no quality reason to keep the original
// resolution — resizing down before it ever reaches Puppeteer fixes the
// hang at the source instead of trying to make Chromium cope with it.
// Stays PNG (not JPEG) specifically to preserve any transparency the
// customer's logo relies on.
export async function resizeForEmbedding(buffer: Buffer, maxDim: number): Promise<Buffer> {
  return sharp(buffer)
    .resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}
