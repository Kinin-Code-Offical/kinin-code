import { translations } from "@/i18n/translations";

export type Language = "tr" | "en";

export const languageMeta: Record<
  Language,
  {
    label: string;
    envLang: string;
    locale: string;
  }
> = {
  tr: { label: "TR", envLang: "tr_TR.UTF-8", locale: "tr-TR" },
  en: { label: "EN", envLang: "en_US.UTF-8", locale: "en-US" },
};

export const languages: { code: Language; label: string }[] = [
  { code: "tr", label: languageMeta.tr.label },
  { code: "en", label: languageMeta.en.label },
];

export { translations };

export function getAlternateLanguage(language: Language): Language {
  return language === "tr" ? "en" : "tr";
}

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
