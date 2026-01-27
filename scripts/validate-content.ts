import { readFile } from "node:fs/promises";
import { contentSchema } from "../src/content/schema";
import { profile } from "../src/content/profile";
import { projects } from "../src/content/projects";
import { theme } from "../src/content/theme";

const pages = ["about", "contact", "title"];

const run = async () => {
  const result = contentSchema.safeParse({ profile, projects, theme });

  if (!result.success) {
    console.error("Content schema validation failed:");
    console.error(result.error.format());
    process.exit(1);
  }

  for (const page of pages) {
    const path = new URL(`../src/content/pages/${page}.md`, import.meta.url);
    const text = await readFile(path, "utf8");
    if (!text.trim()) {
      console.error(`Page ${page}.md is empty.`);
      process.exit(1);
    }
  }

  console.log("Content validated successfully.");
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
