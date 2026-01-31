"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import type { Language } from "@/lib/i18n";

export type TerminalApi = {
  focus: () => void;
  focusInput: () => void;
  blur: () => void;
  isFocused: () => boolean;
  texture: CanvasTexture;
};

export type TerminalDebugInfo = {
  canvasSize: number;
  lastDrawMs: number;
  textureNeedsUpdate: boolean;
  terminalFocus: boolean;
  lastCommand: string | null;
  lastOutputLines: string[];
};

type TerminalFile = {
  path: string;
  content: string;
  section?: string;
};

type Theme = {
  palette: {
    terminalBg: string;
    terminalText: string;
    terminalDim: string;
  };
  crt: {
    scanlineOpacity: number;
    noiseOpacity: number;
    glow: number;
    curvature: number;
  };
};

type TerminalCanvasProps = {
  files: TerminalFile[];
  introLines: readonly string[];
  prompt: string;
  language: Language;
  messages: {
    welcome: string;
    hint: string;
    help: readonly string[];
    availableFiles: string;
    tip: string;
    commandNotFound: string;
    fileNotFound: string;
    noSuchDirectory: string;
    mkdirMissing: string;
    touchMissing: string;
    hello: string;
  };
  theme: Theme;
  isMobile: boolean;
  screenAspect?: number;
  fontScale?: number;
  onNavigateAction: (section: string) => void;
  onReadyAction: (api: TerminalApi) => void;
  onBootReadyAction?: () => void;
  onFocusChangeAction: (focused: boolean) => void;
  onDebugAction?: (info: TerminalDebugInfo) => void;
};

type Line = {
  text: string;
  color?: string;
};

type FsNode =
  | { type: "dir"; children: Record<string, FsNode> }
  | { type: "file"; content: string; section?: string };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizePath = (path: string) => {
  const cleaned = path.trim();
  if (!cleaned) {
    return "/";
  }
  if (!cleaned.startsWith("/")) {
    return `/${cleaned}`;
  }
  return cleaned;
};

const resolvePath = (cwd: string, input: string) => {
  const value = input.trim();
  if (!value || value === ".") {
    return cwd;
  }
  if (value === "~") {
    return "/";
  }
  if (value.startsWith("/")) {
    return normalizePath(value);
  }
  if (value === "..") {
    const parts = cwd.split("/").filter((part) => part.length > 0);
    parts.pop();
    return parts.length ? `/${parts.join("/")}` : "/";
  }
  const parts = [
    ...cwd.split("/").filter((part) => part.length > 0),
    ...value.split("/"),
  ];
  const cleaned = parts.filter((part) => part.length > 0);
  return cleaned.length ? `/${cleaned.join("/")}` : "/";
};

const buildFileTree = (files: TerminalFile[]) => {
  const root: FsNode = { type: "dir", children: {} };
  for (const file of files) {
    const parts = file.path.split("/").filter((part) => part.length > 0);
    let node = root;
    parts.forEach((part, index) => {
      if (node.type !== "dir") {
        return;
      }
      if (index === parts.length - 1) {
        node.children[part] = {
          type: "file",
          content: file.content,
          section: file.section,
        };
        return;
      }
      if (!node.children[part] || node.children[part].type !== "dir") {
        node.children[part] = { type: "dir", children: {} };
      }
      node = node.children[part] as {
        type: "dir";
        children: Record<string, FsNode>;
      };
    });
  }
  return root;
};

const findNode = (root: FsNode, path: string) => {
  const parts = path.split("/").filter((part) => part.length > 0);
  let node: FsNode = root;
  for (const part of parts) {
    if (node.type !== "dir") {
      return null;
    }
    const next = node.children[part];
    if (!next) {
      return null;
    }
    node = next;
  }
  return node;
};

const markdownToLines = (text: string): Line[] => {
  const rawLines = text.split("\n");
  const lines: Line[] = [];
  rawLines.forEach((raw) => {
    const trimmed = raw.trimEnd();
    if (!trimmed) {
      lines.push({ text: "" });
      return;
    }
    if (trimmed.startsWith("#")) {
      const clean = trimmed
        .replace(/^#+\s*/, "")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
      lines.push({ text: clean.toUpperCase() });
      return;
    }
    if (trimmed.startsWith("-")) {
      const clean = trimmed
        .replace(/^-+\s*/, "")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
      lines.push({ text: `• ${clean}` });
      return;
    }
    lines.push({
      text: trimmed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)"),
    });
  });
  return lines;
};

const isWordChar = (char: string) => /[A-Za-z0-9_./-]/.test(char);

const findPrevWord = (text: string, index: number) => {
  let i = index;
  while (i > 0 && !isWordChar(text[i - 1])) {
    i -= 1;
  }
  while (i > 0 && isWordChar(text[i - 1])) {
    i -= 1;
  }
  return i;
};

const findNextWord = (text: string, index: number) => {
  let i = index;
  while (i < text.length && !isWordChar(text[i])) {
    i += 1;
  }
  while (i < text.length && isWordChar(text[i])) {
    i += 1;
  }
  return i;
};

export default function TerminalCanvas({
  files,
  introLines,
  prompt,
  language,
  messages,
  theme,
  isMobile,
  screenAspect,
  fontScale,
  onNavigateAction,
  onReadyAction,
  onBootReadyAction,
  onFocusChangeAction,
  onDebugAction,
}: TerminalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const textureRef = useRef<CanvasTexture | null>(null);
  const linesRef = useRef<Line[]>([]);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const inputValueRef = useRef("");
  const scrollOffsetRef = useRef(0);
  const lastDrawRef = useRef(0);
  const focusedRef = useRef(false);
  const lastCommandRef = useRef<string | null>(null);
  const textureUpdateRef = useRef(false);
  const selectionRef = useRef({ start: 0, end: 0 });
  const selectionAnchorRef = useRef<number | null>(null);
  const bootReadyRef = useRef(false);
  const bootReadyCallbackRef = useRef<typeof onBootReadyAction>(undefined);
  const fsRef = useRef<FsNode>(buildFileTree(files));
  const cwdRef = useRef("/");
  const lastCanvasSizeRef = useRef({ width: 0, height: 0 });
  const dirtyRef = useRef(true);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const freezeTextureRef = useRef(false);
  const frozenSnapshotRef = useRef<HTMLCanvasElement | null>(null);
  const pendingFreezeRef = useRef(false);
  const freezeTimeoutRef = useRef<number | null>(null);

  const baseSize = useMemo(() => 640, []);
  const isFirefox = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }
    return /firefox/i.test(navigator.userAgent);
  }, []);
  const canvasSize = useMemo(() => {
    const aspect = clamp(screenAspect ?? 1.33, 0.6, 1.8);
    let width = baseSize;
    let height = baseSize;
    if (aspect >= 1) {
      width = Math.round(baseSize * aspect);
    } else {
      height = Math.round(baseSize / aspect);
    }
    const maxSize = isFirefox ? 640 : isMobile ? 900 : 1400;
    const scale = Math.min(1, maxSize / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }, [baseSize, isFirefox, isMobile, screenAspect]);

  useEffect(() => {
    fsRef.current = buildFileTree(files);
    cwdRef.current = "/";
  }, [files]);

  const focusInput = useCallback(
    (ensureVisible: boolean) => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      try {
        input.focus({ preventScroll: true });
      } catch {
        input.focus();
      }
      if (ensureVisible && isMobile) {
        input.scrollIntoView({ block: "center", inline: "nearest" });
      }
    },
    [isMobile],
  );

  const setSelectionRange = useCallback((start: number, end: number) => {
    const input = inputRef.current;
    selectionRef.current = { start, end };
    if (!input) {
      return;
    }
    input.setSelectionRange(start, end);
  }, []);

  const syncInputValue = useCallback(
    (next: string, selection?: { start: number; end: number }) => {
      inputValueRef.current = next;
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.value = next;
      if (selection) {
        setSelectionRange(selection.start, selection.end);
      } else {
        const end = next.length;
        setSelectionRange(end, end);
      }
    },
    [setSelectionRange],
  );

  const syncSelection = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    selectionRef.current = { start, end };
    dirtyRef.current = true;
  }, []);

  const [terminalApi] = useState<TerminalApi>(() => ({
    focus: () => {
      if (!focusedRef.current) {
        focusedRef.current = true;
        onFocusChangeAction(true);
      }
      focusInput(true);
    },
    focusInput: () => {
      if (!focusedRef.current) {
        focusedRef.current = true;
        onFocusChangeAction(true);
      }
      focusInput(true);
    },
    blur: () => {
      if (focusedRef.current) {
        focusedRef.current = false;
        onFocusChangeAction(false);
      }
      inputRef.current?.blur();
    },
    isFocused: () => focusedRef.current,
    get texture() {
      return textureRef.current as CanvasTexture;
    },
  }));

  useEffect(() => {
    bootReadyCallbackRef.current = onBootReadyAction;
  }, [onBootReadyAction]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const sizeUnchanged =
      lastCanvasSizeRef.current.width === canvasSize.width &&
      lastCanvasSizeRef.current.height === canvasSize.height;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;

    const buildTexture = () => {
      const texture = new CanvasTexture(canvas);
      texture.flipY = false;
      texture.colorSpace = SRGBColorSpace;
      texture.generateMipmaps = false;
      texture.minFilter = LinearFilter;
      texture.magFilter = LinearFilter;
      return texture;
    };

    if (!textureRef.current) {
      textureRef.current = buildTexture();
      lastCanvasSizeRef.current = {
        width: canvasSize.width,
        height: canvasSize.height,
      };
      onReadyAction(terminalApi);
      setReady(true);
      dirtyRef.current = true;
      return;
    }
    if (sizeUnchanged) {
      dirtyRef.current = true;
      return;
    }
    textureRef.current.dispose();
    textureRef.current = buildTexture();
    lastCanvasSizeRef.current = {
      width: canvasSize.width,
      height: canvasSize.height,
    };
    dirtyRef.current = true;
  }, [canvasSize.height, canvasSize.width, onReadyAction, terminalApi]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    terminalApi.focus();
  }, [ready, terminalApi]);

  useEffect(() => {
    const handleInteraction = (event: Event) => {
      const { detail } = event as CustomEvent<{ active?: boolean }>;
      if (!detail) {
        return;
      }
      const scheduleRelease = () => {
        if (freezeTimeoutRef.current) {
          window.clearTimeout(freezeTimeoutRef.current);
        }
        freezeTimeoutRef.current = window.setTimeout(() => {
          if (freezeTextureRef.current || pendingFreezeRef.current) {
            freezeTextureRef.current = false;
            pendingFreezeRef.current = false;
            dirtyRef.current = true;
          }
        }, 420);
      };
      if (detail.active) {
        scheduleRelease();
        if (!freezeTextureRef.current) {
          const snapshot = frozenSnapshotRef.current;
          if (snapshot && snapshot.width > 0 && snapshot.height > 0) {
            freezeTextureRef.current = true;
          } else {
            pendingFreezeRef.current = true;
          }
          dirtyRef.current = true;
        }
      } else if (freezeTextureRef.current) {
        if (freezeTimeoutRef.current) {
          window.clearTimeout(freezeTimeoutRef.current);
          freezeTimeoutRef.current = null;
        }
        freezeTextureRef.current = false;
        pendingFreezeRef.current = false;
        dirtyRef.current = true;
      } else if (pendingFreezeRef.current) {
        if (freezeTimeoutRef.current) {
          window.clearTimeout(freezeTimeoutRef.current);
          freezeTimeoutRef.current = null;
        }
        pendingFreezeRef.current = false;
        dirtyRef.current = true;
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
      if (freezeTimeoutRef.current) {
        window.clearTimeout(freezeTimeoutRef.current);
        freezeTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (freezeTextureRef.current) {
        return;
      }
      setCursorVisible((prev) => !prev);
      dirtyRef.current = true;
    }, 520);
    return () => window.clearInterval(timer);
  }, []);

  const appendLine = useCallback((text: string, color?: string) => {
    linesRef.current.push({ text, color });
    dirtyRef.current = true;
  }, []);

  const appendLines = useCallback(
    (texts: readonly string[], color?: string) => {
      texts.forEach((text) => appendLine(text, color));
    },
    [appendLine],
  );

  const formatMessage = useCallback(
    (template: string, vars: Record<string, string>) => {
      return Object.entries(vars).reduce(
        (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
        template,
      );
    },
    [],
  );

  const resetTerminal = useCallback(() => {
    linesRef.current = [];
    historyRef.current = [];
    historyIndexRef.current = -1;
    syncInputValue("", { start: 0, end: 0 });
    scrollOffsetRef.current = 0;
    lastCommandRef.current = null;
    dirtyRef.current = true;
  }, [syncInputValue]);

  const profileName = useCallback(() => {
    return prompt.split("@")[0] || "user";
  }, [prompt]);

  const createDir = useCallback((name: string) => {
    const node = findNode(fsRef.current, cwdRef.current);
    if (!node || node.type !== "dir") {
      return;
    }
    if (!node.children[name]) {
      node.children[name] = { type: "dir", children: {} };
    }
  }, []);

  const createFile = useCallback((name: string) => {
    const node = findNode(fsRef.current, cwdRef.current);
    if (!node || node.type !== "dir") {
      return;
    }
    if (!node.children[name]) {
      node.children[name] = { type: "file", content: "" };
    }
  }, []);

  const printFile = useCallback(
    (arg: string) => {
      const trimmed = arg.trim();
      let targetPath = resolvePath(cwdRef.current, trimmed || "");
      if (trimmed && !trimmed.includes("/") && trimmed.endsWith(".md")) {
        const match = files.find((file) => file.path.endsWith(`/${trimmed}`));
        if (match) {
          targetPath = match.path;
        }
      }
      const node = findNode(fsRef.current, targetPath);
      if (!node || node.type !== "file") {
        appendLine(
          formatMessage(messages.fileNotFound, {
            file: trimmed || targetPath,
          }),
          theme.palette.terminalDim,
        );
        return;
      }
      if (node.section) {
        onNavigateAction(node.section);
      }
      markdownToLines(node.content).forEach((line) =>
        appendLine(line.text, line.color ?? theme.palette.terminalText),
      );
    },
    [
      appendLine,
      files,
      formatMessage,
      messages.fileNotFound,
      onNavigateAction,
      theme.palette.terminalDim,
      theme.palette.terminalText,
    ],
  );

  const runCommand = useCallback(
    (command: string) => {
      const [cmd, ...rest] = command.split(" ");
      const arg = rest.join(" ").trim();
      switch (cmd) {
        case "help":
          appendLines(messages.help, theme.palette.terminalDim);
          break;
        case "clear":
          linesRef.current = [];
          scrollOffsetRef.current = 0;
          dirtyRef.current = true;
          break;
        case "show":
        case "open":
          if (arg === "-all") {
            appendLines(messages.help, theme.palette.terminalDim);
            appendLine(messages.availableFiles, theme.palette.terminalText);
            files.forEach((file) => appendLine(file.path));
            appendLine(messages.tip, theme.palette.terminalDim);
          } else {
            printFile(arg);
          }
          break;
        case "ls": {
          const node = findNode(fsRef.current, cwdRef.current);
          if (node && node.type === "dir") {
            const entries = Object.keys(node.children).sort();
            appendLine(entries.join(" "));
          }
          break;
        }
        case "cd": {
          const targetPath = resolvePath(cwdRef.current, arg || "/");
          const node = findNode(fsRef.current, targetPath);
          if (node && node.type === "dir") {
            cwdRef.current = targetPath || "/";
          } else {
            appendLine(
              formatMessage(messages.noSuchDirectory, {
                dir: arg || targetPath,
              }),
              theme.palette.terminalDim,
            );
          }
          break;
        }
        case "pwd":
          appendLine(cwdRef.current || "/");
          break;
        case "echo":
          appendLine(arg);
          break;
        case "hello":
          appendLine(
            formatMessage(messages.hello, { name: profileName() }),
            theme.palette.terminalText,
          );
          break;
        case "mkdir":
          if (!arg) {
            appendLine(messages.mkdirMissing, theme.palette.terminalDim);
            break;
          }
          createDir(arg);
          break;
        case "touch":
          if (!arg) {
            appendLine(messages.touchMissing, theme.palette.terminalDim);
            break;
          }
          createFile(arg);
          break;
        case "":
          break;
        default:
          appendLine(
            formatMessage(messages.commandNotFound, { cmd }),
            theme.palette.terminalDim,
          );
      }
    },
    [
      appendLine,
      appendLines,
      createDir,
      createFile,
      files,
      formatMessage,
      messages.availableFiles,
      messages.commandNotFound,
      messages.hello,
      messages.help,
      messages.mkdirMissing,
      messages.noSuchDirectory,
      messages.tip,
      messages.touchMissing,
      printFile,
      profileName,
      theme.palette.terminalDim,
      theme.palette.terminalText,
    ],
  );

  const drawTerminal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !textureRef.current) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    if (freezeTextureRef.current) {
      const snapshot = frozenSnapshotRef.current;
      if (snapshot && snapshot.width > 0 && snapshot.height > 0) {
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(snapshot, 0, 0, width, height);
        const now = typeof performance !== "undefined" ? performance.now() : 0;
        const glitchSlices = 6;
        for (let i = 0; i < glitchSlices; i += 1) {
          const t = now * 0.002 + i * 1.7;
          const y = Math.floor((Math.sin(t) * 0.5 + 0.5) * (height - 8));
          const sliceHeight = 3 + (i % 3);
          const xShift = Math.round(Math.sin(t * 2.3) * 6);
          ctx.drawImage(
            snapshot,
            0,
            y,
            width,
            sliceHeight,
            xShift,
            y,
            width,
            sliceHeight,
          );
        }
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
        textureRef.current.needsUpdate = true;
        textureUpdateRef.current = textureRef.current.needsUpdate;
        dirtyRef.current = false;
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("terminal-texture-updated"));
        }
        return;
      }
    }

    const { width, height } = canvas;
    const scale = Math.min(width, height);
    const padding = Math.floor(scale * 0.06);
    const safeFontScale = clamp(fontScale ?? 1, 0.7, 1.5);
    const baseFont = Math.floor(scale * 0.026 * safeFontScale);
    const minFont = Math.max(11, Math.floor(scale * 0.018));
    const maxFont = Math.floor(scale * 0.034);
    const fontSize = clamp(baseFont, minFont, maxFont);
    const lineHeight = Math.floor(fontSize * 1.45);
    const availableHeight = Math.max(1, height - padding * 2);
    const maxSlots = Math.max(2, Math.floor(availableHeight / lineHeight));
    const scrollOffset = scrollOffsetRef.current;
    const lines = linesRef.current;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.palette.terminalBg;
    ctx.fillRect(0, 0, width, height);

    const vignette = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      width * 0.2,
      width * 0.5,
      height * 0.5,
      width * 0.9,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textBaseline = "top";

    const maxLineWidth = Math.max(1, width - padding * 2);
    const wrapLine = (text: string) => {
      if (!text) {
        return [{ text: "", start: 0, end: 0 }];
      }
      const segments: { text: string; start: number; end: number }[] = [];
      let lineStart = 0;
      let cursor = 0;
      let currentWidth = 0;
      let lastBreak = -1;
      while (cursor < text.length) {
        const char = text[cursor];
        const charWidth = ctx.measureText(char).width;
        if (char === " ") {
          lastBreak = cursor;
        }
        if (currentWidth + charWidth > maxLineWidth && cursor > lineStart) {
          if (lastBreak >= lineStart) {
            segments.push({
              text: text.slice(lineStart, lastBreak),
              start: lineStart,
              end: lastBreak,
            });
            lineStart = lastBreak + 1;
            cursor = lineStart;
          } else {
            segments.push({
              text: text.slice(lineStart, cursor),
              start: lineStart,
              end: cursor,
            });
            lineStart = cursor;
          }
          currentWidth = 0;
          lastBreak = -1;
          continue;
        }
        currentWidth += charWidth;
        cursor += 1;
      }
      if (lineStart <= text.length) {
        segments.push({
          text: text.slice(lineStart),
          start: lineStart,
          end: text.length,
        });
      }
      return segments;
    };

    const wrappedOutput: Line[] = [];
    lines.forEach((line) => {
      wrapLine(line.text).forEach((wrappedLine) => {
        wrappedOutput.push({ text: wrappedLine.text, color: line.color });
      });
    });

    const promptPrefix = `${prompt} `;
    const promptText = `${promptPrefix}${inputValueRef.current}`;
    const wrappedPrompt = wrapLine(promptText).map((line) => ({
      ...line,
      color: theme.palette.terminalText,
    }));

    const promptSlots = Math.min(maxSlots, wrappedPrompt.length);
    const outputSlots = Math.max(0, maxSlots - promptSlots);
    const outputStart = Math.max(
      0,
      wrappedOutput.length - outputSlots - scrollOffset,
    );
    const outputEnd = Math.max(0, wrappedOutput.length - scrollOffset);
    const visibleOutput = wrappedOutput.slice(outputStart, outputEnd);
    const visiblePrompt = wrappedPrompt.slice(-promptSlots);

    const glow = isMobile || isFirefox ? theme.crt.glow * 0.35 : theme.crt.glow;
    visibleOutput.forEach((line, index) => {
      ctx.fillStyle = line.color ?? theme.palette.terminalText;
      ctx.shadowColor = "rgba(255, 200, 140, 0.22)";
      ctx.shadowBlur = glow;
      ctx.fillText(line.text, padding, padding + index * lineHeight);
      ctx.shadowBlur = 0;
    });

    const selection = selectionRef.current;
    const selectionStart = Math.min(selection.start, selection.end);
    const selectionEnd = Math.max(selection.start, selection.end);
    const hasSelection = selectionEnd > selectionStart;
    const selectionAbsStart = promptPrefix.length + selectionStart;
    const selectionAbsEnd = promptPrefix.length + selectionEnd;
    const caretIndex = clamp(selection.end, 0, inputValueRef.current.length);
    const caretAbs = promptPrefix.length + caretIndex;

    let caretDrawn = false;
    visiblePrompt.forEach((line, index) => {
      const y = padding + (visibleOutput.length + index) * lineHeight;
      if (y > height - padding) {
        return;
      }
      if (
        hasSelection &&
        line.end > selectionAbsStart &&
        line.start < selectionAbsEnd
      ) {
        const startIndex = Math.max(line.start, selectionAbsStart);
        const endIndex = Math.min(line.end, selectionAbsEnd);
        const before = promptText.slice(line.start, startIndex);
        const selectedText = promptText.slice(startIndex, endIndex);
        const x = padding + ctx.measureText(before).width;
        const w = Math.max(2, ctx.measureText(selectedText).width);
        ctx.fillStyle = "rgba(248, 200, 140, 0.25)";
        ctx.fillRect(x - 1, y - 1, w + 2, lineHeight + 2);
      }
      ctx.fillStyle = line.color ?? theme.palette.terminalText;
      ctx.fillText(line.text, padding, y);
      if (
        !caretDrawn &&
        focusedRef.current &&
        cursorVisible &&
        !hasSelection &&
        caretAbs >= line.start &&
        caretAbs <= line.end
      ) {
        const before = promptText.slice(line.start, caretAbs);
        const x = padding + ctx.measureText(before).width;
        const caretWidth = Math.max(2, Math.floor(fontSize * 0.55));
        const caretY = y - Math.max(1, Math.floor(lineHeight * 0.12));
        ctx.fillStyle = theme.palette.terminalText;
        ctx.fillRect(x, caretY, caretWidth, lineHeight - 4);
        caretDrawn = true;
      }
    });

    if (theme.crt.scanlineOpacity > 0.001) {
      ctx.globalAlpha = clamp(theme.crt.scanlineOpacity, 0, 0.25);
      ctx.fillStyle = "#000";
      const step = isMobile ? 5 : 4;
      for (let y = padding; y < height - padding; y += step) {
        ctx.fillRect(0, y, width, 1);
      }
      ctx.globalAlpha = 1;
    }

    if (!isMobile && theme.crt.noiseOpacity > 0.001) {
      const noiseCanvas =
        noiseCanvasRef.current ?? document.createElement("canvas");
      if (noiseCanvas.width !== width || noiseCanvas.height !== height) {
        noiseCanvas.width = width;
        noiseCanvas.height = height;
        const nctx = noiseCanvas.getContext("2d");
        if (nctx) {
          nctx.clearRect(0, 0, width, height);
          const speckles = Math.floor((width * height) / 1800);
          for (let i = 0; i < speckles; i += 1) {
            nctx.fillStyle = "rgba(255,255,255,0.12)";
            nctx.fillRect(
              Math.random() * width,
              Math.random() * height,
              1 + Math.random() * 1.2,
              1 + Math.random() * 1.2,
            );
          }
        }
        noiseCanvasRef.current = noiseCanvas;
      }
      ctx.globalAlpha = clamp(theme.crt.noiseOpacity, 0, 0.12);
      ctx.drawImage(noiseCanvas, 0, 0);
      ctx.globalAlpha = 1;
    }

    const glass = ctx.createLinearGradient(0, 0, width, height);
    glass.addColorStop(0, "rgba(255,255,255,0.04)");
    glass.addColorStop(0.5, "rgba(255,255,255,0)");
    glass.addColorStop(1, "rgba(255,255,255,0.06)");
    ctx.fillStyle = glass;
    ctx.fillRect(0, 0, width, height);

    textureRef.current.needsUpdate = true;
    textureUpdateRef.current = textureRef.current.needsUpdate;
    dirtyRef.current = false;

    const snapshot =
      frozenSnapshotRef.current ?? document.createElement("canvas");
    if (snapshot.width !== width || snapshot.height !== height) {
      snapshot.width = width;
      snapshot.height = height;
    }
    const sctx = snapshot.getContext("2d");
    if (sctx) {
      sctx.clearRect(0, 0, width, height);
      sctx.drawImage(canvas, 0, 0);
    }
    frozenSnapshotRef.current = snapshot;

    if (pendingFreezeRef.current) {
      freezeTextureRef.current = true;
      pendingFreezeRef.current = false;
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("terminal-texture-updated"));
    }
  }, [
    cursorVisible,
    fontScale,
    isFirefox,
    isMobile,
    prompt,
    theme.crt.glow,
    theme.crt.noiseOpacity,
    theme.crt.scanlineOpacity,
    theme.palette.terminalBg,
    theme.palette.terminalText,
  ]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      drawTerminal();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [drawTerminal, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    let cancelled = false;

    const boot = async () => {
      bootReadyRef.current = false;
      resetTerminal();
      for (const line of introLines) {
        if (cancelled) {
          return;
        }
        appendLine(line, theme.palette.terminalDim);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      appendLine(messages.welcome, theme.palette.terminalText);
      appendLine(messages.hint, theme.palette.terminalDim);
      if (!cancelled) {
        bootReadyRef.current = true;
        bootReadyCallbackRef.current?.();
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, [
    appendLine,
    introLines,
    language,
    messages.hint,
    messages.welcome,
    ready,
    resetTerminal,
    theme.palette.terminalDim,
    theme.palette.terminalText,
  ]);

  const handleSelectionUpdate = useCallback(
    (nextIndex: number, expand: boolean) => {
      const { length } = inputValueRef.current;
      const clamped = clamp(nextIndex, 0, length);
      if (expand) {
        if (selectionAnchorRef.current === null) {
          selectionAnchorRef.current = selectionRef.current.end;
        }
        const anchor = selectionAnchorRef.current;
        setSelectionRange(anchor ?? clamped, clamped);
      } else {
        selectionAnchorRef.current = null;
        setSelectionRange(clamped, clamped);
      }
    },
    [setSelectionRange],
  );

  const replaceSelection = useCallback(
    (replacement: string) => {
      const { start, end } = selectionRef.current;
      const selectionStart = Math.min(start, end);
      const selectionEnd = Math.max(start, end);
      const value = inputValueRef.current;
      const next =
        value.slice(0, selectionStart) +
        replacement +
        value.slice(selectionEnd);
      const cursor = selectionStart + replacement.length;
      syncInputValue(next, { start: cursor, end: cursor });
      selectionAnchorRef.current = null;
    },
    [syncInputValue],
  );

  const handleKeyAction = useCallback(
    (
      event: {
        key: string;
        ctrlKey: boolean;
        metaKey: boolean;
        altKey?: boolean;
        shiftKey?: boolean;
        preventDefault: () => void;
      },
      allowCharInput: boolean,
    ) => {
      if (!focusedRef.current) {
        focusedRef.current = true;
        onFocusChangeAction(true);
        focusInput(false);
        dirtyRef.current = true;
      }

      if (event.key === "Escape") {
        terminalApi.blur();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "a") {
        setSelectionRange(0, inputValueRef.current.length);
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "l") {
        linesRef.current = [];
        scrollOffsetRef.current = 0;
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.key === "PageUp") {
        scrollOffsetRef.current = Math.min(
          scrollOffsetRef.current + 3,
          linesRef.current.length,
        );
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.key === "PageDown") {
        scrollOffsetRef.current = Math.max(scrollOffsetRef.current - 3, 0);
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (
        event.altKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        const delta = event.key === "ArrowUp" ? 2 : -2;
        scrollOffsetRef.current = clamp(
          scrollOffsetRef.current + delta,
          0,
          linesRef.current.length,
        );
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const { start, end } = selectionRef.current;
        const hasSelection = start !== end;
        if (!event.shiftKey && hasSelection) {
          const nextIndex =
            event.key === "ArrowLeft"
              ? Math.min(start, end)
              : Math.max(start, end);
          handleSelectionUpdate(nextIndex, false);
          dirtyRef.current = true;
          event.preventDefault();
          return;
        }
        const caretIndex = end;
        const value = inputValueRef.current;
        const moveByWord = event.ctrlKey || event.metaKey;
        const nextIndex = moveByWord
          ? event.key === "ArrowLeft"
            ? findPrevWord(value, caretIndex)
            : findNextWord(value, caretIndex)
          : caretIndex + (event.key === "ArrowLeft" ? -1 : 1);
        handleSelectionUpdate(nextIndex, Boolean(event.shiftKey));
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowUp") {
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          return;
        }
        const history = historyRef.current;
        if (!history.length) {
          return;
        }
        historyIndexRef.current = Math.min(
          historyIndexRef.current + 1,
          history.length - 1,
        );
        const nextValue = history[history.length - 1 - historyIndexRef.current];
        syncInputValue(nextValue);
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowDown") {
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          return;
        }
        const history = historyRef.current;
        historyIndexRef.current = Math.max(historyIndexRef.current - 1, -1);
        const nextValue =
          historyIndexRef.current === -1
            ? ""
            : history[history.length - 1 - historyIndexRef.current];
        syncInputValue(nextValue);
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.key === "Enter") {
        const command = inputValueRef.current.trim();
        lastCommandRef.current = command || null;
        appendLine(`${prompt} ${command}`, theme.palette.terminalText);
        syncInputValue("");
        historyIndexRef.current = -1;
        if (command) {
          historyRef.current.push(command);
          runCommand(command);
        }
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.key === "Backspace") {
        const { start, end } = selectionRef.current;
        if (start !== end) {
          replaceSelection("");
          dirtyRef.current = true;
          event.preventDefault();
          return;
        }
        const caretIndex = end;
        if (caretIndex > 0) {
          const value = inputValueRef.current;
          const next = value.slice(0, caretIndex - 1) + value.slice(caretIndex);
          syncInputValue(next, { start: caretIndex - 1, end: caretIndex - 1 });
          dirtyRef.current = true;
          event.preventDefault();
        }
        return;
      }

      if (
        allowCharInput &&
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        replaceSelection(event.key);
        dirtyRef.current = true;
        event.preventDefault();
      }
    },
    [
      appendLine,
      focusInput,
      handleSelectionUpdate,
      onFocusChangeAction,
      prompt,
      replaceSelection,
      runCommand,
      setSelectionRange,
      syncInputValue,
      terminalApi,
      theme.palette.terminalText,
    ],
  );

  const handleInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      if (!focusedRef.current) {
        return;
      }
      const { value } = event.currentTarget;
      inputValueRef.current = value;
      syncSelection();
      dirtyRef.current = true;
    },
    [syncSelection],
  );

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      if (!focusedRef.current) {
        return;
      }
      const text = event.clipboardData.getData("text");
      if (text) {
        const input = inputRef.current;
        if (!input) {
          return;
        }
        const start = input.selectionStart ?? inputValueRef.current.length;
        const end = input.selectionEnd ?? start;
        const next =
          inputValueRef.current.slice(0, start) +
          text +
          inputValueRef.current.slice(end);
        const cursor = start + text.length;
        syncInputValue(next, { start: cursor, end: cursor });
        dirtyRef.current = true;
        event.preventDefault();
      }
    },
    [syncInputValue],
  );

  const handleInputFocus = useCallback(() => {
    if (!focusedRef.current) {
      focusedRef.current = true;
      onFocusChangeAction(true);
    }
    dirtyRef.current = true;
    focusInput(false);
    syncSelection();
  }, [focusInput, onFocusChangeAction, syncSelection]);

  const handleInputBlur = useCallback(() => {
    if (focusedRef.current) {
      focusedRef.current = false;
      onFocusChangeAction(false);
    }
    selectionAnchorRef.current = null;
    dirtyRef.current = true;
  }, [onFocusChangeAction]);

  const handleInputKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      const input = inputRef.current;
      if (!input) {
        handleKeyAction(event, false);
        return;
      }

      if (
        event.altKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        const delta = event.key === "ArrowUp" ? 2 : -2;
        scrollOffsetRef.current = clamp(
          scrollOffsetRef.current + delta,
          0,
          linesRef.current.length,
        );
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "l") {
        linesRef.current = [];
        scrollOffsetRef.current = 0;
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.key === "PageUp") {
        scrollOffsetRef.current = Math.min(
          scrollOffsetRef.current + 3,
          linesRef.current.length,
        );
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.key === "PageDown") {
        scrollOffsetRef.current = Math.max(scrollOffsetRef.current - 3, 0);
        dirtyRef.current = true;
        event.preventDefault();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const command = input.value.trim();
        lastCommandRef.current = command || null;
        appendLine(`${prompt} ${command}`, theme.palette.terminalText);
        if (command) {
          historyRef.current.push(command);
        }
        historyIndexRef.current = -1;
        syncInputValue("");
        if (command) {
          runCommand(command);
        }
        dirtyRef.current = true;
        return;
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          return;
        }
        const history = historyRef.current;
        if (!history.length) {
          return;
        }
        event.preventDefault();
        if (event.key === "ArrowUp") {
          historyIndexRef.current = Math.min(
            historyIndexRef.current + 1,
            history.length - 1,
          );
        } else {
          historyIndexRef.current = Math.max(historyIndexRef.current - 1, -1);
        }
        const nextValue =
          historyIndexRef.current === -1
            ? ""
            : history[history.length - 1 - historyIndexRef.current];
        syncInputValue(nextValue);
        dirtyRef.current = true;
      }
    },
    [
      appendLine,
      handleKeyAction,
      prompt,
      runCommand,
      syncInputValue,
      theme.palette.terminalText,
    ],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.target === inputRef.current) {
        return;
      }
      handleKeyAction(event, true);
    };

    window.addEventListener("keydown", handleKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKey, { capture: true });
  }, [handleKeyAction]);

  useEffect(() => {
    let rafId = 0;
    const drawLoop = () => {
      const now = performance.now();
      const targetInterval = focusedRef.current
        ? isFirefox
          ? 90
          : 33
        : isMobile || isFirefox
          ? 140
          : 90;
      if (
        dirtyRef.current &&
        !document.hidden &&
        now - lastDrawRef.current > targetInterval
      ) {
        drawTerminal();
        lastDrawRef.current = now;
      }
      rafId = requestAnimationFrame(drawLoop);
    };
    drawLoop();
    return () => cancelAnimationFrame(rafId);
  }, [drawTerminal, isFirefox, isMobile]);

  useEffect(() => {
    if (!onDebugAction) {
      return;
    }
    const { width, height } = canvasSize;
    const interval = window.setInterval(() => {
      const lines = linesRef.current;
      onDebugAction({
        canvasSize: Math.max(width, height),
        lastDrawMs: lastDrawRef.current,
        textureNeedsUpdate: textureUpdateRef.current,
        terminalFocus: focusedRef.current,
        lastCommand: lastCommandRef.current,
        lastOutputLines: lines.slice(-3).map((line) => line.text),
      });
    }, 300);
    return () => window.clearInterval(interval);
  }, [canvasSize, onDebugAction]);

  return (
    <>
      <canvas ref={canvasRef} className="terminal-canvas" />
      <input
        ref={inputRef}
        className="terminal-input"
        type="text"
        id="terminal-input"
        name="terminal-input"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        tabIndex={-1}
        aria-label="Terminal input"
        onKeyDown={handleInputKeyDown}
        onKeyUp={syncSelection}
        onInput={handleInput}
        onPaste={handlePaste}
        onSelect={syncSelection}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
      />
    </>
  );
}
