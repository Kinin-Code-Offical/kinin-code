export const projects = [
  {
    title: "Signal Board",
    year: "2025",
    tags: ["IoT", "Next.js", "Node.js"],
    summary:
      "Realtime monitoring dashboard for sensor streams with alert routing and data export.",
    detailsMd: `### Highlights
- Live telemetry charts
- Role-based dashboards
- Exportable reports`,
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical",
      live: "",
    },
  },
  {
    title: "Retro Console UI",
    year: "2024",
    tags: ["Three.js", "Canvas", "UI"],
    summary:
      "CRT-inspired terminal UI with custom canvas rendering and command system.",
    detailsMd: `### Details
- Canvas based terminal renderer
- Scanline + noise layers
- Command history + virtual FS`,
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical",
      live: "",
    },
  },
  {
    title: "Energy Lab Notes",
    year: "2023",
    tags: ["Python", "Electronics"],
    summary:
      "Tooling for logging lab experiments and exporting results to structured reports.",
    detailsMd: `### Scope
- CSV and PDF export
- Calibration helpers
- Lightweight UI`,
    media: [],
    links: {
      repo: "https://github.com/Kinin-Code-Offical",
      live: "",
    },
  },
] as const;
