"use client";

import { useMemo } from "react";
import { usePreferences } from "@/components/PreferencesProvider";
import { translations } from "@/i18n/translations";
import type { Language } from "@/lib/i18n";

export function useI18n() {
  const { language, setLanguage } = usePreferences();
  const t = useMemo(() => translations[language], [language]);

  const setLang = (lang: Language) => {
    setLanguage(lang);
  };

  return { t, language, setLanguage: setLang };
}
