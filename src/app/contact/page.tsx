import type { Metadata } from "next";
import Link from "next/link";
import ContactForm from "@/components/ContactForm";
import Markdown from "@/components/Markdown";
import { getContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "Contact — Yamac",
  description: "Get in touch with Yamac.",
};

export default async function ContactPage() {
  const content = await getContent();

  return (
    <main className="simple-page">
      <section className="simple-card">
        <Markdown content={content.pages.contact} />
        <div className="contact-form">
          <ContactForm labels={content.profile.contactForm} />
        </div>
        <div className="simple-actions">
          <Link className="button ghost" href="/">
            Back
          </Link>
        </div>
      </section>
    </main>
  );
}
