/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
    // Keys must match the actual routes that call launchBrowser() — an
    // earlier version of this pointed at a /api/render-proof route that
    // was never created, so @sparticuz/chromium's binary never made it
    // into either real route's deployed bundle (confirmed live: "input
    // directory .../@sparticuz/chromium/bin does not exist").
    outputFileTracingIncludes: {
      "/api/workspace/[token]/generate": ["./node_modules/@sparticuz/chromium/**"],
      "/api/admin/review/[id]": ["./node_modules/@sparticuz/chromium/**"],
    },
  },
};

module.exports = nextConfig;
