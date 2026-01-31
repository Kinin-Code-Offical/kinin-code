import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
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
  const language = resolveLanguage(
    params?.lang ?? cookieStore.get("lang")?.value,
  );
  const t = translations[language];
  return buildPageMetadata({
    lang: language,
    path: "/projects",
    title: t.nav.projects,
    description: t.sections.projects.subtitle,
  });
}

export default async function ProjectsPage({
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
        <div className="simple-header">
          <span className="section-eyebrow">{t.sections.projects.eyebrow}</span>
          <h1 className="section-title">{t.sections.projects.title}</h1>
          <p className="section-subtitle">{t.sections.projects.subtitle}</p>
        </div>
        <div className="project-grid">
          {content.projects.map((project) => (
            <article className="project-card" key={project.title}>
              <div className="project-header">
                <span className="project-year">{project.year}</span>
                <h3>{project.title}</h3>
              </div>
              <p className="project-summary">{project.summary[language]}</p>
              <div className="project-tags">
                {project.tags.map((tag) => (
                  <span key={tag} className="project-tag">
                    {tag}
                  </span>
                ))}
              </div>
              {project.detailsMd ? (
                <Markdown content={project.detailsMd[language]} />
              ) : null}
              <div className="project-links">
                {"repo" in project.links && project.links.repo ? (
                  <a href={project.links.repo} target="_blank" rel="noreferrer">
                    {t.projects.repo}
                  </a>
                ) : null}
                {"live" in project.links && project.links.live ? (
                  <a href={project.links.live} target="_blank" rel="noreferrer">
                    {t.projects.live}
                  </a>
                ) : null}
              </div>
            </article>
          ))}
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
