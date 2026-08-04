import puppeteer, { Browser } from "puppeteer-core";
import { findChrome } from "./findChrome";

// Copied from ancient-nutra-label-generator/lib/launchBrowser.ts — verified
// working on a live Netlify Function deploy there (2026-07-21) after fixing
// three real bugs: (1) process.env.NETLIFY isn't reliably set at Function
// runtime, only build time, so also check the Lambda-native env vars Netlify
// Functions always set; (2) Next's bundler inlines an absolute build-machine
// path for @sparticuz/chromium unless it's marked an external server
// package (see next.config.js serverComponentsExternalPackages); (3) Next's
// output file tracing needs outputFileTracingIncludes for this route to ship
// the package's binary .br assets, since they're read from disk, not
// require()d. If those three aren't also mirrored in this app's
// next.config.js, this will fail on Netlify even though it works locally.
export async function launchBrowser(): Promise<Browser> {
  const useServerlessChromium =
    process.env.NETLIFY === "true" ||
    process.env.FORCE_SERVERLESS_CHROMIUM === "true" ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.LAMBDA_TASK_ROOT);

  if (!useServerlessChromium) {
    const executablePath = findChrome();
    return puppeteer.launch({ executablePath, headless: true });
  }

  const chromium = (await import("@sparticuz/chromium")).default;
  const remotePackUrl = process.env.CHROMIUM_REMOTE_PACK_URL || undefined;

  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(remotePackUrl),
    headless: true,
  });
}
