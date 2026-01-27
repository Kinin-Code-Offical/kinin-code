"use client";

import { useState } from "react";
import ContactForm from "@/components/ContactForm";
import DevConsole from "@/components/DevConsole";
import ThreeStage from "@/components/ThreeStage";
import { usePreferences } from "@/components/PreferencesProvider";
import type { GithubProject } from "@/lib/github";
import { copy, languages } from "@/lib/i18n";
import { site } from "@/lib/site";
import type { DevSettings } from "@/lib/devtools";
import { defaultDevSettings } from "@/lib/devtools";

type HomeClientProps = {
  projects: GithubProject[];
};

export default function HomeClient({ projects }: HomeClientProps) {
  const { language, setLanguage, theme, toggleTheme } = usePreferences();
  const t = copy[language];
  const hasGithubProjects = projects.length > 0;
  const [devEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const params = new URLSearchParams(window.location.search);
    return params.get("dev") === "1" || process.env.NEXT_PUBLIC_DEVTOOLS === "1";
  });
  const [devSettings, setDevSettings] = useState<DevSettings>(() => {
    if (typeof window === "undefined") {
      return defaultDevSettings;
    }
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

  return (
    <main className="site">
      <header className="top-nav">
        <div className="logo">
          <span className="logo-mark">~&gt;</span>
          <span className="logo-text">{site.name}</span>
          <span className="logo-sub">home / root / console</span>
        </div>
        <nav className="nav-links">
          <a href="#services">{t.nav.services}</a>
          <a href="#projects">{t.nav.projects}</a>
          <a href="#stack">{t.nav.stack}</a>
          <a href="#timeline">{t.nav.timeline}</a>
        </nav>
        <div className="prefs">
          <button className="toggle" type="button" onClick={toggleTheme}>
            {t.prefs.theme}: {theme === "dark" ? t.prefs.dark : t.prefs.light}
          </button>
          <div className="toggle-group">
            {languages.map((lang) => (
              <button
                key={lang.code}
                className={`toggle ${language === lang.code ? "active" : ""}`}
                type="button"
                onClick={() => setLanguage(lang.code)}
              >
                {lang.label}
              </button>
            ))}
          </div>
          <a className="cta" href="#contact">
            {t.nav.contact}
          </a>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">{t.hero.role}</p>
          <h1>{t.hero.headline}</h1>
          <p>{t.hero.intro}</p>
          <div className="hero-actions">
            <a className="button primary" href={`mailto:${site.email}`}>
              {t.hero.primaryCta}
            </a>
            <a className="button ghost" href="#projects">
              {t.hero.secondaryCta}
            </a>
          </div>
          <div className="hero-meta">
            <span className="chip">{t.hero.location}</span>
            <span className="chip">{t.hero.availability}</span>
          </div>
        </div>
        <div className="hero-scene">
          <ThreeStage devSettings={devEnabled ? devSettings : undefined} />
          <small>{t.hero.modelNote}</small>
        </div>
      </section>

      {devEnabled ? (
        <DevConsole settings={devSettings} onChange={setDevSettings} />
      ) : null}

      <section id="services" className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">{t.services.title}</h2>
            <p className="section-subtitle">{t.services.subtitle}</p>
          </div>
        </div>
        <div className="cards">
          {t.services.items.map((service) => (
            <article className="card" key={service.title}>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="projects" className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">{t.projects.title}</h2>
            <p className="section-subtitle">{t.projects.subtitle}</p>
          </div>
          <a className="cta" href="#contact">
            {t.projects.cta}
          </a>
        </div>
        <div className="projects">
          {hasGithubProjects
            ? projects.map((project) => (
                <article className="project" key={project.url}>
                  <span>{new Date(project.updatedAt).getFullYear()}</span>
                  <h4>
                    <a href={project.url} target="_blank" rel="noreferrer">
                      {project.name}
                    </a>
                  </h4>
                  <p>{project.description || t.projects.noDescription}</p>
                  <div className="tags">
                    {project.language ? <span className="tag">{project.language}</span> : null}
                    <span className="tag">★ {project.stars}</span>
                  </div>
                </article>
              ))
            : (
                <p className="section-subtitle">{t.projects.empty}</p>
              )}
        </div>
      </section>

      <section id="stack" className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">{t.stack.title}</h2>
            <p className="section-subtitle">{t.stack.subtitle}</p>
          </div>
        </div>
        <div className="stack-grid">
          {t.stack.items.map((item) => (
            <span className="stack-chip" key={item}>
              {item}
            </span>
          ))}
        </div>
      </section>

      <section id="timeline" className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">{t.timeline.title}</h2>
            <p className="section-subtitle">{t.timeline.subtitle}</p>
          </div>
        </div>
        <div className="timeline">
          {t.timeline.items.map((item) => (
            <div className="timeline-item" key={item.title}>
              <span>{item.year}</span>
              <div>
                <h4>{item.title}</h4>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="section">
        <div className="section-header">
          <div>
            <h2 className="section-title">{t.contact.title}</h2>
            <p className="section-subtitle">{t.contact.subtitle}</p>
          </div>
        </div>
        <div className="contact-card">
          <ContactForm labels={t.contact.form} />
          <div className="footer">
            <span>{site.email}</span>
            <div className="footer-links">
              {site.socials.map((social) => (
                <a key={social.label} href={social.href}>
                  {social.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <span>
          {t.footer.copyright} {new Date().getFullYear()} {site.name} Code
        </span>
        <span>{t.footer.role}</span>
      </footer>
    </main>
  );
}
