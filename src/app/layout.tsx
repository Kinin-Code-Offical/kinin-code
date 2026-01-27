import type { Metadata } from "next";
import { cookies } from "next/headers";
import { JetBrains_Mono, Space_Grotesk, Unbounded } from "next/font/google";
import "./globals.css";
import LoadingBar from "@/components/LoadingBar";
import { PreferencesProvider } from "@/components/PreferencesProvider";
import type { Language } from "@/lib/i18n";

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

export const metadata: Metadata = {
  title: "Kinin Code — Full-Stack Developer",
  description:
    "Full-stack developer portfolio with 3D scene, selected projects, and contact form.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "Kinin Code — Full-Stack Developer",
    description:
      "Full-stack developer portfolio with 3D scene, selected projects, and contact form.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = cookies();
  const theme = cookieStore.get("theme")?.value === "light" ? "light" : "dark";
  const langValue = cookieStore.get("lang")?.value;
  const language: Language = langValue === "en" ? "en" : "tr";

  return (
    <html lang={language} data-theme={theme} data-lang={language}>
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <PreferencesProvider initialTheme={theme} initialLanguage={language}>
          <LoadingBar />
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}
