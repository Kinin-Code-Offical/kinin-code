import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import { getContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "About — Yamac",
  description: "About Yamac and the work in electronics + software.",
};

export default async function AboutPage() {
  const content = await getContent();
  return (
    <main className="simple-page">
      <section className="simple-card">
        <Markdown content={content.pages.about} />
        <div className="simple-actions">
          <Link className="button ghost" href="/">
            Back
          </Link>
        </div>
      </section>
    </main>
  );
}
