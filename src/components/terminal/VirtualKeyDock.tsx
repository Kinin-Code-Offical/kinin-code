"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { localize, type VirtualKey, type VirtualLayout } from "./virtualKeys";

type VirtualKeyDockProps = {
  layout: VirtualLayout;
  language: "tr" | "en";
  /** Focuses the terminal input so the phone keyboard opens (⌨ key). */
  onOpenKeyboardAction: () => void;
};

const REPEAT_DELAY_MS = 380;
const REPEAT_INTERVAL_MS = 70;

type HeldKey = { key: VirtualKey; timer: number | null };

// Synthetic events: the terminal treats them like a physical keyboard but
// never focuses its hidden input for them (that would open the phone keyboard).
function send(type: "keydown" | "keyup", key: VirtualKey) {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      key: key.key,
      code: key.code ?? "",
      ctrlKey: Boolean(key.ctrlKey),
      bubbles: true,
      cancelable: true,
    }),
  );
}

function releaseHeld(held: HeldKey) {
  if (held.timer !== null) {
    window.clearTimeout(held.timer);
    held.timer = null;
  }
  if (held.key.hold) {
    send("keyup", held.key);
  }
}

/**
 * Bottom key dock shown on touch screens while a terminal app runs. Each
 * finger is tracked by pointer id, so e.g. HELLRUN can walk and fire at once.
 */
export default function VirtualKeyDock({
  layout,
  language,
  onOpenKeyboardAction,
}: VirtualKeyDockProps) {
  const heldRef = useRef(new Map<number, HeldKey>());

  // Switching apps (or hiding the dock) must not leave a key held down.
  useEffect(() => {
    const held = heldRef.current;
    return () => {
      held.forEach(releaseHeld);
      held.clear();
    };
  }, [layout]);

  const press = (event: PointerEvent<HTMLButtonElement>, key: VirtualKey) => {
    event.preventDefault();
    if (key.keyboard) {
      onOpenKeyboardAction();
      return;
    }
    const previous = heldRef.current.get(event.pointerId);
    if (previous) {
      releaseHeld(previous);
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a nicety: release still arrives via pointerup/cancel.
    }
    const held: HeldKey = { key, timer: null };
    send("keydown", key);
    if (!key.hold) {
      send("keyup", key);
    }
    if (key.repeat) {
      const tick = () => {
        send("keydown", key);
        send("keyup", key);
        held.timer = window.setTimeout(tick, REPEAT_INTERVAL_MS);
      };
      held.timer = window.setTimeout(tick, REPEAT_DELAY_MS);
    }
    heldRef.current.set(event.pointerId, held);
  };

  const release = (event: PointerEvent<HTMLButtonElement>) => {
    const held = heldRef.current.get(event.pointerId);
    if (!held) {
      return;
    }
    heldRef.current.delete(event.pointerId);
    releaseHeld(held);
  };

  const renderKey = (key: VirtualKey, inGrid: boolean) => (
    <button
      key={key.area}
      type="button"
      className={`vkey${inGrid ? "" : " vkey--bar"}${key.main ? " vkey--main" : ""}${key.small ? " vkey--small" : ""}`}
      style={inGrid ? { gridArea: key.area } : undefined}
      aria-label={localize(key.aria, language)}
      onPointerDown={(event) => press(event, key)}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}>
      {localize(key.label, language)}
    </button>
  );

  const title = localize(layout.title, language);

  return (
    <>
      {/* Top bar: lives in the empty space above the monitor. */}
      <div className="vkey-bar" role="group" aria-label={title}>
        {/* A crowded bar (HELLRUN's weapons) drops the title to fit. */}
        <span className="vkey-bar__title">
          {(layout.bar?.length ?? 0) >= 4 ? "" : title}
        </span>
        {layout.bar?.map((key) => renderKey(key, false))}
        {renderKey(layout.exit, false)}
      </div>
      {/* Bottom dock: the app's controls, kept below the terminal screen. */}
      <div
        className="vkey-dock"
        role="group"
        aria-label={title}
        style={{
          maxWidth: layout.maxWidth,
          gridTemplateColumns: layout.columns,
          gridTemplateAreas: layout.areas.map((row) => `"${row}"`).join(" "),
          gridAutoRows: `${layout.rowHeight}px`,
        }}>
        {layout.keys.map((key) => renderKey(key, true))}
      </div>
    </>
  );
}
