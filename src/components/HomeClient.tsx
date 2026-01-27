"use client";

import dynamic from "next/dynamic";
import type { CSSProperties, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import ContactForm from "@/components/ContactForm";
import DevConsole from "@/components/DevConsole";
import Markdown from "@/components/Markdown";
import TerminalCanvas, { TerminalApi } from "@/components/terminal/TerminalCanvas";
import type { SceneDebugInfo } from "@/components/hero/HeroScene";
import type { ContentData } from "@/lib/content";
import type { DevSettings } from "@/lib/devtools";
import { defaultDevSettings } from "@/lib/devtools";

const HeroScene = dynamic(() => import("@/components/hero/HeroScene"), {
  ssr: false,
  loading: () => <div className="hero-loading">Loading scene...</div>,
});

type HomeClientProps = {
  content: ContentData;
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function useScrollProgress(ref: RefObject<HTMLElement>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handle = () => {
      if (!ref.current) {
        return;
      }
      const rect = ref.current.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const raw = total > 0 ? Math.min(Math.max(-rect.top / total, 0), 1) : 0;
      setProgress(raw);
    };
    handle();
    window.addEventListener("scroll", handle, { passive: true });
    window.addEventListener("resize", handle);
    return () => {
      window.removeEventListener("scroll", handle);
      window.removeEventListener("resize", handle);
    };
  }, [ref]);

  return progress;
}

export default function HomeClient({ content }: HomeClientProps) {
  const { profile, projects, theme, pages } = content;
  const heroRef = useRef<HTMLElement>(null);
  const scrollProgress = useScrollProgress(heroRef);
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [devEnabled] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("dev") === "1" || process.env.NEXT_PUBLIC_DEVTOOLS === "1";
  });
  const [devSettings, setDevSettings] = useState<DevSettings>(() => {
    try {
      const raw = localStorage.getItem("devtools");
      if (raw) {
        return { ...defaultDevSettings, ...JSON.parse(raw) } as DevSettings;
      }
    } catch {
      // ignore
    }
    return defaultDevSettings;
  });
  const [terminalApi, setTerminalApi] = useState<TerminalApi | null>(null);
  const [terminalFocused, setTerminalFocused] = useState(false);
  const [debugInfo, setDebugInfo] = useState<SceneDebugInfo>({
    meshNames: [],
    screenMeshName: null,
    fallbackPlane: false,
  });

  const projectsMd = useMemo(() => {
    return [
      "# Projects",
      "",
      ...projects.map(
        (project) =>
          `- ${project.title} (${project.year}): ${project.summary}`,
      ),
    ].join("\n");
  }, [projects]);

  const sectionLabels = useMemo(
    () => Object.fromEntries(profile.menu.map((item) => [item.id, item.label])),
    [profile.menu],
  );

  const files = useMemo(
    () => [
      { path: "/title/title.md", content: pages.title, section: "home" },
      { path: "/about/about.md", content: pages.about, section: "about" },
      { path: "/projects/projects.md", content: projectsMd, section: "projects" },
      { path: "/contact/contact.md", content: pages.contact, section: "contact" },
    ],
    [pages, projectsMd],
  );

  const fade = Math.max(0, 1 - scrollProgress * 1.2);
  const reveal = Math.min(1, scrollProgress * 1.2);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <main
      className="edh-shell"
      style={
        {
          "--hero-fade": String(fade),
          "--content-reveal": String(reveal),
        } as CSSProperties
      }
    >
      <header className="fixed-menu">
        <div className="menu-stack">
          <button
            className="menu-button"
            type="button"
            onClick={() => scrollToSection("home")}
            aria-label="Menu"
          >
            ≡
          </button>
          {profile.menu.map((item) => (
            <button
              key={item.id}
              className="menu-button"
              type="button"
              onClick={() => scrollToSection(item.id)}
            >
              {item.label[0]}
            </button>
          ))}
        </div>
        <div className="menu-stack">
          {profile.socials.map((social) => (
            <a key={social.label} className="menu-button" href={social.href} target="_blank" rel="noreferrer">
              {social.icon}
            </a>
          ))}
        </div>
      </header>

      <section ref={heroRef} id="home" className={`hero-shell ${terminalFocused ? "focused" : ""}`}>
        <div className="hero-sticky">
          <HeroScene
            devSettings={devEnabled ? devSettings : undefined}
            terminalApi={terminalApi}
            scrollProgress={scrollProgress}
            onDebug={setDebugInfo}
            onFocus={() => terminalApi?.focus()}
            onBlur={() => terminalApi?.blur()}
          />
          <div className="hero-overlay">
            <div className="hero-title">
              <span className="hero-tag">~&gt;</span>
              <div>
                <p className="hero-name">{profile.name}</p>
                <p className="hero-role">{profile.roles.join(" · ")}</p>
              </div>
            </div>
            <p className="hero-hint">Scroll or type &quot;help&quot; to get started</p>
          </div>
        </div>
        <TerminalCanvas
          files={files}
          introLines={profile.introLines}
          prompt={profile.terminal.prompt}
          helpText={profile.terminal.helpText}
          theme={theme}
          isMobile={isMobile}
          onNavigate={scrollToSection}
          onReady={(api) => setTerminalApi(api)}
          onFocusChange={(focused) => setTerminalFocused(focused)}
        />
      </section>

      {devEnabled ? (
        <DevConsole settings={devSettings} onChange={setDevSettings} debug={debugInfo} />
      ) : null}

      {profile.sections
        .filter((section) => section !== "home")
        .map((section) => {
          if (section === "about") {
            return (
              <section key={section} id="about" className="content-section">
                <div className="section-header">
                  <span className="section-label">{sectionLabels.about ?? "About"}</span>
                  <h2>{sectionLabels.about ?? "About"}</h2>
                </div>
                <Markdown content={pages.about} />
              </section>
            );
          }
          if (section === "projects") {
            return (
              <section key={section} id="projects" className="content-section">
                <div className="section-header">
                  <span className="section-label">{sectionLabels.projects ?? "Projects"}</span>
                  <h2>{sectionLabels.projects ?? "Projects"}</h2>
                </div>
                <div className="project-grid">
                  {projects.map((project) => (
                    <ProjectCard key={project.title} project={project} />
                  ))}
                </div>
              </section>
            );
          }
          if (section === "contact") {
            return (
              <section key={section} id="contact" className="content-section">
                <div className="section-header">
                  <span className="section-label">{sectionLabels.contact ?? "Contact"}</span>
                  <h2>{sectionLabels.contact ?? "Contact"}</h2>
                </div>
                <Markdown content={pages.contact} />
                <div className="contact-form">
                  <ContactForm labels={profile.contactForm} />
                </div>
              </section>
            );
          }
          return null;
        })}
    </main>
  );
}

function ProjectCard({
  project,
}: {
  project: {
    title: string;
    year: string;
    tags: string[];
    summary: string;
    detailsMd?: string;
    links: {
      repo?: string;
      live?: string;
    };
  };
}) {
  const [open, setOpen] = useState(false);

  return (
    <article className="project-card">
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
      {project.detailsMd ? (
        <button className="project-toggle" type="button" onClick={() => setOpen((prev) => !prev)}>
          {open ? "hide" : "more..."}
        </button>
      ) : null}
      {open && project.detailsMd ? <Markdown content={project.detailsMd} /> : null}
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
  );
}
