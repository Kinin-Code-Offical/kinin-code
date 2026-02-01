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
  content?: string;
  section?: string;
  type?: "file" | "dir";
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
  isActive?: boolean;
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

type AppMode = "snake" | "pacman" | "calc";

type FsNode =
  | { type: "dir"; children: Record<string, FsNode> }
  | { type: "file"; content: string; section?: string };

type GridPoint = { x: number; y: number };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const resolvePath = (cwd: string, input: string, home: string) => {
  const value = input.trim();
  if (!value || value === ".") {
    return cwd;
  }
  const expanded = value.startsWith("~") ? `${home}${value.slice(1)}` : value;
  const absolute = expanded.startsWith("/")
    ? expanded
    : `${cwd.replace(/\/$/, "")}/${expanded}`;
  const parts = absolute.split("/").filter((part) => part.length > 0);
  const stack: string[] = [];
  parts.forEach((part) => {
    if (part === ".") {
      return;
    }
    if (part === "..") {
      stack.pop();
      return;
    }
    stack.push(part);
  });
  return stack.length ? `/${stack.join("/")}` : "/";
};

const tokenizeInput = (input: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaping = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }
    if (char === "\\" && quote !== "'") {
      escaping = true;
      continue;
    }
    if (char === "'" || char === '"') {
      if (!quote) {
        quote = char;
        continue;
      }
      if (quote === char) {
        quote = null;
        continue;
      }
    }
    if (!quote && /\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
};

const expandEnv = (value: string, env: Record<string, string>) => {
  return value.replace(
    /\$(\w+)|\$\{([^}]+)\}/g,
    (_, key, braced) => env[key || braced] ?? "",
  );
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes}B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)}K`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
};

const formatUptime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.max(0, seconds % 60);
  const parts: string[] = [];
  if (days) {
    parts.push(`${days}d`);
  }
  if (hours) {
    parts.push(`${hours}h`);
  }
  if (minutes) {
    parts.push(`${minutes}m`);
  }
  if (!parts.length) {
    parts.push(`${secs}s`);
  }
  return parts.join(" ");
};

const evaluateExpression = (expression: string) => {
  const input = expression.replace(/\s+/g, "");
  if (!input) {
    return 0;
  }
  if (!/^[0-9+\-*/().]+$/.test(input)) {
    throw new Error("invalid");
  }
  const tokens: string[] = [];
  let current = "";
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (/[0-9.]/.test(char)) {
      current += char;
      continue;
    }
    if (current) {
      tokens.push(current);
      current = "";
    }
    if (char === "-" && (i === 0 || "(+*/-".includes(input[i - 1]))) {
      current = "-";
      continue;
    }
    tokens.push(char);
  }
  if (current) {
    tokens.push(current);
  }

  const output: string[] = [];
  const ops: string[] = [];
  const precedence: Record<string, number> = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2,
  };

  tokens.forEach((token) => {
    if (!Number.isNaN(Number(token))) {
      output.push(token);
      return;
    }
    if (token === "(") {
      ops.push(token);
      return;
    }
    if (token === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") {
        output.push(ops.pop() as string);
      }
      if (!ops.length) {
        throw new Error("mismatch");
      }
      ops.pop();
      return;
    }
    const prec = precedence[token];
    if (!prec) {
      throw new Error("invalid");
    }
    while (ops.length) {
      const top = ops[ops.length - 1];
      const topPrec = precedence[top];
      if (!topPrec || topPrec < prec) {
        break;
      }
      output.push(ops.pop() as string);
    }
    ops.push(token);
  });

  while (ops.length) {
    const op = ops.pop() as string;
    if (op === "(" || op === ")") {
      throw new Error("mismatch");
    }
    output.push(op);
  }

  const stack: number[] = [];
  output.forEach((token) => {
    if (!Number.isNaN(Number(token))) {
      stack.push(Number(token));
      return;
    }
    const right = stack.pop();
    const left = stack.pop();
    if (left === undefined || right === undefined) {
      throw new Error("invalid");
    }
    switch (token) {
      case "+":
        stack.push(left + right);
        break;
      case "-":
        stack.push(left - right);
        break;
      case "*":
        stack.push(left * right);
        break;
      case "/":
        stack.push(left / right);
        break;
      default:
        throw new Error("invalid");
    }
  });

  if (stack.length !== 1 || Number.isNaN(stack[0])) {
    throw new Error("invalid");
  }
  return stack[0];
};

const buildFileTree = (files: TerminalFile[]) => {
  const root: FsNode = { type: "dir", children: {} };
  for (const file of files) {
    const normalizedPath = file.path.replace(/\/+$/, "");
    const parts = normalizedPath.split("/").filter((part) => part.length > 0);
    let node = root;
    parts.forEach((part, index) => {
      if (node.type !== "dir") {
        return;
      }
      if (index === parts.length - 1) {
        if (file.type === "dir") {
          node.children[part] = { type: "dir", children: {} };
        } else {
          node.children[part] = {
            type: "file",
            content: file.content ?? "",
            section: file.section,
          };
        }
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
  isActive = true,
  screenAspect,
  fontScale,
  onNavigateAction,
  onReadyAction,
  onBootReadyAction,
  onFocusChangeAction,
  onDebugAction,
}: TerminalCanvasProps) {
  const userName = useMemo(() => prompt.split("@")[0] || "user", [prompt]);
  const homePath = useMemo(() => `/home/${userName}`, [userName]);
  const builtinCommands = useMemo(
    () => [
      "help",
      "clear",
      "ls",
      "cd",
      "pwd",
      "echo",
      "hello",
      "mkdir",
      "touch",
      "rm",
      "rmdir",
      "mv",
      "cp",
      "cat",
      "less",
      "edit",
      "nano",
      "head",
      "tail",
      "tree",
      "find",
      "grep",
      "history",
      "env",
      "export",
      "alias",
      "unalias",
      "whoami",
      "uname",
      "date",
      "uptime",
      "python",
      "python2",
      "calc",
      "snake",
      "pacman",
      "man",
      "which",
      "set",
      "open",
      "show",
    ],
    [],
  );
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
  const prevCwdRef = useRef<string | null>(null);
  const envRef = useRef<Record<string, string>>({
    USER: userName,
    HOME: homePath,
    SHELL: "/bin/kinin",
    LANG: language === "tr" ? "tr_TR.UTF-8" : "en_US.UTF-8",
    PATH: "/usr/local/bin:/usr/bin:/bin",
    TERM: "kinin-term",
  });
  const aliasRef = useRef<Record<string, string>>({
    ll: "ls -al",
    la: "ls -a",
    l: "ls",
  });
  const editorRef = useRef<{ path: string; buffer: string[] } | null>(null);
  const sessionStartRef = useRef(Date.now());
  const lastCanvasSizeRef = useRef({ width: 0, height: 0 });
  const dirtyRef = useRef(true);
  const appModeRef = useRef<AppMode | null>(null);
  const gameTimerRef = useRef<number | null>(null);
  const snakeBodyRef = useRef<GridPoint[]>([]);
  const snakeDirRef = useRef<GridPoint>({ x: 1, y: 0 });
  const snakeNextDirRef = useRef<GridPoint>({ x: 1, y: 0 });
  const snakeFoodRef = useRef<GridPoint | null>(null);
  const snakeAliveRef = useRef(true);
  const snakeScoreRef = useRef(0);
  const snakeGridRef = useRef({ cols: 24, rows: 16 });
  const pacmanGridRef = useRef<number[][]>([]);
  const pacmanPosRef = useRef<GridPoint>({ x: 1, y: 1 });
  const pacmanDirRef = useRef<GridPoint>({ x: 1, y: 0 });
  const pacmanNextDirRef = useRef<GridPoint>({ x: 1, y: 0 });
  const pacmanScoreRef = useRef(0);
  const pacmanPelletsRef = useRef(0);
  const pacmanWonRef = useRef(false);
  const calcInputRef = useRef("");
  const calcResultRef = useRef<string | null>(null);
  const calcErrorRef = useRef<string | null>(null);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const freezeTextureRef = useRef(false);
  const frozenSnapshotRef = useRef<HTMLCanvasElement | null>(null);
  const pendingFreezeRef = useRef(false);
  const freezeTimeoutRef = useRef<number | null>(null);
  const gradientCacheRef = useRef<{
    width: number;
    height: number;
    vignette: CanvasGradient | null;
    glass: CanvasGradient | null;
  }>({
    width: 0,
    height: 0,
    vignette: null,
    glass: null,
  });
  const lastTextureEventRef = useRef(0);
  const interactionActiveRef = useRef(false);
  const hasTerminalContentRef = useRef(false);
  const isActiveRef = useRef(isActive);

  const perfInfo = useMemo(() => {
    if (typeof navigator === "undefined") {
      return { memory: 8, cores: 8 };
    }
    const nav = navigator as Navigator & { deviceMemory?: number };
    const memory = typeof nav.deviceMemory === "number" ? nav.deviceMemory : 8;
    const cores =
      typeof navigator.hardwareConcurrency === "number"
        ? navigator.hardwareConcurrency
        : 8;
    return { memory, cores };
  }, []);
  const perfTier = useMemo(() => {
    const { memory, cores } = perfInfo;
    if (isMobile && memory <= 4) {
      return "low";
    }
    if (memory >= 8 && cores >= 8) {
      return "high";
    }
    return "mid";
  }, [isMobile, perfInfo]);
  const resolutionScale = useMemo(() => {
    const { memory, cores } = perfInfo;
    let scale = 1;
    if (memory <= 2 || cores <= 2) {
      scale = 0.6;
    } else if (memory <= 4 || cores <= 4) {
      scale = 0.75;
    } else if (memory <= 6 || cores <= 6) {
      scale = 0.85;
    } else if (memory >= 12 && cores >= 12) {
      scale = 1.1;
    }
    if (isMobile) {
      scale = Math.min(scale, 0.95);
    }
    return scale;
  }, [isMobile, perfInfo]);
  const baseSize = useMemo(() => {
    const raw = perfTier === "low" ? 520 : perfTier === "high" ? 720 : 640;
    const scaled = Math.round(raw * resolutionScale);
    return clamp(scaled, 420, 860);
  }, [perfTier, resolutionScale]);
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
    const maxSizeRaw = isFirefox
      ? 640
      : isMobile
        ? perfTier === "high"
          ? 980
          : perfTier === "low"
            ? 700
            : 820
        : perfTier === "high"
          ? 1600
          : perfTier === "low"
            ? 1100
            : 1400;
    const maxSize = Math.round(maxSizeRaw * resolutionScale);
    const scale = Math.min(1, maxSize / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }, [baseSize, isFirefox, isMobile, perfTier, resolutionScale, screenAspect]);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (isActive) {
      dirtyRef.current = true;
      if (focusedRef.current) {
        setCursorVisible(true);
      }
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      return;
    }
    if (freezeTextureRef.current || pendingFreezeRef.current) {
      freezeTextureRef.current = false;
      pendingFreezeRef.current = false;
      dirtyRef.current = true;
    }
  }, [isActive]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const handleVisibility = () => {
      if (document.hidden) {
        return;
      }
      if (focusedRef.current) {
        setCursorVisible(true);
      }
      lastDrawRef.current = 0;
      dirtyRef.current = true;
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    fsRef.current = buildFileTree(files);
    const nextHome = homePath;
    const currentNode = findNode(fsRef.current, cwdRef.current);
    const homeNode = findNode(fsRef.current, nextHome);
    if (homeNode && homeNode.type === "dir" && cwdRef.current === "/") {
      cwdRef.current = nextHome;
    } else if (!currentNode || currentNode.type !== "dir") {
      cwdRef.current = homeNode ? nextHome : "/";
    }
  }, [files, homePath]);

  useEffect(() => {
    envRef.current = {
      ...envRef.current,
      USER: userName,
      HOME: homePath,
      LANG: language === "tr" ? "tr_TR.UTF-8" : "en_US.UTF-8",
    };
  }, [homePath, language, userName]);

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

  const stopGameLoop = useCallback(() => {
    if (gameTimerRef.current) {
      window.clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
    }
  }, []);

  const computeAppGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const width = canvas?.width ?? 640;
    const height = canvas?.height ?? 480;
    const cols = Math.max(18, Math.min(36, Math.floor(width / 26)));
    const rows = Math.max(12, Math.min(24, Math.floor(height / 26)));
    return { cols, rows };
  }, []);

  const resetSnake = useCallback(() => {
    const { cols, rows } = computeAppGrid();
    snakeGridRef.current = { cols, rows };
    const startX = Math.floor(cols / 2);
    const startY = Math.floor(rows / 2);
    snakeBodyRef.current = [
      { x: startX - 1, y: startY },
      { x: startX, y: startY },
      { x: startX + 1, y: startY },
    ];
    snakeDirRef.current = { x: 1, y: 0 };
    snakeNextDirRef.current = { x: 1, y: 0 };
    snakeAliveRef.current = true;
    snakeScoreRef.current = 0;
    snakeFoodRef.current = null;
    dirtyRef.current = true;
  }, [computeAppGrid]);

  const placeSnakeFood = useCallback(() => {
    const { cols, rows } = snakeGridRef.current;
    const body = snakeBodyRef.current;
    const occupied = new Set(body.map((part) => `${part.x},${part.y}`));
    const maxTries = cols * rows;
    for (let i = 0; i < maxTries; i += 1) {
      const x = Math.floor(Math.random() * cols);
      const y = Math.floor(Math.random() * rows);
      if (!occupied.has(`${x},${y}`)) {
        snakeFoodRef.current = { x, y };
        return;
      }
    }
    snakeFoodRef.current = null;
  }, []);

  const stepSnake = useCallback(() => {
    if (!snakeAliveRef.current) {
      return;
    }
    const { cols, rows } = snakeGridRef.current;
    const body = snakeBodyRef.current;
    const currentDir = snakeDirRef.current;
    const nextDir = snakeNextDirRef.current;
    const isOpposite =
      currentDir.x + nextDir.x === 0 && currentDir.y + nextDir.y === 0;
    const dir = isOpposite ? currentDir : nextDir;
    snakeDirRef.current = dir;
    const head = body[body.length - 1];
    const next = { x: head.x + dir.x, y: head.y + dir.y };
    if (next.x < 0 || next.y < 0 || next.x >= cols || next.y >= rows) {
      snakeAliveRef.current = false;
      return;
    }
    if (body.some((part) => part.x === next.x && part.y === next.y)) {
      snakeAliveRef.current = false;
      return;
    }
    body.push(next);
    const food = snakeFoodRef.current;
    if (food && food.x === next.x && food.y === next.y) {
      snakeScoreRef.current += 1;
      placeSnakeFood();
    } else {
      body.shift();
    }
  }, [placeSnakeFood]);

  const buildPacmanGrid = useCallback((cols: number, rows: number) => {
    const grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => 2),
    );
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) {
          grid[y][x] = 1;
        }
      }
    }
    for (let y = 2; y < rows - 2; y += 4) {
      for (let x = 2; x < cols - 2; x += 1) {
        if (x % 6 === 0) {
          continue;
        }
        grid[y][x] = 1;
      }
    }
    for (let x = 3; x < cols - 3; x += 6) {
      for (let y = 2; y < rows - 2; y += 1) {
        if (y % 5 === 0) {
          continue;
        }
        grid[y][x] = 1;
      }
    }
    grid[1][1] = 0;
    grid[1][2] = 0;
    grid[2][1] = 0;
    return grid;
  }, []);

  const resetPacman = useCallback(() => {
    const { cols, rows } = computeAppGrid();
    const grid = buildPacmanGrid(cols, rows);
    pacmanGridRef.current = grid;
    pacmanPosRef.current = { x: 1, y: 1 };
    pacmanDirRef.current = { x: 1, y: 0 };
    pacmanNextDirRef.current = { x: 1, y: 0 };
    pacmanScoreRef.current = 0;
    pacmanWonRef.current = false;
    let pellets = 0;
    grid.forEach((row) => {
      row.forEach((cell) => {
        if (cell === 2) {
          pellets += 1;
        }
      });
    });
    pacmanPelletsRef.current = pellets;
    dirtyRef.current = true;
  }, [buildPacmanGrid, computeAppGrid]);

  const stepPacman = useCallback(() => {
    if (pacmanWonRef.current) {
      return;
    }
    const grid = pacmanGridRef.current;
    const pos = pacmanPosRef.current;
    const nextDir = pacmanNextDirRef.current;
    const canMove = (dir: GridPoint) => {
      const nx = pos.x + dir.x;
      const ny = pos.y + dir.y;
      return grid[ny]?.[nx] !== 1;
    };
    if (canMove(nextDir)) {
      pacmanDirRef.current = nextDir;
    }
    const dir = pacmanDirRef.current;
    if (!canMove(dir)) {
      return;
    }
    pos.x += dir.x;
    pos.y += dir.y;
    if (grid[pos.y][pos.x] === 2) {
      grid[pos.y][pos.x] = 0;
      pacmanScoreRef.current += 1;
      pacmanPelletsRef.current -= 1;
      if (pacmanPelletsRef.current <= 0) {
        pacmanWonRef.current = true;
      }
    }
  }, []);

  const resetCalc = useCallback(() => {
    calcInputRef.current = "";
    calcResultRef.current = null;
    calcErrorRef.current = null;
    dirtyRef.current = true;
  }, []);

  const startGameLoop = useCallback(
    (mode: AppMode) => {
      stopGameLoop();
      const baseInterval = mode === "snake" ? 120 : 140;
      const lowPowerInterval = mode === "snake" ? 200 : 220;
      let interval = baseInterval;
      if (perfTier === "low") {
        interval = lowPowerInterval;
      } else if (perfTier === "mid") {
        interval = Math.round(baseInterval * (isMobile ? 1.5 : 1.25));
      } else if (isMobile) {
        interval = Math.round(baseInterval * 1.2);
      }
      gameTimerRef.current = window.setInterval(() => {
        if (appModeRef.current !== mode) {
          return;
        }
        if (mode === "snake") {
          stepSnake();
        } else if (mode === "pacman") {
          stepPacman();
        }
        dirtyRef.current = true;
      }, interval);
    },
    [isMobile, perfTier, stepPacman, stepSnake, stopGameLoop],
  );

  const startApp = useCallback(
    (mode: AppMode) => {
      stopGameLoop();
      appModeRef.current = mode;
      hasTerminalContentRef.current = true;
      if (mode === "snake") {
        resetSnake();
        placeSnakeFood();
        startGameLoop(mode);
      } else if (mode === "pacman") {
        resetPacman();
        startGameLoop(mode);
      } else if (mode === "calc") {
        resetCalc();
      }
      dirtyRef.current = true;
    },
    [
      placeSnakeFood,
      resetCalc,
      resetPacman,
      resetSnake,
      startGameLoop,
      stopGameLoop,
    ],
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
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const snapshot = frozenSnapshotRef.current;
      if (snapshot && snapshot.width > 0 && snapshot.height > 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(snapshot, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.fillStyle = theme.palette.terminalBg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

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
      if (textureRef.current) {
        textureRef.current.needsUpdate = true;
        textureUpdateRef.current = true;
      }
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
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
      textureUpdateRef.current = true;
    }
  }, [
    canvasSize.height,
    canvasSize.width,
    onReadyAction,
    terminalApi,
    theme.palette.terminalBg,
  ]);

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
      interactionActiveRef.current = Boolean(detail.active);
      if (detail.active) {
        if (!bootReadyRef.current) {
          return;
        }
        if (!hasTerminalContentRef.current) {
          return;
        }
        if (focusedRef.current) {
          return;
        }
        if (freezeTimeoutRef.current) {
          window.clearTimeout(freezeTimeoutRef.current);
          freezeTimeoutRef.current = null;
        }
        if (!freezeTextureRef.current) {
          const snapshot = frozenSnapshotRef.current;
          if (snapshot && snapshot.width > 0 && snapshot.height > 0) {
            freezeTextureRef.current = true;
          } else {
            pendingFreezeRef.current = true;
          }
          dirtyRef.current = true;
        }
      } else {
        if (freezeTimeoutRef.current) {
          window.clearTimeout(freezeTimeoutRef.current);
        }
        freezeTimeoutRef.current = window.setTimeout(() => {
          if (interactionActiveRef.current) {
            return;
          }
          if (freezeTextureRef.current || pendingFreezeRef.current) {
            freezeTextureRef.current = false;
            pendingFreezeRef.current = false;
            dirtyRef.current = true;
          }
        }, 220);
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
    if (!isActive) {
      return;
    }
    const timer = window.setInterval(() => {
      if (freezeTextureRef.current || !focusedRef.current) {
        return;
      }
      setCursorVisible((prev) => !prev);
      dirtyRef.current = true;
    }, 520);
    return () => window.clearInterval(timer);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) {
      stopGameLoop();
      return;
    }
    const mode = appModeRef.current;
    if (mode === "snake" || mode === "pacman") {
      startGameLoop(mode);
    }
  }, [isActive, startGameLoop, stopGameLoop]);

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

  const stopApp = useCallback(
    (message?: string) => {
      stopGameLoop();
      const ended = appModeRef.current;
      appModeRef.current = null;
      if (ended) {
        appendLine(message ?? `Exited ${ended}`);
      }
      dirtyRef.current = true;
    },
    [appendLine, stopGameLoop],
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
    return userName;
  }, [userName]);

  const ensureDir = useCallback(
    (input: string, recursive = false) => {
      const target = resolvePath(cwdRef.current, input, homePath);
      const parts = target.split("/").filter((part) => part.length > 0);
      let node = fsRef.current;
      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];
        if (node.type !== "dir") {
          return null;
        }
        const existing = node.children[part];
        if (!existing) {
          if (!recursive && i < parts.length - 1) {
            return null;
          }
          node.children[part] = { type: "dir", children: {} };
        } else if (existing.type !== "dir") {
          return null;
        }
        node = node.children[part] as {
          type: "dir";
          children: Record<string, FsNode>;
        };
      }
      return node;
    },
    [homePath],
  );

  const writeFile = useCallback(
    (
      input: string,
      content: string,
      options?: { append?: boolean; create?: boolean },
    ) => {
      const target = resolvePath(cwdRef.current, input, homePath);
      const parts = target.split("/").filter((part) => part.length > 0);
      const name = parts.pop();
      if (!name) {
        return false;
      }
      const dirPath = parts.length ? `/${parts.join("/")}` : "/";
      const dirNode = ensureDir(dirPath, true);
      if (!dirNode || dirNode.type !== "dir") {
        return false;
      }
      const existing = dirNode.children[name];
      if (!existing && options?.create === false) {
        return false;
      }
      if (!existing || existing.type !== "file") {
        dirNode.children[name] = { type: "file", content };
      } else if (options?.append) {
        existing.content += content;
      } else {
        existing.content = content;
      }
      return true;
    },
    [ensureDir, homePath],
  );

  const createDir = useCallback(
    (name: string, recursive = false) => {
      return Boolean(ensureDir(name, recursive));
    },
    [ensureDir],
  );

  const createFile = useCallback(
    (name: string) => {
      return writeFile(name, "", { create: true });
    },
    [writeFile],
  );

  const removeNode = useCallback(
    (input: string, recursive = false) => {
      const target = resolvePath(cwdRef.current, input, homePath);
      if (!target || target === "/") {
        return false;
      }
      const parts = target.split("/").filter((part) => part.length > 0);
      const name = parts.pop();
      if (!name) {
        return false;
      }
      const dirPath = parts.length ? `/${parts.join("/")}` : "/";
      const parent = findNode(fsRef.current, dirPath);
      if (!parent || parent.type !== "dir") {
        return false;
      }
      const node = parent.children[name];
      if (!node) {
        return false;
      }
      if (
        node.type === "dir" &&
        !recursive &&
        Object.keys(node.children).length > 0
      ) {
        return false;
      }
      delete parent.children[name];
      return true;
    },
    [homePath],
  );

  const cloneNode = useCallback((node: FsNode): FsNode => {
    if (node.type === "file") {
      return { type: "file", content: node.content, section: node.section };
    }
    const children: Record<string, FsNode> = {};
    Object.entries(node.children).forEach(([key, child]) => {
      children[key] = cloneNode(child);
    });
    return { type: "dir", children };
  }, []);

  const listDir = useCallback(
    (input: string, options?: { all?: boolean }) => {
      const target = resolvePath(cwdRef.current, input, homePath);
      const node = findNode(fsRef.current, target);
      if (!node || node.type !== "dir") {
        return null;
      }
      const entries = Object.keys(node.children).filter((name) =>
        options?.all ? true : !name.startsWith("."),
      );
      return entries.sort();
    },
    [homePath],
  );

  const formatLsLong = useCallback(
    (names: string[], dirPath: string) => {
      const lines: string[] = [];
      names.forEach((name) => {
        const node = findNode(
          fsRef.current,
          `${dirPath}/${name}`.replace(/\/+/g, "/"),
        );
        if (!node) {
          return;
        }
        const isDir = node.type === "dir";
        const size =
          node.type === "file"
            ? node.content.length
            : Object.keys(node.children).length * 24;
        const typeChar = isDir ? "d" : "-";
        lines.push(
          `${typeChar}rw-r--r--  ${userName.padEnd(6)}  ${formatBytes(size).padStart(4)}  ${name}`,
        );
      });
      return lines;
    },
    [userName],
  );

  const printFile = useCallback(
    (arg: string) => {
      const trimmed = arg.trim();
      let targetPath = resolvePath(cwdRef.current, trimmed || "", homePath);
      if (trimmed && !trimmed.includes("/") && trimmed.endsWith(".md")) {
        const match = files.find((file) => file.path.endsWith(`/${trimmed}`));
        if (match) {
          targetPath = match.path;
        }
      }
      if (trimmed && !trimmed.includes("/") && !trimmed.includes(".")) {
        const match = files.find((file) =>
          file.path.endsWith(`/${trimmed}.md`),
        );
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
      homePath,
      messages.fileNotFound,
      onNavigateAction,
      theme.palette.terminalDim,
      theme.palette.terminalText,
    ],
  );

  const runCommand = useCallback(
    (command: string) => {
      const env = envRef.current;
      let tokens = tokenizeInput(command);
      if (!tokens.length) {
        return;
      }

      for (let i = 0; i < 3; i += 1) {
        const alias = aliasRef.current[tokens[0]];
        if (!alias) {
          break;
        }
        tokens = [...tokenizeInput(alias), ...tokens.slice(1)];
      }

      tokens = tokens.map((token) => expandEnv(token, env));
      const [cmdRaw, ...args] = tokens;
      const cmd = cmdRaw ?? "";
      const arg = args.join(" ").trim();
      const params = args.filter((value) => !value.startsWith("-"));
      const hasFlag = (flag: string) =>
        args.some((value) => value.startsWith("-") && value.includes(flag));
      const home = env.HOME || homePath;
      const resolveArg = (value: string) =>
        resolvePath(cwdRef.current, value, home);
      const reportNoDir = (value: string) =>
        appendLine(
          formatMessage(messages.noSuchDirectory, { dir: value }),
          theme.palette.terminalDim,
        );
      const reportNoFile = (value: string) =>
        appendLine(
          formatMessage(messages.fileNotFound, { file: value }),
          theme.palette.terminalDim,
        );

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
          const target = params[0] ?? ".";
          const entries = listDir(target, { all: hasFlag("a") });
          if (!entries) {
            reportNoDir(target);
            break;
          }
          if (hasFlag("l")) {
            const dirPath = resolveArg(target);
            formatLsLong(entries, dirPath).forEach((line) => appendLine(line));
            break;
          }
          appendLine(entries.join(" "));
          break;
        }
        case "cd": {
          const targetArg = params[0] ?? home;
          if (targetArg === "-" && prevCwdRef.current) {
            const prev = prevCwdRef.current;
            prevCwdRef.current = cwdRef.current;
            cwdRef.current = prev;
            appendLine(cwdRef.current);
            break;
          }
          const targetPath = resolveArg(targetArg);
          const node = findNode(fsRef.current, targetPath);
          if (node && node.type === "dir") {
            prevCwdRef.current = cwdRef.current;
            cwdRef.current = targetPath || "/";
          } else {
            reportNoDir(targetArg);
          }
          break;
        }
        case "pwd":
          appendLine(cwdRef.current || "/");
          break;
        case "echo": {
          const redirectIndex = args.findIndex(
            (value) => value === ">" || value === ">>",
          );
          if (redirectIndex >= 0) {
            const target = args[redirectIndex + 1];
            if (!target) {
              appendLine("echo: missing file");
              break;
            }
            const text = args.slice(0, redirectIndex).join(" ");
            writeFile(target, `${text}\n`, {
              append: args[redirectIndex] === ">>",
              create: true,
            });
            break;
          }
          appendLine(arg);
          break;
        }
        case "whoami":
          appendLine(env.USER || "user");
          break;
        case "uname":
          appendLine(
            hasFlag("a") ? "KininOS 0.9.4 kinin-term x86_64" : "KininOS",
          );
          break;
        case "date":
          appendLine(
            new Date().toLocaleString(language === "tr" ? "tr-TR" : "en-US"),
          );
          break;
        case "uptime": {
          const seconds = Math.max(
            1,
            Math.floor((Date.now() - sessionStartRef.current) / 1000),
          );
          appendLine(`up ${formatUptime(seconds)}`);
          break;
        }
        case "env":
        case "set":
          Object.entries(env)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([key, value]) => appendLine(`${key}=${value}`));
          break;
        case "export":
          if (!args.length) {
            Object.entries(env)
              .sort(([a], [b]) => a.localeCompare(b))
              .forEach(([key, value]) => appendLine(`${key}=${value}`));
            break;
          }
          args.forEach((entry) => {
            const [key, ...rest] = entry.split("=");
            envRef.current[key] = rest.join("=");
          });
          break;
        case "alias":
          if (!args.length) {
            Object.entries(aliasRef.current)
              .sort(([a], [b]) => a.localeCompare(b))
              .forEach(([key, value]) => appendLine(`alias ${key}='${value}'`));
            break;
          }
          args.forEach((entry) => {
            const [key, ...rest] = entry.split("=");
            const value = rest.join("=").replace(/^['"]|['"]$/g, "");
            if (key) {
              aliasRef.current[key] = value;
            }
          });
          break;
        case "unalias":
          args.forEach((name) => {
            delete aliasRef.current[name];
          });
          break;
        case "history":
          if (hasFlag("c")) {
            historyRef.current = [];
            historyIndexRef.current = -1;
            appendLine("history cleared");
            break;
          }
          historyRef.current.forEach((entry, index) =>
            appendLine(`${index + 1}  ${entry}`),
          );
          break;
        case "mkdir": {
          if (!arg) {
            appendLine(messages.mkdirMissing, theme.palette.terminalDim);
            break;
          }
          const recursive = hasFlag("p");
          params.forEach((value) => {
            const ok = createDir(value, recursive);
            if (!ok) {
              appendLine(`mkdir: cannot create directory '${value}'`);
            }
          });
          break;
        }
        case "touch": {
          if (!arg) {
            appendLine(messages.touchMissing, theme.palette.terminalDim);
            break;
          }
          params.forEach((value) => createFile(value));
          break;
        }
        case "rm": {
          if (!params.length) {
            appendLine("rm: missing operand");
            break;
          }
          const recursive = hasFlag("r") || hasFlag("f");
          params.forEach((value) => {
            const node = findNode(fsRef.current, resolveArg(value));
            if (!node) {
              reportNoFile(value);
              return;
            }
            if (node.type === "dir" && !recursive) {
              appendLine(`rm: ${value}: is a directory`);
              return;
            }
            removeNode(value, recursive);
          });
          break;
        }
        case "rmdir": {
          if (!params.length) {
            appendLine("rmdir: missing operand");
            break;
          }
          params.forEach((value) => {
            const node = findNode(fsRef.current, resolveArg(value));
            if (!node || node.type !== "dir") {
              reportNoDir(value);
              return;
            }
            if (Object.keys(node.children).length > 0) {
              appendLine(`rmdir: ${value}: directory not empty`);
              return;
            }
            removeNode(value, true);
          });
          break;
        }
        case "cp": {
          if (params.length < 2) {
            appendLine("cp: missing file operand");
            break;
          }
          const dest = params[params.length - 1];
          const sources = params.slice(0, -1);
          sources.forEach((source) => {
            const sourceNode = findNode(fsRef.current, resolveArg(source));
            if (!sourceNode) {
              reportNoFile(source);
              return;
            }
            if (sourceNode.type === "dir" && !hasFlag("r")) {
              appendLine(`cp: ${source}: is a directory`);
              return;
            }
            const targetPath = resolveArg(dest);
            const destNode = findNode(fsRef.current, targetPath);
            if (destNode && destNode.type === "dir") {
              const name = source.split("/").filter(Boolean).pop() ?? source;
              const destFilePath = `${targetPath}/${name}`;
              if (sourceNode.type === "file") {
                writeFile(destFilePath, sourceNode.content, { create: true });
              } else {
                ensureDir(destFilePath, true);
                const parent = findNode(fsRef.current, destFilePath);
                if (parent && parent.type === "dir") {
                  parent.children = (
                    cloneNode(sourceNode) as {
                      type: "dir";
                      children: Record<string, FsNode>;
                    }
                  ).children;
                }
              }
              return;
            }
            if (sourceNode.type === "file") {
              writeFile(dest, sourceNode.content, { create: true });
            } else {
              ensureDir(dest, true);
              const destNodeDir = findNode(fsRef.current, targetPath);
              if (destNodeDir && destNodeDir.type === "dir") {
                destNodeDir.children = (
                  cloneNode(sourceNode) as {
                    type: "dir";
                    children: Record<string, FsNode>;
                  }
                ).children;
              }
            }
          });
          break;
        }
        case "mv": {
          if (params.length < 2) {
            appendLine("mv: missing file operand");
            break;
          }
          const dest = params[params.length - 1];
          const sources = params.slice(0, -1);
          sources.forEach((source) => {
            const sourceNode = findNode(fsRef.current, resolveArg(source));
            if (!sourceNode) {
              reportNoFile(source);
              return;
            }
            const targetPath = resolveArg(dest);
            const destNode = findNode(fsRef.current, targetPath);
            if (destNode && destNode.type === "dir") {
              const name = source.split("/").filter(Boolean).pop() ?? source;
              const destFilePath = `${targetPath}/${name}`;
              if (sourceNode.type === "file") {
                writeFile(destFilePath, sourceNode.content, { create: true });
              } else {
                ensureDir(destFilePath, true);
                const parent = findNode(fsRef.current, destFilePath);
                if (parent && parent.type === "dir") {
                  parent.children = (
                    cloneNode(sourceNode) as {
                      type: "dir";
                      children: Record<string, FsNode>;
                    }
                  ).children;
                }
              }
            } else if (sourceNode.type === "file") {
              writeFile(dest, sourceNode.content, { create: true });
            } else {
              ensureDir(dest, true);
              const destNodeDir = findNode(fsRef.current, targetPath);
              if (destNodeDir && destNodeDir.type === "dir") {
                destNodeDir.children = (
                  cloneNode(sourceNode) as {
                    type: "dir";
                    children: Record<string, FsNode>;
                  }
                ).children;
              }
            }
            removeNode(source, true);
          });
          break;
        }
        case "cat":
        case "less": {
          if (!params.length) {
            appendLine("cat: missing file operand");
            break;
          }
          params.forEach((value) => {
            const node = findNode(fsRef.current, resolveArg(value));
            if (!node || node.type !== "file") {
              reportNoFile(value);
              return;
            }
            node.content.split("\n").forEach((line) => appendLine(line));
          });
          break;
        }
        case "edit":
        case "nano": {
          if (!arg) {
            appendLine("edit: missing file");
            break;
          }
          const targetPath = resolveArg(arg);
          const node = findNode(fsRef.current, targetPath);
          if (node && node.type === "dir") {
            appendLine("edit: target is a directory");
            break;
          }
          if (!node) {
            writeFile(arg, "", { create: true });
          }
          const refreshed = findNode(fsRef.current, targetPath);
          const content =
            refreshed && refreshed.type === "file" ? refreshed.content : "";
          editorRef.current = {
            path: arg,
            buffer: content ? content.split("\n") : [],
          };
          appendLine(`-- EDIT ${arg} --`);
          appendLine("Type :wq to save, :q to quit.");
          if (content) {
            content.split("\n").forEach((line) => appendLine(line));
          }
          break;
        }
        case "head":
        case "tail": {
          if (!params.length) {
            appendLine(`${cmd}: missing file operand`);
            break;
          }
          const countArgIndex = args.findIndex((value) => value === "-n");
          const count =
            countArgIndex >= 0 && args[countArgIndex + 1]
              ? Number.parseInt(args[countArgIndex + 1], 10)
              : 10;
          const file = params[params.length - 1];
          const node = findNode(fsRef.current, resolveArg(file));
          if (!node || node.type !== "file") {
            reportNoFile(file);
            break;
          }
          const lines = node.content.split("\n");
          const slice =
            cmd === "head" ? lines.slice(0, count) : lines.slice(-count);
          slice.forEach((line) => appendLine(line));
          break;
        }
        case "tree": {
          const target = params[0] ?? ".";
          const node = findNode(fsRef.current, resolveArg(target));
          if (!node || node.type !== "dir") {
            reportNoDir(target);
            break;
          }
          const depthIndex = args.findIndex((value) => value === "-L");
          const maxDepth =
            depthIndex >= 0 && args[depthIndex + 1]
              ? Math.max(1, Number.parseInt(args[depthIndex + 1], 10))
              : 2;
          const walk = (current: FsNode, prefix: string, depth: number) => {
            if (current.type !== "dir") {
              return;
            }
            const entries = Object.keys(current.children).sort();
            entries.forEach((name, index) => {
              const connector = index === entries.length - 1 ? "└─" : "├─";
              appendLine(`${prefix}${connector} ${name}`);
              if (depth < maxDepth && current.children[name].type === "dir") {
                walk(
                  current.children[name],
                  `${prefix}${index === entries.length - 1 ? "  " : "│ "}`,
                  depth + 1,
                );
              }
            });
          };
          appendLine(target);
          walk(node, "", 1);
          break;
        }
        case "find": {
          const target = args[0]?.startsWith("-") ? "." : (args[0] ?? ".");
          const patternIndex = args.findIndex((value) => value === "-name");
          const needle =
            patternIndex >= 0
              ? (args[patternIndex + 1] ?? "")
              : (params[1] ?? "");
          const node = findNode(fsRef.current, resolveArg(target));
          if (!node || node.type !== "dir") {
            reportNoDir(target);
            break;
          }
          const results: string[] = [];
          const walk = (current: FsNode, path: string) => {
            if (current.type === "dir") {
              Object.entries(current.children).forEach(([name, child]) => {
                const nextPath = `${path}/${name}`.replace(/\/+/g, "/");
                if (!needle || nextPath.includes(needle)) {
                  results.push(nextPath);
                }
                walk(child, nextPath);
              });
            }
          };
          walk(node, resolveArg(target));
          results.slice(0, 120).forEach((line) => appendLine(line));
          if (results.length > 120) {
            appendLine(`... ${results.length - 120} more`);
          }
          break;
        }
        case "grep": {
          if (params.length < 2) {
            appendLine("grep: missing pattern or file");
            break;
          }
          const ignoreCase = hasFlag("i");
          const recursive = hasFlag("r");
          const pattern = params[0];
          const matcher = ignoreCase ? pattern.toLowerCase() : pattern;
          const target = params[1];
          const searchNode = (node: FsNode, path: string) => {
            if (node.type === "file") {
              const lines = node.content.split("\n");
              lines.forEach((line, index) => {
                const haystack = ignoreCase ? line.toLowerCase() : line;
                if (haystack.includes(matcher)) {
                  appendLine(`${path}:${index + 1}:${line}`);
                }
              });
            } else if (recursive) {
              Object.entries(node.children).forEach(([name, child]) => {
                searchNode(child, `${path}/${name}`.replace(/\/+/g, "/"));
              });
            }
          };
          const node = findNode(fsRef.current, resolveArg(target));
          if (!node) {
            reportNoFile(target);
            break;
          }
          searchNode(node, resolveArg(target));
          break;
        }
        case "which": {
          if (!params.length) {
            appendLine("which: missing command");
            break;
          }
          const commandName = params[0];
          if (
            Object.prototype.hasOwnProperty.call(aliasRef.current, commandName)
          ) {
            appendLine(
              `alias ${commandName}='${aliasRef.current[commandName]}'`,
            );
            break;
          }
          if (builtinCommands.includes(commandName)) {
            appendLine(`${commandName}: builtin`);
            break;
          }
          const pathEntries = (env.PATH ?? "").split(":");
          let found = "";
          pathEntries.forEach((entry) => {
            if (found) {
              return;
            }
            const candidate = `${entry}/${commandName}`.replace(/\/+/g, "/");
            const node = findNode(fsRef.current, candidate);
            if (node && node.type === "file") {
              found = candidate;
            }
          });
          if (found) {
            appendLine(found);
          } else {
            appendLine(`${commandName}: not found`);
          }
          break;
        }
        case "man": {
          const target = params[0];
          if (!target) {
            appendLine("man: missing topic");
            break;
          }
          const manuals: Record<string, string[]> = {
            ls: ["ls - list directory contents", "Usage: ls [-al] [path]"],
            cd: ["cd - change directory", "Usage: cd [path]"],
            cat: ["cat - print files", "Usage: cat <file>"],
            python: ["python - simulated runtime", "Usage: python <file.py>"],
            snake: ["snake - mini game (simulated)"],
            pacman: ["pacman - mini game (simulated)"],
          };
          const manual = manuals[target];
          if (manual) {
            manual.forEach((line) => appendLine(line));
          } else {
            appendLine(`No manual entry for ${target}`);
          }
          break;
        }
        case "python":
        case "python2": {
          if (hasFlag("V") || hasFlag("v")) {
            appendLine("Python 2.7.18");
            break;
          }
          if (!params.length) {
            appendLine("Python 2.7.18 (simulated)");
            appendLine('Type "exit()" to return.');
            break;
          }
          if (params[0] === "-c") {
            const code = params.slice(1).join(" ");
            if (!code) {
              appendLine("python: missing code after -c");
            } else {
              appendLine(">>> " + code);
              appendLine("... output suppressed");
            }
            break;
          }
          const scriptPath = params[0];
          const node = findNode(fsRef.current, resolveArg(scriptPath));
          if (!node || node.type !== "file") {
            appendLine(`python: can't open file '${scriptPath}'`);
            break;
          }
          const scriptName = scriptPath.split("/").pop() ?? scriptPath;
          if (scriptName === "calc.py") {
            appendLine("Launching calc...");
            startApp("calc");
          } else if (scriptName === "snake.py") {
            appendLine("Launching snake...");
            startApp("snake");
          } else if (scriptName === "pacman.py") {
            appendLine("Launching pacman...");
            startApp("pacman");
          } else {
            appendLine(`Running ${scriptName}...`);
            appendLine("Done.");
          }
          break;
        }
        case "calc": {
          const expr = params.join(" ");
          if (!expr) {
            appendLine("Launching calc...");
            startApp("calc");
            break;
          }
          if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
            appendLine("calc: invalid characters");
            break;
          }
          try {
            const result = evaluateExpression(expr);
            appendLine(String(result));
          } catch {
            appendLine("calc: error evaluating expression");
          }
          break;
        }
        case "snake":
          appendLine("Launching snake...");
          startApp("snake");
          break;
        case "pacman":
          appendLine("Launching pacman...");
          startApp("pacman");
          break;
        case "hello":
          appendLine(
            formatMessage(messages.hello, { name: profileName() }),
            theme.palette.terminalText,
          );
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
      cloneNode,
      builtinCommands,
      createDir,
      createFile,
      ensureDir,
      files,
      formatMessage,
      formatLsLong,
      homePath,
      language,
      listDir,
      messages.availableFiles,
      messages.commandNotFound,
      messages.fileNotFound,
      messages.hello,
      messages.help,
      messages.mkdirMissing,
      messages.noSuchDirectory,
      messages.tip,
      messages.touchMissing,
      printFile,
      profileName,
      removeNode,
      startApp,
      theme.palette.terminalDim,
      theme.palette.terminalText,
      writeFile,
    ],
  );

  const completeInput = useCallback(() => {
    const value = inputValueRef.current;
    const caret = selectionRef.current.end;
    if (caret !== value.length) {
      return;
    }
    const endsWithSpace = /\s$/.test(value);
    const tokens = tokenizeInput(value);
    if (endsWithSpace) {
      tokens.push("");
    }
    if (!tokens.length) {
      return;
    }
    const currentToken = tokens[tokens.length - 1] ?? "";
    const isFirst = tokens.length === 1;
    let suggestions: string[] = [];

    if (isFirst) {
      const commands = [...builtinCommands, ...Object.keys(aliasRef.current)];
      suggestions = commands.filter((cmd) => cmd.startsWith(currentToken));
    } else {
      const home = envRef.current.HOME || homePath;
      const expanded = currentToken.startsWith("~")
        ? `${home}${currentToken.slice(1)}`
        : currentToken;
      const slashIndex = expanded.lastIndexOf("/");
      const dirPart = slashIndex >= 0 ? expanded.slice(0, slashIndex + 1) : "";
      const base = expanded.slice(dirPart.length);
      const dirPath = dirPart
        ? resolvePath(cwdRef.current, dirPart, home)
        : cwdRef.current;
      const entries = listDir(dirPath, { all: base.startsWith(".") });
      if (entries) {
        suggestions = entries
          .filter((name) => name.startsWith(base))
          .map((name) => {
            const node = findNode(
              fsRef.current,
              `${dirPath}/${name}`.replace(/\/+/g, "/"),
            );
            const suffix = node && node.type === "dir" ? "/" : "";
            const combined = `${dirPart}${name}${suffix}`;
            return currentToken.startsWith("~")
              ? combined.replace(home, "~")
              : combined;
          });
      }
    }

    if (!suggestions.length) {
      return;
    }
    suggestions = Array.from(new Set(suggestions)).sort();
    if (suggestions.length === 1) {
      const replacement = suggestions[0];
      const prefix = value.slice(0, value.length - currentToken.length);
      syncInputValue(`${prefix}${replacement}`);
    } else {
      appendLine(suggestions.join(" "));
    }
    dirtyRef.current = true;
  }, [appendLine, builtinCommands, homePath, listDir, syncInputValue]);

  const drawTerminal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !textureRef.current) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const emitTextureEvent = (now: number) => {
      if (typeof window === "undefined") {
        return;
      }
      const throttleMs =
        perfTier === "low" ? 120 : isMobile || isFirefox ? 60 : 33;
      if (now - lastTextureEventRef.current < throttleMs) {
        return;
      }
      lastTextureEventRef.current = now;
      window.dispatchEvent(new Event("terminal-texture-updated"));
    };

    if (
      freezeTextureRef.current &&
      bootReadyRef.current &&
      hasTerminalContentRef.current
    ) {
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
        emitTextureEvent(now);
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
    if (!hasTerminalContentRef.current) {
      hasTerminalContentRef.current =
        lines.length > 0 || inputValueRef.current.length > 0;
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.palette.terminalBg;
    ctx.fillRect(0, 0, width, height);

    const gradientCache = gradientCacheRef.current;
    if (gradientCache.width !== width || gradientCache.height !== height) {
      gradientCache.width = width;
      gradientCache.height = height;
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
      gradientCache.vignette = vignette;

      const glass = ctx.createLinearGradient(0, 0, width, height);
      glass.addColorStop(0, "rgba(255,255,255,0.04)");
      glass.addColorStop(0.5, "rgba(255,255,255,0)");
      glass.addColorStop(1, "rgba(255,255,255,0.06)");
      gradientCache.glass = glass;
    }

    if (gradientCache.vignette) {
      ctx.fillStyle = gradientCache.vignette;
      ctx.fillRect(0, 0, width, height);
    }

    const finalizeFrame = () => {
      if (perfTier !== "low" && theme.crt.scanlineOpacity > 0.001) {
        ctx.globalAlpha = clamp(theme.crt.scanlineOpacity, 0, 0.25);
        ctx.fillStyle = "#000";
        const step = isMobile ? 6 : 4;
        for (let y = padding; y < height - padding; y += step) {
          ctx.fillRect(0, y, width, 1);
        }
        ctx.globalAlpha = 1;
      }

      if (!isMobile && perfTier !== "low" && theme.crt.noiseOpacity > 0.001) {
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

      if (perfTier !== "low" && gradientCache.glass) {
        ctx.fillStyle = gradientCache.glass;
        ctx.fillRect(0, 0, width, height);
      }

      const texture = textureRef.current;
      if (!texture) {
        dirtyRef.current = false;
        return;
      }
      texture.needsUpdate = true;
      textureUpdateRef.current = texture.needsUpdate;
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

      if (
        pendingFreezeRef.current &&
        bootReadyRef.current &&
        hasTerminalContentRef.current
      ) {
        freezeTextureRef.current = true;
        pendingFreezeRef.current = false;
      }

      const now = typeof performance !== "undefined" ? performance.now() : 0;
      emitTextureEvent(now);
    };

    const mode = appModeRef.current;
    if (mode) {
      const accent = theme.palette.terminalText;
      const dim = theme.palette.terminalDim;
      const headerSize = Math.max(12, Math.floor(fontSize * 1.1));
      ctx.font = `${headerSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.textBaseline = "top";

      if (mode === "calc") {
        const pad = Math.floor(Math.min(width, height) * 0.12);
        const boxW = width - pad * 2;
        const boxH = height - pad * 2;
        ctx.strokeStyle = dim;
        ctx.lineWidth = 2;
        ctx.strokeRect(pad, pad, boxW, boxH);
        ctx.fillStyle = accent;
        ctx.fillText("CALC", pad + 12, pad + 8);
        const displaySize = Math.max(16, Math.floor(fontSize * 1.6));
        ctx.font = `${displaySize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        const inputText = calcInputRef.current || "0";
        ctx.fillText(inputText.slice(-24), pad + 12, pad + 46);
        ctx.font = `${headerSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        if (calcResultRef.current) {
          ctx.fillStyle = accent;
          ctx.fillText(`= ${calcResultRef.current}`, pad + 12, pad + 90);
        } else if (calcErrorRef.current) {
          ctx.fillStyle = "#d6735b";
          ctx.fillText(calcErrorRef.current, pad + 12, pad + 90);
        }
        ctx.fillStyle = dim;
        ctx.fillText(
          "Enter: run  C: clear  Q: quit",
          pad + 12,
          height - pad - 24,
        );
      } else {
        const grid =
          mode === "snake"
            ? snakeGridRef.current
            : {
                cols: pacmanGridRef.current[0]?.length ?? 24,
                rows: pacmanGridRef.current.length ?? 16,
              };
        const { cols, rows } = grid;
        const cellSize = Math.floor(
          Math.min((width - padding * 2) / cols, (height - padding * 2) / rows),
        );
        const boardW = cols * cellSize;
        const boardH = rows * cellSize;
        const offsetX = Math.floor((width - boardW) / 2);
        const offsetY = Math.floor((height - boardH) / 2);
        ctx.strokeStyle = dim;
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX - 1, offsetY - 1, boardW + 2, boardH + 2);

        if (mode === "snake") {
          ctx.fillStyle = accent;
          ctx.fillText(
            `SNAKE  SCORE ${snakeScoreRef.current}`,
            offsetX,
            offsetY - 24,
          );
          const body = snakeBodyRef.current;
          body.forEach((part, index) => {
            ctx.fillStyle = index === body.length - 1 ? "#f6c27a" : accent;
            ctx.fillRect(
              offsetX + part.x * cellSize,
              offsetY + part.y * cellSize,
              cellSize,
              cellSize,
            );
          });
          const food = snakeFoodRef.current;
          if (food) {
            ctx.fillStyle = "#d6735b";
            ctx.fillRect(
              offsetX + food.x * cellSize + 2,
              offsetY + food.y * cellSize + 2,
              cellSize - 4,
              cellSize - 4,
            );
          }
          if (!snakeAliveRef.current) {
            ctx.fillStyle = "#d6735b";
            ctx.fillText(
              "GAME OVER  R: restart  Q: quit",
              offsetX,
              offsetY + boardH + 12,
            );
          } else {
            ctx.fillStyle = dim;
            ctx.fillText("R: restart  Q: quit", offsetX, offsetY + boardH + 12);
          }
        } else {
          ctx.fillStyle = accent;
          ctx.fillText(
            `PACMAN  SCORE ${pacmanScoreRef.current}`,
            offsetX,
            offsetY - 24,
          );
          const gridCells = pacmanGridRef.current;
          for (let y = 0; y < gridCells.length; y += 1) {
            for (let x = 0; x < gridCells[y].length; x += 1) {
              const cell = gridCells[y][x];
              if (cell === 1) {
                ctx.fillStyle = dim;
                ctx.fillRect(
                  offsetX + x * cellSize,
                  offsetY + y * cellSize,
                  cellSize,
                  cellSize,
                );
              } else if (cell === 2) {
                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.arc(
                  offsetX + x * cellSize + cellSize / 2,
                  offsetY + y * cellSize + cellSize / 2,
                  Math.max(1, cellSize * 0.12),
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
              }
            }
          }
          const pos = pacmanPosRef.current;
          ctx.fillStyle = "#f4d35e";
          ctx.beginPath();
          ctx.arc(
            offsetX + pos.x * cellSize + cellSize / 2,
            offsetY + pos.y * cellSize + cellSize / 2,
            cellSize * 0.42,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          if (pacmanWonRef.current) {
            ctx.fillStyle = "#6fd68d";
            ctx.fillText(
              "YOU WIN!  R: restart  Q: quit",
              offsetX,
              offsetY + boardH + 12,
            );
          } else {
            ctx.fillStyle = dim;
            ctx.fillText("R: restart  Q: quit", offsetX, offsetY + boardH + 12);
          }
        }
      }

      finalizeFrame();
      return;
    }

    ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textBaseline = "top";

    const maxLineWidth = Math.max(1, width - padding * 2);
    const charWidth = Math.max(1, ctx.measureText("M").width || 1);
    const maxChars = Math.max(1, Math.floor(maxLineWidth / charWidth));
    const wrapLine = (text: string) => {
      if (!text) {
        return [{ text: "", start: 0, end: 0 }];
      }
      const segments: { text: string; start: number; end: number }[] = [];
      let cursor = 0;
      while (cursor < text.length) {
        let sliceEnd = Math.min(cursor + maxChars, text.length);
        if (sliceEnd < text.length) {
          const lastSpace = text.lastIndexOf(" ", sliceEnd - 1);
          if (lastSpace > cursor) {
            sliceEnd = lastSpace;
          }
        }
        segments.push({
          text: text.slice(cursor, sliceEnd),
          start: cursor,
          end: sliceEnd,
        });
        cursor = sliceEnd;
        while (text[cursor] === " ") {
          cursor += 1;
        }
      }
      return segments;
    };

    const wrappedOutput: Line[] = [];
    lines.forEach((line) => {
      wrapLine(line.text).forEach((wrappedLine) => {
        wrappedOutput.push({ text: wrappedLine.text, color: line.color });
      });
    });

    const displayCwd =
      cwdRef.current === homePath
        ? "~"
        : cwdRef.current.startsWith(`${homePath}/`)
          ? `~${cwdRef.current.slice(homePath.length)}`
          : cwdRef.current;
    const promptPrefix = `${prompt.replace("~", displayCwd)} `;
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

    const glow =
      perfTier === "low"
        ? 0
        : isMobile || isFirefox
          ? theme.crt.glow * 0.35
          : theme.crt.glow;
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
        const x = padding + before.length * charWidth;
        const w = Math.max(2, selectedText.length * charWidth);
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
        const x = padding + before.length * charWidth;
        const caretWidth = Math.max(2, Math.floor(fontSize * 0.55));
        const caretY = y - Math.max(1, Math.floor(lineHeight * 0.12));
        ctx.fillStyle = theme.palette.terminalText;
        ctx.fillRect(x, caretY, caretWidth, lineHeight - 4);
        caretDrawn = true;
      }
    });

    finalizeFrame();
  }, [
    cursorVisible,
    fontScale,
    homePath,
    isFirefox,
    isMobile,
    perfTier,
    prompt,
    theme.crt.glow,
    theme.crt.noiseOpacity,
    theme.crt.scanlineOpacity,
    theme.palette.terminalBg,
    theme.palette.terminalDim,
    theme.palette.terminalText,
  ]);

  useEffect(() => {
    if (!ready || !isActive) {
      return;
    }
    const rafId = window.requestAnimationFrame(() => {
      drawTerminal();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [drawTerminal, isActive, ready]);

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

  const handleAppKey = useCallback(
    (event: {
      key: string;
      ctrlKey: boolean;
      metaKey: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
      preventDefault: () => void;
    }) => {
      const mode = appModeRef.current;
      if (!mode) {
        return false;
      }
      const { key } = event;
      const lower = key.toLowerCase();
      if (key === "Escape" || lower === "q") {
        stopApp("-- EXIT --");
        event.preventDefault();
        return true;
      }
      if (lower === "r") {
        if (mode === "snake") {
          resetSnake();
          placeSnakeFood();
        } else if (mode === "pacman") {
          resetPacman();
        } else if (mode === "calc") {
          resetCalc();
        }
        event.preventDefault();
        return true;
      }

      if (mode === "calc") {
        if (key === "Enter" || key === "=") {
          const expr = calcInputRef.current.trim();
          if (!expr) {
            calcResultRef.current = "0";
            calcErrorRef.current = null;
          } else if (!/^[0-9+\-*/().\s]+$/.test(expr)) {
            calcErrorRef.current = "Invalid";
          } else {
            try {
              calcResultRef.current = String(evaluateExpression(expr));
              calcErrorRef.current = null;
            } catch {
              calcErrorRef.current = "Error";
            }
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "Backspace") {
          calcInputRef.current = calcInputRef.current.slice(0, -1);
          calcErrorRef.current = null;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (lower === "c") {
          resetCalc();
          event.preventDefault();
          return true;
        }
        if (key.length === 1 && /[0-9+\-*/().\s]/.test(key)) {
          calcInputRef.current += key;
          calcErrorRef.current = null;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        event.preventDefault();
        return true;
      }

      if (mode === "snake" || mode === "pacman") {
        const dirMap: Record<string, GridPoint> = {
          ArrowUp: { x: 0, y: -1 },
          ArrowDown: { x: 0, y: 1 },
          ArrowLeft: { x: -1, y: 0 },
          ArrowRight: { x: 1, y: 0 },
          w: { x: 0, y: -1 },
          s: { x: 0, y: 1 },
          a: { x: -1, y: 0 },
          d: { x: 1, y: 0 },
        };
        const next = dirMap[key] ?? dirMap[lower];
        if (next) {
          if (mode === "snake") {
            snakeNextDirRef.current = next;
          } else {
            pacmanNextDirRef.current = next;
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        event.preventDefault();
        return true;
      }
      return false;
    },
    [placeSnakeFood, resetCalc, resetPacman, resetSnake, stopApp],
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
      if (handleAppKey(event)) {
        return;
      }
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

      if (event.key === "Tab") {
        completeInput();
        event.preventDefault();
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
        const inputLine = inputValueRef.current;
        if (editorRef.current) {
          appendLine(inputLine);
          const { buffer, path } = editorRef.current;
          const trimmed = inputLine.trim();
          if (trimmed === ":q") {
            editorRef.current = null;
            appendLine("-- EXIT --");
          } else if (trimmed === ":wq") {
            writeFile(path, buffer.join("\n"), {
              create: true,
            });
            editorRef.current = null;
            appendLine("-- SAVED --");
          } else if (trimmed === ":w") {
            writeFile(path, buffer.join("\n"), {
              create: true,
            });
            appendLine("-- SAVED --");
          } else {
            buffer.push(inputLine);
          }
          syncInputValue("");
          dirtyRef.current = true;
          event.preventDefault();
          return;
        }
        const command = inputLine.trim();
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
      completeInput,
      focusInput,
      handleAppKey,
      handleSelectionUpdate,
      onFocusChangeAction,
      prompt,
      replaceSelection,
      runCommand,
      setSelectionRange,
      syncInputValue,
      terminalApi,
      theme.palette.terminalText,
      writeFile,
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
    if (
      !interactionActiveRef.current &&
      (freezeTextureRef.current || pendingFreezeRef.current)
    ) {
      freezeTextureRef.current = false;
      pendingFreezeRef.current = false;
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
      if (!isActiveRef.current) {
        return;
      }
      if (
        handleAppKey({
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          preventDefault: () => event.preventDefault(),
        })
      ) {
        return;
      }
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

      if (event.key === "Tab") {
        completeInput();
        event.preventDefault();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const inputLine = input.value;
        if (editorRef.current) {
          appendLine(inputLine);
          const { buffer, path } = editorRef.current;
          const trimmed = inputLine.trim();
          if (trimmed === ":q") {
            editorRef.current = null;
            appendLine("-- EXIT --");
          } else if (trimmed === ":wq") {
            writeFile(path, buffer.join("\n"), {
              create: true,
            });
            editorRef.current = null;
            appendLine("-- SAVED --");
          } else if (trimmed === ":w") {
            writeFile(path, buffer.join("\n"), {
              create: true,
            });
            appendLine("-- SAVED --");
          } else {
            buffer.push(inputLine);
          }
          syncInputValue("");
          dirtyRef.current = true;
          return;
        }
        const command = inputLine.trim();
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
      completeInput,
      handleAppKey,
      handleKeyAction,
      prompt,
      runCommand,
      syncInputValue,
      theme.palette.terminalText,
      writeFile,
    ],
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!isActiveRef.current) {
        return;
      }
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
    if (!isActive) {
      return;
    }
    let rafId = 0;
    const drawLoop = () => {
      const now = performance.now();
      const targetInterval = focusedRef.current
        ? isFirefox
          ? 90
          : 33
        : isMobile || isFirefox || perfTier === "low"
          ? 170
          : perfTier === "high"
            ? 110
            : 130;
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
  }, [drawTerminal, isActive, isFirefox, isMobile, perfTier]);

  useEffect(() => {
    if (!onDebugAction || !isActive) {
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
  }, [canvasSize, isActive, onDebugAction]);

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
