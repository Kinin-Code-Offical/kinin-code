import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { getGithubProjects } from "@/lib/github";
import { copy } from "@/lib/i18n";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Projects — Yamac",
  description: "Selected GitHub projects by Yamac.",
};

export default async function ProjectsPage() {
  const cookieStore = await cookies();
  const language = cookieStore.get("lang")?.value === "en" ? "en" : "tr";
  const t = copy[language].pages.projects;
  const projects = await getGithubProjects();
  const github = site.socials.find((item) => item.label === "GitHub");

  return (
    <main className="simple-page">
      <section className="simple-card">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="simple-text">{t.body}</p>
        <div className="projects">
          {projects.length > 0 ? (
            projects.map((project) => (
              <article className="project" key={project.url}>
                <span>{new Date(project.updatedAt).getFullYear()}</span>
                <h4>
                  <a href={project.url} target="_blank" rel="noreferrer">
                    {project.name}
                  </a>
                </h4>
                <p>{project.description || t.noDescription}</p>
                <div className="tags">
                  {project.language ? <span className="tag">{project.language}</span> : null}
                  <span className="tag">★ {project.stars}</span>
                </div>
              </article>
            ))
          ) : (
            <p className="section-subtitle">{t.empty}</p>
          )}
        </div>
        <div className="simple-actions">
          <Link className="button ghost" href="/">
            {t.primary}
          </Link>
          {github ? (
            <a className="button primary" href={github.href} target="_blank" rel="noreferrer">
              {t.secondary}
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}
