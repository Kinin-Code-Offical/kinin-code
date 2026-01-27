import { readFile } from "node:fs/promises";
import path from "node:path";
import { profile } from "@/content/profile";
import { projects } from "@/content/projects";
import { theme } from "@/content/theme";

export type ContentPages = {
  about: string;
  contact: string;
  title: string;
};

export type ContentData = {
  profile: typeof profile;
  projects: typeof projects;
  theme: typeof theme;
  pages: ContentPages;
};

async function readPage(name: keyof ContentPages) {
  const filePath = path.join(process.cwd(), "src", "content", "pages", `${name}.md`);
  return readFile(filePath, "utf8");
}

export async function getContent(): Promise<ContentData> {
  const [about, contact, title] = await Promise.all([
    readPage("about"),
    readPage("contact"),
    readPage("title"),
  ]);

  return {
    profile,
    projects,
    theme,
    pages: { about, contact, title },
  };
}
