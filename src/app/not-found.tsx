import Link from "next/link";
import { cookies } from "next/headers";
import { copy } from "@/lib/i18n";

export default function NotFound() {
  const cookieStore = cookies();
  const language = cookieStore.get("lang")?.value === "en" ? "en" : "tr";
  const t = copy[language].errors.notFound;

  return (
    <main className="error-shell">
      <section className="error-card">
        <p className="error-code">404</p>
        <h1>{t.title}</h1>
        <p className="error-text">{t.text}</p>
        <div className="error-actions">
          <Link className="button primary" href="/">
            {t.primary}
          </Link>
          <Link className="button ghost" href="/#projects">
            {t.secondary}
          </Link>
        </div>
      </section>
    </main>
  );
}
