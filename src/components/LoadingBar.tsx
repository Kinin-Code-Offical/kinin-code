"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

type LoadingBarSnapshot = {
  progress: number;
  visible: boolean;
};

function createLoadingBarStore() {
  let progress = 0;
  let visible = true;
  let start = 0;
  let ready = false;
  let hideTimer: number | null = null;
  let rafId: number | null = null;
  let cleanup: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    listeners.forEach((listener) => listener());
  };

  const markReady = () => {
    if (!ready) {
      ready = true;
      notify();
    }
  };

  const startLoop = () => {
    progress = 0;
    visible = true;
    ready = false;
    start = performance.now();

    if (typeof document !== "undefined") {
      if (document.readyState === "complete") {
        markReady();
      } else {
        window.addEventListener("load", markReady, { once: true });
      }
      if (document.fonts?.ready) {
        void document.fonts.ready.then(markReady).catch(() => undefined);
      }
    }

    const minVisibleMs = 350;
    const tick = (now: number) => {
      const elapsed = now - start;
      const ramp = Math.min(1, elapsed / 2200);
      const target = ready ? 100 : 10 + ramp * 80;
      const speed = ready ? 0.28 : 0.08;
      const next = progress + (target - progress) * speed;
      progress = Math.min(100, Math.max(progress, next));
      notify();

      if (ready && elapsed > minVisibleMs && progress >= 99) {
        if (!hideTimer) {
          hideTimer = window.setTimeout(() => {
            visible = false;
            notify();
          }, 180);
        }
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (hideTimer) {
        window.clearTimeout(hideTimer);
        hideTimer = null;
      }
      window.removeEventListener("load", markReady);
    };
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (listeners.size === 1) {
      cleanup = startLoop();
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && cleanup) {
        cleanup();
        cleanup = null;
      }
    };
  };

  const getSnapshot = (): LoadingBarSnapshot => ({ progress, visible });

  return { subscribe, getSnapshot };
}

const loadingBarStore = createLoadingBarStore();

export default function LoadingBar() {
  const { progress, visible } = useSyncExternalStore(
    loadingBarStore.subscribe,
    loadingBarStore.getSnapshot,
    loadingBarStore.getSnapshot,
  );
  const barRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!barRef.current) {
      return;
    }
    barRef.current.style.transform = `scaleX(${progress / 100})`;
  }, [progress]);

  return (
    <div className={`loading-bar ${visible ? "is-visible" : ""}`}>
      <span ref={barRef} />
    </div>
  );
}
