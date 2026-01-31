export const capabilities = [
  {
    id: "rapid-prototyping",
    icon: "zap",
    title: {
      tr: "Hizli prototipleme",
      en: "Rapid prototyping",
    },
    body: {
      tr: "Fikirleri hizlica MVP'ye cevirir, dogru iterasyonlarla gelistiririm.",
      en: "Turn ideas into MVPs fast and iterate with clear, focused steps.",
    },
    bullets: {
      tr: ["Wireframe -> prototype akisi", "Hizli test ve geri bildirim"],
      en: ["Wireframe to prototype flow", "Fast testing and feedback loops"],
    },
  },
  {
    id: "3d-modeling",
    icon: "cube",
    title: {
      tr: "3D cizim & modelleme",
      en: "3D drafting & modeling",
    },
    body: {
      tr: "Blender ve oyun motoru uyumlu sahnelerle etkileyici 3D arayuzler.",
      en: "Blender-first scenes and game-engine ready assets for 3D UIs.",
    },
    bullets: {
      tr: ["GLB/GLTF pipeline", "Sahne optimizasyonu"],
      en: ["GLB/GLTF pipeline", "Scene optimization"],
    },
  },
  {
    id: "electronics",
    icon: "cpu",
    title: {
      tr: "Elektronik devre tasarimi",
      en: "Electronics & circuit design",
    },
    body: {
      tr: "Sensor/MCU entegrasyonu ve devre prototipleme ile donanimi canliya tasirim.",
      en: "Bring hardware to life with sensor/MCU integration and prototyping.",
    },
    bullets: {
      tr: ["ESP32/Arduino projeleri", "Test ve kalibrasyon"],
      en: ["ESP32/Arduino builds", "Testing and calibration"],
    },
  },
  {
    id: "ai-training",
    icon: "brain",
    title: {
      tr: "Yapay zeka egitimi",
      en: "AI training",
    },
    body: {
      tr: "Veri hazirlama, model egitimi ve deploy ile uctan uca yapay zeka.",
      en: "Data prep, model training, and deployment from end to end.",
    },
    bullets: {
      tr: ["Model iterasyonu", "Uygulama entegrasyonu"],
      en: ["Model iteration", "App integration"],
    },
  },
  {
    id: "full-stack",
    icon: "layers",
    title: {
      tr: "Full-Stack gelistirme",
      en: "Full-stack development",
    },
    body: {
      tr: "Frontend (Next.js/React), backend (Node/.NET), veritabani, API ve auth.",
      en: "Frontend (Next.js/React), backend (Node/.NET), DB, API design, auth.",
    },
    bullets: {
      tr: ["API tasarimi", "Guvenli kimlik dogrulama"],
      en: ["API design", "Secure authentication"],
    },
  },
  {
    id: "collaboration",
    icon: "users",
    title: {
      tr: "Multi-developer isbirligi",
      en: "Multi-developer collaboration",
    },
    body: {
      tr: "Git akisi, code review ve CI/CD ile ekip gelistirme kulturunu kurarim.",
      en: "Git flow, code reviews, and CI/CD for healthy team delivery.",
    },
    bullets: {
      tr: ["Issue tabanli calisma", "Dokumantasyon disiplini"],
      en: ["Issue-driven delivery", "Documentation discipline"],
    },
  },
  {
    id: "custom-tools",
    icon: "wrench",
    title: {
      tr: "Custom tool gelistirme",
      en: "Custom tool building",
    },
    body: {
      tr: "Dahili CLI araclari, otomasyon scriptleri ve dashboard'lar uretirim.",
      en: "Build internal CLI tools, automation scripts, and dashboards.",
    },
    bullets: {
      tr: ["Gelisimci deneyimi", "Operasyonel hiz"],
      en: ["Developer experience", "Operational speed"],
    },
  },
] as const;
