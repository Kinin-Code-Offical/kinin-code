import type { MetadataRoute } from "next";
import { getSiteUrl, isNoIndex } from "@/lib/seo";

// Search engines and AI answer engines (ChatGPT, Claude, Perplexity, Gemini,
// Copilot, Apple) are explicitly welcome: the goal is that a search for
// "Yamaç Gürsel" anywhere leads here.
const AI_AND_SEARCH_BOTS = [
  "Googlebot",
  "Google-Extended",
  "Bingbot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
  "DuckDuckBot",
  "YandexBot",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  if (isNoIndex()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      { userAgent: AI_AND_SEARCH_BOTS, allow: "/" },
      { userAgent: "*", allow: "/" },
    ],
    host: baseUrl,
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
