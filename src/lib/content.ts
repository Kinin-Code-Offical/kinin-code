import { readFile } from "node:fs/promises";
import path from "node:path";
import { profile } from "@/content/profile";
import { projects } from "@/content/projects";
import { capabilities } from "@/content/capabilities";
import { theme } from "@/content/theme";
import type { Language } from "@/lib/i18n";

export type Localized<T> = {
  tr: T;
  en: T;
};

export type ContentPages = {
  about: Localized<string>;
  contact: Localized<string>;
  title: Localized<string>;
};

export type ContentData = {
  profile: typeof profile;
  projects: typeof projects;
  capabilities: typeof capabilities;
  theme: typeof theme;
  pages: ContentPages;
};

async function readPage(name: string, lang: Language) {
  const filePath = path.join(process.cwd(), "src", "content", "pages", `${name}.${lang}.md`);
  return readFile(filePath, "utf8");
}

export async function getContent(): Promise<ContentData> {
  const [aboutTr, aboutEn, contactTr, contactEn, titleTr, titleEn] =
    await Promise.all([
      readPage("about", "tr"),
      readPage("about", "en"),
      readPage("contact", "tr"),
      readPage("contact", "en"),
      readPage("title", "tr"),
      readPage("title", "en"),
    ]);

  return {
    profile,
    projects,
    capabilities,
    theme,
    pages: {
      about: { tr: aboutTr, en: aboutEn },
      contact: { tr: contactTr, en: contactEn },
      title: { tr: titleTr, en: titleEn },
    },
  };
}
