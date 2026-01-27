import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/": ["src/content/pages/**/*.md"],
  },
};

export default nextConfig;
