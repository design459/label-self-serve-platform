/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // sharp (lib/resizeImage.ts) ships the same kind of native-binary
    // package as @sparticuz/chromium — the platform-specific binary lives
    // in a separate @img/sharp-<platform>-<arch> optional dependency that
    // `npm install` resolves correctly on whatever OS/arch runs it (i.e.
    // Netlify's own Linux build, not this machine), but still needs to be
    // told to Next.js explicitly the same way chromium's binary does.
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "sharp"],
    // Keys must match the actual routes that call launchBrowser() — an
    // earlier version of this pointed at a /api/render-proof route that
    // was never created, so @sparticuz/chromium's binary never made it
    // into either real route's deployed bundle (confirmed live: "input
    // directory .../@sparticuz/chromium/bin does not exist").
    outputFileTracingIncludes: {
      "/api/workspace/[token]/generate": [
        "./node_modules/@sparticuz/chromium/**",
        "./node_modules/sharp/**",
        "./node_modules/@img/**",
      ],
      "/api/admin/review/[id]": [
        "./node_modules/@sparticuz/chromium/**",
        "./node_modules/sharp/**",
        "./node_modules/@img/**",
      ],
    },
  },
};

module.exports = nextConfig;
