import Link from "next/link";
import { cookies } from "next/headers";
import { copy } from "@/lib/i18n";

export default function AboutPage() {
  const cookieStore = cookies();
  const language = cookieStore.get("lang")?.value === "en" ? "en" : "tr";
  const t = copy[language].pages.about;

  return (
    <main className="simple-page">
      <section className="simple-card">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="simple-text">{t.body}</p>
        <div className="simple-actions">
          <Link className="button primary" href="/">
            {t.primary}
          </Link>
          <Link className="button ghost" href="/projects">
            {t.secondary}
          </Link>
        </div>
      </section>
    </main>
  );
}
