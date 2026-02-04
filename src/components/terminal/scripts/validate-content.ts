import { readFile } from "node:fs/promises";
import { contentSchema } from "../src/content/schema";
import { profile } from "../src/content/profile";
import { projects } from "../src/content/projects";
import { capabilities } from "../src/content/capabilities";
import { theme } from "../src/content/theme";

const pages = ["about", "contact", "title"];
const languages = ["tr", "en"] as const;

const run = async () => {
  const result = contentSchema.safeParse({ profile, projects, capabilities, theme });

  if (!result.success) {
    console.error("Content schema validation failed:");
    console.error(result.error.format());
    process.exit(1);
  }

  for (const page of pages) {
    for (const lang of languages) {
      const path = new URL(`../src/content/pages/${page}.${lang}.md`, import.meta.url);
      const text = await readFile(path, "utf8");
      if (!text.trim()) {
        console.error(`Page ${page}.${lang}.md is empty.`);
        process.exit(1);
      }
    }
  }

  console.log("Content validated successfully.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
