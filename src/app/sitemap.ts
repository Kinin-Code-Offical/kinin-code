import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();
  const lastModified = new Date();
  const paths = ["", "/about", "/projects", "/contact"];
  const languages = ["tr", "en"] as const;

  // Each page is listed in both languages and tells Google about its
  // translation (hreflang), so Turkish searches get the /tr version.
  const pages: MetadataRoute.Sitemap = languages.flatMap((lang) =>
    paths.map((path) => ({
      url: `${baseUrl}/${lang}${path}`,
      lastModified,
      changeFrequency: path === "" ? "weekly" : "monthly",
      priority: path === "" ? 1 : 0.7,
      alternates: {
        languages: {
          tr: `${baseUrl}/tr${path}`,
          en: `${baseUrl}/en${path}`,
        },
      },
    })),
  );

  // The ZMUT paper PDFs are indexable documents in their own right.
  const papers: MetadataRoute.Sitemap = [
    "/papers/zmut/zmut-tr.pdf",
    "/papers/zmut/zmut-en.pdf",
  ].map((file) => ({
    url: `${baseUrl}${file}`,
    lastModified: new Date("2026-08-07"),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [...pages, ...papers];
}
