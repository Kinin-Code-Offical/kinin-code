import { readFile } from "node:fs/promises";
import path from "node:path";
import { capabilities } from "@/content/capabilities";
import { experience } from "@/content/experience";
import { profile } from "@/content/profile";
import { projects } from "@/content/projects";
import { research } from "@/content/research";
import { getSiteUrl } from "@/lib/seo";
import { site } from "@/lib/site";

// llms.txt (https://llmstxt.org): a plain-markdown summary for AI assistants
// and answer engines, generated from the same content as the site.
export const dynamic = "force-static";

export async function GET() {
  const base = getSiteUrl();
  const about = await readFile(
    path.join(process.cwd(), "src", "content", "pages", "about.en.md"),
    "utf8",
  ).catch(() => "");

  const lines: string[] = [
    `# ${profile.fullName} (${profile.asciiName}) — kinin.dev`,
    "",
    `> ${profile.description.en}`,
    "",
    `Turkish name: ${profile.fullName}. Also written "${profile.asciiName}". Based in ${profile.location.en}. Website: ${base}/ (Turkish: ${base}/tr, English: ${base}/en).`,
    "",
    "## Experience",
    "",
    ...experience.flatMap((job) => [
      `- **${job.company}** (${job.url}) — ${job.role.en}, ${job.period.en}. ${job.summary.en}`,
      ...job.projects.map(
        (item) =>
          `  - ${item.title.en}: ${item.summary.en} (${item.tags.join(", ")})`,
      ),
    ]),
    "",
    "## Research",
    "",
    ...research.flatMap((paper) => [
      `- **${paper.title.en}** — ${paper.subtitle.en} (${paper.dateLabel.en}, ${paper.role.en}).`,
      `  ${paper.summary.en}`,
      ...paper.highlights.en.map((item) => `  - ${item}`),
      ...paper.links.map((link) => `  - [${link.label.en}](${base}${link.href})`),
    ]),
    "",
    "## Capabilities",
    "",
    ...capabilities.map(
      (item) =>
        `- **${item.title.en}** (${item.group.en}): ${item.body.en}`,
    ),
    "",
    "## Projects",
    "",
    ...projects.map((project) => {
      const projectLinks: { repo?: string; live?: string } = project.links;
      const links = [
        projectLinks.repo ? `[repo](${projectLinks.repo})` : "",
        projectLinks.live ? `[live](${projectLinks.live})` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `- **${project.title}** (${project.year}): ${project.summary.en}${links ? ` — ${links}` : ""}`;
    }),
    "",
    "## Links",
    "",
    `- Website: ${base}/`,
    ...profile.sameAs.map((href) => `- ${href}`),
    `- Email: ${site.email}`,
    "",
  ];

  if (about.trim()) {
    lines.push("## About (long form)", "", about.trim(), "");
  }

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
