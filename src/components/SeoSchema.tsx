import { experience } from "@/content/experience";
import { profile } from "@/content/profile";
import { projects } from "@/content/projects";
import { research } from "@/content/research";
import { site } from "@/lib/site";
import { translations } from "@/i18n/translations";
import type { Language } from "@/lib/i18n";
import { getSiteUrl, withLangPath } from "@/lib/seo";

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
  // Every public profile that is "the same person": this is what lets
  // Google (Knowledge Graph) and AI answer engines tie them together.
  const sameAs = Array.from(
    new Set([
      ...profile.socials.map((social) => social.href),
      ...site.socials.map((social) => social.href),
      ...(profile.sameAs ?? []),
    ]),
  ).filter((href) => href.startsWith("http"));

  const personId = `${baseUrl}/#person`;
  const websiteId = `${baseUrl}/#website`;
  const pageUrl = new URL(withLangPath(language, "/"), baseUrl).toString();
  const person = {
    "@type": "Person",
    "@id": personId,
    name: profile.fullName,
    givenName: "Yamaç",
    familyName: "Gürsel",
    alternateName: Array.from(
      new Set([profile.asciiName, "Yamac Gursel", "Kinin Code", "kinin.dev"]),
    ),
    jobTitle: profile.jobTitle[language],
    url: baseUrl,
    mainEntityOfPage: pageUrl,
    image: {
      "@type": "ImageObject",
      url: new URL(profile.ogImage, baseUrl).toString(),
      width: 1200,
      height: 630,
    },
    email: `mailto:${site.email}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Ankara",
      addressCountry: "TR",
    },
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
    inLanguage: "en",
    author: { "@id": personId },
    publisher: { "@type": "Organization", name: "OSF (Open Science Framework)", url: "https://osf.io" },
    keywords: paper.tags.join(", "),
    url: paper.links[0].href,
    sameAs: paper.links.slice(1).map((link) => link.href),
    isAccessibleForFree: true,
  }));

  const website = {
    "@type": "WebSite",
    "@id": websiteId,
    name: profile.fullName,
    alternateName: ["kinin.dev", profile.asciiName],
    url: baseUrl,
    inLanguage: ["tr", "en"],
    description: profile.description[language],
    publisher: { "@id": personId },
    author: { "@id": personId },
  };

  // Google's ProfilePage rich result: this page is *about* the person.
  const profilePage = {
    "@type": "ProfilePage",
    "@id": `${pageUrl}#profile`,
    url: pageUrl,
    name: `${profile.fullName} — ${profile.jobTitle[language]}`,
    inLanguage: language,
    isPartOf: { "@id": websiteId },
    mainEntity: { "@id": personId },
    about: { "@id": personId },
    dateModified: new Date().toISOString().slice(0, 10),
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
    "@graph": [profilePage, person, website, itemList, ...papers],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
