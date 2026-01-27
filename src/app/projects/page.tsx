import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import { getContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "Projects — Yamac",
  description: "Selected projects and experiments.",
};

export default async function ProjectsPage() {
  const content = await getContent();

  return (
    <main className="simple-page">
      <section className="simple-card">
        <Markdown content="# Projects" />
        <div className="project-grid">
          {content.projects.map((project) => (
            <article className="project-card" key={project.title}>
              <div className="project-header">
                <span className="project-year">{project.year}</span>
                <h3>{project.title}</h3>
              </div>
              <p className="project-summary">{project.summary}</p>
              <div className="project-tags">
                {project.tags.map((tag) => (
                  <span key={tag} className="project-tag">
                    {tag}
                  </span>
                ))}
              </div>
              {project.detailsMd ? <Markdown content={project.detailsMd} /> : null}
              <div className="project-links">
                {project.links.repo ? (
                  <a href={project.links.repo} target="_blank" rel="noreferrer">
                    repo
                  </a>
                ) : null}
                {project.links.live ? (
                  <a href={project.links.live} target="_blank" rel="noreferrer">
                    live
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        <div className="simple-actions">
          <Link className="button ghost" href="/">
            Back
          </Link>
        </div>
      </section>
    </main>
  );
}
