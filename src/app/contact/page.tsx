import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import ContactForm from "@/components/ContactForm";
import { copy } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Contact — Yamac",
  description: "Contact Yamac for projects and collaborations.",
};

export default async function ContactPage() {
  const cookieStore = await cookies();
  const language = cookieStore.get("lang")?.value === "en" ? "en" : "tr";
  const t = copy[language].pages.contact;

  return (
    <main className="simple-page">
      <section className="simple-card">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="simple-text">{t.body}</p>
        <div className="contact-card">
          <ContactForm labels={t.form} />
        </div>
        <div className="simple-actions">
          <Link className="button ghost" href="/">
            {t.primary}
          </Link>
        </div>
      </section>
    </main>
  );
}
