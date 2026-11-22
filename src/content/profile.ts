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
      "Elektrik-elektronik mühendisliği öğrencisi: devre ve PCB tasarımı, sinyalizasyon ve gömülü sistemler. RobotWin Studio'nun geliştiricisi; web, mobil ve bulut ürünleri de kuran bir full-stack builder.",
    en:
      "Electrical & Electronics Engineering student: circuit and PCB design, signalling and embedded systems. Creator of RobotWin Studio and a full-stack builder who also ships web, mobile and cloud products.",
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
  // Extra public profiles of the same person (structured data "sameAs").
  // Add LinkedIn, ORCID, Google Scholar, etc. here when available.
  sameAs: [
    "https://github.com/Kinin-Code-Offical",
    "https://patreon.com/YamacGursel",
  ] as string[],
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
