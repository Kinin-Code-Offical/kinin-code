// Work experience. Gong Global facts come from the project folders and git
// history in D:\GONG (internal systems are described only in general terms;
// the patent-related spatial engine is intentionally left out).

export const experience = [
  {
    id: "gong-global",
    company: "Gong Global",
    url: "https://www.gongglobal.net",
    location: { tr: "Ankara", en: "Ankara, Türkiye" },
    period: { tr: "Haziran – Ekim 2026", en: "June – October 2026" },
    role: {
      tr: "Yazılım mimarı & full-stack geliştirici",
      en: "Software architect & full-stack developer",
    },
    summary: {
      tr: "Entegre tesis yönetimi şirketi Gong Global'in yazılım ekosistemini tek başına tasarlayıp geliştirdim: üç dilli kurumsal web sitesi, saha güvenliği platformu GONG Guard, İK platformu Cognita ve bunlara bağlı Android, Windows ve kiosk uygulamaları. Altyapıyı Google Cloud ve Cloudflare üzerinde kurdum; CI/CD ve otomatik testlerle yönettim.",
      en: "I single-handedly designed and built the software ecosystem of Gong Global, an integrated facilities-management company: a trilingual corporate website, the GONG Guard security-operations platform, the Cognita HR platform and their Android, Windows and kiosk clients. I set up the infrastructure on Google Cloud and Cloudflare and ran it with CI/CD and automated tests.",
    },
    stats: [
      { value: "5", label: { tr: "ürün", en: "products" } },
      { value: "1.200+", label: { tr: "commit", en: "commits" } },
      { value: "4", label: { tr: "platform", en: "platforms" } },
      { value: "3", label: { tr: "dil (TR/EN/AR)", en: "languages (TR/EN/AR)" } },
    ],
    projects: [
      {
        id: "gong-web",
        title: { tr: "Kurumsal web sitesi", en: "Corporate website" },
        summary: {
          tr: "TR/EN/AR çok dilli kurumsal site; haber yönetimi, iletişim/İK/teklif formları, KVKK onayı ve dijital kartvizit + QR sistemi. GCP'ye otomatik dağıtım.",
          en: "Trilingual corporate site with a news CMS, contact/HR/quote forms, KVKK consent and a digital business-card + QR system, auto-deployed to GCP.",
        },
        tags: ["Astro", "PHP", "MariaDB", "GitHub Actions", "Cloudflare"],
        link: "https://www.gongglobal.net",
      },
      {
        id: "gong-guard",
        title: { tr: "GONG Guard", en: "GONG Guard" },
        summary: {
          tr: "Güvenlik operasyonları için çok kiracılı platform: QR kontrol noktalı devriye, vardiya, olay ve ziyaretçi/araç yönetimi; görevli ve amir için iki Android uygulaması.",
          en: "Multi-tenant security-operations platform: QR-checkpoint patrols, shifts, incidents and visitor/vehicle gates, with guard and supervisor Android apps.",
        },
        tags: [".NET", "PostgreSQL RLS", "Kotlin", "Jetpack Compose"],
      },
      {
        id: "gong-cognita",
        title: { tr: "Cognita İK platformu", en: "Cognita HR platform" },
        summary: {
          tr: "Bordro, izin, işe alım, performans ve form süreçleri için web paneli, çalışan/yönetici mobil uygulaması ve Windows yönetim merkezi.",
          en: "Payroll, leave, recruitment, performance and form workflows with a web panel, a staff/manager mobile app and a Windows admin centre.",
        },
        tags: ["ASP.NET Core", "PostgreSQL", "Android", "WPF"],
      },
      {
        id: "gong-formcraft",
        title: { tr: "FormCraft", en: "FormCraft" },
        summary: {
          tr: "A4 tuvalli Windows form tasarımcısı: QR/OMR hizalama işaretleri, seri numarası, 300 dpi PDF çıktısı ve dijital imza.",
          en: "Windows form designer on an A4 canvas: QR/OMR alignment marks, serial numbers, 300 dpi PDF export and digital signatures.",
        },
        tags: [".NET", "WinForms", "PdfSharp", "QR/OMR"],
      },
      {
        id: "gong-archive",
        title: { tr: "Arşiv kiosku", en: "Archive kiosk" },
        summary: {
          tr: "Barkod okuyucu, belge tarayıcı ve etiket yazıcısıyla çalışan, OCR destekli fiziksel arşiv kiosku ve web paneli.",
          en: "Physical-archive kiosk and web panel driving a barcode reader, document scanner and label printer, with OCR search.",
        },
        tags: ["Python", "GTK", "SANE", "SQLite FTS5", "OCR"],
      },
    ],
  },
] as const;

export type ExperienceItem = (typeof experience)[number];
