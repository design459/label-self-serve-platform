import QRCode from "qrcode";

// Adapted from ancient-nutra-label-generator/lib/labelCodes.ts, with one
// deliberate simplification: no CODE128 barcode graphic. jsbarcode needs a
// real <canvas> (browser) or the native `canvas` npm package (Node), and
// the latter needs node-gyp/Cairo to build — a fragile dependency to add
// for a machine that may not have those build tools. QR codes cover the
// same "machine-readable traceability code on the label" need and `qrcode`
// is pure JS (works identically in the browser and in the Netlify Function
// that renders the print proof), so batch/SKU codes render as plain
// monospace text instead of a barcode graphic. Revisit with a real
// `canvas`-based barcode if Sahan specifically wants scan-at-till barcodes.
export async function generateQrDataUrl(text: string): Promise<string | null> {
  if (!text.trim()) return null;
  try {
    return await QRCode.toDataURL(text, { width: 220, margin: 1 });
  } catch {
    return null;
  }
}
