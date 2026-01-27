export type Language = "tr" | "en";

export const languages: { code: Language; label: string }[] = [
  { code: "tr", label: "TR" },
  { code: "en", label: "EN" },
];

export const copy = {
  tr: {
    nav: {
      services: "Servisler",
      projects: "Projeler",
      stack: "Stack",
      timeline: "Zaman Çizgisi",
      contact: "Birlikte Çalışalım",
    },
    hero: {
      role: "Elektrik Elektronik Öğrencisi",
      headline: "Elektronik ve yazılımın kesişiminde ürünler geliştiriyorum.",
      intro:
        "Elektrik-elektronik alanında eğitim alırken full-stack projeler üretiyorum. Odağım: temiz arayüzler, sağlam backend ve pratik prototipleme.",
      primaryCta: "Proje Başlat",
      secondaryCta: "Seçili İşler",
      location: "Ankara, Türkiye",
      availability: "Öğrenci",
      modelNote: "Model: /public/models/computer.glb (Blender export)",
    },
    services: {
      title: "Odaklandığım Alanlar",
      subtitle:
        "Ürünü fikirden canlıya taşıyan, strateji + uygulama + görsellik üçlüsüne odaklıyım.",
      items: [
        {
          title: "Experience Design",
          description:
            "Ürün stratejisi, wireframe ve UI sistemlerinin kodla netleşmesi.",
        },
        {
          title: "Full-Stack Delivery",
          description:
            "Next.js, API tasarımı, veri modeli ve bulut otomasyonu.",
        },
        {
          title: "3D + Motion",
          description:
            "Etkileşimli 3D hikaye anlatımı ve sahne tasarımı.",
        },
      ],
    },
    projects: {
      title: "Seçili Projeler",
      subtitle:
        "GitHub’da paylaştığım projelerden güncel ve öne çıkanlar.",
      cta: "GitHub Profili",
      empty: "GitHub projeleri yüklenemedi. Kullanıcı adı tanımla.",
      noDescription: "Açıklama eklenmemiş.",
    },
    stack: {
      title: "Teknoloji Yığını",
      subtitle:
        "Frontend hızını korurken, backend ve bulut katmanını sağlam tutacak modern araçlar.",
      items: [
        "Next.js 16",
        "React 19",
        "TypeScript",
        "Node.js",
        "Three.js",
        "Postgres",
        "Cloud Run",
        "Cloudflare",
      ],
    },
    timeline: {
      title: "Zaman Çizgisi",
      subtitle:
        "Son yılların odağı: ürünleşme, ölçeklenebilirlik ve kullanıcı-merkezli sistemler.",
      items: [
        {
          year: "Şimdi",
          title: "Independent builder",
          detail:
            "Full-stack projeler, mentorluk ve kurucu ortaklıkları.",
        },
        {
          year: "2022 — 2025",
          title: "Senior Engineer, Studio Signal",
          detail: "Immersive ürün lansmanları ve iç platformlar.",
        },
        {
          year: "2019 — 2022",
          title: "Full-Stack Developer, Arcadia",
          detail: "SaaS ölçekleme ve legacy migration.",
        },
      ],
    },
    contact: {
      title: "Yeni Proje",
      subtitle:
        "Bir sonraki ürün için hızlı bir başlangıç yapalım. 1-2 gün içinde dönüş yaparım.",
      form: {
        nameLabel: "İsim",
        namePlaceholder: "Adın",
        emailLabel: "E-posta",
        emailPlaceholder: "mail@adresin.com",
        messageLabel: "Proje Notu",
        messagePlaceholder: "Ne üzerinde çalışıyoruz?",
        submit: "Mesaj Gönder",
        sending: "Gönderiliyor...",
        success: "Mesajın ulaştı. 24 saat içinde dönüş yapacağım.",
        error: "Bir hata oluştu. Lütfen tekrar dene.",
      },
    },
    footer: {
      copyright: "©",
      role: "Elektrik Elektronik Öğrencisi",
    },
    pages: {
      about: {
        eyebrow: "Hakkımda",
        title: "Yamaç, Elektrik Elektronik Öğrencisi",
        body:
          "Elektronik ve yazılımı birlikte kullanarak projeler geliştiriyorum. Öğrencilik dönemimde üretime odaklı, hızlı prototiplenen uygulamalar ve cihaz entegrasyonları kuruyorum.",
        primary: "Ana sayfa",
        secondary: "Projeler",
      },
      projects: {
        eyebrow: "GitHub",
        title: "Projeler",
        body:
          "GitHub’da paylaştığım projelerin öne çıkanları. Detaylar ve güncellemeler için profili inceleyebilirsin.",
        primary: "Ana sayfa",
        secondary: "GitHub Profili",
        empty: "GitHub projeleri yüklenemedi. Kullanıcı adı tanımla.",
        noDescription: "Açıklama eklenmemiş.",
      },
      contact: {
        eyebrow: "İletişim",
        title: "Birlikte çalışalım",
        body:
          "Projenin detaylarını ve ihtiyaçlarını paylaş. En kısa sürede dönüş yapacağım.",
        primary: "Ana sayfa",
        form: {
          nameLabel: "İsim",
          namePlaceholder: "Adın",
          emailLabel: "E-posta",
          emailPlaceholder: "mail@adresin.com",
          messageLabel: "Proje Notu",
          messagePlaceholder: "Ne üzerinde çalışıyoruz?",
          submit: "Mesaj Gönder",
          sending: "Gönderiliyor...",
          success: "Mesajın ulaştı. 24 saat içinde dönüş yapacağım.",
          error: "Bir hata oluştu. Lütfen tekrar dene.",
        },
      },
    },
    errors: {
      notFound: {
        title: "Sayfa bulunamadı",
        text:
          "Aradığın sayfa kaldırılmış olabilir veya adresi yanlış yazmış olabilirsin.",
        primary: "Ana sayfaya dön",
        secondary: "Projeleri gör",
      },
      service: {
        title: "Servis şu an kullanılamıyor",
        text:
          "Kısa bir bakım ya da yoğunluk nedeniyle hizmet veremiyoruz. Birazdan tekrar dene.",
        primary: "Ana sayfaya dön",
        secondary: "İletişime geç",
      },
    },
    prefs: {
      theme: "Tema",
      light: "Açık",
      dark: "Koyu",
    },
  },
  en: {
    nav: {
      services: "Services",
      projects: "Projects",
      stack: "Stack",
      timeline: "Timeline",
      contact: "Work Together",
    },
    hero: {
      role: "Electrical & Electronics Student",
      headline: "Building products where electronics meets software.",
      intro:
        "While studying electrical & electronics, I build full-stack projects with clean UI, reliable backends, and fast prototyping.",
      primaryCta: "Start a Project",
      secondaryCta: "Selected Work",
      location: "Ankara, Türkiye",
      availability: "Student",
      modelNote: "Model: /public/models/computer.glb (Blender export)",
    },
    services: {
      title: "Focus Areas",
      subtitle:
        "I connect strategy, execution, and visual storytelling to bring products to life.",
      items: [
        {
          title: "Experience Design",
          description:
            "Product strategy, wireframes, and UI systems translated cleanly into code.",
        },
        {
          title: "Full-Stack Delivery",
          description:
            "Next.js, API design, data modeling, and cloud-native deployment.",
        },
        {
          title: "3D + Motion",
          description:
            "Interactive 3D storytelling and motion systems with intent.",
        },
      ],
    },
    projects: {
      title: "Selected Projects",
      subtitle:
        "Latest highlights from my GitHub repositories.",
      cta: "GitHub Profile",
      empty: "GitHub projects could not be loaded. Please set a username.",
      noDescription: "No description provided.",
    },
    stack: {
      title: "Technology Stack",
      subtitle:
        "Modern tooling that keeps the frontend fast and the backend resilient.",
      items: [
        "Next.js 16",
        "React 19",
        "TypeScript",
        "Node.js",
        "Three.js",
        "Postgres",
        "Cloud Run",
        "Cloudflare",
      ],
    },
    timeline: {
      title: "Timeline",
      subtitle:
        "Recent years focused on productization, scalability, and user-centered systems.",
      items: [
        {
          year: "Now",
          title: "Independent builder",
          detail:
            "Shipping full-stack apps, mentoring teams, and partnering with founders.",
        },
        {
          year: "2022 — 2025",
          title: "Senior Engineer, Studio Signal",
          detail: "Led immersive product launches and built internal platforms.",
        },
        {
          year: "2019 — 2022",
          title: "Full-Stack Developer, Arcadia",
          detail: "Scaled SaaS products and modernized legacy infrastructure.",
        },
      ],
    },
    contact: {
      title: "New Project",
      subtitle:
        "Let’s kick off your next product. I’ll reply within 1–2 days.",
      form: {
        nameLabel: "Name",
        namePlaceholder: "Your name",
        emailLabel: "Email",
        emailPlaceholder: "you@email.com",
        messageLabel: "Project note",
        messagePlaceholder: "What should we build?",
        submit: "Send Message",
        sending: "Sending...",
        success: "Message received. I’ll get back to you within 24 hours.",
        error: "Something went wrong. Please try again.",
      },
    },
    footer: {
      copyright: "©",
      role: "Electrical & Electronics Student",
    },
    pages: {
      about: {
        eyebrow: "About",
        title: "Yamaç, Electrical & Electronics Student",
        body:
          "I build projects where electronics meets software. During my studies I focus on fast prototyping, real-world integrations, and clean product execution.",
        primary: "Home",
        secondary: "Projects",
      },
      projects: {
        eyebrow: "GitHub",
        title: "Projects",
        body:
          "Highlights from my GitHub repositories. Visit the profile for details and updates.",
        primary: "Home",
        secondary: "GitHub Profile",
        empty: "GitHub projects could not be loaded. Please set a username.",
        noDescription: "No description provided.",
      },
      contact: {
        eyebrow: "Contact",
        title: "Let’s work together",
        body:
          "Share your project details and needs. I’ll get back to you as soon as possible.",
        primary: "Home",
        form: {
          nameLabel: "Name",
          namePlaceholder: "Your name",
          emailLabel: "Email",
          emailPlaceholder: "you@email.com",
          messageLabel: "Project note",
          messagePlaceholder: "What should we build?",
          submit: "Send Message",
          sending: "Sending...",
          success: "Message received. I’ll get back to you within 24 hours.",
          error: "Something went wrong. Please try again.",
        },
      },
    },
    errors: {
      notFound: {
        title: "Page not found",
        text:
          "The page you’re looking for might have been removed or the address may be incorrect.",
        primary: "Back to home",
        secondary: "View projects",
      },
      service: {
        title: "Service unavailable",
        text:
          "We’re temporarily unavailable due to maintenance or high load. Please try again shortly.",
        primary: "Back to home",
        secondary: "Contact me",
      },
    },
    prefs: {
      theme: "Theme",
      light: "Light",
      dark: "Dark",
    },
  },
} as const;
