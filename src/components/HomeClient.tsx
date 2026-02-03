"use client";

import dynamic from "next/dynamic";
import type { ReactElement, RefObject } from "react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import ContactForm from "@/components/ContactForm";
import Markdown from "@/components/Markdown";
import TerminalCanvas, {
  TerminalApi,
} from "@/components/terminal/TerminalCanvas";
import type { SceneDebugInfo } from "@/components/hero/HeroScene";
import { usePreferences } from "@/components/PreferencesProvider";
import type { ContentData } from "@/lib/content";
import { getAlternateLanguage, languageMeta } from "@/lib/i18n";
import { useI18n } from "@/hooks/useI18n";

function HeroLoading() {
  const { t } = useI18n();
  return <div className="hero-loading">{t.hero.loading}</div>;
}

const HeroScene = dynamic(() => import("@/components/hero/HeroScene"), {
  ssr: false,
  loading: () => <HeroLoading />,
});

type HomeClientProps = {
  content: ContentData;
  debugEnabled?: boolean;
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

function useSmoothScrollProgress(
  ref: RefObject<HTMLElement | null>,
  onUpdate?: (value: number) => void,
) {
  const progressRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const onUpdateRef = useRef<typeof onUpdate>(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    let active = true;
    let resizeObserver: ResizeObserver | null = null;

    const computeTarget = () => {
      if (!ref.current) {
        targetRef.current = 0;
        return;
      }
      const rect = ref.current.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const raw = total > 0 ? Math.min(Math.max(-rect.top / total, 0), 1) : 0;
      targetRef.current = raw;
    };

    const epsilon = 0.0008;
    const smoothing = 0.12;

    const tick = () => {
      if (!active) {
        return;
      }
      const diff = targetRef.current - progressRef.current;
      if (Math.abs(diff) < epsilon) {
        progressRef.current = targetRef.current;
      } else {
        progressRef.current += diff * smoothing;
      }
      onUpdateRef.current?.(progressRef.current);
      rafRef.current = window.requestAnimationFrame(tick);
    };

    computeTarget();
    rafRef.current = window.requestAnimationFrame(tick);

    const schedule = () => {
      computeTarget();
    };

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(schedule);
      if (ref.current) {
        resizeObserver.observe(ref.current);
      }
    }

    return () => {
      active = false;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [ref]);

  return progressRef;
}

function useTypewriterText(
  text: string,
  active: boolean,
  options: { typeSpeed?: number; deleteSpeed?: number; reduceMotion?: boolean },
) {
  const { typeSpeed = 36, deleteSpeed = 48, reduceMotion } = options;
  const [count, setCount] = useState(active ? text.length : 0);
  const progressRef = useRef(count);
  const carryRef = useRef(0);

  useEffect(() => {
    progressRef.current = count;
  }, [count]);

  useEffect(() => {
    if (reduceMotion) {
      const next = active ? text.length : 0;
      progressRef.current = next;
      carryRef.current = 0;
      const rafId = window.requestAnimationFrame(() => {
        setCount(next);
      });
      return () => window.cancelAnimationFrame(rafId);
    }

    let raf = 0;
    let last = performance.now();
    const target = active ? text.length : 0;
    const speed = active ? typeSpeed : deleteSpeed;

    const step = (now: number) => {
      const delta = now - last;
      last = now;
      const direction = active ? 1 : -1;
      carryRef.current += (delta * speed) / 1000;
      while (carryRef.current >= 1) {
        carryRef.current -= 1;
        const next = Math.min(
          Math.max(progressRef.current + direction, 0),
          text.length,
        );
        progressRef.current = next;
        setCount(next);
        if ((active && next >= target) || (!active && next <= target)) {
          carryRef.current = 0;
          break;
        }
      }
      if (
        (active && progressRef.current < target) ||
        (!active && progressRef.current > target)
      ) {
        raf = window.requestAnimationFrame(step);
      }
    };

    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [active, deleteSpeed, reduceMotion, text, typeSpeed]);

  return {
    visibleText: text.slice(0, Math.max(0, count)),
    visibleCount: count,
    phase: active ? "typing" : "deleting",
  };
}

function useSwapTypewriter(
  text: string,
  options: { typeSpeed?: number; deleteSpeed?: number; reduceMotion?: boolean },
) {
  const { typeSpeed = 18, deleteSpeed = 26, reduceMotion } = options;
  const [display, setDisplay] = useState(text);
  const displayRef = useRef(display);
  const targetRef = useRef(text);
  const phaseRef = useRef<"typing" | "deleting" | null>(null);

  useEffect(() => {
    displayRef.current = display;
  }, [display]);

  useEffect(() => {
    if (reduceMotion) {
      targetRef.current = text;
      displayRef.current = text;
      const rafId = window.requestAnimationFrame(() => {
        setDisplay(text);
      });
      phaseRef.current = null;
      return () => window.cancelAnimationFrame(rafId);
    }

    if (text === displayRef.current) {
      targetRef.current = text;
      phaseRef.current = null;
      return;
    }

    targetRef.current = text;
    phaseRef.current = displayRef.current.length > 0 ? "deleting" : "typing";

    let raf = 0;
    let last = performance.now();
    let carry = 0;

    const step = (now: number) => {
      const phase = phaseRef.current;
      if (!phase) {
        return;
      }
      const delta = now - last;
      last = now;
      const speed = phase === "typing" ? typeSpeed : deleteSpeed;
      carry += (delta * speed) / 1000;

      while (carry >= 1) {
        carry -= 1;
        const { current } = displayRef;
        if (phaseRef.current === "deleting") {
          const next = current.slice(0, -1);
          displayRef.current = next;
          setDisplay(next);
          if (next.length === 0) {
            phaseRef.current = "typing";
          }
        } else if (phaseRef.current === "typing") {
          const target = targetRef.current;
          const next = target.slice(0, current.length + 1);
          displayRef.current = next;
          setDisplay(next);
          if (next.length >= target.length) {
            phaseRef.current = null;
            return;
          }
        }
      }

      if (phaseRef.current) {
        raf = window.requestAnimationFrame(step);
      }
    };

    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [text, reduceMotion, typeSpeed, deleteSpeed]);

  return display;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type LocalizedProject = {
  title: string;
  year: string;
  createdAt?: string;
  featured?: boolean;
  order?: number;
  tags: readonly string[];
  summary: string;
  detailsMd?: string;
  links: { repo?: string; live?: string };
};

function FeaturedCard({
  project,
  labels,
}: {
  project: LocalizedProject;
  labels: { repo: string; live: string };
}) {
  return (
    <article className="featured-card">
      <div className="featured-card-header">
        <span className="featured-year">{project.year}</span>
        <h3>{project.title}</h3>
      </div>
      <p className="featured-summary">{project.summary}</p>
      <div className="featured-tags">
        {project.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="featured-links">
        {project.links.repo ? (
          <a href={project.links.repo} target="_blank" rel="noreferrer">
            {labels.repo}
          </a>
        ) : null}
        {project.links.live ? (
          <a href={project.links.live} target="_blank" rel="noreferrer">
            {labels.live}
          </a>
        ) : null}
      </div>
    </article>
  );
}

const capabilityIcons: Record<string, ReactElement> = {
  zap: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  cube: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2l8 4v12l-8 4-8-4V6l8-4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 2v20M4 6l8 4 8-4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  cpu: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="7"
        y="7"
        width="10"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  brain: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 4a3 3 0 0 1 5 2v1a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-1v2a3 3 0 0 1-6 0v-2H5a3 3 0 0 1-3-3v-1a3 3 0 0 1 3-3V7a3 3 0 0 1 3-3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  layers: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M16 11a3 3 0 1 0-2.9-3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8 11a3 3 0 1 0-2.9-3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M2 20a6 6 0 0 1 10-4M12 20a6 6 0 0 1 10-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 7a4 4 0 1 0-5 5l-6 6 3 3 6-6a4 4 0 0 0 5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

type SectionId = ContentData["profile"]["sections"][number];

export default function HomeClient({
  content,
  debugEnabled = false,
}: HomeClientProps) {
  const { profile, projects, theme, pages, capabilities } = content;
  const { t, language, setLanguage } = useI18n();
  const { theme: currentTheme, toggleTheme, isSwitching } = usePreferences();
  const heroRef = useRef<HTMLElement>(null);
  const featuredRef = useRef<HTMLElement>(null);
  const featuredHeadingRef = useRef<HTMLHeadingElement>(null);
  const featuredSubtitleRef = useRef<HTMLParagraphElement>(null);
  const featuredProgressRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLElement>(null);
  const [debugHud, setDebugHud] = useState({
    scroll: 0,
    reveal: 0,
    fade: 1,
    heroActive: true,
  });
  const debugLastRef = useRef(0);
  const featuredIndex = useMemo(
    () => profile.sections.indexOf("featured"),
    [profile.sections],
  );
  const emailIndex = useMemo(
    () =>
      profile.socials.findIndex((social) => social.href.startsWith("mailto:")),
    [profile.socials],
  );
  const [dockKeysVisible, setDockKeysVisible] = useState(true);
  const dockKeysVisibleRef = useRef(true);
  const [heroActive, setHeroActive] = useState(true);
  const heroActiveRef = useRef(true);
  const [virtualKeysOpen, setVirtualKeysOpenState] = useState(false);
  const virtualKeysOpenRef = useRef(false);
  const setVirtualKeysOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      setVirtualKeysOpenState((prev) => {
        const nextValue = typeof value === "function" ? value(prev) : value;
        virtualKeysOpenRef.current = nextValue;
        return nextValue;
      });
    },
    [],
  );
  const scrollProgressRef = useSmoothScrollProgress(heroRef, (value) => {
    if (!shellRef.current) {
      return;
    }
    const activeId = activeSectionRef.current ?? "home";
    const activeIndex = profile.sections.indexOf(activeId);
    const forceOpaque = featuredIndex >= 0 && activeIndex > featuredIndex;
    const clamp = (val: number, min: number, max: number) =>
      Math.min(max, Math.max(min, val));
    let reveal = 0;
    const featuredEl =
      featuredSubtitleRef.current ??
      featuredHeadingRef.current ??
      featuredRef.current;
    if (featuredEl) {
      const rect = featuredEl.getBoundingClientRect();
      const elementCenter = rect.top + rect.height / 2;
      const offsetCenter = elementCenter - window.innerHeight;
      const triggerStart = window.innerHeight * 0.8;
      const triggerEnd = window.innerHeight * 0.5;
      if (triggerStart !== triggerEnd) {
        reveal = clamp(
          (triggerStart - offsetCenter) / (triggerStart - triggerEnd),
          0,
          1,
        );
      }
    } else {
      reveal = clamp((value - 0.85) / 0.12, 0, 1);
    }
    reveal = forceOpaque ? 1 : reveal;
    const fade = forceOpaque ? 0 : 1 - reveal;
    shellRef.current.style.setProperty("--hero-fade", String(fade));
    shellRef.current.style.setProperty("--content-reveal", String(reveal));
    const nextHeroActive = reveal < 0.98;
    if (debugEnabled) {
      const now = typeof performance !== "undefined" ? performance.now() : 0;
      if (now - debugLastRef.current > 120) {
        debugLastRef.current = now;
        setDebugHud({
          scroll: value,
          reveal,
          fade,
          heroActive: nextHeroActive,
        });
      }
    }
    if (heroActiveRef.current !== nextHeroActive) {
      heroActiveRef.current = nextHeroActive;
      setHeroActive(nextHeroActive);
    }
    const nextDockKeysVisible = reveal < 0.92;
    if (dockKeysVisibleRef.current !== nextDockKeysVisible) {
      dockKeysVisibleRef.current = nextDockKeysVisible;
      setDockKeysVisible(nextDockKeysVisible);
      // Close virtual keys when dock becomes hidden
      if (!nextDockKeysVisible) {
        setVirtualKeysOpen(false);
      }
    }
    if (
      (!nextDockKeysVisible || !nextHeroActive) &&
      virtualKeysOpenRef.current
    ) {
      virtualKeysOpenRef.current = false;
      setVirtualKeysOpen(false);
    }
  });

  const isMobile = useMediaQuery("(max-width: 900px)");
  const isCoarsePointer = useMediaQuery("(pointer: coarse)");
  const reducedMotion = useReducedMotion() ?? false;
  const [menuOpen, setMenuOpen] = useState(false);
  const fallbackSection = profile.sections[0] ?? "home";
  const [activeSection, setActiveSection] =
    useState<SectionId>(fallbackSection);
  const activeSectionRef = useRef<SectionId>(activeSection);
  const [bootDone, setBootDone] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelReadyAt, setModelReadyAt] = useState<number | null>(null);
  const [sceneReadyAt, setSceneReadyAt] = useState<number | null>(null);
  const [siteReady, setSiteReady] = useState(false);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [openCapabilityId, setOpenCapabilityId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [terminalApi, setTerminalApi] = useState<TerminalApi | null>(null);
  const [terminalFocused, setTerminalFocused] = useState(false);
  const pendingTerminalFocusRef = useRef(false);
  const [screenAspect, setScreenAspect] = useState(1.33);
  const [screenAspectReady, setScreenAspectReady] = useState(false);
  const [screenAspectReadyAt, setScreenAspectReadyAt] = useState<number | null>(
    null,
  );
  const screenAspectRef = useRef(screenAspect);
  const screenAspectTimerRef = useRef<number | null>(null);
  const pendingAspectRef = useRef<number | null>(null);
  const interactionActiveRef = useRef(false);
  const [terminalBootReady, setTerminalBootReady] = useState(false);
  const [terminalBootReadyAt, setTerminalBootReadyAt] = useState<number | null>(
    null,
  );
  const bootProgressRef = useRef(0);
  const bootProgressElRef = useRef<HTMLDivElement | null>(null);
  const bootStartAtRef = useRef<number | null>(null);
  const bootLoopStartRef = useRef<(() => void) | null>(null);
  const switchStartAtRef = useRef<number | null>(null);
  const [mobileModifiers, setMobileModifiers] = useState({
    ctrl: false,
    shift: false,
    alt: false,
  });
  const mobileModifiersRef = useRef(mobileModifiers);
  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
    setSceneReadyAt(Date.now());
  }, []);

  const handleSceneDebug = useCallback((info: SceneDebugInfo) => {
    if (info.modelLoaded || info.fallbackPlane) {
      setModelReady(true);
      setModelReadyAt(Date.now());
    }
  }, []);

  const handleTerminalFocus = useCallback(() => {
    if (terminalApi) {
      terminalApi.focus();
      pendingTerminalFocusRef.current = false;
      return;
    }
    pendingTerminalFocusRef.current = true;
  }, [terminalApi]);

  const handleTerminalInputFocus = useCallback(() => {
    terminalApi?.focusInput?.();
  }, [terminalApi]);

  const handleVirtualKey = useCallback(
    (
      key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "Tab",
      options?: { focus?: boolean },
    ) => {
      if (options?.focus !== false) {
        handleTerminalFocus();
      }
      const modifiers = mobileModifiersRef.current;
      const down = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        ctrlKey: modifiers.ctrl,
        shiftKey: modifiers.shift,
        altKey: modifiers.alt,
      });
      const up = new KeyboardEvent("keyup", {
        key,
        bubbles: true,
        ctrlKey: modifiers.ctrl,
        shiftKey: modifiers.shift,
        altKey: modifiers.alt,
      });
      window.dispatchEvent(down);
      window.dispatchEvent(up);
    },
    [handleTerminalFocus],
  );

  const toggleMobileModifier = useCallback((key: "ctrl" | "shift" | "alt") => {
    setMobileModifiers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      mobileModifiersRef.current = next;
      return next;
    });
  }, []);

  const showVirtualKeys = heroActive && (isMobile || virtualKeysOpen);

  const applyLanguage = (lang: "tr" | "en") => {
    setLanguage(lang);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const cleanPath = url.pathname.replace(/^\/(tr|en)(?=\/|$)/, "");
      url.pathname = cleanPath === "" ? "/" : cleanPath;
      url.searchParams.set("lang", lang);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const readyStartAtRef = useRef<number | null>(null);
  const bootStatusLine = t.boot.statusLine;
  const bootPhaseLine = useMemo(() => {
    if (bootDone) {
      return t.boot.phases.systemReady;
    }
    if (!sceneReady) {
      return t.boot.phases.bootLoading;
    }
    if (!modelReady) {
      return t.boot.phases.computerWarmingUp;
    }
    if (!screenAspectReady) {
      return t.boot.phases.calibratingScreen;
    }
    if (!terminalBootReady) {
      return t.boot.phases.startingTerminal;
    }
    return t.boot.phases.finalTouches;
  }, [
    bootDone,
    modelReady,
    sceneReady,
    screenAspectReady,
    terminalBootReady,
    t.boot.phases,
  ]);

  const bootFlagsRef = useRef({
    sceneReady: false,
    modelReady: false,
    screenAspectReady: false,
    terminalBootReady: false,
    bootDone: false,
    siteReady: false,
    isSwitching: false,
    domReady: false,
    fontsReady: false,
  });

  useEffect(() => {
    const flags = bootFlagsRef.current;
    flags.sceneReady = sceneReady;
    flags.modelReady = modelReady;
    flags.screenAspectReady = screenAspectReady;
    flags.terminalBootReady = terminalBootReady;
    flags.bootDone = bootDone;
    flags.siteReady = siteReady;
    flags.isSwitching = isSwitching;
  }, [
    bootDone,
    isSwitching,
    modelReady,
    sceneReady,
    screenAspectReady,
    siteReady,
    terminalBootReady,
  ]);

  useEffect(() => {
    const flags = bootFlagsRef.current;
    flags.domReady = true;
    if (typeof document !== "undefined") {
      flags.domReady = document.readyState === "complete";
      if (!flags.domReady) {
        window.addEventListener(
          "load",
          () => {
            bootFlagsRef.current.domReady = true;
            bootLoopStartRef.current?.();
          },
          { once: true },
        );
      }
      if (document.fonts?.ready) {
        void document.fonts.ready
          .then(() => {
            bootFlagsRef.current.fontsReady = true;
            bootLoopStartRef.current?.();
          })
          .catch(() => undefined);
      } else {
        flags.fontsReady = true;
      }
    } else {
      flags.fontsReady = true;
    }
  }, []);

  useEffect(() => {
    if (isSwitching) {
      switchStartAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      bootLoopStartRef.current?.();
    }
  }, [isSwitching]);

  useEffect(() => {
    if (bootStartAtRef.current === null) {
      bootStartAtRef.current =
        typeof performance !== "undefined" ? performance.now() : Date.now();
    }

    let rafId: number | null = null;
    const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
    const ease = (t: number) => t * t * (3 - 2 * t);

    const bootSteps = [
      {
        id: "dom",
        weight: 10,
        cap: 0.85,
        softMs: 650,
        done: () => bootFlagsRef.current.domReady,
      },
      {
        id: "fonts",
        weight: 10,
        cap: 0.9,
        softMs: 700,
        done: () => bootFlagsRef.current.fontsReady,
      },
      {
        id: "scene",
        weight: 20,
        cap: 0.92,
        softMs: 1100,
        done: () => bootFlagsRef.current.sceneReady,
      },
      {
        id: "model",
        weight: 25,
        cap: 0.92,
        softMs: 1500,
        done: () => bootFlagsRef.current.modelReady,
      },
      {
        id: "aspect",
        weight: 10,
        cap: 0.9,
        softMs: 900,
        done: () => bootFlagsRef.current.screenAspectReady,
      },
      {
        id: "terminal",
        weight: 20,
        cap: 0.92,
        softMs: 1400,
        done: () => bootFlagsRef.current.terminalBootReady,
      },
      {
        id: "final",
        weight: 5,
        cap: 0.95,
        softMs: 700,
        done: () => bootFlagsRef.current.bootDone,
      },
    ] as const;

    const activeStepRef = { id: "" as string, startedAt: 0 };
    let lastNow =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const applyProgress = (value: number) => {
      const next = Math.min(100, Math.max(0, value));
      if (next < bootProgressRef.current) {
        return;
      }
      bootProgressRef.current = next;
      if (bootProgressElRef.current) {
        const clamped = clamp01(next / 100);
        bootProgressElRef.current.style.setProperty(
          "--boot-progress",
          clamped.toString(),
        );
      }
    };

    const computeBootTarget = (now: number) => {
      if (bootFlagsRef.current.bootDone) {
        return 100;
      }
      let completed = 0;
      let active: (typeof bootSteps)[number] | null = null;
      for (const step of bootSteps) {
        if (step.done()) {
          completed += step.weight;
          continue;
        }
        active = step;
        break;
      }
      if (!active) {
        return 100;
      }
      if (activeStepRef.id !== active.id) {
        activeStepRef.id = active.id;
        activeStepRef.startedAt = now;
      }
      const start = completed;
      const end = completed + active.weight;
      const cap = start + (end - start) * active.cap;
      const t = clamp01((now - activeStepRef.startedAt) / active.softMs);
      const withinStep = start + (cap - start) * ease(t);
      return Math.max(start, Math.min(cap, withinStep));
    };

    const computeSwitchTarget = (now: number) => {
      const start = switchStartAtRef.current ?? now;
      const elapsed = Math.max(0, now - start);
      const duration = 900;
      const t = clamp01(elapsed / duration);
      const a = 0.22;
      const b = 0.72;
      if (t <= a) {
        const tt = ease(t / a);
        return 35 * tt;
      }
      if (t <= b) {
        const tt = ease((t - a) / (b - a));
        return 35 + (80 - 35) * tt;
      }
      const tt = ease((t - b) / (1 - b));
      return 80 + (100 - 80) * tt;
    };

    const tick = (now: number) => {
      rafId = null;
      const dt = Math.max(0, now - lastNow);
      lastNow = now;

      const visible =
        !bootFlagsRef.current.siteReady || bootFlagsRef.current.isSwitching;
      if (!visible) {
        return;
      }

      const target =
        bootFlagsRef.current.siteReady && bootFlagsRef.current.isSwitching
          ? computeSwitchTarget(now)
          : computeBootTarget(now);

      const tau = 140;
      const alpha = tau > 0 ? 1 - Math.exp(-dt / tau) : 1;
      const next =
        bootProgressRef.current + (target - bootProgressRef.current) * alpha;
      applyProgress(next);

      rafId = window.requestAnimationFrame(tick);
    };

    const startLoop = () => {
      if (rafId !== null) {
        return;
      }
      lastNow =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      rafId = window.requestAnimationFrame(tick);
    };

    bootLoopStartRef.current = startLoop;
    startLoop();

    return () => {
      bootLoopStartRef.current = null;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  useEffect(() => {
    if (!siteReady || isSwitching) {
      bootLoopStartRef.current?.();
    }
  }, [isSwitching, siteReady]);

  useEffect(() => {
    if (bootStartAtRef.current === null) {
      bootStartAtRef.current = Date.now();
    }
    if (!sceneReady || !modelReady || !sceneReadyAt || !modelReadyAt) {
      return;
    }
    const stableDelay = 500;
    const minBootDuration = 1000;
    const maxWait = 12000;
    const lastReadyAt = Math.max(
      sceneReadyAt,
      modelReadyAt,
      screenAspectReadyAt ?? 0,
      terminalBootReadyAt ?? 0,
    );
    const elapsed = Date.now() - lastReadyAt;
    if (sceneReady && modelReady && readyStartAtRef.current === null) {
      readyStartAtRef.current = Date.now();
    } else if (!sceneReady || !modelReady) {
      readyStartAtRef.current = null;
    }
    const readyElapsed = readyStartAtRef.current
      ? Date.now() - readyStartAtRef.current
      : 0;
    const canFinish = screenAspectReady && terminalBootReady;
    const shouldForce =
      readyStartAtRef.current !== null &&
      readyElapsed >= maxWait &&
      terminalBootReady;
    if (shouldForce) {
      const timer = window.setTimeout(() => {
        setBootDone(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
    if (!canFinish) {
      return;
    }
    const bootStart = bootStartAtRef.current ?? Date.now();
    const bootElapsed = Date.now() - bootStart;
    const remaining = Math.max(
      0,
      Math.max(stableDelay - elapsed, minBootDuration - bootElapsed),
    );
    const timer = window.setTimeout(() => {
      setBootDone(true);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [
    modelReady,
    modelReadyAt,
    sceneReady,
    sceneReadyAt,
    screenAspectReady,
    screenAspectReadyAt,
    terminalBootReady,
    terminalBootReadyAt,
  ]);

  useEffect(() => {
    if (!bootDone) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSiteReady(true);
    }, 160);
    return () => window.clearTimeout(timer);
  }, [bootDone]);

  useEffect(() => {
    if (!terminalApi || !pendingTerminalFocusRef.current) {
      return;
    }
    terminalApi.focus();
    pendingTerminalFocusRef.current = false;
  }, [terminalApi]);

  useEffect(() => {
    if (!bootDone || !terminalApi || isMobile || isCoarsePointer) {
      return;
    }
    const active = document.activeElement;
    if (
      active &&
      active !== document.body &&
      active !== document.documentElement
    ) {
      return;
    }
    terminalApi.focus();
  }, [bootDone, isCoarsePointer, isMobile, terminalApi]);

  useEffect(() => {
    mobileModifiersRef.current = mobileModifiers;
  }, [mobileModifiers]);

  useEffect(() => {
    screenAspectRef.current = screenAspect;
  }, [screenAspect]);

  useEffect(() => {
    const handleInteraction = (event: Event) => {
      const { detail } = event as CustomEvent<{ active?: boolean }>;
      if (!detail) {
        return;
      }
      interactionActiveRef.current = Boolean(detail.active);
      if (!detail.active && pendingAspectRef.current !== null) {
        const nextAspect = pendingAspectRef.current;
        pendingAspectRef.current = null;
        setScreenAspect(nextAspect);
        if (!screenAspectReady) {
          setScreenAspectReady(true);
          setScreenAspectReadyAt(Date.now());
        }
      }
    };
    window.addEventListener(
      "hero-interaction",
      handleInteraction as EventListener,
    );
    return () => {
      window.removeEventListener(
        "hero-interaction",
        handleInteraction as EventListener,
      );
      if (screenAspectTimerRef.current) {
        window.clearTimeout(screenAspectTimerRef.current);
      }
    };
  }, [screenAspectReady]);

  useEffect(() => {
    const shouldLock = isMobile && (isSwitching || !siteReady || menuOpen);
    const overflowValue = shouldLock ? "hidden" : "";
    document.body.style.overflow = overflowValue;
    document.documentElement.style.overflow = overflowValue;
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isMobile, isSwitching, menuOpen, siteReady]);

  useEffect(() => {
    if (!siteReady || isSwitching) {
      window.scrollTo(0, 0);
    }
  }, [isSwitching, siteReady]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const handleChange = () => {
      if (menuOpen) {
        setMenuOpen(false);
      }
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    const sections = profile.sections
      .map((id) => ({ id, element: document.getElementById(id) }))
      .filter((item): item is { id: SectionId; element: HTMLElement } =>
        Boolean(item.element),
      );

    if (sections.length === 0) {
      return;
    }

    let frame: number | null = null;
    const getAnchor = () => window.innerHeight * 0.25;

    const updateActive = () => {
      frame = null;
      let bestId: SectionId = sections[0]?.id ?? fallbackSection;
      let bestDistance = Number.POSITIVE_INFINITY;
      const anchor = getAnchor();

      sections.forEach((section) => {
        const rect = section.element.getBoundingClientRect();
        const distance = Math.abs(rect.top - anchor);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestId = section.id;
        }
      });

      if (bestId && bestId !== activeSectionRef.current) {
        activeSectionRef.current = bestId;
        setActiveSection(bestId);
      }
    };

    const scheduleUpdate = () => {
      if (frame === null) {
        frame = window.requestAnimationFrame(updateActive);
      }
    };

    updateActive();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [fallbackSection, profile.sections]);

  const localizedPages = useMemo(
    () => ({
      about: pages.about[language],
      contact: pages.contact[language],
      title: pages.title[language],
    }),
    [language, pages.about, pages.contact, pages.title],
  );

  const demoteHeadings = (value: string) => value.replace(/^#\s+/gm, "## ");
  const stripLeadingHeading = (value: string) =>
    value.replace(/^##?\s+.*\n+/, "");
  const aboutParts = useMemo(() => {
    const raw = localizedPages.about;
    const split = raw.split(/<!--\s*more\s*-->/i);
    return {
      intro: stripLeadingHeading(demoteHeadings(split[0] ?? "")),
      rest: stripLeadingHeading(
        demoteHeadings(split.slice(1).join("\n") ?? ""),
      ),
    };
  }, [localizedPages.about]);
  const contactContent = useMemo(
    () => demoteHeadings(localizedPages.contact),
    [localizedPages.contact],
  );
  const localizedCapabilities = useMemo(
    () =>
      capabilities.map((capability) => ({
        ...capability,
        title: capability.title[language],
        body: capability.body[language],
        bullets: capability.bullets ? capability.bullets[language] : undefined,
      })),
    [capabilities, language],
  );
  const aboutTitle = useSwapTypewriter(
    aboutOpen ? t.sections.about.longTitle : t.sections.about.title,
    {
      reduceMotion: reducedMotion,
    },
  );

  const localizedProjects = useMemo<LocalizedProject[]>(
    () =>
      projects.map((project) => ({
        ...project,
        summary: project.summary[language],
        detailsMd: project.detailsMd ? project.detailsMd[language] : undefined,
      })),
    [language, projects],
  );

  const featuredProjects = useMemo(() => {
    const list = localizedProjects.filter((project) => project.featured);
    return list.sort((a, b) => {
      if (a.order !== undefined || b.order !== undefined) {
        return (a.order ?? 999) - (b.order ?? 999);
      }
      const aTime = a.createdAt
        ? Date.parse(`${a.createdAt}-01`)
        : Date.parse(`${a.year}-01-01`);
      const bTime = b.createdAt
        ? Date.parse(`${b.createdAt}-01`)
        : Date.parse(`${b.year}-01-01`);
      return bTime - aTime;
    });
  }, [localizedProjects]);

  const latestProjects = useMemo(() => {
    const count = profile.latestProjectsCount ?? 6;
    const sorted = [...localizedProjects].sort((a, b) => {
      const aTime = a.createdAt
        ? Date.parse(`${a.createdAt}-01`)
        : Date.parse(`${a.year}-01-01`);
      const bTime = b.createdAt
        ? Date.parse(`${b.createdAt}-01`)
        : Date.parse(`${b.year}-01-01`);
      return bTime - aTime;
    });
    return sorted.slice(0, count);
  }, [localizedProjects, profile.latestProjectsCount]);

  const projectsMd = useMemo(() => {
    return [
      `# ${t.projects.latestTitle}`,
      "",
      ...latestProjects.map(
        (project) => `- ${project.title} (${project.year}): ${project.summary}`,
      ),
    ].join("\n");
  }, [latestProjects, t.projects.latestTitle]);

  const files = useMemo(() => {
    const terminalUser = profile.terminal.prompt.split("@")[0] || "user";
    const homeDir = `/home/${terminalUser}`;
    const docsDir = `${homeDir}/docs`;
    const scriptsDir = `${homeDir}/scripts`;
    const mediaDir = `${homeDir}/media`;
    const projectsDir = `${homeDir}/projects`;
    return [
      {
        path: `${homeDir}/README.md`,
        content: `# ${profile.fullName}\n\nWelcome to KININ-TERM.\n\nQuick links:\n- docs/about.md\n- docs/projects.md\n- docs/contact.md\n`,
      },
      {
        path: `${docsDir}/title.md`,
        content: localizedPages.title,
        section: "home",
      },
      {
        path: `${docsDir}/about.md`,
        content: localizedPages.about,
        section: "about",
      },
      {
        path: `${docsDir}/projects.md`,
        content: projectsMd,
        section: "projects",
      },
      {
        path: `${docsDir}/contact.md`,
        content: localizedPages.contact,
        section: "contact",
      },
      {
        path: `${homeDir}/notes/todo.txt`,
        content:
          "- finalize terminal sim\n- tune hero camera\n- deploy to cloud run\n- add new 3d scene\n",
      },
      {
        path: `${homeDir}/notes/ideas.txt`,
        content:
          "Ideas:\n- retro mini games\n- hardware blog posts\n- terminal theme switch\n",
      },
      {
        path: `${scriptsDir}/calc.py`,
        content:
          "# SciCalc demo\nimport math\nexpr = 'sin(pi/2) + cos(0)'\nallowed = {k: getattr(math, k) for k in ['sin','cos','tan','sqrt','log','pi','e']}\nallowed['pow'] = pow\nresult = eval(expr, {'__builtins__': {}}, allowed)\nprint('SciCalc demo:', expr, '=', result)\nprint('Tip: use calc command for interactive mode.')\n",
      },
      {
        path: `${scriptsDir}/snake.py`,
        content:
          "# Snake demo\nboard = [\n  '###########',\n  '#.........#',\n  '#..S....@..#',\n  '#.........#',\n  '###########',\n]\nprint('Controls: run `snake` in terminal for full game.')\nprint('\n'.join(board))\n",
      },
      {
        path: `${scriptsDir}/pacman.py`,
        content:
          "# Pacman demo\nmaze = [\n  '############',\n  '#C....##....#',\n  '#.##..##..##.#',\n  '#....G.....o#',\n  '############',\n]\nprint('Controls: run `pacman` in terminal for full game.')\nprint('\n'.join(maze))\n",
      },
      {
        path: `${scriptsDir}/pong.py`,
        content:
          "# Pong demo\nprint('Controls: run `pong` in terminal for full game.')\nprint('Scoreboard: PLAYER 0 - 0 AI')\nprint('Left/Right to move paddle')\n",
      },
      {
        path: `${scriptsDir}/chess.py`,
        content:
          "# Chess demo\nprint('Controls: run `chess` in terminal for full game.')\nprint('Tips: 1/2/3 difficulty, B bot, P pvp, C bot color')\n",
      },
      {
        path: `${scriptsDir}/solitaire.py`,
        content:
          "# Solitaire demo\nprint('Controls: run `solitaire` in terminal for full game.')\nprint('Keys: D draw, W waste, 1-7 tableau, F foundation')\n",
      },
      {
        path: `${scriptsDir}/dice_roll.py`,
        content:
          "import random\nprint('Dice roll:', random.randint(1, 6))\nprint('Try again for a new roll.')\n",
      },
      {
        path: `${scriptsDir}/hello_world.py`,
        content:
          "import datetime\nprint('Hello, world!')\nprint('UTC time:', datetime.datetime.utcnow().isoformat())\n",
      },
      {
        path: `${scriptsDir}/media_demo.py`,
        content:
          "print('Media demo:')\nprint('image  -> random retro ASCII')\nprint('video  -> random loop')\nprint('mp3    -> random chiptune')\nprint('Tip: image ~/media/nebula.txt')\n",
      },
      {
        path: `${scriptsDir}/ascii_image.py`,
        content:
          "art = [\n  '   .-.',\n  '  (o o)',\n  '  | = |',\n  ' (__|__)',\n  'RETRO BOT',\n]\nprint('\\n'.join(art))\n",
      },
      {
        path: `${scriptsDir}/starfield.py`,
        content:
          "import random\nfor _ in range(6):\n    line = ''.join(random.choice('.*') if random.random() > 0.7 else ' ' for _ in range(48))\n    print(line)\n",
      },
      {
        path: `${scriptsDir}/quote_bot.py`,
        content:
          "import random\nquotes = [\n  'Focus beats luck.',\n  'Ship it.',\n  'Keep it simple.',\n  'Small steps, big wins.',\n]\nprint(random.choice(quotes))\n",
      },
      {
        path: `${mediaDir}/nebula.txt`,
        content:
          "        .     .      .\n     .   *  .   .  *   .\n  .  .  .  .***.  .  .  .\n    .   .*'  *  '*.   .\n .    . *   .   . * .   .\n    .    '*.   .*'    .\n .  .  .   '***'   .  .  .\n     .   *  .   .  *   .\n        .     .      .\n",
      },
      {
        path: `${mediaDir}/grid.txt`,
        content:
          "|‾‾‾‾‾‾‾‾‾‾‾|\n|  RETRO  |\n|  GRID   |\n|_________|\n\\\\\\\\\\\\\\\n/ / / / / /\n\\\\\\\\\\\\\\\n",
      },
      {
        path: `${mediaDir}/city.txt`,
        content:
          "     | | | | | |\n  ___|_|_|_|_|_|___\n /__ NEON SKYLINE __\\\n|_|_|_|_|_|_|_|_|_|_|\n  /_/ /_/ /_/ /_/ /_\n",
      },
      {
        path: `${mediaDir}/arcade.txt`,
        content:
          "   .--------------.\n  /   ARCADE 88    /|\n /______________/ |\n | .----------. | |\n | |  READY!  | | |\n | '----------' |/\n '--------------'\n",
      },
      {
        path: `${mediaDir}/loop.vid`,
        content:
          "[frame 1]\n  (o)\n /|\\\n / \\\n\n---\n[frame 2]\n  (o)\n /|\\\n /\\ \\\n\n---\n[frame 3]\n  (o)\n /|\\\n / \\\n\n",
      },
      {
        path: `${mediaDir}/loop2.vid`,
        content:
          "[frame 1]\n  [#]  \n /|_|\\\n  / \\\n\n---\n[frame 2]\n  [#]  \n /|_|\\\n  /\\ \\\n\n---\n[frame 3]\n  [#]  \n /|_|\\\n  / \\\n\n",
      },
      {
        path: `${mediaDir}/loop3.vid`,
        content:
          "[frame 1]\n  <o>  \n  /|\\\n  / \\\n\n---\n[frame 2]\n  <o>  \n  /|\\\n  /\\ \\\n\n---\n[frame 3]\n  <o>  \n  /|\\\n  / \\\n\n",
      },
      {
        path: `${mediaDir}/loop4.vid`,
        content:
          "[frame 1]\n  /\\_/\\  \n ( o.o )\n  > ^ <\n\n---\n[frame 2]\n  /\\_/\\  \n ( o.o )\n  > ~ <\n\n---\n[frame 3]\n  /\\_/\\  \n ( o.o )\n  > ^ <\n\n",
      },
      {
        path: `${mediaDir}/loop5.vid`,
        content:
          "[frame 1]\n  [==]  \n  |  |  \n  |__|  \n\n---\n[frame 2]\n  [==]  \n  |~~|  \n  |__|  \n\n---\n[frame 3]\n  [==]  \n  |  |  \n  |__|  \n\n",
      },
      {
        path: `${mediaDir}/neon_grid.png`,
        content:
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%230b0f0e'/><path d='M0 48 L64 32' stroke='%236fd1ff' stroke-width='2'/><path d='M0 56 L64 40' stroke='%237ef2b2' stroke-width='2'/><circle cx='48' cy='20' r='10' fill='%23ffb36b'/></svg>",
      },
      {
        path: `${mediaDir}/neon_sun.jpg`,
        content:
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%23061110'/><rect y='36' width='64' height='28' fill='%23121f2a'/><circle cx='32' cy='30' r='14' fill='%23ff7ad9'/><path d='M0 48 L64 34' stroke='%23ffb36b' stroke-width='2'/></svg>",
      },
      {
        path: `${mediaDir}/circuit_chip.png`,
        content:
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%230b0f0e'/><rect x='14' y='14' width='36' height='36' rx='4' fill='%231a2b2a' stroke='%236fd1ff' stroke-width='2'/><path d='M8 20h8M8 32h8M8 44h8M48 8v8M32 8v8M20 8v8M56 20h-8M56 32h-8M56 44h-8M20 56v-8M32 56v-8M44 56v-8' stroke='%237ef2b2' stroke-width='2'/></svg>",
      },
      {
        path: `${mediaDir}/sunrise.png`,
        content:
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='64'><rect width='80' height='64' fill='%23070b12'/><rect y='34' width='80' height='30' fill='%23111f2a'/><circle cx='40' cy='30' r='14' fill='%23ffb36b'/><path d='M0 44 L80 32' stroke='%23ff7ad9' stroke-width='2'/><path d='M0 52 L80 38' stroke='%236fd1ff' stroke-width='2'/></svg>",
      },
      {
        path: `${mediaDir}/neon_rain.jpg`,
        content:
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='64'><rect width='80' height='64' fill='%230a0f14'/><path d='M8 0v64M20 0v64M32 0v64M44 0v64M56 0v64M68 0v64' stroke='%236fd1ff' stroke-width='2' opacity='0.7'/><circle cx='62' cy='20' r='8' fill='%23ff7ad9'/></svg>",
      },
      {
        path: `${mediaDir}/grid_horizon.jpg`,
        content:
          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='64'><rect width='80' height='64' fill='%230b0f0e'/><path d='M0 44 L80 28' stroke='%237ef2b2' stroke-width='2'/><path d='M0 54 L80 36' stroke='%236fd1ff' stroke-width='2'/><path d='M0 64 L80 44' stroke='%23ffb36b' stroke-width='2'/></svg>",
      },
      {
        path: `${mediaDir}/synth.mp3`,
        content: "MP3DATA",
      },
      {
        path: `${mediaDir}/synth2.mp3`,
        content: "MP3DATA_2",
      },
      {
        path: `${mediaDir}/synth3.mp3`,
        content: "MP3DATA_3",
      },
      {
        path: `${mediaDir}/neon_drive.mp3`,
        content: "MP3DATA_4",
      },
      {
        path: `${mediaDir}/circuit_beat.mp3`,
        content: "MP3DATA_5",
      },
      {
        path: `${mediaDir}/glow_shift.mp3`,
        content: "MP3DATA_6",
      },
      {
        path: `${mediaDir}/horizon_chords.mp3`,
        content: "MP3DATA_7",
      },
      {
        path: `${mediaDir}/pulse_echo.mp3`,
        content: "MP3DATA_8",
      },
      {
        path: `${mediaDir}/retro_wave.mp3`,
        content: "MP3DATA_9",
      },
      {
        path: `${projectsDir}/kinin-portfolio/README.md`,
        content:
          "# Kinin Portfolio\n\nStatus: active\nStack: Next.js, Three.js, WebGL\n",
      },
      {
        path: `${projectsDir}/retro-os/README.md`,
        content:
          "# Retro OS\n\nExperimenting with terminal UX and CRT shaders.\n",
      },
      {
        path: `${homeDir}/.bashrc`,
        content: "alias ll='ls -al'\nalias la='ls -a'\n",
      },
      {
        path: `${homeDir}/.profile`,
        content: "export LANG=en_US.UTF-8\nexport TERM=kinin-term\n",
      },
      {
        path: "/etc/os-release",
        content:
          'NAME=KininOS\nVERSION=0.9.4\nID=kininos\nPRETTY_NAME="KininOS 0.9.4"\n',
      },
      {
        path: "/var/log/boot.log",
        content: "boot: ok\nservices: ready\n",
      },
      {
        path: "/usr/bin/python",
        content: "ELF...",
      },
      {
        path: "/usr/bin/pacman",
        content: "ELF...",
      },
      {
        path: "/usr/bin/snake",
        content: "ELF...",
      },
      {
        path: "/usr/bin/pong",
        content: "ELF...",
      },
      {
        path: "/usr/bin/chess",
        content: "ELF...",
      },
      {
        path: "/usr/bin/solitaire",
        content: "ELF...",
      },
      {
        path: "/usr/bin/mp3",
        content: "ELF...",
      },
      {
        path: "/usr/bin/video",
        content: "ELF...",
      },
      {
        path: "/usr/bin/image",
        content: "ELF...",
      },
    ];
  }, [localizedPages, profile.fullName, profile.terminal.prompt, projectsMd]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setMenuOpen(false);
  };

  const navLabels: Record<string, string> = {
    home: t.nav.home,
    intro: t.nav.intro,
    featured: t.nav.featured,
    capabilities: t.nav.capabilities,
    about: t.nav.about,
    projects: t.nav.projects,
    contact: t.nav.contact,
  };

  const navItems = profile.sections.map((id) => ({
    id,
    label: navLabels[id] ?? id,
  }));

  const featuredCount = featuredProjects.length;
  const [activeFeatured, setActiveFeatured] = useState(0);
  const featuredAutoTimerRef = useRef<number | null>(null);
  const featuredAutoScheduleRef = useRef<((delay: number) => void) | null>(
    null,
  );
  const featuredLastInteractionRef = useRef(0);
  const clampFeaturedIndex = useCallback(
    (index: number) => {
      if (featuredCount <= 0) {
        return 0;
      }
      return Math.max(0, Math.min(index, featuredCount - 1));
    },
    [featuredCount],
  );
  const setFeaturedIndex = useCallback(
    (index: number) => {
      setActiveFeatured(clampFeaturedIndex(index));
    },
    [clampFeaturedIndex],
  );
  const shiftFeaturedIndex = useCallback(
    (delta: number) => {
      setActiveFeatured((prev) => clampFeaturedIndex(prev + delta));
    },
    [clampFeaturedIndex],
  );
  const registerFeaturedInteraction = useCallback(() => {
    featuredLastInteractionRef.current = Date.now();
    if (featuredAutoScheduleRef.current) {
      featuredAutoScheduleRef.current(12000);
    }
  }, []);
  const featuredAutoDir = useRef(1);
  useEffect(() => {
    if (reducedMotion || featuredCount <= 1) {
      return;
    }
    let active = true;
    const clearTimer = () => {
      if (featuredAutoTimerRef.current !== null) {
        window.clearTimeout(featuredAutoTimerRef.current);
        featuredAutoTimerRef.current = null;
      }
    };
    const schedule = (delay: number) => {
      clearTimer();
      featuredAutoTimerRef.current = window.setTimeout(() => {
        if (!active) {
          return;
        }
        const now = Date.now();
        const sinceInteraction =
          now - (featuredLastInteractionRef.current || 0);
        if (sinceInteraction < 12000) {
          schedule(12000 - sinceInteraction);
          return;
        }
        setActiveFeatured((prev) => {
          if (prev >= featuredCount - 1) {
            featuredAutoDir.current = -1;
          } else if (prev <= 0) {
            featuredAutoDir.current = 1;
          }
          return clampFeaturedIndex(prev + featuredAutoDir.current);
        });
        schedule(5200);
      }, delay);
    };
    featuredAutoScheduleRef.current = schedule;
    schedule(5200);
    return () => {
      active = false;
      featuredAutoScheduleRef.current = null;
      clearTimer();
    };
  }, [clampFeaturedIndex, featuredCount, reducedMotion]);
  const safeActiveFeatured =
    featuredCount > 0 ? clampFeaturedIndex(activeFeatured) : 0;
  const activeFeaturedProject =
    featuredCount > 0 ? featuredProjects[safeActiveFeatured] : null;
  const featuredProgress =
    featuredProjects.length > 0
      ? (safeActiveFeatured + 1) / featuredProjects.length
      : 0;
  useEffect(() => {
    if (!featuredProgressRef.current) {
      return;
    }
    featuredProgressRef.current.style.setProperty(
      "--featured-progress",
      String(featuredProgress),
    );
  }, [featuredProgress]);
  const featuredSliderCss = useMemo(() => {
    if (featuredCount === 0) {
      return "";
    }
    const rules: string[] = [];
    for (let active = 1; active <= featuredCount; active += 1) {
      for (let item = 1; item <= featuredCount; item += 1) {
        const offset = item - active;
        let offsetValue = "0px";
        let scale = 0.86;
        let opacity = 0.6;
        let zIndex = 0;
        let position = "absolute";
        let pointer = "none";

        if (offset === 0) {
          offsetValue = "0px";
          scale = 1;
          opacity = 1;
          zIndex = 2;
          position = "relative";
          pointer = "auto";
        } else if (offset === 1) {
          offsetValue = "var(--featured-offset-1)";
          scale = 0.86;
          opacity = 0.6;
          zIndex = 1;
        } else if (offset === -1) {
          offsetValue = "calc(var(--featured-offset-1) * -1)";
          scale = 0.86;
          opacity = 0.6;
          zIndex = 1;
        } else if (offset === 2) {
          offsetValue = "var(--featured-offset-2)";
          scale = 0.72;
          opacity = 0;
          zIndex = -1;
        } else if (offset === -2) {
          offsetValue = "calc(var(--featured-offset-2) * -1)";
          scale = 0.72;
          opacity = 0;
          zIndex = -1;
        } else if (offset > 2) {
          offsetValue = "var(--featured-offset-2)";
          scale = 0.72;
          opacity = 0;
          zIndex = -1;
        } else {
          offsetValue = "calc(var(--featured-offset-2) * -1)";
          scale = 0.72;
          opacity = 0;
          zIndex = -1;
        }

        rules.push(
          `#featured-slide-${active}:checked ~ .featured-track .featured-item--${item} { --featured-offset: ${offsetValue}; --featured-scale: ${scale}; --featured-opacity: ${opacity}; --featured-z: ${zIndex}; position: ${position}; pointer-events: ${pointer}; }`,
        );
      }
      rules.push(
        `#featured-slide-${active}:checked ~ .featured-controls .featured-dots .featured-dot--${active} { background: var(--hero-accent); border-color: var(--hero-accent); transform: scale(1.05); }`,
      );
    }
    return rules.join("\n");
  }, [featuredCount]);

  useEffect(() => {
    if (!shellRef.current) {
      return;
    }
    shellRef.current.style.setProperty("--hero-fade", "1");
    shellRef.current.style.setProperty("--content-reveal", "0");
  }, []);

  return (
    <main className="site-shell" ref={shellRef}>
      {debugEnabled ? (
        <div className="debug-hud">
          {`scroll: ${debugHud.scroll.toFixed(3)}\nreveal: ${debugHud.reveal.toFixed(3)}\nfade: ${debugHud.fade.toFixed(3)}\nheroActive: ${debugHud.heroActive}`}
        </div>
      ) : null}
      {!siteReady || isSwitching ? (
        <div
          className={`boot-screen ${isSwitching ? "is-switching" : ""}`}
          role="status"
          aria-live="polite">
          <div className="boot-card">
            <div className="boot-logo">~&gt;</div>
            <div className="boot-lines">
              {profile.introLines[language]
                .filter((line) => !line.toLowerCase().includes("help"))
                .map((line, index) => (
                  <p key={`${line}-${index}`}>{line}</p>
                ))}
              <p>{bootStatusLine}</p>
              <p className="boot-phase">{bootPhaseLine}</p>
            </div>
            <div className="boot-progress is-live" ref={bootProgressElRef}>
              <span />
            </div>
          </div>
        </div>
      ) : null}

      <div className={`site-content ${siteReady ? "is-ready" : "is-loading"}`}>
        {isMobile ? (
          <button
            className={`mobile-menu-toggle ${
              menuOpen ? "is-active is-hidden" : ""
            }`}
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-haspopup="dialog"
            aria-label={menuOpen ? t.nav.close : t.nav.menu}>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}

        {!isMobile ? (
          <div
            className={`compact-dock ${menuOpen ? "is-hidden" : "is-visible"}`}
            aria-label={t.nav.menu}>
            <div className="dock-stack">
              <button
                className="dock-button"
                type="button"
                onClick={() => setMenuOpen(true)}
                aria-label={t.nav.menu}>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M4 7h16M4 12h16M4 17h16"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
              <button
                className="dock-button"
                type="button"
                onClick={toggleTheme}
                aria-label={
                  currentTheme === "dark" ? t.ui.themeDark : t.ui.themeLight
                }
                aria-pressed={currentTheme === "dark"}>
                {currentTheme === "dark" ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M15.5 4.5a7.5 7.5 0 1 0 4 10.6 8 8 0 0 1-4-10.6z"
                      strokeWidth="1.6"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <circle
                      cx="12"
                      cy="12"
                      r="4.2"
                      strokeWidth="1.6"
                      fill="none"
                    />
                    <path
                      d="M12 3v3M12 18v3M3 12h3M18 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </button>
              <button
                className="dock-button"
                type="button"
                onClick={() => applyLanguage(getAlternateLanguage(language))}
                aria-label={t.ui.language}>
                {languageMeta[language].label}
              </button>
            </div>
            <div className="dock-socials" aria-label="Social links">
              {profile.socials.map((social, index) => {
                const isEmail = social.href.startsWith("mailto:");
                if (isEmail) {
                  return (
                    <Fragment key={social.label}>
                      <button
                        className="dock-button"
                        type="button"
                        onClick={() => scrollToSection("contact")}
                        aria-label={social.label}>
                        {social.icon}
                      </button>
                      {dockKeysVisible && index === emailIndex ? (
                        <button
                          className={`dock-button${
                            virtualKeysOpen ? " is-active" : ""
                          }`}
                          type="button"
                          onClick={() => setVirtualKeysOpen((prev) => !prev)}
                          aria-label={t.hero.keysToggle}
                          aria-pressed={virtualKeysOpen}>
                          K
                        </button>
                      ) : null}
                    </Fragment>
                  );
                }
                return (
                  <a
                    key={social.label}
                    className="dock-button"
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}>
                    {social.icon}
                  </a>
                );
              })}
              {dockKeysVisible && emailIndex === -1 ? (
                <button
                  className={`dock-button${
                    virtualKeysOpen ? " is-active" : ""
                  }`}
                  type="button"
                  onClick={() => setVirtualKeysOpen((prev) => !prev)}
                  aria-label={t.hero.keysToggle}
                  aria-pressed={virtualKeysOpen}>
                  K
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isMobile && menuOpen ? (
          <div
            className="sidebar-backdrop"
            role="presentation"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}

        {!isMobile ? (
          <aside
            className={`sidebar ${menuOpen ? "open" : ""}`}
            aria-label={t.nav.menu}
            aria-hidden={!menuOpen}>
            <div className="sidebar-inner">
              <div className="sidebar-brand">
                <div className="brand-mark">~&gt;</div>
                <div>
                  <p className="brand-name">{profile.fullName}</p>
                  <p className="brand-role">{profile.jobTitle[language]}</p>
                </div>
                <button
                  className="sidebar-close"
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label={t.nav.close}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M6 6l12 12M18 6l-12 12"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="sidebar-separator" role="presentation" />
              <nav className="sidebar-nav" aria-label={t.nav.menu}>
                {navItems.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`sidebar-link ${isActive ? "active" : ""}`}
                      onClick={() => scrollToSection(item.id)}
                      aria-current={isActive ? "page" : undefined}>
                      <span className="nav-glyph" aria-hidden="true">
                        &gt;
                      </span>
                      <span className="nav-label">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="sidebar-separator" role="presentation" />
              <div className="sidebar-actions">
                <button
                  className="sidebar-action"
                  type="button"
                  onClick={toggleTheme}
                  aria-label={
                    currentTheme === "dark" ? t.ui.themeDark : t.ui.themeLight
                  }
                  aria-pressed={currentTheme === "dark"}>
                  {currentTheme === "dark" ? (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false">
                      <path
                        d="M15.5 4.5a7.5 7.5 0 1 0 4 10.6 8 8 0 0 1-4-10.6z"
                        strokeWidth="1.6"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false">
                      <circle
                        cx="12"
                        cy="12"
                        r="4.2"
                        strokeWidth="1.6"
                        fill="none"
                      />
                      <path
                        d="M12 3v3M12 18v3M3 12h3M18 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  <span className="sidebar-action-label">
                    {currentTheme === "dark" ? t.ui.themeDark : t.ui.themeLight}
                  </span>
                </button>
                <div className="sidebar-lang" aria-label={t.ui.language}>
                  <button
                    type="button"
                    className={language === "tr" ? "active" : ""}
                    onClick={() => applyLanguage("tr")}>
                    {languageMeta.tr.label}
                  </button>
                  <span aria-hidden="true">/</span>
                  <button
                    type="button"
                    className={language === "en" ? "active" : ""}
                    onClick={() => applyLanguage("en")}>
                    {languageMeta.en.label}
                  </button>
                </div>
                <div className="sidebar-socials" aria-label="Social links">
                  {profile.socials.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer">
                      <span className="social-glyph">{social.icon}</span>
                      <span className="social-label">{social.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        ) : null}

        {isMobile ? (
          <div
            id="mobile-menu"
            className={`mobile-sheet ${menuOpen ? "open" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-hidden={!menuOpen}
            onClick={() => setMenuOpen(false)}>
            <div
              className="mobile-sheet-content"
              onClick={(event) => event.stopPropagation()}>
              <div className="mobile-sheet-header">
                <div className="mobile-brand">
                  <div className="brand-mark">~&gt;</div>
                  <div>
                    <p className="brand-name">{profile.fullName}</p>
                    <p className="brand-role">{profile.jobTitle[language]}</p>
                  </div>
                </div>
                <button
                  className="mobile-close"
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label={t.nav.close}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path
                      d="M6 6l12 12M18 6l-12 12"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="mobile-links">
                {navItems.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={isActive ? "active" : ""}
                      onClick={() => scrollToSection(item.id)}>
                      <span aria-hidden="true">›</span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <div className="mobile-actions">
                <button
                  className="sidebar-action"
                  type="button"
                  onClick={toggleTheme}
                  aria-label={
                    currentTheme === "dark" ? t.ui.themeDark : t.ui.themeLight
                  }
                  aria-pressed={currentTheme === "dark"}>
                  {currentTheme === "dark" ? (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false">
                      <path
                        d="M15.5 4.5a7.5 7.5 0 1 0 4 10.6 8 8 0 0 1-4-10.6z"
                        strokeWidth="1.6"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      focusable="false">
                      <circle
                        cx="12"
                        cy="12"
                        r="4.2"
                        strokeWidth="1.6"
                        fill="none"
                      />
                      <path
                        d="M12 3v3M12 18v3M3 12h3M18 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                  <span className="sidebar-action-label">
                    {currentTheme === "dark" ? t.ui.themeDark : t.ui.themeLight}
                  </span>
                </button>
                <div className="sidebar-lang" aria-label={t.ui.language}>
                  <button
                    type="button"
                    className={language === "tr" ? "active" : ""}
                    onClick={() => applyLanguage("tr")}>
                    {languageMeta.tr.label}
                  </button>
                  <span aria-hidden="true">/</span>
                  <button
                    type="button"
                    className={language === "en" ? "active" : ""}
                    onClick={() => applyLanguage("en")}>
                    {languageMeta.en.label}
                  </button>
                </div>
                <div className="sidebar-socials" aria-label="Social links">
                  {profile.socials.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noreferrer">
                      <span className="social-glyph">{social.icon}</span>
                      <span className="social-label">{social.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <section
          ref={heroRef}
          id="home"
          className={`hero-shell ${terminalFocused ? "focused" : ""}`}>
          <div className="hero-sticky">
            <HeroScene
              terminalApi={terminalApi}
              scrollProgressRef={scrollProgressRef}
              noteTexts={{ red: t.hero.noteRed, blue: t.hero.noteBlue }}
              active={heroActive}
              onDebugAction={handleSceneDebug}
              onScreenAspectAction={(aspect) => {
                if (!screenAspectReady) {
                  setScreenAspect(aspect);
                  setScreenAspectReady(true);
                  setScreenAspectReadyAt(Date.now());
                  screenAspectRef.current = aspect;
                  pendingAspectRef.current = null;
                  return;
                }
                const diff = Math.abs(aspect - screenAspectRef.current);
                if (diff < 0.03) {
                  return;
                }
                pendingAspectRef.current = aspect;
                if (interactionActiveRef.current) {
                  return;
                }
                if (screenAspectTimerRef.current) {
                  window.clearTimeout(screenAspectTimerRef.current);
                }
                screenAspectTimerRef.current = window.setTimeout(() => {
                  if (pendingAspectRef.current === null) {
                    return;
                  }
                  const nextAspect = pendingAspectRef.current;
                  pendingAspectRef.current = null;
                  setScreenAspect(nextAspect);
                  if (!screenAspectReady) {
                    setScreenAspectReady(true);
                    setScreenAspectReadyAt(Date.now());
                  }
                }, 140);
              }}
              onReadyAction={handleSceneReady}
            />
            <div className="hero-overlay">
              <div className="hero-title">
                <span className="hero-tag">~&gt;</span>
                <div>
                  <h1 className="hero-name">{profile.fullName}</h1>
                  <p className="hero-role">
                    {profile.roles[language].join(" · ")}
                  </p>
                </div>
              </div>
              <p className="hero-hint">{t.hero.hint}</p>
              <p className="hero-hint">{t.hero.keysHint}</p>
            </div>
          </div>
          {showVirtualKeys ? (
            <div className="hero-mobile-keys" aria-hidden="true">
              <button
                type="button"
                className="hero-key-button hero-key-focus"
                aria-label="Terminal input"
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleTerminalInputFocus();
                }}>
                ⌨
              </button>
              <button
                type="button"
                className="hero-key-button hero-key-tab"
                aria-label="Tab"
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleVirtualKey("Tab", { focus: true });
                }}>
                Tab
              </button>
              <button
                type="button"
                className="hero-key-button hero-key-up"
                aria-label="Arrow up"
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleVirtualKey("ArrowUp", { focus: false });
                }}>
                ▲
              </button>
              <button
                type="button"
                className="hero-key-button hero-key-left"
                aria-label="Arrow left"
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleVirtualKey("ArrowLeft", { focus: false });
                }}>
                ◀
              </button>
              <button
                type="button"
                className="hero-key-button hero-key-right"
                aria-label="Arrow right"
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleVirtualKey("ArrowRight", { focus: false });
                }}>
                ▶
              </button>
              <button
                type="button"
                className="hero-key-button hero-key-down"
                aria-label="Arrow down"
                onPointerDown={(event) => {
                  event.preventDefault();
                  handleVirtualKey("ArrowDown", { focus: false });
                }}>
                ▼
              </button>
              <button
                type="button"
                className={`hero-key-button hero-key-mod hero-key-ctrl${
                  mobileModifiers.ctrl ? " is-active" : ""
                }`}
                aria-label="Ctrl modifier"
                aria-pressed={mobileModifiers.ctrl}
                onPointerDown={(event) => {
                  event.preventDefault();
                  toggleMobileModifier("ctrl");
                }}>
                Ctrl
              </button>
              <button
                type="button"
                className={`hero-key-button hero-key-mod hero-key-shift${
                  mobileModifiers.shift ? " is-active" : ""
                }`}
                aria-label="Shift modifier"
                aria-pressed={mobileModifiers.shift}
                onPointerDown={(event) => {
                  event.preventDefault();
                  toggleMobileModifier("shift");
                }}>
                ⇧
              </button>
              <button
                type="button"
                className={`hero-key-button hero-key-mod hero-key-alt${
                  mobileModifiers.alt ? " is-active" : ""
                }`}
                aria-label="Alt modifier"
                aria-pressed={mobileModifiers.alt}
                onPointerDown={(event) => {
                  event.preventDefault();
                  toggleMobileModifier("alt");
                }}>
                Alt
              </button>
            </div>
          ) : null}
          <div
            className={`hero-scroll-shield${heroActive ? " is-active" : ""}`}
            aria-hidden="true"
          />
          <TerminalCanvas
            files={files}
            introLines={profile.introLines[language]}
            prompt={profile.terminal.prompt}
            language={language}
            messages={t.terminal}
            theme={theme}
            isMobile={isMobile}
            isActive={heroActive}
            screenAspect={screenAspect}
            scrollProgressRef={scrollProgressRef}
            onNavigateAction={scrollToSection}
            onReadyAction={(api) => {
              setTerminalApi(api);
            }}
            onBootReadyAction={() => {
              setTerminalBootReady(true);
              setTerminalBootReadyAt(Date.now());
            }}
            onFocusChangeAction={(focused) => setTerminalFocused(focused)}
          />
        </section>

        <motion.section
          id="intro"
          className="section section-intro"
          initial={reducedMotion ? false : { opacity: 0, y: 32 }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6, ease: "easeOut" }}>
          <div className="section-inner intro-grid">
            <div>
              <span className="section-eyebrow">
                {t.sections.intro.eyebrow}
              </span>
              <h2 className="section-title">{t.sections.intro.title}</h2>
              <p className="section-subtitle">{t.sections.intro.subtitle}</p>
              <div className="intro-actions">
                <button
                  className="button primary"
                  type="button"
                  onClick={() => scrollToSection("projects")}>
                  {t.sections.intro.primaryCta}
                </button>
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => scrollToSection("contact")}>
                  {t.sections.intro.secondaryCta}
                </button>
              </div>
            </div>
            <div className="intro-card">
              <span className="intro-label">{profile.location[language]}</span>
              <h3>{profile.fullName}</h3>
              <p>{profile.roles[language].join(" · ")}</p>
              <div className="intro-tags">
                {profile.socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer">
                    {social.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        <section id="featured" className="section section-featured">
          <div className="section-inner featured-layout">
            <div className="featured-copy">
              <span className="section-eyebrow">
                {t.sections.featured.eyebrow}
              </span>
              <h2 ref={featuredHeadingRef} className="section-title">
                {t.sections.featured.title}
              </h2>
              <p ref={featuredSubtitleRef} className="section-subtitle">
                {t.sections.featured.subtitle}
              </p>
              {!isMobile && activeFeaturedProject ? (
                <div className="featured-status" aria-live="polite">
                  <div className="featured-status-row">
                    <span className="featured-count">
                      {String(safeActiveFeatured + 1).padStart(2, "0")} /{" "}
                      {String(featuredProjects.length).padStart(2, "0")}
                    </span>
                    <span className="featured-current">
                      {activeFeaturedProject.title}
                    </span>
                  </div>
                  <div
                    className="featured-progress"
                    ref={featuredProgressRef}
                    role="progressbar"
                    aria-label={t.sections.featured.title}
                    aria-valuemin={0}
                    aria-valuemax={featuredProjects.length}
                    aria-valuenow={safeActiveFeatured + 1}>
                    <span />
                  </div>
                </div>
              ) : null}
            </div>
            <div className="featured-viewer">
              {featuredCount > 0 ? (
                <div className="featured-slider">
                  <style>{featuredSliderCss}</style>
                  {featuredProjects.map((project, index) => (
                    <input
                      key={`${project.title}-input`}
                      className="featured-radio"
                      type="radio"
                      name="featured-slider"
                      id={`featured-slide-${index + 1}`}
                      checked={safeActiveFeatured === index}
                      onChange={() => {
                        registerFeaturedInteraction();
                        setFeaturedIndex(index);
                      }}
                      aria-label={`${t.sections.featured.title} ${index + 1}`}
                    />
                  ))}
                  <div className="featured-track">
                    {featuredProjects.map((project, index) => (
                      <article
                        key={project.title}
                        className={`featured-item featured-item--${index + 1}`}>
                        <FeaturedCard
                          project={project}
                          labels={{
                            repo: t.projects.repo,
                            live: t.projects.live,
                          }}
                        />
                      </article>
                    ))}
                    {featuredProjects[activeFeatured - 1] ? (
                      <button
                        type="button"
                        className="featured-hit featured-hit-prev"
                        aria-label={`${t.sections.featured.title} ${
                          activeFeatured
                        }/${featuredCount}`}
                        onClick={() => {
                          registerFeaturedInteraction();
                          shiftFeaturedIndex(-1);
                        }}
                      />
                    ) : null}
                    {featuredProjects[activeFeatured + 1] ? (
                      <button
                        type="button"
                        className="featured-hit featured-hit-next"
                        aria-label={`${t.sections.featured.title} ${
                          activeFeatured + 2
                        }/${featuredCount}`}
                        onClick={() => {
                          registerFeaturedInteraction();
                          shiftFeaturedIndex(1);
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="featured-controls">
                    <button
                      type="button"
                      className="featured-arrow featured-arrow-prev"
                      aria-label={`${t.sections.featured.title} ${
                        safeActiveFeatured + 1
                      }/${featuredCount}`}
                      onClick={() => {
                        registerFeaturedInteraction();
                        shiftFeaturedIndex(-1);
                      }}
                      disabled={safeActiveFeatured <= 0}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M15 5l-7 7 7 7"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <div className="featured-dots" role="group">
                      {featuredProjects.map((project, index) => (
                        <label
                          key={`${project.title}-dot`}
                          className={`featured-dot featured-dot--${index + 1}`}
                          htmlFor={`featured-slide-${index + 1}`}
                          aria-label={`${t.sections.featured.title} ${index + 1}`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      className="featured-arrow featured-arrow-next"
                      aria-label={`${t.sections.featured.title} ${
                        safeActiveFeatured + 1
                      }/${featuredCount}`}
                      onClick={() => {
                        registerFeaturedInteraction();
                        shiftFeaturedIndex(1);
                      }}
                      disabled={safeActiveFeatured >= featuredCount - 1}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M9 5l7 7-7 7"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                  <p className="featured-hint">{t.sections.featured.hint}</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <motion.section
          id="capabilities"
          className="section section-capabilities"
          aria-labelledby="capabilities-title"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut" }}>
          <div className="section-inner">
            <div className="section-header">
              <span className="section-eyebrow">
                {t.sections.capabilities.eyebrow}
              </span>
              <h2 className="section-title" id="capabilities-title">
                {t.sections.capabilities.title}
              </h2>
              <p className="section-subtitle">
                {t.sections.capabilities.subtitle}
              </p>
            </div>
            <motion.div
              className="capability-grid"
              initial={reducedMotion ? false : "hidden"}
              whileInView={reducedMotion ? undefined : "show"}
              viewport={{ once: true, amount: 0.2 }}
              variants={{
                hidden: { opacity: 0 },
                show: {
                  opacity: 1,
                  transition: { staggerChildren: 0.06 },
                },
              }}>
              {localizedCapabilities.map((item) => {
                const isOpen = openCapabilityId === item.id;
                const hasDetails = Boolean(item.bullets?.length);
                return (
                  <motion.article
                    key={item.id}
                    className="capability-card"
                    variants={{
                      hidden: { opacity: 0, y: 16 },
                      show: { opacity: 1, y: 0 },
                    }}
                    whileHover={
                      reducedMotion ? undefined : { y: -2, scale: 1.01 }
                    }
                    transition={{ duration: 0.35, ease: "easeOut" }}>
                    <span className="capability-icon">
                      {capabilityIcons[item.icon] ?? capabilityIcons.layers}
                    </span>
                    <div className="capability-body">
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </div>
                    {hasDetails ? (
                      <button
                        type="button"
                        className="capability-toggle"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setOpenCapabilityId(isOpen ? null : item.id)
                        }>
                        {isOpen
                          ? t.sections.capabilities.close
                          : t.sections.capabilities.details}
                      </button>
                    ) : null}
                    {hasDetails ? (
                      <motion.div
                        className="capability-details"
                        initial={false}
                        animate={
                          isOpen
                            ? { height: "auto", opacity: 1 }
                            : { height: 0, opacity: 0 }
                        }
                        transition={
                          reducedMotion
                            ? { duration: 0 }
                            : { duration: 0.25, ease: "easeOut" }
                        }>
                        <ul>
                          {item.bullets?.map((bullet) => (
                            <li key={bullet}>{bullet}</li>
                          ))}
                        </ul>
                      </motion.div>
                    ) : null}
                  </motion.article>
                );
              })}
            </motion.div>
          </div>
        </motion.section>

        <motion.section
          id="about"
          className="section section-about"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut" }}>
          <div className="section-inner">
            <div className="section-header">
              <span className="section-eyebrow">
                {t.sections.about.eyebrow}
              </span>
              <h2 className="section-title section-title-caret">
                {aboutTitle}
                <span className="typing-caret" aria-hidden="true" />
              </h2>
              <p className="section-subtitle">{t.sections.about.subtitle}</p>
            </div>
            <div className="about-content">
              <div className="about-card">
                <Markdown content={aboutParts.intro} />
                {aboutParts.rest ? (
                  <button
                    type="button"
                    className="about-toggle"
                    aria-expanded={aboutOpen}
                    onClick={() => setAboutOpen((prev) => !prev)}>
                    {aboutOpen ? t.sections.about.less : t.sections.about.more}
                  </button>
                ) : null}
                {aboutParts.rest ? (
                  <motion.div
                    className="about-more"
                    initial={false}
                    animate={
                      aboutOpen
                        ? {
                            opacity: 1,
                            maxHeight: isMobile ? 3200 : 3600,
                            marginTop: 12,
                          }
                        : { opacity: 0, maxHeight: 0, marginTop: 0 }
                    }
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : { duration: 0.28, ease: "easeOut" }
                    }>
                    <Markdown content={aboutParts.rest} />
                  </motion.div>
                ) : null}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          id="projects"
          className="section"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut" }}>
          <div className="section-inner">
            <div className="section-header">
              <span className="section-eyebrow">
                {t.sections.projects.eyebrow}
              </span>
              <h2 className="section-title">{t.projects.latestTitle}</h2>
              <p className="section-subtitle">{t.projects.latestSubtitle}</p>
            </div>
            <div className="project-grid">
              {latestProjects.map((project) => (
                <ProjectCard
                  key={project.title}
                  project={project}
                  labels={{
                    more: t.projects.more,
                    less: t.projects.less,
                    repo: t.projects.repo,
                    live: t.projects.live,
                  }}
                  reducedMotion={Boolean(reducedMotion)}
                  isOpen={openProjectId === project.title}
                  onToggle={(nextOpen) =>
                    setOpenProjectId(nextOpen ? project.title : null)
                  }
                />
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          id="contact"
          className="section"
          initial={reducedMotion ? false : { opacity: 0, y: 24 }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: "easeOut" }}>
          <div className="section-inner">
            <div className="section-header">
              <span className="section-eyebrow">
                {t.sections.contact.eyebrow}
              </span>
              <h2 className="section-title">{t.sections.contact.title}</h2>
              <p className="section-subtitle">{t.sections.contact.subtitle}</p>
            </div>
            <div className="contact-grid">
              <div className="contact-card">
                <Markdown content={contactContent} />
              </div>
              <div className="contact-form">
                <ContactForm labels={t.contact.form} />
              </div>
            </div>
          </div>
        </motion.section>

        <footer className="site-footer">
          <div className="footer-inner">
            <div>
              <p className="footer-name">{profile.fullName}</p>
              <p className="footer-role">{profile.jobTitle[language]}</p>
              <p className="footer-copy">
                © 2026 {profile.fullName}.{" "}
                {language === "tr"
                  ? "Tum haklari saklidir."
                  : "All rights reserved."}
              </p>
            </div>
            <div className="footer-links">
              {profile.socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer">
                  {social.label}
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}

function ProjectCard({
  project,
  labels,
  reducedMotion,
  isOpen,
  onToggle,
}: {
  project: LocalizedProject;
  labels: {
    more: string;
    less: string;
    repo: string;
    live: string;
  };
  reducedMotion: boolean;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}) {
  const projectId = `project-${slugify(project.title)}`;
  const detailsId = `${projectId}-details`;
  const maxTags = 4;
  const visibleTags = project.tags.slice(0, maxTags);
  const extraTags = project.tags.length - visibleTags.length;
  const isExpandable = Boolean(project.detailsMd);
  const { visibleText, visibleCount, phase } = useTypewriterText(
    project.detailsMd ?? "",
    isOpen,
    {
      reduceMotion: reducedMotion,
    },
  );
  const showDetails =
    Boolean(project.detailsMd) && (isOpen || visibleCount > 0);
  const handleCardToggle = (event: React.MouseEvent<HTMLElement>) => {
    if (!isExpandable) {
      return;
    }
    if ((event.target as HTMLElement).closest("a, button")) {
      return;
    }
    onToggle(!isOpen);
  };
  const handleKeyToggle = (event: React.KeyboardEvent<HTMLElement>) => {
    if (!isExpandable) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(!isOpen);
    }
  };

  return (
    <motion.article
      id={projectId}
      className={`project-card ${isExpandable ? "is-clickable" : ""}`}
      role={isExpandable ? "button" : undefined}
      tabIndex={isExpandable ? 0 : undefined}
      aria-expanded={isExpandable ? isOpen : undefined}
      aria-controls={isExpandable ? detailsId : undefined}
      onClick={handleCardToggle}
      onKeyDown={handleKeyToggle}
      whileHover={reducedMotion ? undefined : { y: -4 }}
      transition={{ duration: 0.3 }}>
      <div className="project-header">
        <span className="project-year">{project.year}</span>
        <h3>{project.title}</h3>
      </div>
      <p className="project-summary">{project.summary}</p>
      <div className="project-tags">
        {visibleTags.map((tag) => (
          <span key={tag} className="project-tag">
            {tag}
          </span>
        ))}
        {extraTags > 0 ? (
          <span className="project-tag project-tag-more">+{extraTags}</span>
        ) : null}
      </div>
      {project.detailsMd ? (
        <button
          className="project-toggle"
          type="button"
          aria-expanded={isOpen}
          aria-controls={detailsId}
          onClick={() => onToggle(!isOpen)}>
          {isOpen ? labels.less : labels.more}
        </button>
      ) : null}
      {project.detailsMd ? (
        <motion.div
          id={detailsId}
          className="project-details"
          initial={false}
          animate={
            showDetails
              ? { height: "auto", opacity: 1, marginTop: 8 }
              : { height: 0, opacity: 0, marginTop: 0 }
          }
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.25, ease: "easeOut" }
          }>
          <div className="project-details-inner">
            <Markdown
              content={visibleText}
              caret={showDetails}
              caretClassName={`project-typing-caret ${phase}`}
            />
          </div>
        </motion.div>
      ) : null}
      <div className="project-links">
        {project.links.repo ? (
          <a href={project.links.repo} target="_blank" rel="noreferrer">
            {labels.repo}
          </a>
        ) : null}
        {project.links.live ? (
          <a href={project.links.live} target="_blank" rel="noreferrer">
            {labels.live}
          </a>
        ) : null}
      </div>
    </motion.article>
  );
}
