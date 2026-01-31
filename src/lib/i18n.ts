import { translations } from "@/i18n/translations";

export type Language = "tr" | "en";

export const languages: { code: Language; label: string }[] = [
  { code: "tr", label: "TR" },
  { code: "en", label: "EN" },
];

export { translations };

export const copy = {
  tr: {
    nav: {
      services: translations.tr.nav.capabilities,
    },
    errors: translations.tr.errors,
  },
  en: {
    nav: {
      services: translations.en.nav.capabilities,
    },
    errors: translations.en.errors,
  },
} as const;
