import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { translations } from "@/i18n/translations";
import { resolveLanguage } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const language = resolveLanguage(cookieStore.get("lang")?.value);
  const t = translations[language].errors.service;
  return {
    title: t.title,
    description: t.text,
    robots: { index: false, follow: false },
  };
}

export default async function ServiceUnavailable() {
  const cookieStore = await cookies();
  const language = resolveLanguage(cookieStore.get("lang")?.value);
  const t = translations[language].errors.service;

  return (
    <main className="error-shell">
      <section className="error-card">
        <p className="error-code">503</p>
        <h1>{t.title}</h1>
        <p className="error-text">{t.text}</p>
        <div className="error-actions">
          <Link className="button primary" href="/">
            {t.primary}
          </Link>
          <Link className="button ghost" href="/#contact">
            {t.secondary}
          </Link>
        </div>
      </section>
    </main>
  );
}
