// Capability cards, grouped into the electrical/electronics side and the
// software/product side. Technologies listed are the ones used in the
// projects on this site (RobotWin Studio, ESP-FIND, the Gong Global platform).
export const capabilities = [
  {
    id: "pcb",
    icon: "pcb",
    group: { tr: "Elektrik–Elektronik", en: "Electrical & Electronics" },
    title: {
      tr: "PCB tasarımı & donanım",
      en: "PCB design & hardware",
    },
    body: {
      tr: "Şematikten karta: sensör/MCU kartları, güç katları ve arayüz devreleri için şematik çizimi, PCB yerleşimi, üretim dosyaları ve prototipin devreye alınması.",
      en: "From schematic to board: schematics, PCB layout, manufacturing files and bring-up for sensor/MCU boards, power stages and interface circuits.",
    },
    bullets: {
      tr: [
        "Şematik çizimi ve PCB yerleşimi",
        "Güç katı, koruma ve gürültüye dikkat eden tasarım",
        "Gerber/BOM çıktısı, montaj ve ölçümle doğrulama",
      ],
      en: [
        "Schematic capture and PCB layout",
        "Power stages, protection and noise-aware design",
        "Gerber/BOM output, assembly and bench verification",
      ],
    },
    tags: ["PCB", "Schematic", "Gerber/BOM", "Bring-up"],
  },
  {
    id: "signalling",
    icon: "signal",
    group: { tr: "Elektrik–Elektronik", en: "Electrical & Electronics" },
    title: {
      tr: "Sinyalizasyon sistemleri",
      en: "Signalling systems",
    },
    body: {
      tr: "Raylı sistem, trafik ve endüstriyel sinyalizasyon için kontrol mantığı: durum makineleri, kilitleme (interlocking) kuralları, güvenli-hata (fail-safe) davranışı ve saha haberleşmesi.",
      en: "Control logic for railway, traffic and industrial signalling: state machines, interlocking rules, fail-safe behaviour and field communication.",
    },
    bullets: {
      tr: [
        "Durum makinesi tabanlı kontrol ve kilitleme mantığı",
        "Fail-safe tasarım, arıza tespiti ve izleme",
        "Saha haberleşmesi: RS-485, CAN, MQTT",
      ],
      en: [
        "State-machine control and interlocking logic",
        "Fail-safe design, fault detection and monitoring",
        "Field communication: RS-485, CAN, MQTT",
      ],
    },
    tags: ["Signalling", "Interlocking", "Fail-safe", "RS-485/CAN"],
  },
  {
    id: "embedded",
    icon: "cpu",
    group: { tr: "Elektrik–Elektronik", en: "Electrical & Electronics" },
    title: {
      tr: "Gömülü sistemler & IoT",
      en: "Embedded systems & IoT",
    },
    body: {
      tr: "ESP32/Arduino tabanlı cihazlar, firmware ve bulut bağlantısı; RFID erişim kontrolünden firmware emülasyonuna ve donanım-döngüde (HIL) teste kadar.",
      en: "ESP32/Arduino devices, firmware and cloud connectivity — from RFID access control to firmware emulation and hardware-in-the-loop testing.",
    },
    bullets: {
      tr: [
        "ESP32 / ESP8266 / ATmega328P firmware",
        "MQTT, WebSocket ve REST ile bulut entegrasyonu",
        "HIL test ve firmware emülasyonu",
      ],
      en: [
        "ESP32 / ESP8266 / ATmega328P firmware",
        "Cloud integration over MQTT, WebSocket and REST",
        "HIL testing and firmware emulation",
      ],
    },
    tags: ["ESP32", "Arduino", "MQTT", "HIL"],
  },
  {
    id: "full-stack",
    icon: "layers",
    group: { tr: "Yazılım & Ürün", en: "Software & Product" },
    title: {
      tr: "Full-stack builder",
      en: "Full-stack builder",
    },
    body: {
      tr: "Fikirden canlıya ürün: web, mobil ve masaüstü istemciler, API'ler, veritabanı ve bulut altyapısı tek elden. Gong Global'in yazılım ekosistemini bu şekilde kurdum.",
      en: "Products from idea to production: web, mobile and desktop clients, APIs, databases and cloud infrastructure end to end — how I built Gong Global's software ecosystem.",
    },
    bullets: {
      tr: [
        "Next.js/React, Astro · ASP.NET Core/.NET, Node.js",
        "PostgreSQL (RLS), MariaDB · Kotlin/Compose, WPF",
        "Google Cloud, Cloudflare, Docker, CI/CD",
      ],
      en: [
        "Next.js/React, Astro · ASP.NET Core/.NET, Node.js",
        "PostgreSQL (RLS), MariaDB · Kotlin/Compose, WPF",
        "Google Cloud, Cloudflare, Docker, CI/CD",
      ],
    },
    tags: ["Next.js", ".NET", "PostgreSQL", "Kotlin", "GCP"],
  },
  {
    id: "simulation-3d",
    icon: "cube",
    group: { tr: "Yazılım & Ürün", en: "Software & Product" },
    title: {
      tr: "Simülasyon & 3D",
      en: "Simulation & 3D",
    },
    body: {
      tr: "Deterministik robotik simülasyon, C++ fizik motorları, Unity sahneleri ve web için optimize 3D; mekanik parçalar için CAD ve 3D baskı.",
      en: "Deterministic robotics simulation, C++ physics engines, Unity scenes and web-optimised 3D; CAD and 3D printing for mechanical parts.",
    },
    bullets: {
      tr: [
        "C++ rigidbody fizik ve sabit adımlı scheduler",
        "Unity, Three.js/R3F, GLB optimizasyonu",
        "SolidWorks/STEP ile parça tasarımı ve 3D baskı",
      ],
      en: [
        "C++ rigid-body physics and fixed-step scheduling",
        "Unity, Three.js/R3F, GLB optimisation",
        "SolidWorks/STEP part design and 3D printing",
      ],
    },
    tags: ["Unity", "C++", "WebGL", "SolidWorks"],
  },
  {
    id: "ai-automation",
    icon: "brain",
    group: { tr: "Yazılım & Ürün", en: "Software & Product" },
    title: {
      tr: "Yapay zeka & otomasyon",
      en: "AI & automation",
    },
    body: {
      tr: "Veri hazırlama, model eğitimi ve ürüne entegrasyon; OCR ve sınıflandırma gibi işleri otomatik iş akışlarına, tekrar eden işleri CLI araçlarına dönüştürürüm.",
      en: "Data preparation, model training and product integration; I turn OCR and classification into automated workflows and repetitive work into CLI tools.",
    },
    bullets: {
      tr: [
        "OCR ve otomatik belge sınıflandırma",
        "Model eğitimi, değerlendirme ve deploy",
        "CLI ve otomasyon araçları",
      ],
      en: [
        "OCR and automatic document classification",
        "Model training, evaluation and deployment",
        "CLI and automation tooling",
      ],
    },
    tags: ["Python", "OCR", "ML", "CLI"],
  },
] as const;
