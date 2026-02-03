"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Language } from "@/lib/i18n";

type Theme = "dark" | "light";

type PreferencesContextValue = {
  theme: Theme;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleTheme: () => void;
  isSwitching: boolean;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const THEME_COOKIE = "theme";
const LANG_COOKIE = "lang";
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

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

function getInitialLanguage(initialLanguage: Language): Language {
  if (typeof window === "undefined") {
    return initialLanguage;
  }
  const params = new URLSearchParams(window.location.search);
  const paramLang = params.get("lang");
  if (paramLang === "tr" || paramLang === "en") {
    return paramLang;
  }
  const storedLang =
    localStorage.getItem(LANG_COOKIE) || readCookie(LANG_COOKIE);
  if (storedLang === "tr" || storedLang === "en") {
    return storedLang;
  }
  const browserLang = navigator.language.toLowerCase();
  return browserLang.startsWith("tr") ? "tr" : "en";
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
  const [language, setLanguageState] = useState<Language>(() =>
    getInitialLanguage(initialLanguage),
  );
  const [isSwitching, setIsSwitching] = useState(false);
  const switchTimerRef = useRef<number | null>(null);

  const startSwitch = useCallback(() => {
    setIsSwitching(true);
    if (switchTimerRef.current !== null) {
      window.clearTimeout(switchTimerRef.current);
    }
    switchTimerRef.current = window.setTimeout(() => {
      setIsSwitching(false);
      switchTimerRef.current = null;
    }, 900);
  }, []);

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

  useEffect(() => {
    return () => {
      if (switchTimerRef.current !== null) {
        window.clearTimeout(switchTimerRef.current);
      }
    };
  }, []);

  const setLanguage = useCallback(
    (lang: Language) => {
      if (lang === language) {
        return;
      }
      startSwitch();
      setLanguageState(lang);
    },
    [language, startSwitch],
  );

  const toggleTheme = useCallback(() => {
    startSwitch();
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, [startSwitch]);

  const value = useMemo(
    () => ({
      theme,
      language,
      setLanguage,
      toggleTheme,
      isSwitching,
    }),
    [theme, language, setLanguage, toggleTheme, isSwitching],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return ctx;
}
