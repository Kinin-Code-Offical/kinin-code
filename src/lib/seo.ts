import type { Metadata } from "next";
import { profile } from "@/content/profile";
import type { Language } from "@/lib/i18n";

const DEFAULT_LANG: Language = "en";

export function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function getLocale(lang: Language) {
  return lang === "tr" ? "tr_TR" : "en_US";
}

export function isNoIndex() {
  return process.env.NEXT_PUBLIC_NO_INDEX === "1";
}

export function resolveLanguage(value?: string | null): Language {
  if (value === "tr" || value === "en") {
    return value;
  }
  return DEFAULT_LANG;
}

export function withLangPath(lang: Language, path: string) {
  const clean = path === "/" ? "" : path;
  return `/${lang}${clean}`;
}

export function buildAlternates(path: string) {
  const baseUrl = getSiteUrl();
  const tr = new URL(withLangPath("tr", path), baseUrl).toString();
  const en = new URL(withLangPath("en", path), baseUrl).toString();
  return {
    canonical: en,
    languages: {
      tr,
      en,
      "x-default": en,
    },
  };
}

type BuildMetadataOptions = {
  lang: Language;
  path: string;
  title: string;
  description: string;
};

export function buildPageMetadata({ lang, path, title, description }: BuildMetadataOptions): Metadata {
  const baseUrl = getSiteUrl();
  const canonical = new URL(withLangPath(lang, path), baseUrl).toString();
  const alternates = buildAlternates(path);
  const { ogImage } = profile;

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    alternates: {
      canonical,
      languages: alternates.languages,
    },
    robots: isNoIndex()
      ? { index: false, follow: false }
      : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-snippet": -1,
          "max-image-preview": "large",
          "max-video-preview": -1,
        },
      },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: profile.fullName,
      locale: getLocale(lang),
      alternateLocale: [getLocale(lang === "tr" ? "en" : "tr")],
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: profile.fullName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}
