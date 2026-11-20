import { experience } from "@/content/experience";
import { profile } from "@/content/profile";
import { projects } from "@/content/projects";
import { research } from "@/content/research";
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

  const personId = `${baseUrl}/#person`;
  const person = {
    "@type": "Person",
    "@id": personId,
    name: profile.fullName,
    alternateName: [profile.asciiName, "Kinin Code"],
    jobTitle: profile.jobTitle[language],
    url: baseUrl,
    image: new URL(profile.ogImage, baseUrl).toString(),
    sameAs,
    description: profile.description[language],
    knowsAbout:
      language === "tr"
        ? [
            "PCB tasarımı",
            "Sinyalizasyon sistemleri",
            "Gömülü sistemler",
            "Full-stack yazılım geliştirme",
            "Teorik fizik",
          ]
        : [
            "PCB design",
            "Signalling systems",
            "Embedded systems",
            "Full-stack software development",
            "Theoretical physics",
          ],
    worksFor: experience.map((job) => ({
      "@type": "Organization",
      name: job.company,
      url: job.url,
    })),
  };

  const papers = research.map((paper) => ({
    "@type": "ScholarlyArticle",
    headline: paper.title[language],
    alternativeHeadline: paper.subtitle[language],
    abstract: paper.summary[language],
    datePublished: paper.date,
    inLanguage: language === "tr" ? "tr" : "en",
    author: { "@id": personId },
    keywords: paper.tags.join(", "),
    url: new URL(paper.links[language === "tr" ? 0 : 1].href, baseUrl).toString(),
  }));

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
    "@graph": [person, website, itemList, ...papers],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
