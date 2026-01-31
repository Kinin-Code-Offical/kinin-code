import { profile } from "@/content/profile";
import { projects } from "@/content/projects";
import { translations } from "@/i18n/translations";
import type { Language } from "@/lib/i18n";
import { getSiteUrl, getLocale, withLangPath } from "@/lib/seo";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type SeoSchemaProps = {
  language: Language;
};

export default function SeoSchema({ language }: SeoSchemaProps) {
  const baseUrl = getSiteUrl();
  const t = translations[language];
  const sameAs = profile.socials
    .map((social) => social.href)
    .filter((href) => href.startsWith("http"));

  const person = {
    "@type": "Person",
    name: profile.fullName,
    alternateName: [profile.asciiName],
    jobTitle: profile.jobTitle[language],
    url: baseUrl,
    image: new URL(profile.ogImage, baseUrl).toString(),
    sameAs,
    description: profile.description[language],
  };

  const website = {
    "@type": "WebSite",
    name: profile.fullName,
    url: baseUrl,
    inLanguage: getLocale(language),
    description: profile.description[language],
  };

  const projectItems = projects.map((project, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": "CreativeWork",
      name: project.title,
      description: project.summary[language],
      url: new URL(`${withLangPath(language, "/projects")}#project-${slugify(project.title)}`, baseUrl).toString(),
      dateCreated: project.year,
    },
  }));

  const itemList = {
    "@type": "ItemList",
    name: t.sections.projects.title,
    itemListElement: projectItems,
  };

  const graph = {
    "@context": "https://schema.org",
    "@graph": [person, website, itemList],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
