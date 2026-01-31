import type { MetadataRoute } from "next";
import { getSiteUrl, isNoIndex } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  const noIndex = isNoIndex();

  return {
    rules: [
      {
        userAgent: "*",
        allow: noIndex ? undefined : "/",
        disallow: noIndex ? "/" : undefined,
      },
    ],
    host: baseUrl,
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
