export const profile = {
  name: "Yamac",
  fullName: "Yamaç Gürsel",
  asciiName: "Yamac Gursel",
  jobTitle: {
    tr: "Elektrik-Elektronik & Full-Stack Builder",
    en: "Electronics & Full-Stack Builder",
  },
  description: {
    tr:
      "Elektrik-elektronik mühendisliği öğrencisi ve full-stack builder. PCB tasarımı, sinyalizasyon ve gömülü sistemlerden web, mobil ve bulut ürünlerine; Gong Global'in yazılım ekosistemini kurdu, ZMUT teorik fizik makalesinin yazarı.",
    en:
      "Electrical & Electronics Engineering student and full-stack builder. From PCB design, signalling and embedded systems to web, mobile and cloud products; built Gong Global's software ecosystem and authored the ZMUT theoretical-physics paper.",
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
      "KININ-TERM 2.0 başlatılıyor...",
      "Profil okunuyor: Yamaç",
      "Sistem hazır. /home/yamac bağlandı.",
      "\"help\" ile komutları görebilirsin.",
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
      href: "mailto:developer@kinin.dev",
      icon: "@",
    },
  ],
  terminal: {
    prompt: "yamac@comp:~$",
  },
  latestProjectsCount: 8,
  sections: [
    "home",
    "intro",
    "featured",
    "capabilities",
    "experience",
    "research",
    "about",
    "projects",
    "contact",
  ],
} as const;
