export const projects = [
  {
    title: "RobotWin Studio",
    year: "2026",
    createdAt: "2026-01",
    tags: ["Robotics", "Simulation", "Unity", "C++", ".NET"],
    featured: true,
    summary: {
      tr:
        "Windows icin deterministik robotik simulasyon platformu. Unity 3D, .NET orchestration ve C++ fizik/firmware motorlariyla HIL odakli.",
      en:
        "Deterministic robotics simulation platform for Windows, combining Unity visuals, .NET orchestration, and C++ physics/firmware engines.",
    },
    detailsMd: {
      tr:
        "### Ozellikler\n- Deterministik sabit zaman adimi scheduler\n- C++ fizik ve rigidbody motoru (AVX2 optimizasyon)\n- ATmega328P firmware emulasyonu\n- Unity 3D gorunum ve debug araclari\n- IPC ile HIL baglantisi",
      en:
        "### Highlights\n- Deterministic fixed-step scheduler\n- C++ physics + rigid body engine (AVX2 optimized)\n- ATmega328P firmware emulation\n- Unity 3D visualization with debug tools\n- IPC-based HIL integration",
    },
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical/robotwin-studio",
    },
  },
  {
    title: "cloudsqlctl",
    year: "2026",
    createdAt: "2026-01",
    tags: ["CLI", "Google Cloud", "DevOps", "Node.js", "Windows"],
    featured: true,
    summary: {
      tr:
        "Windows icin Cloud SQL Auth Proxy yonetimi yapan CLI. gcloud entegrasyonu, kurulum sihirbazi, servis yonetimi ve diagnostik akisi.",
      en:
        "Windows-native CLI for managing Cloud SQL Auth Proxy with gcloud integration, setup wizard, service control, and diagnostics.",
    },
    detailsMd: {
      tr:
        "### Ozellikler\n- Kurulum sihirbazi ve otomatik proxy indirimi\n- gcloud/ADC kimlik dogrulama yardimcilari\n- Instance secimi ve arka plan servis yonetimi\n- JSON loglar ve hassas veri maskeleme\n- Doctor komutu ve self-update",
      en:
        "### Highlights\n- Setup wizard with automated proxy install\n- gcloud/ADC auth helpers\n- Instance selection + background service control\n- Structured JSON logs with masking\n- Doctor checks + self-update",
    },
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical/cloudsqlctl",
      live: "https://cloud.google.com/sql/docs",
    },
  },
  {
    title: "Deniko",
    year: "2026",
    createdAt: "2026-01",
    tags: ["Next.js", "Prisma", "PostgreSQL", "SaaS"],
    featured: true,
    summary: {
      tr:
        "Ogretmen ve ogrenciler icin kapsamli egitim yonetimi ve ozel ders takip platformu. Next.js 16 + Prisma + PostgreSQL.",
      en:
        "Comprehensive education management and tutoring platform built with Next.js 16, Prisma, and PostgreSQL.",
    },
    detailsMd: {
      tr:
        "### Kapsam\n- Web + API ayri katmanlar\n- Prisma migration ve veri modeli\n- Dosya depolama (GCS) entegrasyonu\n- Kurumsal kullanima uygun yapilandirma",
      en:
        "### Scope\n- Separate web + API layers\n- Prisma migrations + data model\n- File storage integration (GCS)\n- Enterprise-ready configuration",
    },
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical/deniko",
      live: "https://deniko.net",
    },
  },
  {
    title: "SigortaCu",
    year: "2025",
    createdAt: "2025-12",
    tags: ["Flutter", "PHP", "MySQL", "Mobile"],
    featured: true,
    summary: {
      tr:
        "Sigorta acenteleri icin poliçe/musteri/varlik yonetimi. Flutter on yuz, PHP REST API ve MySQL altyapisi.",
      en:
        "Insurance agency management system with a Flutter client, PHP REST API, and MySQL backend.",
    },
    detailsMd: {
      tr:
        "### Durum\n- Aktif gelistirme (on-going)\n- CI/CD akisi ve test altyapisi\n- Phinx migration yapisi",
      en:
        "### Status\n- Actively in development\n- CI/testing pipeline\n- Phinx-based migrations",
    },
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical/sigortacu",
    },
  },
  {
    title: "ESP-FIND",
    year: "2026",
    createdAt: "2026-01",
    tags: ["ESP32", "IoT", "RFID", "MQTT"],
    featured: true,
    summary: {
      tr:
        "ESP8266/ESP32 icin RFID erisim kontrol sistemi. Web arayuz, MQTT entegrasyonu ve WebSocket API.",
      en:
        "RFID access control system for ESP8266/ESP32 with web UI, MQTT integration, and WebSocket API.",
    },
    detailsMd: {
      tr:
        "### Ozellikler\n- Wiegand, PN532 ve RDM6300 destegi\n- Gercek zamanli status + log akisi\n- NTP zaman senkronu\n- PlatformIO/Arduino kurulum akisi",
      en:
        "### Highlights\n- Wiegand, PN532, and RDM6300 reader support\n- Real-time status + access logs\n- NTP time sync\n- PlatformIO/Arduino setup",
    },
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical/esp-find",
    },
  },
  {
    title: "Kinu Game Engine",
    year: "2025",
    createdAt: "2025-12",
    tags: ["C++", "C#", "Game Engine", "WPF"],
    featured: true,
    summary: {
      tr:
        "C++/C# tabanli oyun motoru ve editor (WPF). Grafik, matematik, ses ve networking katmanlari.",
      en:
        "C++/C# game engine and editor (WPF) with rendering, math, audio, and networking layers.",
    },
    detailsMd: {
      tr:
        "### Detaylar\n- C++ cekirdek motor + C# editor\n- DirectX 12 tabanli render hedefi\n- Oyun editoru ve sahne arayuzu",
      en:
        "### Details\n- C++ core engine + C# editor\n- DirectX 12 rendering target\n- Editor tooling and scene UI",
    },
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical/Kinu",
    },
  },
  {
    title: "3D Library Toolkit",
    year: "2026",
    createdAt: "2026-01",
    tags: ["3D", "Rendering", "Tools", "WebGL"],
    featured: true,
    summary: {
      tr:
        "Model goruntuleme, sahne kompozisyonu ve optimizasyon icin moduler 3D arac seti. WebGL/R3F uyumlu akislar.",
      en:
        "Modular 3D tooling for model viewing, scene composition, and optimization with WebGL/R3F-friendly workflows.",
    },
    detailsMd: {
      tr:
        "### Hedefler\n- Model import/export pipeline\n- Hafif material preset'leri\n- LOD ve performans profili\n- Editor odakli sahne katmanlari\n\n> Durum: aktif gelistirme",
      en:
        "### Goals\n- Model import/export pipeline\n- Lightweight material presets\n- LOD + performance profiling\n- Editor-focused scene layers\n\n> Status: in active development",
    },
    media: [],
    links: {},
  },
  {
    title: "ScholarShelf Browser Extension",
    year: "2026",
    createdAt: "2026-01",
    tags: ["Chrome Extension", "Productivity", "PDF", "Web"],
    featured: true,
    summary: {
      tr:
        "Webtoon, cizgi roman, PDF ve akademik kaynaklari tek kutuphanede toplayan tarayici eklentisi.",
      en:
        "Browser extension that collects webtoons, comics, PDFs, and academic sources into a unified library.",
    },
    detailsMd: {
      tr:
        "### Kapsam\n- Otomatik kaydetme ve klasorleme\n- Etiketleme + arama\n- Okuma listesi ve ilerleme takibi\n- Hafif senkronizasyon modu\n\n> Durum: prototip",
      en:
        "### Scope\n- One-click save and folders\n- Tagging + search\n- Reading list and progress tracking\n- Lightweight sync mode\n\n> Status: prototype",
    },
    media: [],
    links: {},
  },
  {
    title: "Custom Physics Engine",
    year: "2026",
    createdAt: "2026-01",
    tags: ["Physics", "Simulation", "C++", "Math"],
    featured: true,
    summary: {
      tr:
        "Gercek zamanli rigidbody, carpisma ve zaman adimi icin optimize edilmis ozel fizik motoru.",
      en:
        "Custom real-time physics engine optimized for rigid bodies, collisions, and stable time-stepping.",
    },
    detailsMd: {
      tr:
        "### Odak\n- Deterministik solver\n- Genisletilebilir carpisma katmani\n- Sabit zaman adimi pipeline\n\n> Durum: Ar-Ge asamasi",
      en:
        "### Focus\n- Deterministic solver\n- Extensible collision layer\n- Fixed-step pipeline\n\n> Status: R&D phase",
    },
    media: [],
    links: {},
  },
  {
    title: "Embedded Sim Kernel",
    year: "2026",
    createdAt: "2026-01",
    tags: ["ESP32", "Arduino", "Simulation", "Kernel"],
    featured: true,
    summary: {
      tr:
        "ESP32/Arduino sinyallerini fizik motoru ile senkron calistiran, ikincil kernel destekli simulasyon ortami.",
      en:
        "Simulation kernel that syncs ESP32/Arduino signals with a physics engine, supporting a secondary runtime kernel.",
    },
    detailsMd: {
      tr:
        "### Vizyon\n- Gercek donanim sinyaliyle hizalanmis simulasyon\n- Cift katmanli kernel modeli\n- Sensorden aktuatore tam dongu test\n\n> Durum: tasarim & mimari",
      en:
        "### Vision\n- Hardware-synchronized simulation signals\n- Dual-kernel runtime model\n- End-to-end sensor-to-actuator testing\n\n> Status: design & architecture",
    },
    media: [],
    links: {},
  },
  {
    title: "Kinin-Code Portfolio",
    year: "2026",
    createdAt: "2026-01",
    tags: ["Next.js", "R3F", "Three.js", "Portfolio"],
    featured: true,
    summary: {
      tr:
        "3D retro bilgisayar ve CRT terminal odakli portfoy sitesi. R3F, CanvasTexture ve i18n altyapisi.",
      en:
        "3D retro-computer portfolio with CRT terminal, built on R3F, CanvasTexture, and i18n.",
    },
    detailsMd: {
      tr:
        "### Ozellikler\n- GLB model + terminal texture mapping\n- i18n (TR/EN) ve SEO altyapisi\n- Performans odakli mobil degrade",
      en:
        "### Highlights\n- GLB model + terminal texture mapping\n- TR/EN i18n and SEO foundations\n- Performance-minded mobile degrade",
    },
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical/kinin-code",
    },
  },
] as const;
