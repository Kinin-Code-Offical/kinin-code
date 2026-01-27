"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Language } from "@/lib/i18n";

type Theme = "dark" | "light";

type PreferencesContextValue = {
  theme: Theme;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleTheme: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const THEME_COOKIE = "theme";
const LANG_COOKIE = "lang";
const ONE_YEAR = 60 * 60 * 24 * 365;

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; max-age=${ONE_YEAR}; path=/; samesite=lax`;
}

function writeStorage(name: string, value: string) {
  try {
    localStorage.setItem(name, value);
  } catch {
    // Storage might be blocked; ignore.
  }
}

export function PreferencesProvider({
  children,
  initialTheme,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialTheme: Theme;
  initialLanguage: Language;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.lang = language;
    root.lang = language;
    writeCookie(THEME_COOKIE, theme);
    writeCookie(LANG_COOKIE, language);
    writeStorage(THEME_COOKIE, theme);
    writeStorage(LANG_COOKIE, language);
  }, [theme, language]);

  const value = useMemo(
    () => ({
      theme,
      language,
      setLanguage: setLanguageState,
      toggleTheme: () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
    }),
    [theme, language],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return ctx;
}
