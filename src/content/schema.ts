import { z } from "zod";

export const profileSchema = z.object({
  name: z.string(),
  roles: z.array(z.string()),
  location: z.string(),
  introLines: z.array(z.string()),
  menu: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    }),
  ),
  socials: z.array(
    z.object({
      label: z.string(),
      href: z.string().url(),
      icon: z.string().min(1).max(3),
    }),
  ),
  terminal: z.object({
    prompt: z.string(),
    helpText: z.string(),
  }),
  contactForm: z.object({
    nameLabel: z.string(),
    namePlaceholder: z.string(),
    emailLabel: z.string(),
    emailPlaceholder: z.string(),
    messageLabel: z.string(),
    messagePlaceholder: z.string(),
    submit: z.string(),
    sending: z.string(),
    success: z.string(),
    error: z.string(),
  }),
  sections: z.array(z.string()),
});

export const projectSchema = z.object({
  title: z.string(),
  year: z.string(),
  tags: z.array(z.string()),
  summary: z.string(),
  detailsMd: z.string().optional(),
  media: z.array(z.string()).optional(),
  links: z.object({
    live: z.string().optional(),
    repo: z.string().optional(),
  }),
});

export const themeSchema = z.object({
  palette: z.object({
    heroBg: z.string(),
    heroAccent: z.string(),
    heroAccentSoft: z.string(),
    terminalBg: z.string(),
    terminalText: z.string(),
    terminalDim: z.string(),
    contentBg: z.string(),
    contentInk: z.string(),
    contentMuted: z.string(),
    border: z.string(),
    chip: z.string(),
  }),
  typography: z.object({
    display: z.string(),
    body: z.string(),
    mono: z.string(),
  }),
  layout: z.object({
    maxWidth: z.number(),
    separator: z.string(),
  }),
  crt: z.object({
    scanlineOpacity: z.number(),
    noiseOpacity: z.number(),
    glow: z.number(),
    curvature: z.number(),
  }),
});

export const contentSchema = z.object({
  profile: profileSchema,
  projects: z.array(projectSchema),
  theme: themeSchema,
});
