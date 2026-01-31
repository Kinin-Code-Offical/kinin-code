"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export default function LoadingBar() {
  const pathname = usePathname();
  return <LoadingBarInner key={pathname} />;
}

function LoadingBarInner() {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const doneRef = useRef<number | null>(null);
  const barRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setProgress((prev) => (prev < 82 ? prev + Math.random() * 8 : prev));
    }, 150);

    doneRef.current = window.setTimeout(() => {
      setProgress(100);
      window.setTimeout(() => setVisible(false), 480);
    }, 1200);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      if (doneRef.current) {
        window.clearTimeout(doneRef.current);
      }
    };
  }, []);

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
