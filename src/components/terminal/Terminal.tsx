"use client";

import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { CanvasTexture } from "three";
import { useTerminalEngine, TerminalEngine } from "./TerminalEngine";
import type { TerminalConfig } from "./types";
import { useGameLoop } from "../shared/useGameLoop";

export type TerminalRef = {
  handleInput: (key: string) => void;
  focusInput: () => void;
};

type TerminalProps = {
  config: TerminalConfig;
  theme: {
    palette: {
      terminalBg: string;
      terminalText: string;
      terminalDim: string;
    };
  };
  onTextureReady?: (texture: CanvasTexture) => void;
  active: boolean;
  focused?: boolean;
  onFocusChange?: (focused: boolean) => void;
  // Legacy props compatibility
  width?: number;
  height?: number;
};

type ScreenProps = {
  textureRef: React.MutableRefObject<CanvasTexture | null>;
  engine: TerminalEngine;
  theme: TerminalProps["theme"];
  onTextureUpdateAction?: () => void;
  active: boolean;
};

function Screen({
  textureRef,
  engine,
  theme,
  onTextureUpdateAction,
  active,
}: ScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render Loop
  useGameLoop((dt) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { width, height } = canvas;

    const { palette } = theme;

    // If a game is active, let it render
    if (engine.mode === "game" && engine.activeProgram) {
      // Clear only if needed, or let game handle it?
      // Optim: Game usually clears full screen.
      engine.activeProgram.tick(dt);

      ctx.fillStyle = palette.terminalBg;
      ctx.fillRect(0, 0, width, height);

      engine.activeProgram.render(ctx, width, height, {
        bg: palette.terminalBg,
        text: palette.terminalText,
        dim: palette.terminalDim,
        accent: palette.terminalText,
      });
    } else {
      // Shell Mode Render
      // Only re-render if dirty? For now, render every frame to support cursor blink etc.
      ctx.fillStyle = palette.terminalBg;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = palette.terminalText;
      ctx.font = '24px "JetBrains Mono"';
      ctx.textBaseline = "top";

      // Render lines
      const lineHeight = 36;
      const pad = 32;
      // Simple scroll logic: show last N lines
      const maxLines = Math.floor((height - pad * 2) / lineHeight);
      const startLine = Math.max(0, engine.lines.length - maxLines);
      const visibleLines = engine.lines.slice(startLine);

      visibleLines.forEach((line, i) => {
        ctx.fillText(line, pad, pad + i * lineHeight);
      });

      // Cursor (Blink?)
      if (Math.floor(performance.now() / 500) % 2 === 0) {
        const cursorY = pad + visibleLines.length * lineHeight;
        const cursorX = pad; // Simplified, assuming cursor is at start of new line
        ctx.fillStyle = palette.terminalText;
        ctx.fillRect(cursorX, cursorY, 14, 28);
      }
    }

    // Mark texture as updated
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
      onTextureUpdateAction?.();
    }
  }, active);

  // Init texture once
  useEffect(() => {
    if (canvasRef.current && !textureRef.current) {
      textureRef.current = new CanvasTexture(canvasRef.current);
      onTextureUpdateAction?.();
    }
  }, [textureRef, onTextureUpdateAction]);

  return (
    <canvas
      ref={canvasRef}
      width={1024}
      height={600}
      className="hidden" // Hidden, used for texture only
    />
  );
}

export const Terminal = forwardRef<TerminalRef, TerminalProps>(
  ({ config, theme, onTextureReady, active, focused, onFocusChange }, ref) => {
    const { engine } = useTerminalEngine(config);
    const textureRef = useRef<CanvasTexture | null>(null);

    useImperativeHandle(ref, () => ({
      handleInput: (key: string) => {
        engine.handleInput(key);
      },
      focusInput: () => {
        onFocusChange?.(true);
      },
    }));

    const handleTextureUpdate = useCallback(() => {
      if (textureRef.current && onTextureReady) {
        onTextureReady(textureRef.current);
      }
    }, [onTextureReady]);

    // Handle Input
    useEffect(() => {
      if (!active || !focused) return;

      const handleKey = (e: KeyboardEvent) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        if (
          e.key.length === 1 ||
          e.key === "Backspace" ||
          e.key === "Enter" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowDown" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "Tab" ||
          e.key === "Escape"
        ) {
          if (e.key === "Tab") e.preventDefault();

          // Prevent scrolling for game keys
          if (
            engine.mode === "game" &&
            [
              "ArrowUp",
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
              "Space",
            ].includes(e.key)
          ) {
            e.preventDefault();
          }

          engine.handleInput(e.key);
        }
      };

      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }, [active, focused, engine]);

    return (
      <div className="terminal-hidden-layer">
        <Screen
          textureRef={textureRef}
          engine={engine}
          theme={theme}
          active={active}
          onTextureUpdateAction={handleTextureUpdate}
        />
      </div>
    );
  },
);

Terminal.displayName = "Terminal";
