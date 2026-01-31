export const profile = {
  name: "Yamac",
  fullName: "Yamaç Gürsel",
  asciiName: "Yamac Gursel",
  jobTitle: {
    tr: "Full-Stack Geliştirici",
    en: "Full-Stack Builder",
  },
  description: {
    tr:
      "Elektrik elektronik öğrencisi ve full-stack geliştirici. 3D, web ve donanımı birleştirerek ürünler tasarlar, hızlı prototipler ve güçlü altyapı kurar.",
    en:
      "Electric & Electronics Engineering student and full-stack builder. I combine 3D, web, and hardware to ship products, rapid prototypes, and reliable systems.",
  },
  ogImage: "/og.png",
  roles: {
    tr: ["Elektrik Elektronik Öğrencisi", "Full-Stack Geliştirici"],
    en: ["Electric & Electronics Engineering Student", "Full-stack Builder"],
  },
  location: {
    tr: "Ankara, Türkiye",
    en: "Ankara, Türkiye",
  },
  introLines: {
    tr: [
      "KININ-TERM 2.0 baslatiliyor...",
      "Profil okunuyor: Yamac",
      "Sistem hazir. /home/yamac baglandi.",
      "\"help\" ile komutlari gorebilirsin.",
    ],
    en: [
      "Starting KININ-TERM 2.0...",
      "Loading profile: Yamac",
      "System ready. /home/yamac mounted.",
      "Type \"help\" for commands.",
    ],
  },
  socials: [
    {
      label: "GitHub",
      href: "https://github.com/Kinin-Code-Offical",
      icon: "GH",
    },
    {
      label: "Email",
      href: "mailto:developer@kinin-code.dev",
      icon: "@",
    },
  ],
  terminal: {
    prompt: "yamac@comp:~$",
  },
  latestProjectsCount: 8,
  sections: ["home", "intro", "featured", "capabilities", "about", "projects", "contact"],
} as const;
