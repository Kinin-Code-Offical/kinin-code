import type { Metadata } from "next";
import { cookies } from "next/headers";
import { JetBrains_Mono, Space_Grotesk, Unbounded } from "next/font/google";
import "./globals.css";
import { PreferencesProvider } from "@/components/PreferencesProvider";
import type { Language } from "@/lib/i18n";
import { profile } from "@/content/profile";
import {
  buildAlternates,
  getLocale,
  getSiteUrl,
  isNoIndex,
  resolveLanguage,
  withLangPath,
} from "@/lib/seo";
import SeoSchema from "@/components/SeoSchema";

const display = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const language = resolveLanguage(cookieStore.get("lang")?.value);
  const {
    fullName,
    jobTitle,
    description: profileDescription,
    ogImage,
  } = profile;
  const title = `${fullName} — ${jobTitle[language]}`;
  const description = profileDescription[language];
  const baseUrl = getSiteUrl();
  const canonical = new URL(withLangPath(language, "/"), baseUrl).toString();
  const alternates = buildAlternates("/");

  return {
    metadataBase: new URL(baseUrl),
    title: {
      default: title,
      template: `%s | ${fullName}`,
    },
    description,
    alternates: {
      canonical,
      languages: alternates.languages,
    },
    robots: isNoIndex()
      ? { index: false, follow: false }
      : { index: true, follow: true },
    icons: {
      icon: "/favicon.ico",
      shortcut: "/favicon.ico",
      apple: "/apple-icon.png",
      other: [
        { rel: "icon", url: "/icon-192.png" },
        { rel: "icon", url: "/icon-512.png" },
      ],
    },
    manifest: "/site.webmanifest",
    authors: [{ name: fullName }],
    creator: fullName,
    publisher: fullName,
    category: "portfolio",
    keywords: [
      fullName,
      profile.asciiName,
      jobTitle[language],
      "Next.js",
      "Three.js",
      "Portfolio",
    ],
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      siteName: fullName,
      locale: getLocale(language),
      alternateLocale: [getLocale(language === "tr" ? "en" : "tr")],
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: fullName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    referrer: "strict-origin-when-cross-origin",
    applicationName: fullName,
    generator: "Next.js",
    themeColor: "#0b0f0e",
    formatDetection: {
      email: true,
      address: false,
      telephone: false,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";
  const langValue = cookieStore.get("lang")?.value;
  const language: Language = langValue === "en" ? "en" : "tr";

  return (
    <html lang={language} data-theme={theme} data-lang={language}>
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <SeoSchema language={language} />
        <PreferencesProvider initialTheme={theme} initialLanguage={language}>
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
