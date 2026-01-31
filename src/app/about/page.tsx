import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import MarkdownCollapsible from "@/components/MarkdownCollapsible";
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
  const language = resolveLanguage(
    params?.lang ?? cookieStore.get("lang")?.value,
  );
  const t = translations[language];
  return buildPageMetadata({
    lang: language,
    path: "/about",
    title: t.nav.about,
    description: t.sections.about.subtitle,
  });
}

export default async function AboutPage({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string }>;
}) {
  const cookieStore = await cookies();
  const params = searchParams ? await searchParams : undefined;
  const language = resolveLanguage(
    params?.lang ?? cookieStore.get("lang")?.value,
  );
  const t = translations[language];
  const content = await getContent();
  return (
    <main className="simple-page">
      <section className="simple-card">
        <MarkdownCollapsible
          content={content.pages.about[language]}
          moreLabel={t.projects.more}
          lessLabel={t.projects.less}
        />
        <div className="simple-actions">
          <Link className="button ghost" href="/">
            {t.nav.home}
          </Link>
        </div>
      </section>
    </main>
  );
}
