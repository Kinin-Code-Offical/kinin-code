export const projects = [
  {
    title: "RobotWin Studio",
    year: "2026",
    createdAt: "2025-12",
    order: 1,
    tags: ["Circuit Sim", "PCB", "Arduino", "ESP32", "C#/.NET", "Physics"],
    featured: true,
    summary: {
      tr:
        "Robot ve elektronik projelerini baştan sona yapan Windows uygulaması (v1.2.0, MIT): devreyi çiz ve canlı simüle et, 2/4/6 katmanlı PCB'sini çıkar, Arduino/ESP32 kodunu emüle et, şasesini modelle, hepsini gerçek fizikli bir dünyada kablolayıp çalıştır.",
      en:
        "A Windows app for robot and electronics projects end to end (v1.2.0, MIT): draw and live-simulate the circuit, lay out a 2/4/6-layer PCB, emulate the Arduino/ESP32 code, model the chassis, then wire and run it all in a physics world.",
    },
    detailsMd: {
      tr:
        "### Özellikler\n- **Devre:** 256 gerçek parça, MNA + Newton-Raphson analog çözücüyle canlı simülasyon; osiloskop, multimetre, Monte Carlo, arıza tespiti (\"Neden yandı?\")\n- **PCB:** 2/4/6 katman, bakır alanlar, etkileşimli ve otomatik yol çizimi, DRC; Gerber/Excellon/BOM/CPL ve KiCad 8 dışa aktarımı\n- **Kod:** Arduino Uno/Nano (ATmega328P) derlenmiş HEX olarak emüle edilir, ESP32 devreyle eş zamanlı (co-simulation) çalışır\n- **Modelle:** Blender benzeri 3D modelleyici (bıçak, halka kesim, pah, Boolean)\n- **Dünya:** motorlar, servolar, sensörler, kablolar ve parçalar gerçek fizikle birbirini etkiler; roket motoru, paraşüt, hava sürtünmesi\n- .NET 9 + WPF, C++ ESP32 HAL, xUnit testleri, kurulum paketi ve belge sitesi",
      en:
        "### Highlights\n- **Circuit:** 256 real parts, live simulation with an MNA + Newton-Raphson analog solver; oscilloscope, multimeter, Monte Carlo, fault finding (\"why did it burn?\")\n- **PCB:** 2/4/6 layers, copper pours, interactive and automatic routing, DRC; Gerber/Excellon/BOM/CPL and KiCad 8 export\n- **Code:** Arduino Uno/Nano (ATmega328P) runs as compiled HEX, ESP32 code is co-simulated with the circuit\n- **Model:** Blender-like 3D modeller (knife, loop cut, bevel, Boolean)\n- **World:** motors, servos, sensors, wires and parts interact through real physics; rocket motors, parachutes, air drag\n- .NET 9 + WPF, C++ ESP32 HAL, xUnit tests, installer and documentation site",
    },
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical/robotwin-studio",
      live: "https://kinin-code-offical.github.io/robotwin-studio/",
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
        "Windows için Cloud SQL Auth Proxy yönetimi yapan CLI. gcloud entegrasyonu, kurulum sihirbazı, servis yönetimi ve diagnostik akışı.",
      en:
        "Windows-native CLI for managing Cloud SQL Auth Proxy with gcloud integration, setup wizard, service control, and diagnostics.",
    },
    detailsMd: {
      tr:
        "### Özellikler\n- Kurulum sihirbazı ve otomatik proxy indirme\n- gcloud/ADC kimlik doğrulama yardımcıları\n- Instance seçimi ve arka plan servis yönetimi\n- JSON loglar ve hassas veri maskeleme\n- Doctor komutu ve self-update",
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
        "Öğretmen ve öğrenciler için kapsamlı eğitim yönetimi ve özel ders takip platformu. Next.js 16 + Prisma + PostgreSQL.",
      en:
        "Comprehensive education management and tutoring platform built with Next.js 16, Prisma, and PostgreSQL.",
    },
    detailsMd: {
      tr:
        "### Kapsam\n- Web + API ayrı katmanlar\n- Prisma migration ve veri modeli\n- Dosya depolama (GCS) entegrasyonu\n- Kurumsal kullanıma uygun yapılandırma",
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
        "Sigorta acenteleri için poliçe/müşteri/varlık yönetimi. Flutter ön yüz, PHP REST API ve MySQL altyapısı.",
      en:
        "Insurance agency management system with a Flutter client, PHP REST API, and MySQL backend.",
    },
    detailsMd: {
      tr:
        "### Durum\n- Aktif geliştirme (devam ediyor)\n- CI/CD akışı ve test altyapısı\n- Phinx migration yapısı",
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
    order: 2,
    tags: ["ESP32", "IoT", "RFID", "MQTT"],
    featured: true,
    summary: {
      tr:
        "ESP8266/ESP32 için RFID erişim kontrol sistemi. Web arayüzü, MQTT entegrasyonu ve WebSocket API.",
      en:
        "RFID access control system for ESP8266/ESP32 with web UI, MQTT integration, and WebSocket API.",
    },
    detailsMd: {
      tr:
        "### Özellikler\n- Wiegand, PN532 ve RDM6300 desteği\n- Gerçek zamanlı durum + log akışı\n- NTP zaman senkronu\n- PlatformIO/Arduino kurulum akışı",
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
        "C++/C# tabanlı oyun motoru ve editör (WPF). Grafik, matematik, ses ve ağ katmanları.",
      en:
        "C++/C# game engine and editor (WPF) with rendering, math, audio, and networking layers.",
    },
    detailsMd: {
      tr:
        "### Detaylar\n- C++ çekirdek motor + C# editör\n- DirectX 12 tabanlı render hedefi\n- Oyun editörü ve sahne arayüzü",
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
        "Model görüntüleme, sahne kompozisyonu ve optimizasyon için modüler 3D araç seti. WebGL/R3F uyumlu akışlar.",
      en:
        "Modular 3D tooling for model viewing, scene composition, and optimization with WebGL/R3F-friendly workflows.",
    },
    detailsMd: {
      tr:
        "### Hedefler\n- Model import/export pipeline\n- Hafif materyal preset'leri\n- LOD ve performans profili\n- Editör odaklı sahne katmanları\n\n> Durum: aktif geliştirme",
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
        "Webtoon, çizgi roman, PDF ve akademik kaynakları tek kütüphanede toplayan tarayıcı eklentisi.",
      en:
        "Browser extension that collects webtoons, comics, PDFs, and academic sources into a unified library.",
    },
    detailsMd: {
      tr:
        "### Kapsam\n- Otomatik kaydetme ve klasörleme\n- Etiketleme + arama\n- Okuma listesi ve ilerleme takibi\n- Hafif senkronizasyon modu\n\n> Durum: prototip",
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
        "Gerçek zamanlı rigidbody, çarpışma ve zaman adımı için optimize edilmiş özel fizik motoru.",
      en:
        "Custom real-time physics engine optimized for rigid bodies, collisions, and stable time-stepping.",
    },
    detailsMd: {
      tr:
        "### Odak\n- Deterministik solver\n- Genişletilebilir çarpışma katmanı\n- Sabit zaman adımlı pipeline\n\n> Durum: Ar-Ge aşaması",
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
    order: 3,
    tags: ["ESP32", "Arduino", "Simulation", "Kernel"],
    featured: true,
    summary: {
      tr:
        "ESP32/Arduino sinyallerini fizik motoru ile senkron çalıştıran, ikincil kernel destekli simülasyon ortamı.",
      en:
        "Simulation kernel that syncs ESP32/Arduino signals with a physics engine, supporting a secondary runtime kernel.",
    },
    detailsMd: {
      tr:
        "### Vizyon\n- Gerçek donanım sinyaliyle hizalanmış simülasyon\n- Çift katmanlı kernel modeli\n- Sensörden aktüatöre tam döngü test\n\n> Durum: tasarım & mimari",
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
        "3D retro bilgisayar ve CRT terminal odaklı portfolyo sitesi. R3F, CanvasTexture ve i18n altyapısı.",
      en:
        "3D retro-computer portfolio with CRT terminal, built on R3F, CanvasTexture, and i18n.",
    },
    detailsMd: {
      tr:
        "### Özellikler\n- GLB model + terminal texture mapping\n- i18n (TR/EN) ve SEO altyapısı\n- Performans odaklı mobil sadeleştirme",
      en:
        "### Highlights\n- GLB model + terminal texture mapping\n- TR/EN i18n and SEO foundations\n- Performance-minded mobile degrade",
    },
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical/kinin-code",
    },
  },
] as const;
