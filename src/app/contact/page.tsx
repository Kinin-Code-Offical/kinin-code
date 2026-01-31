import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import ContactForm from "@/components/ContactForm";
import Markdown from "@/components/Markdown";
import { getContent } from "@/lib/content";
import { translations } from "@/i18n/translations";
import { buildPageMetadata, resolveLanguage } from "@/lib/seo";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const cookieStore = await cookies();
  const params = searchParams ? await searchParams : undefined;
  const language = resolveLanguage(params?.lang ?? cookieStore.get("lang")?.value);
  const t = translations[language];
  return buildPageMetadata({
    lang: language,
    path: "/contact",
    title: t.nav.contact,
    description: t.sections.contact.subtitle,
  });
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const cookieStore = await cookies();
  const params = searchParams ? await searchParams : undefined;
  const language = resolveLanguage(params?.lang ?? cookieStore.get("lang")?.value);
  const t = translations[language];
  const content = await getContent();

  return (
    <main className="simple-page">
      <section className="simple-card">
        <Markdown content={content.pages.contact[language]} />
        <div className="contact-form">
          <ContactForm labels={t.contact.form} />
        </div>
        <div className="simple-actions">
          <Link className="button ghost" href="/">
            {t.nav.home}
          </Link>
        </div>
      </section>
    </main>
  );
}
