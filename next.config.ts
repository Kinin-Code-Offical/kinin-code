import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  outputFileTracingIncludes: {
    "/": ["src/content/pages/**/*.md"],
  },
  experimental: {
    // Tree-shake large barrel packages so only the used parts are bundled.
    optimizePackageImports: ["@react-three/drei", "framer-motion"],
  },
  async headers() {
    return [
      {
        source: "/models/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // HELLRUN sprites/textures and the paper PDFs rarely change:
        // let browsers and Cloudflare cache them for a week.
        source: "/:dir(hellrun|papers)/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
