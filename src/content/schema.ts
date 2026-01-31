import { z } from "zod";

const localizedString = z.object({
  tr: z.string(),
  en: z.string(),
});

const localizedStringArray = z.object({
  tr: z.array(z.string()),
  en: z.array(z.string()),
});

export const profileSchema = z.object({
  name: z.string(),
  fullName: z.string(),
  asciiName: z.string(),
  jobTitle: localizedString,
  description: localizedString,
  ogImage: z.string(),
  roles: localizedStringArray,
  location: localizedString,
  introLines: localizedStringArray,
  socials: z.array(
    z.object({
      label: z.string(),
      href: z.string().url(),
      icon: z.string().min(1).max(3),
    }),
  ),
  terminal: z.object({
    prompt: z.string(),
  }),
  latestProjectsCount: z.number().optional(),
  sections: z.array(z.string()),
});

export const projectSchema = z.object({
  title: z.string(),
  year: z.string(),
  createdAt: z.string().optional(),
  featured: z.boolean().optional(),
  order: z.number().optional(),
  tags: z.array(z.string()),
  summary: localizedString,
  detailsMd: localizedString.optional(),
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

export const capabilitySchema = z.object({
  id: z.string(),
  icon: z.string(),
  title: localizedString,
  body: localizedString,
  bullets: localizedStringArray.optional(),
  tags: z.array(z.string()).optional(),
});

export const contentSchema = z.object({
  profile: profileSchema,
  projects: z.array(projectSchema),
  capabilities: z.array(capabilitySchema),
  theme: themeSchema,
});
