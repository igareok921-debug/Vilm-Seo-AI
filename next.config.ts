import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/reports/generate": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  // Separă artefactele dev de build-ul de producție pentru a evita chunk-uri stale/lipsă
  // când `next build` este rulat în timp ce serverul local este pornit.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
