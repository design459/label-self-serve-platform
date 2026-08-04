/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
    outputFileTracingIncludes: {
      "/api/render-proof": ["./node_modules/@sparticuz/chromium/**"],
    },
  },
};

module.exports = nextConfig;
