export const theme = {
  palette: {
    heroBg: "#18130f",
    heroAccent: "#f3a143",
    heroAccentSoft: "#f7c27a",
    terminalBg: "#18130f",
    terminalText: "#f7c87a",
    terminalDim: "#c89a58",
    contentBg: "#18130f",
    contentInk: "#f5e6cf",
    contentMuted: "#c2a87f",
    border: "rgba(243, 161, 67, 0.2)",
    chip: "rgba(243, 161, 67, 0.12)",
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
