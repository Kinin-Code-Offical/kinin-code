export const theme = {
  palette: {
    heroBg: "#0b0f0e",
    heroAccent: "#ffc56d",
    heroAccentSoft: "#ffd79c",
    terminalBg: "#120b06",
    terminalText: "#f4b86b",
    terminalDim: "#a1784b",
    contentBg: "#f6efe3",
    contentInk: "#231f1b",
    contentMuted: "#5c5349",
    border: "rgba(30, 25, 20, 0.2)",
    chip: "#f1dfc5",
  },
  typography: {
    display: "var(--font-display)",
    body: "var(--font-body)",
    mono: "var(--font-mono)",
  },
  layout: {
    maxWidth: 1040,
    separator: "dashed",
  },
  crt: {
    scanlineOpacity: 0.12,
    noiseOpacity: 0.08,
    glow: 1.6,
    curvature: 0.12,
  },
} as const;
