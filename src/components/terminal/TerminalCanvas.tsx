"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
} from "react";
import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import { languageMeta, type Language } from "@/lib/i18n";

export type TerminalFile = {
  path: string;
  content?: string;
  section?: string;
  type?: "file" | "dir";
};

export type TerminalDebugInfo = {
  canvasSize: number;
  lastDrawMs: number;
  textureNeedsUpdate: boolean;
  terminalFocus: boolean;
  lastCommand: string | null;
  lastOutputLines: string[];
};

export type TerminalApi = {
  focus: () => void;
  focusInput: () => void;
  blur: () => void;
  isFocused: () => boolean;
  readonly texture: CanvasTexture;
};

type EditorState = {
  path: string;
  buffer: string[];
  showLineNumbers: boolean;
  modified: boolean;
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
    system: {
      exit: string;
      exitLine: string;
      historyCleared: string;
      noOutput: string;
    };
    pip: {
      help: string;
      missingPackage: string;
      installed: string;
      uninstalled: string;
      packageNotFound: string;
      unknownCommand: string;
    };
    editor: {
      header: string;
      editing: string;
      saveFailed: string;
      unsavedChanges: string;
      exit: string;
      saved: string;
      savedAs: string;
      lineNumbersOn: string;
      lineNumbersOff: string;
      usageSet: string;
      help: string;
      invalidLineNumber: string;
      lineDeleted: string;
      lineInserted: string;
      unknownCommand: string;
      lineUpdated: string;
      lineAdded: string;
      missingFile: string;
      targetIsDirectory: string;
    };
    commands: {
      echoMissingFile: string;
      mkdirCannotCreate: string;
      rmMissingOperand: string;
      rmIsDirectory: string;
      rmdirMissingOperand: string;
      rmdirNotEmpty: string;
      cpMissingOperand: string;
      cpIsDirectory: string;
      mvMissingOperand: string;
      catMissingOperand: string;
      headMissingOperand: string;
      grepMissing: string;
      whichMissing: string;
      whichBuiltin: string;
      whichNotFound: string;
      manMissingTopic: string;
      manNoEntry: string;
    };
    python: {
      version: string;
      usage: string;
      missingCode: string;
      loading: string;
      error: string;
      cantOpen: string;
    };
    media: {
      mp3NoMedia: string;
      videoNoMedia: string;
      imageNoMedia: string;
      imageUnsupported: string;
      imageLoading: string;
      imageLoadError: string;
      playbackComplete: string;
      playing: string;
      paused: string;
      loadingImage: string;
      unableToLoadImage: string;
      noImagesFound: string;
    };
    calc: {
      launch: string;
      invalidChars: string;
      evalError: string;
      invalid: string;
      error: string;
    };
    apps: {
      launchSnake: string;
      launchPacman: string;
      launchPong: string;
      launchChess: string;
      launchSolitaire: string;
      modeStatus: string;
    };
    chess: {
      selectPiece: string;
      promotePawn: string;
      noPieceSelected: string;
      notYourTurn: string;
      illegalMove: string;
      checkmate: string;
      stalemate: string;
      check: string;
      botThinking: string;
      difficulty: string;
      modeBot: string;
      modePvp: string;
      modeLabelBot: string;
      modeLabelPvp: string;
      colorWhite: string;
      colorBlack: string;
      botColor: string;
      header: string;
      promoteOptions: string;
    };
    solitaire: {
      hint: string;
      stockRecycled: string;
      noCardsLeft: string;
      wasteEmpty: string;
      selectedWaste: string;
      selectCardFirst: string;
      cannotMoveFoundation: string;
      drawCard: string;
      placedCard: string;
      emptyPile: string;
      flippedCard: string;
      selectedPile: string;
      cannotStack: string;
      movedCard: string;
    };
    ui: {
      player: string;
      playerControlsMedia: string;
      playerControlsImage: string;
      sciCalc: string;
      calcControls: string;
      retroFps: string;
      chessControls: string;
      chessMeta: string;
      solitaireTitle: string;
      solitaireControls: string;
      solitaireStock: string;
      solitaireWaste: string;
      snakeHeader: string;
      snakeWin: string;
      snakeGameOver: string;
      snakeControls: string;
      pacmanHeader: string;
      pacmanWin: string;
      pacmanGameOver: string;
      pacmanControls: string;
      pongHeader: string;
      pongControls: string;
      pongGameOver: string;
    };
  };
  theme: Theme;
  isMobile: boolean;
  isActive?: boolean;
  screenAspect?: number;
  fontScale?: number;
  scrollProgressRef?: MutableRefObject<number>;
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

type AppMode =
  | "snake"
  | "pacman"
  | "calc"
  | "pong"
  | "chess"
  | "solitaire"
  | "player"
  | "doom";

type FsNode =
  | { type: "dir"; children: Record<string, FsNode> }
  | { type: "file"; content: string; section?: string };

type GridPoint = { x: number; y: number };
type Vector2 = { x: number; y: number };
type SolitaireCard = { rank: string; suit: string; faceUp: boolean };
type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  runPython: (code: string) => unknown;
  globals: { set: (name: string, value: unknown) => void };
};

const SOLITAIRE_RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const SOLITAIRE_SUITS = ["♠", "♥", "♦", "♣"] as const;
const CALC_BUTTONS: string[][] = [
  ["7", "8", "9", "/", "C"],
  ["4", "5", "6", "*", "("],
  ["1", "2", "3", "-", ")"],
  ["0", ".", "+", "^", "="],
  ["sin", "cos", "tan", "sqrt", "log"],
  ["ln", "pow", "pi", "e", "←"],
];

declare global {
  interface Window {
    loadPyodide?: (options?: {
      indexURL?: string;
    }) => Promise<PyodideInterface>;
  }
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

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

const evaluateScientificExpression = (expression: string) => {
  const input = expression.replace(/\s+/g, "");
  if (!input) {
    return 0;
  }
  const tokens: {
    type: "number" | "op" | "paren" | "comma" | "ident";
    value: string;
  }[] = [];
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (/[0-9.]/.test(char)) {
      let value = char;
      while (i + 1 < input.length && /[0-9.]/.test(input[i + 1])) {
        value += input[i + 1];
        i += 1;
      }
      tokens.push({ type: "number", value });
      continue;
    }
    if (/[a-zA-Z]/.test(char)) {
      let value = char;
      while (i + 1 < input.length && /[a-zA-Z0-9_]/.test(input[i + 1])) {
        value += input[i + 1];
        i += 1;
      }
      tokens.push({ type: "ident", value });
      continue;
    }
    if ("+-*/^".includes(char)) {
      tokens.push({ type: "op", value: char });
      continue;
    }
    if (char === "(") {
      tokens.push({ type: "paren", value: char });
      continue;
    }
    if (char === ")") {
      tokens.push({ type: "paren", value: char });
      continue;
    }
    if (char === ",") {
      tokens.push({ type: "comma", value: char });
      continue;
    }
    throw new Error("invalid");
  }

  const constants: Record<string, number> = {
    pi: Math.PI,
    e: Math.E,
  };
  const functions = new Set([
    "sin",
    "cos",
    "tan",
    "asin",
    "acos",
    "atan",
    "sqrt",
    "log",
    "ln",
    "abs",
    "exp",
    "pow",
    "min",
    "max",
  ]);
  const precedence: Record<string, number> = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2,
    "^": 3,
    "u-": 4,
  };
  const rightAssoc = new Set(["^", "u-"]);

  const output: Array<
    | { type: "number"; value: number }
    | { type: "op"; value: string }
    | { type: "func"; value: string }
  > = [];
  const ops: Array<
    | { type: "op"; value: string }
    | { type: "func"; value: string }
    | { type: "paren"; value: "(" }
  > = [];

  let prev: "start" | "op" | "paren" | "comma" | "value" = "start";

  tokens.forEach((token, index) => {
    if (token.type === "number") {
      const num = Number(token.value);
      if (Number.isNaN(num)) {
        throw new Error("invalid");
      }
      output.push({ type: "number", value: num });
      prev = "value";
      return;
    }
    if (token.type === "ident") {
      const name = token.value.toLowerCase();
      const next = tokens[index + 1];
      if (next?.type === "paren" && next.value === "(") {
        if (!functions.has(name)) {
          throw new Error("invalid");
        }
        ops.push({ type: "func", value: name });
        prev = "op";
        return;
      }
      if (Object.prototype.hasOwnProperty.call(constants, name)) {
        output.push({ type: "number", value: constants[name] });
        prev = "value";
        return;
      }
      throw new Error("invalid");
    }
    if (token.type === "comma") {
      while (ops.length && ops[ops.length - 1].type !== "paren") {
        const top = ops.pop() as { type: "op" | "func"; value: string };
        if (top.type === "op" || top.type === "func") {
          output.push(top);
        }
      }
      if (!ops.length) {
        throw new Error("invalid");
      }
      prev = "comma";
      return;
    }
    if (token.type === "paren") {
      if (token.value === "(") {
        ops.push({ type: "paren", value: "(" });
        prev = "paren";
        return;
      }
      while (ops.length && ops[ops.length - 1].type !== "paren") {
        const top = ops.pop() as { type: "op" | "func"; value: string };
        if (top.type === "op" || top.type === "func") {
          output.push(top);
        }
      }
      if (!ops.length) {
        throw new Error("invalid");
      }
      ops.pop();
      if (ops.length && ops[ops.length - 1].type === "func") {
        output.push(ops.pop() as { type: "func"; value: string });
      }
      prev = "value";
      return;
    }
    if (token.type === "op") {
      let op = token.value;
      if (
        op === "-" &&
        (prev === "start" ||
          prev === "op" ||
          prev === "paren" ||
          prev === "comma")
      ) {
        op = "u-";
      }
      while (ops.length && ops[ops.length - 1].type === "op") {
        const top = ops[ops.length - 1] as { type: "op"; value: string };
        const topPrec = precedence[top.value];
        const nextPrec = precedence[op];
        if (
          topPrec > nextPrec ||
          (topPrec === nextPrec && !rightAssoc.has(op))
        ) {
          output.push(ops.pop() as { type: "op"; value: string });
          continue;
        }
        break;
      }
      ops.push({ type: "op", value: op });
      prev = "op";
    }
  });

  while (ops.length) {
    const top = ops.pop() as { type: "op" | "func" | "paren"; value: string };
    if (top.type === "paren") {
      throw new Error("invalid");
    }
    const safeTop = top as { type: "op" | "func"; value: string };
    output.push(safeTop);
  }

  const stack: number[] = [];
  output.forEach((token) => {
    if (token.type === "number") {
      stack.push(token.value);
      return;
    }
    if (token.type === "op") {
      if (token.value === "u-") {
        const value = stack.pop();
        if (value === undefined) {
          throw new Error("invalid");
        }
        stack.push(-value);
        return;
      }
      const right = stack.pop();
      const left = stack.pop();
      if (left === undefined || right === undefined) {
        throw new Error("invalid");
      }
      switch (token.value) {
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
        case "^":
          stack.push(Math.pow(left, right));
          break;
        default:
          throw new Error("invalid");
      }
      return;
    }
    if (token.type === "func") {
      const name = token.value;
      const unary = () => {
        const value = stack.pop();
        if (value === undefined) {
          throw new Error("invalid");
        }
        return value;
      };
      const binary = () => {
        const right = stack.pop();
        const left = stack.pop();
        if (left === undefined || right === undefined) {
          throw new Error("invalid");
        }
        return { left, right };
      };
      switch (name) {
        case "sin":
          stack.push(Math.sin(unary()));
          break;
        case "cos":
          stack.push(Math.cos(unary()));
          break;
        case "tan":
          stack.push(Math.tan(unary()));
          break;
        case "asin":
          stack.push(Math.asin(unary()));
          break;
        case "acos":
          stack.push(Math.acos(unary()));
          break;
        case "atan":
          stack.push(Math.atan(unary()));
          break;
        case "sqrt":
          stack.push(Math.sqrt(unary()));
          break;
        case "log": {
          const value = unary();
          const log10 = Math.log10
            ? Math.log10(value)
            : Math.log(value) / Math.LN10;
          stack.push(log10);
          break;
        }
        case "ln":
          stack.push(Math.log(unary()));
          break;
        case "abs":
          stack.push(Math.abs(unary()));
          break;
        case "exp":
          stack.push(Math.exp(unary()));
          break;
        case "pow": {
          const { left, right } = binary();
          stack.push(Math.pow(left, right));
          break;
        }
        case "min": {
          const { left, right } = binary();
          stack.push(Math.min(left, right));
          break;
        }
        case "max": {
          const { left, right } = binary();
          stack.push(Math.max(left, right));
          break;
        }
        default:
          throw new Error("invalid");
      }
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
  scrollProgressRef,
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
      "pip",
      "calc",
      "snake",
      "pacman",
      "pong",
      "chess",
      "solitaire",
      "mp3",
      "video",
      "image",
      "doom",
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
    LANG: languageMeta[language].envLang,
    PATH: "/usr/local/bin:/usr/bin:/bin",
    TERM: "kinin-term",
  });
  const aliasRef = useRef<Record<string, string>>({
    ll: "ls -al",
    la: "ls -a",
    l: "ls",
  });
  const editorRef = useRef<EditorState | null>(null);
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
  const snakeWonRef = useRef(false);
  const snakeScoreRef = useRef(0);
  const snakeGridRef = useRef({ cols: 24, rows: 16 });
  const pacmanGridRef = useRef<number[][]>([]);
  const pacmanPosRef = useRef<GridPoint>({ x: 1, y: 1 });
  const pacmanDirRef = useRef<GridPoint>({ x: 1, y: 0 });
  const pacmanNextDirRef = useRef<GridPoint>({ x: 1, y: 0 });
  const pacmanGhostsRef = useRef<
    Array<{
      pos: GridPoint;
      dir: GridPoint;
      home: GridPoint;
      scared: number;
      color: string;
      style: "chase" | "ambush" | "random";
    }>
  >([]);
  const pacmanScoreRef = useRef(0);
  const pacmanPelletsRef = useRef(0);
  const pacmanWonRef = useRef(false);
  const pacmanGameOverRef = useRef(false);
  const pacmanPowerRef = useRef(0);
  const pacmanScatterRef = useRef(0);
  const calcInputRef = useRef("");
  const calcResultRef = useRef<string | null>(null);
  const calcErrorRef = useRef<string | null>(null);
  const calcCursorRef = useRef({ row: 0, col: 0 });
  const pongGridRef = useRef({ cols: 28, rows: 18 });
  const pongBallRef = useRef<Vector2>({ x: 0, y: 0 });
  const pongVelRef = useRef<Vector2>({ x: 1, y: 1 });
  const pongPaddleRef = useRef(0);
  const pongAiRef = useRef(0);
  const pongScoreRef = useRef({ player: 0, ai: 0 });
  const pongLivesRef = useRef(3);
  const pongOverRef = useRef(false);
  const doomMapRef = useRef<number[][]>([]);
  const doomPlayerRef = useRef({ x: 2.5, y: 2.5, angle: 0 });
  const doomImpulseRef = useRef({ move: 0, strafe: 0, turn: 0 });
  const doomFlashRef = useRef(0);
  const doomMessageRef = useRef<string | null>(null);
  const doomEnemiesRef = useRef<
    Array<{ x: number; y: number; hp: number; cooldown: number }>
  >([]);
  const doomPickupsRef = useRef<
    Array<{
      x: number;
      y: number;
      type: "ammo" | "med" | "shield" | "bomb" | "chest";
    }>
  >([]);
  const doomPropsRef = useRef<
    Array<{ x: number; y: number; type: "pillar" | "crate" | "torch" }>
  >([]);
  const doomAmmoRef = useRef(24);
  const doomHealthRef = useRef(100);
  const doomShieldRef = useRef(60);
  const doomBombsRef = useRef(2);
  const doomScoreRef = useRef(0);
  const doomCooldownRef = useRef(0);
  const doomGameOverRef = useRef(false);
  const doomMiniMapRef = useRef(true);
  const doomBobRef = useRef(0);
  const doomBootRef = useRef<{ start: number; duration: number } | null>(null);
  const chessBoardRef = useRef<string[][]>([]);
  const chessCursorRef = useRef<GridPoint>({ x: 0, y: 7 });
  const chessSelectedRef = useRef<GridPoint | null>(null);
  const chessTurnRef = useRef<"w" | "b">("w");
  const chessMovesRef = useRef(0);
  const chessStatusRef = useRef<string | null>(null);
  const chessModeRef = useRef<"pvp" | "bot">("pvp");
  const chessBotColorRef = useRef<"w" | "b">("b");
  const chessDifficultyRef = useRef<"easy" | "medium" | "hard">("medium");
  const chessBotThinkingRef = useRef(false);
  const chessCastlingRef = useRef({ wK: true, wQ: true, bK: true, bQ: true });
  const chessEnPassantRef = useRef<GridPoint | null>(null);
  const chessPendingPromotionRef = useRef<{
    x: number;
    y: number;
    color: "w" | "b";
    nextTurn: "w" | "b";
  } | null>(null);
  const chessPromotionChoiceRef = useRef(0);
  const solitaireStockRef = useRef<SolitaireCard[]>([]);
  const solitaireWasteRef = useRef<SolitaireCard[]>([]);
  const solitaireFoundationsRef = useRef<Record<string, SolitaireCard[]>>({
    "♠": [],
    "♥": [],
    "♦": [],
    "♣": [],
  });
  const solitaireTableauRef = useRef<SolitaireCard[][]>([]);
  const solitaireSelectionRef = useRef<
    { type: "waste" } | { type: "tableau"; index: number } | null
  >(null);
  const solitaireMessageRef = useRef<string | null>(null);
  const playerModeRef = useRef<"mp3" | "video" | "image" | null>(null);
  const playerFramesRef = useRef<string[]>([]);
  const playerFrameIndexRef = useRef(0);
  const playerTitleRef = useRef("");
  const playerProgressRef = useRef(0);
  const playerDurationRef = useRef(180);
  const playerIsPlayingRef = useRef(false);
  const playerBarsRef = useRef<number[][]>([]);
  const playerStatusRef = useRef<string | null>(null);
  const playerImageListRef = useRef<string[]>([]);
  const playerImageIndexRef = useRef(0);
  const playerImageZoomRef = useRef(1);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioMasterRef = useRef<GainNode | null>(null);
  const audioFilterRef = useRef<BiquadFilterNode | null>(null);
  const audioDriveRef = useRef<WaveShaperNode | null>(null);
  const audioPulseRef = useRef<OscillatorNode | null>(null);
  const audioPulseGainRef = useRef<GainNode | null>(null);
  const audioOscillatorsRef = useRef<OscillatorNode[]>([]);
  const audioLfoRef = useRef<OscillatorNode | null>(null);
  const audioLfoGainRef = useRef<GainNode | null>(null);
  const audioVolumeRef = useRef(0);
  const audioTargetRef = useRef(0);
  const audioTimerRef = useRef<number | null>(null);
  const audioLastTickRef = useRef(0);
  const audioAutoPausedRef = useRef(false);
  const pyodideRef = useRef<PyodideInterface | null>(null);
  const pyodideLoadingRef = useRef<Promise<PyodideInterface> | null>(null);
  const pipPackagesRef = useRef<string[]>(["pip", "setuptools", "wheel"]);
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

  const doomText = useCallback(
    (key: string) => {
      const dict = {
        tr: {
          ready: "HAZIR",
          noAmmo: "MERMİ YOK",
          fire: "ATEŞ!",
          targetDown: "HEDEF İNDİ",
          hit: "İSABET",
          noBombs: "BOMBA YOK",
          boom: "PATLAMA",
          doorOpen: "KAPI AÇILDI",
          noDoor: "KAPI YOK",
          ammoPlus: "MERMİ +",
          healthPlus: "CAN +",
          shieldPlus: "KALKAN +",
          bombPlus: "BOMBA +",
          chest: "SANDIK!",
          damage: "HASAR!",
          died: "ÖLDÜN",
          clear: "TEMİZ",
          launch: "Retro FPS başlatılıyor...",
          loading: "YÜKLENİYOR...",
          hudLabel: "CAN",
          shieldLabel: "KALKAN",
          ammoLabel: "MERMİ",
          bombLabel: "BOMBA",
          scoreLabel: "SKOR",
          controls1: "W/S: hareket  A/D: kay  ←/→: dön  Boşluk: ateş",
          controls2: "B: bomba  E: kapı  M: harita  R: reset  Q: çıkış",
          gameOver: "ÖLDÜN - R: yeniden",
        },
        en: {
          ready: "READY",
          noAmmo: "NO AMMO",
          fire: "FIRE!",
          targetDown: "TARGET DOWN",
          hit: "HIT",
          noBombs: "NO BOMBS",
          boom: "BOOM",
          doorOpen: "DOOR OPEN",
          noDoor: "NO DOOR",
          ammoPlus: "AMMO +",
          healthPlus: "HEALTH +",
          shieldPlus: "SHIELD +",
          bombPlus: "BOMB +",
          chest: "CHEST!",
          damage: "HIT!",
          died: "YOU DIED",
          clear: "ALL CLEAR",
          launch: "Launching retro FPS...",
          loading: "LOADING...",
          hudLabel: "HP",
          shieldLabel: "SHIELD",
          ammoLabel: "AMMO",
          bombLabel: "BOMBS",
          scoreLabel: "SCORE",
          controls1: "W/S: move  A/D: strafe  ←/→: turn  Space: fire",
          controls2: "B: bomb  E: door  M: map  R: reset  Q: quit",
          gameOver: "YOU DIED - R: restart",
        },
      } as const;
      const lang = language === "tr" ? "tr" : "en";
      return dict[lang][key as keyof (typeof dict)["tr"]] ?? key;
    },
    [language],
  );

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
    const raw = isMobile
      ? perfTier === "low"
        ? 420
        : perfTier === "high"
          ? 600
          : 520
      : perfTier === "low"
        ? 520
        : perfTier === "high"
          ? 720
          : 640;
    const scaled = Math.round(raw * resolutionScale);
    return clamp(scaled, 360, 860);
  }, [isMobile, perfTier, resolutionScale]);
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
          ? 860
          : perfTier === "low"
            ? 620
            : 740
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
      LANG: languageMeta[language].envLang,
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
    snakeWonRef.current = false;
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
    if (!snakeAliveRef.current || snakeWonRef.current) {
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
    if (body.length >= cols * rows) {
      snakeWonRef.current = true;
      snakeAliveRef.current = false;
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
    const midRow = Math.floor(rows / 2);
    for (let x = 1; x < cols - 1; x += 1) {
      grid[midRow][x] = 0;
    }
    grid[midRow][0] = 0;
    grid[midRow][cols - 1] = 0;
    for (let y = 3; y < rows - 3; y += 5) {
      for (let x = 3; x < cols - 3; x += 7) {
        grid[y][x] = 1;
        if (grid[y + 1]?.[x] !== undefined) {
          grid[y + 1][x] = 1;
        }
      }
    }
    grid[1][1] = 0;
    grid[1][2] = 0;
    grid[2][1] = 0;
    const powerPellets: GridPoint[] = [
      { x: cols - 2, y: 1 },
      { x: 1, y: rows - 2 },
      { x: cols - 2, y: rows - 2 },
      { x: Math.max(1, Math.floor(cols / 2)), y: 1 },
    ];
    powerPellets.forEach((cell) => {
      if (grid[cell.y]?.[cell.x] === 2) {
        grid[cell.y][cell.x] = 3;
      }
    });
    return grid;
  }, []);

  const resetPacman = useCallback(() => {
    const { cols, rows } = computeAppGrid();
    const grid = buildPacmanGrid(cols, rows);
    pacmanGridRef.current = grid;
    pacmanPosRef.current = { x: 1, y: 1 };
    pacmanDirRef.current = { x: 1, y: 0 };
    pacmanNextDirRef.current = { x: 1, y: 0 };
    const resolveGhostStart = (preferred: GridPoint) => {
      if (grid[preferred.y]?.[preferred.x] !== 1) {
        return preferred;
      }
      for (let y = rows - 2; y >= 1; y -= 1) {
        for (let x = cols - 2; x >= 1; x -= 1) {
          if (grid[y][x] !== 1) {
            return { x, y };
          }
        }
      }
      return { x: cols - 2, y: rows - 2 };
    };
    const ghostStarts = [
      resolveGhostStart({ x: cols - 2, y: rows - 2 }),
      resolveGhostStart({ x: cols - 2, y: 1 }),
      resolveGhostStart({ x: Math.max(1, Math.floor(cols / 2)), y: rows - 2 }),
    ];
    const ghostColors = ["#d6735b", "#6fd68d", "#5bb5d6"];
    const ghostStyles: Array<"chase" | "ambush" | "random"> = [
      "chase",
      "ambush",
      "random",
    ];
    pacmanGhostsRef.current = ghostStarts.map((pos, index) => ({
      pos: { ...pos },
      dir: { x: -1, y: 0 },
      home: { ...pos },
      scared: 0,
      color: ghostColors[index] ?? "#d6735b",
      style: ghostStyles[index] ?? "chase",
    }));
    pacmanScoreRef.current = 0;
    pacmanWonRef.current = false;
    pacmanGameOverRef.current = false;
    pacmanPowerRef.current = 0;
    pacmanScatterRef.current = 0;
    let pellets = 0;
    grid.forEach((row) => {
      row.forEach((cell) => {
        if (cell === 2 || cell === 3) {
          pellets += 1;
        }
      });
    });
    pacmanPelletsRef.current = pellets;
    dirtyRef.current = true;
  }, [buildPacmanGrid, computeAppGrid]);

  const stepPacman = useCallback(() => {
    if (pacmanWonRef.current || pacmanGameOverRef.current) {
      return;
    }
    const grid = pacmanGridRef.current;
    const pos = pacmanPosRef.current;
    const cols = grid[0]?.length ?? 0;
    const rows = grid.length ?? 0;
    if (!cols || !rows) {
      return;
    }
    const nextDir = pacmanNextDirRef.current;
    const wrapX = (x: number, y: number) => {
      if (x < 0) {
        return grid[y]?.[cols - 1] !== 1 ? cols - 1 : x;
      }
      if (x >= cols) {
        return grid[y]?.[0] !== 1 ? 0 : x;
      }
      return x;
    };
    const getNextPos = (origin: GridPoint, dir: GridPoint) => {
      const ny = origin.y + dir.y;
      const nx = wrapX(origin.x + dir.x, ny);
      return { x: nx, y: ny };
    };
    const canMove = (dir: GridPoint) => {
      const next = getNextPos(pos, dir);
      return grid[next.y]?.[next.x] !== 1;
    };
    if (canMove(nextDir)) {
      pacmanDirRef.current = nextDir;
    }
    const dir = pacmanDirRef.current;
    if (canMove(dir)) {
      const next = getNextPos(pos, dir);
      pos.x = next.x;
      pos.y = next.y;
      const cell = grid[pos.y]?.[pos.x];
      if (cell === 2 || cell === 3) {
        grid[pos.y][pos.x] = 0;
        pacmanScoreRef.current += cell === 3 ? 5 : 1;
        pacmanPelletsRef.current -= 1;
        if (cell === 3) {
          pacmanPowerRef.current = 60;
          pacmanGhostsRef.current.forEach((ghost) => {
            ghost.scared = 60;
            ghost.dir = { x: -ghost.dir.x, y: -ghost.dir.y };
          });
        }
        if (pacmanPelletsRef.current <= 0) {
          pacmanWonRef.current = true;
        }
      }
    }

    if (pacmanPowerRef.current > 0) {
      pacmanPowerRef.current -= 1;
    }
    pacmanScatterRef.current = (pacmanScatterRef.current + 1) % 400;
    const scatterMode = pacmanScatterRef.current < 80;

    const dirs: GridPoint[] = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    pacmanGhostsRef.current.forEach((ghost) => {
      if (ghost.scared > 0) {
        ghost.scared -= 1;
      }
      if (ghost.pos.x === pos.x && ghost.pos.y === pos.y) {
        if (ghost.scared > 0 || pacmanPowerRef.current > 0) {
          pacmanScoreRef.current += 20;
          ghost.pos = { ...ghost.home };
          ghost.dir = { x: -1, y: 0 };
          ghost.scared = 0;
        } else {
          pacmanGameOverRef.current = true;
        }
      }
    });

    pacmanGhostsRef.current.forEach((ghost, index) => {
      const canMoveGhost = (dir: GridPoint) => {
        const next = getNextPos(ghost.pos, dir);
        return grid[next.y]?.[next.x] !== 1;
      };
      const options = dirs.filter(canMoveGhost);
      if (!options.length) {
        return;
      }
      const currentDir = ghost.dir;
      const reverseDir = { x: -currentDir.x, y: -currentDir.y };
      const nonReverse = options.filter(
        (dir) => dir.x !== reverseDir.x || dir.y !== reverseDir.y,
      );
      const usableOptions = nonReverse.length ? nonReverse : options;
      const canKeep = usableOptions.some(
        (dir) => dir.x === currentDir.x && dir.y === currentDir.y,
      );
      let next = currentDir;
      if (!canKeep || Math.random() < 0.35) {
        const ahead = {
          x: pos.x + pacmanDirRef.current.x * 2,
          y: pos.y + pacmanDirRef.current.y * 2,
        };
        const baseTarget = scatterMode
          ? ghost.home
          : ghost.style === "ambush"
            ? ahead
            : ghost.style === "random"
              ? {
                  x: Math.floor(cols / 2) + (index - 1) * 3,
                  y: Math.floor(rows / 2),
                }
              : pos;
        const target =
          ghost.scared > 0 || pacmanPowerRef.current > 0 ? pos : baseTarget;
        next = usableOptions.reduce((best, candidate) => {
          const bestPos = getNextPos(ghost.pos, best);
          const candPos = getNextPos(ghost.pos, candidate);
          const bestScore =
            Math.abs(target.x - bestPos.x) + Math.abs(target.y - bestPos.y);
          const candScore =
            Math.abs(target.x - candPos.x) + Math.abs(target.y - candPos.y);
          if (ghost.scared > 0 || pacmanPowerRef.current > 0) {
            return candScore >= bestScore ? candidate : best;
          }
          return candScore <= bestScore ? candidate : best;
        }, usableOptions[0]);
      }
      const slowMove = ghost.scared > 0 || pacmanPowerRef.current > 0;
      if (slowMove && pacmanScatterRef.current % 2 === 1) {
        return;
      }
      ghost.dir = next;
      const nextGhost = getNextPos(ghost.pos, next);
      ghost.pos.x = nextGhost.x;
      ghost.pos.y = nextGhost.y;
      if (ghost.pos.x === pos.x && ghost.pos.y === pos.y) {
        if (ghost.scared > 0 || pacmanPowerRef.current > 0) {
          pacmanScoreRef.current += 20;
          ghost.pos = { ...ghost.home };
          ghost.dir = { x: -1, y: 0 };
          ghost.scared = 0;
        } else {
          pacmanGameOverRef.current = true;
        }
      }
    });
  }, []);

  const resetCalc = useCallback(() => {
    calcInputRef.current = "";
    calcResultRef.current = null;
    calcErrorRef.current = null;
    dirtyRef.current = true;
  }, []);

  const resetPong = useCallback(() => {
    const { cols, rows } = computeAppGrid();
    pongGridRef.current = { cols, rows };
    const paddleWidth = Math.max(4, Math.floor(cols * 0.2));
    pongPaddleRef.current = Math.floor((cols - paddleWidth) / 2);
    pongAiRef.current = Math.floor((cols - paddleWidth) / 2);
    pongBallRef.current = { x: cols / 2, y: rows / 2 };
    const dirX = Math.random() < 0.5 ? -1 : 1;
    const dirY = Math.random() < 0.5 ? -1 : 1;
    pongVelRef.current = { x: dirX * 0.7, y: dirY * 0.7 };
    pongScoreRef.current = { player: 0, ai: 0 };
    pongLivesRef.current = 3;
    pongOverRef.current = false;
    dirtyRef.current = true;
  }, [computeAppGrid]);

  const beginDoomBoot = useCallback((duration = 1400) => {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    doomBootRef.current = { start: now, duration };
  }, []);

  const getDoomBootProgress = useCallback(() => {
    const boot = doomBootRef.current;
    if (!boot) {
      return 1;
    }
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const progress = clamp((now - boot.start) / boot.duration, 0, 1);
    if (progress >= 1) {
      doomBootRef.current = null;
    }
    return progress;
  }, []);

  const resetDoom = useCallback(() => {
    const layout = [
      "#################",
      "#..D....#...D...#",
      "#..##...#..E..A.#",
      "#..#....#.......#",
      "#..#..S.#..##...#",
      "#..####.#..#..K.#",
      "#......D#..#..#.#",
      "#..P.....#..B.#.#",
      "#..##..T.#..#...#",
      "#..#.....#..###.#",
      "#..#..E..#......#",
      "#..D.....#..C..H#",
      "#################",
    ];
    const enemies: Array<{
      x: number;
      y: number;
      hp: number;
      cooldown: number;
    }> = [];
    const pickups: Array<{
      x: number;
      y: number;
      type: "ammo" | "med" | "shield" | "bomb" | "chest";
    }> = [];
    const props: Array<{
      x: number;
      y: number;
      type: "pillar" | "crate" | "torch";
    }> = [];
    const map = layout.map((row, y) =>
      row.split("").map((cell, x) => {
        if (cell === "E") {
          enemies.push({ x: x + 0.5, y: y + 0.5, hp: 2, cooldown: 0 });
          return 0;
        }
        if (cell === "A") {
          pickups.push({ x: x + 0.5, y: y + 0.5, type: "ammo" });
          return 0;
        }
        if (cell === "H") {
          pickups.push({ x: x + 0.5, y: y + 0.5, type: "med" });
          return 0;
        }
        if (cell === "K") {
          pickups.push({ x: x + 0.5, y: y + 0.5, type: "shield" });
          return 0;
        }
        if (cell === "B") {
          pickups.push({ x: x + 0.5, y: y + 0.5, type: "bomb" });
          return 0;
        }
        if (cell === "C") {
          pickups.push({ x: x + 0.5, y: y + 0.5, type: "chest" });
          return 0;
        }
        if (cell === "P") {
          props.push({ x: x + 0.5, y: y + 0.5, type: "pillar" });
          return 0;
        }
        if (cell === "T") {
          props.push({ x: x + 0.5, y: y + 0.5, type: "torch" });
          return 0;
        }
        if (cell === "D") {
          return 2;
        }
        return cell === "#" ? 1 : 0;
      }),
    );
    let spawn = { x: 2.5, y: 2.5 };
    layout.forEach((row, y) => {
      const x = row.indexOf("S");
      if (x >= 0) {
        spawn = { x: x + 0.5, y: y + 0.5 };
      }
    });
    doomMapRef.current = map;
    doomEnemiesRef.current = enemies;
    doomPickupsRef.current = pickups;
    doomPropsRef.current = props;
    doomPlayerRef.current = { x: spawn.x, y: spawn.y, angle: 0 };
    doomImpulseRef.current = { move: 0, strafe: 0, turn: 0 };
    doomFlashRef.current = 0;
    doomAmmoRef.current = 24;
    doomHealthRef.current = 100;
    doomShieldRef.current = 60;
    doomBombsRef.current = 2;
    doomScoreRef.current = 0;
    doomCooldownRef.current = 0;
    doomGameOverRef.current = false;
    doomBobRef.current = 0;
    doomMessageRef.current = doomText("ready");
    dirtyRef.current = true;
  }, [doomText]);

  const castDoomDistance = useCallback(
    (origin: { x: number; y: number }, angle: number, maxDist: number) => {
      const map = doomMapRef.current;
      if (!map.length) {
        return maxDist;
      }
      const dirX = Math.cos(angle) || 0.0001;
      const dirY = Math.sin(angle) || 0.0001;
      let mapX = Math.floor(origin.x);
      let mapY = Math.floor(origin.y);
      const deltaDistX = Math.abs(1 / dirX);
      const deltaDistY = Math.abs(1 / dirY);
      const stepX = dirX < 0 ? -1 : 1;
      const stepY = dirY < 0 ? -1 : 1;
      let sideDistX =
        (dirX < 0 ? origin.x - mapX : mapX + 1 - origin.x) * deltaDistX;
      let sideDistY =
        (dirY < 0 ? origin.y - mapY : mapY + 1 - origin.y) * deltaDistY;
      let side = 0;
      let distance = maxDist;
      for (let step = 0; step < 96; step += 1) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        const cell = map[mapY]?.[mapX];
        if (cell && cell >= 1) {
          const raw =
            side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
          distance = Math.min(maxDist, raw);
          break;
        }
        const raw =
          side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
        if (raw >= maxDist) {
          distance = maxDist;
          break;
        }
      }
      return distance;
    },
    [],
  );

  const shootDoom = useCallback(() => {
    if (doomGameOverRef.current) {
      return;
    }
    if (doomCooldownRef.current > 0) {
      return;
    }
    if (doomAmmoRef.current <= 0) {
      doomMessageRef.current = doomText("noAmmo");
      return;
    }
    doomAmmoRef.current -= 1;
    doomCooldownRef.current = 10;
    doomFlashRef.current = 6;
    doomMessageRef.current = doomText("fire");
    const player = doomPlayerRef.current;
    const enemies = doomEnemiesRef.current;
    if (!enemies.length) {
      return;
    }
    const fovHit = 0.22;
    let bestIndex = -1;
    let bestDist = 999;
    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.3 || dist > 8) {
        continue;
      }
      const angle = Math.atan2(dy, dx);
      const delta = Math.atan2(
        Math.sin(angle - player.angle),
        Math.cos(angle - player.angle),
      );
      if (Math.abs(delta) > fovHit) {
        continue;
      }
      const wallDist = castDoomDistance(player, angle, dist + 0.05);
      if (wallDist + 0.05 < dist) {
        continue;
      }
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      const enemy = enemies[bestIndex];
      enemy.hp -= 1;
      if (enemy.hp <= 0) {
        enemies.splice(bestIndex, 1);
        doomScoreRef.current += 1;
        doomMessageRef.current = doomText("targetDown");
      } else {
        doomMessageRef.current = doomText("hit");
      }
    }
  }, [castDoomDistance, doomText]);

  const throwDoomBomb = useCallback(() => {
    if (doomGameOverRef.current) {
      return;
    }
    if (doomBombsRef.current <= 0) {
      doomMessageRef.current = doomText("noBombs");
      return;
    }
    doomBombsRef.current -= 1;
    doomFlashRef.current = 8;
    doomMessageRef.current = doomText("boom");
    const player = doomPlayerRef.current;
    const enemies = doomEnemiesRef.current;
    const radius = 2.2;
    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const enemy = enemies[i];
      const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (dist <= radius) {
        enemies.splice(i, 1);
        doomScoreRef.current += 2;
      }
    }
  }, [doomText]);

  const openDoomDoor = useCallback(() => {
    const map = doomMapRef.current;
    if (!map.length) {
      return;
    }
    const player = doomPlayerRef.current;
    const lookX = player.x + Math.cos(player.angle) * 0.8;
    const lookY = player.y + Math.sin(player.angle) * 0.8;
    const gx = Math.floor(lookX);
    const gy = Math.floor(lookY);
    if (map[gy]?.[gx] === 2) {
      map[gy][gx] = 0;
      doomMessageRef.current = doomText("doorOpen");
    } else {
      doomMessageRef.current = doomText("noDoor");
    }
  }, [doomText]);

  const stepDoom = useCallback(() => {
    const map = doomMapRef.current;
    if (!map.length) {
      return;
    }
    if (getDoomBootProgress() < 1) {
      return;
    }
    if (doomGameOverRef.current) {
      return;
    }
    const player = doomPlayerRef.current;
    const impulse = doomImpulseRef.current;
    if (doomFlashRef.current > 0) {
      doomFlashRef.current -= 1;
    }
    if (doomCooldownRef.current > 0) {
      doomCooldownRef.current -= 1;
    }
    impulse.move *= 0.82;
    impulse.strafe *= 0.82;
    impulse.turn *= 0.7;
    player.angle += impulse.turn;
    const speed = Math.abs(impulse.move) + Math.abs(impulse.strafe);
    doomBobRef.current = (doomBobRef.current + speed * 4) % (Math.PI * 2);
    const cos = Math.cos(player.angle);
    const sin = Math.sin(player.angle);
    const moveX = cos * impulse.move + -sin * impulse.strafe;
    const moveY = sin * impulse.move + cos * impulse.strafe;
    const nextX = player.x + moveX;
    const nextY = player.y + moveY;
    const radius = 0.18;
    const isWall = (x: number, y: number) => {
      const gx = Math.floor(x);
      const gy = Math.floor(y);
      const cell = map[gy]?.[gx] ?? 0;
      return cell >= 1;
    };
    if (
      !isWall(nextX + radius, player.y) &&
      !isWall(nextX - radius, player.y)
    ) {
      player.x = nextX;
    }
    if (
      !isWall(player.x, nextY + radius) &&
      !isWall(player.x, nextY - radius)
    ) {
      player.y = nextY;
    }

    const pickups = doomPickupsRef.current;
    if (pickups.length) {
      doomPickupsRef.current = pickups.filter((pickup) => {
        const dist = Math.hypot(pickup.x - player.x, pickup.y - player.y);
        if (dist > 0.55) {
          return true;
        }
        if (pickup.type === "ammo") {
          doomAmmoRef.current = Math.min(99, doomAmmoRef.current + 12);
          doomMessageRef.current = doomText("ammoPlus");
        } else if (pickup.type === "med") {
          doomHealthRef.current = Math.min(100, doomHealthRef.current + 20);
          doomMessageRef.current = doomText("healthPlus");
        } else if (pickup.type === "shield") {
          doomShieldRef.current = Math.min(100, doomShieldRef.current + 35);
          doomMessageRef.current = doomText("shieldPlus");
        } else if (pickup.type === "bomb") {
          doomBombsRef.current = Math.min(9, doomBombsRef.current + 1);
          doomMessageRef.current = doomText("bombPlus");
        } else if (pickup.type === "chest") {
          doomScoreRef.current += 5;
          doomAmmoRef.current = Math.min(99, doomAmmoRef.current + 6);
          doomMessageRef.current = doomText("chest");
        }
        return false;
      });
    }

    const enemies = doomEnemiesRef.current;
    enemies.forEach((enemy) => {
      if (enemy.cooldown > 0) {
        enemy.cooldown -= 1;
      }
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.6) {
        if (enemy.cooldown <= 0) {
          const damage = 5;
          if (doomShieldRef.current > 0) {
            const absorbed = Math.min(doomShieldRef.current, damage);
            doomShieldRef.current -= absorbed;
            const left = damage - absorbed;
            if (left > 0) {
              doomHealthRef.current = Math.max(0, doomHealthRef.current - left);
            }
          } else {
            doomHealthRef.current = Math.max(0, doomHealthRef.current - damage);
          }
          enemy.cooldown = 24;
          doomMessageRef.current = doomText("damage");
          if (doomHealthRef.current <= 0) {
            doomGameOverRef.current = true;
            doomMessageRef.current = doomText("died");
          }
        }
        return;
      }
      const step = 0.018;
      const nx = enemy.x + (dx / dist) * step;
      const ny = enemy.y + (dy / dist) * step;
      if (!isWall(nx, enemy.y)) {
        enemy.x = nx;
      }
      if (!isWall(enemy.x, ny)) {
        enemy.y = ny;
      }
    });
    if (!enemies.length) {
      doomMessageRef.current = doomText("clear");
    }
  }, [doomText, getDoomBootProgress]);

  const stepPong = useCallback(() => {
    if (pongOverRef.current) {
      return;
    }
    const { cols, rows } = pongGridRef.current;
    const paddleWidth = Math.max(4, Math.floor(cols * 0.2));
    const ball = pongBallRef.current;
    const vel = pongVelRef.current;

    ball.x += vel.x;
    ball.y += vel.y;

    if (ball.x <= 0 || ball.x >= cols - 1) {
      vel.x *= -1;
      ball.x = clamp(ball.x, 0, cols - 1);
    }

    const aiTarget = ball.x - paddleWidth / 2;
    const aiMove = Math.sign(aiTarget - pongAiRef.current) * 0.8;
    pongAiRef.current = clamp(
      pongAiRef.current + aiMove,
      0,
      cols - paddleWidth,
    );
    pongPaddleRef.current = clamp(pongPaddleRef.current, 0, cols - paddleWidth);

    const aiY = 1;
    const playerY = rows - 2;
    if (ball.y <= aiY + 0.2) {
      if (
        ball.x >= pongAiRef.current &&
        ball.x <= pongAiRef.current + paddleWidth
      ) {
        vel.y = Math.abs(vel.y);
        ball.y = aiY + 0.4;
      } else if (ball.y < 0) {
        pongScoreRef.current.player += 1;
        ball.x = cols / 2;
        ball.y = rows / 2;
        vel.y = Math.abs(vel.y);
        vel.x = (Math.random() < 0.5 ? -1 : 1) * Math.max(0.6, Math.abs(vel.x));
      }
    }

    if (ball.y >= playerY - 0.2) {
      if (
        ball.x >= pongPaddleRef.current &&
        ball.x <= pongPaddleRef.current + paddleWidth
      ) {
        vel.y = -Math.abs(vel.y);
        ball.y = playerY - 0.4;
      } else if (ball.y > rows - 1) {
        pongLivesRef.current -= 1;
        if (pongLivesRef.current <= 0) {
          pongOverRef.current = true;
        } else {
          ball.x = cols / 2;
          ball.y = rows / 2;
          vel.y = -Math.abs(vel.y);
          vel.x =
            (Math.random() < 0.5 ? -1 : 1) * Math.max(0.6, Math.abs(vel.x));
        }
      }
    }
  }, []);

  const resetChess = useCallback(() => {
    chessBoardRef.current = [
      ["r", "n", "b", "q", "k", "b", "n", "r"],
      ["p", "p", "p", "p", "p", "p", "p", "p"],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["P", "P", "P", "P", "P", "P", "P", "P"],
      ["R", "N", "B", "Q", "K", "B", "N", "R"],
    ];
    chessCursorRef.current = { x: 0, y: 7 };
    chessSelectedRef.current = null;
    chessTurnRef.current = "w";
    chessMovesRef.current = 0;
    chessStatusRef.current = messages.chess.selectPiece;
    chessBotThinkingRef.current = false;
    chessCastlingRef.current = { wK: true, wQ: true, bK: true, bQ: true };
    chessEnPassantRef.current = null;
    chessPendingPromotionRef.current = null;
    dirtyRef.current = true;
  }, [messages.chess.selectPiece]);

  const getChessColor = useCallback((piece: string) => {
    if (!piece) {
      return null;
    }
    return piece === piece.toUpperCase() ? "w" : "b";
  }, []);

  const isChessInBounds = useCallback(
    (x: number, y: number) => x >= 0 && x < 8 && y >= 0 && y < 8,
    [],
  );

  const getChessAttackSquares = useCallback(
    (board: string[][], x: number, y: number) => {
      const piece = board[y]?.[x] ?? "";
      const color = getChessColor(piece);
      if (!piece || !color) {
        return [] as GridPoint[];
      }
      const moves: GridPoint[] = [];
      const addMove = (nx: number, ny: number) => {
        if (!isChessInBounds(nx, ny)) {
          return false;
        }
        moves.push({ x: nx, y: ny });
        const target = board[ny]?.[nx] ?? "";
        return !target;
      };
      const addRay = (dx: number, dy: number) => {
        let nx = x + dx;
        let ny = y + dy;
        while (isChessInBounds(nx, ny)) {
          moves.push({ x: nx, y: ny });
          const target = board[ny]?.[nx] ?? "";
          if (target) {
            break;
          }
          nx += dx;
          ny += dy;
        }
      };
      const lower = piece.toLowerCase();
      if (lower === "p") {
        const dir = color === "w" ? -1 : 1;
        const left = { x: x - 1, y: y + dir };
        const right = { x: x + 1, y: y + dir };
        if (isChessInBounds(left.x, left.y)) {
          moves.push(left);
        }
        if (isChessInBounds(right.x, right.y)) {
          moves.push(right);
        }
        return moves;
      }
      if (lower === "n") {
        const jumps = [
          [1, 2],
          [2, 1],
          [-1, 2],
          [-2, 1],
          [1, -2],
          [2, -1],
          [-1, -2],
          [-2, -1],
        ];
        jumps.forEach(([dx, dy]) => addMove(x + dx, y + dy));
        return moves;
      }
      if (lower === "b" || lower === "q") {
        addRay(1, 1);
        addRay(1, -1);
        addRay(-1, 1);
        addRay(-1, -1);
      }
      if (lower === "r" || lower === "q") {
        addRay(1, 0);
        addRay(-1, 0);
        addRay(0, 1);
        addRay(0, -1);
      }
      if (lower === "k") {
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dy = -1; dy <= 1; dy += 1) {
            if (dx === 0 && dy === 0) {
              continue;
            }
            addMove(x + dx, y + dy);
          }
        }
      }
      return moves;
    },
    [getChessColor, isChessInBounds],
  );

  const isChessSquareAttacked = useCallback(
    (board: string[][], target: GridPoint, byColor: "w" | "b") => {
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const piece = board[y]?.[x] ?? "";
          const color = getChessColor(piece);
          if (!piece || color !== byColor) {
            continue;
          }
          const attacks = getChessAttackSquares(board, x, y);
          if (
            attacks.some((move) => move.x === target.x && move.y === target.y)
          ) {
            return true;
          }
        }
      }
      return false;
    },
    [getChessAttackSquares, getChessColor],
  );

  const getChessMoves = useCallback(
    (board: string[][], x: number, y: number) => {
      const piece = board[y]?.[x] ?? "";
      const color = getChessColor(piece);
      if (!piece || !color) {
        return [] as GridPoint[];
      }
      const moves: GridPoint[] = [];
      const addMove = (nx: number, ny: number) => {
        if (!isChessInBounds(nx, ny)) {
          return false;
        }
        const target = board[ny]?.[nx] ?? "";
        const targetColor = getChessColor(target);
        if (target && targetColor === color) {
          return false;
        }
        moves.push({ x: nx, y: ny });
        return !target;
      };
      const addRay = (dx: number, dy: number) => {
        let nx = x + dx;
        let ny = y + dy;
        while (isChessInBounds(nx, ny)) {
          const target = board[ny]?.[nx] ?? "";
          const targetColor = getChessColor(target);
          if (target && targetColor === color) {
            break;
          }
          moves.push({ x: nx, y: ny });
          if (target) {
            break;
          }
          nx += dx;
          ny += dy;
        }
      };
      const lower = piece.toLowerCase();
      if (lower === "p") {
        const dir = color === "w" ? -1 : 1;
        const startRow = color === "w" ? 6 : 1;
        const oneY = y + dir;
        if (isChessInBounds(x, oneY) && !board[oneY]?.[x]) {
          moves.push({ x, y: oneY });
          const twoY = y + dir * 2;
          if (y === startRow && !board[twoY]?.[x]) {
            moves.push({ x, y: twoY });
          }
        }
        const captureOffsets = [
          { x: -1, y: dir },
          { x: 1, y: dir },
        ];
        captureOffsets.forEach((offset) => {
          const nx = x + offset.x;
          const ny = y + offset.y;
          if (!isChessInBounds(nx, ny)) {
            return;
          }
          const target = board[ny]?.[nx] ?? "";
          const targetColor = getChessColor(target);
          if (target && targetColor && targetColor !== color) {
            moves.push({ x: nx, y: ny });
            return;
          }
          const enPassant = chessEnPassantRef.current;
          if (enPassant && enPassant.x === nx && enPassant.y === ny) {
            moves.push({ x: nx, y: ny });
          }
        });
        return moves;
      }
      if (lower === "n") {
        const jumps = [
          [1, 2],
          [2, 1],
          [-1, 2],
          [-2, 1],
          [1, -2],
          [2, -1],
          [-1, -2],
          [-2, -1],
        ];
        jumps.forEach(([dx, dy]) => addMove(x + dx, y + dy));
        return moves;
      }
      if (lower === "b" || lower === "q") {
        addRay(1, 1);
        addRay(1, -1);
        addRay(-1, 1);
        addRay(-1, -1);
      }
      if (lower === "r" || lower === "q") {
        addRay(1, 0);
        addRay(-1, 0);
        addRay(0, 1);
        addRay(0, -1);
      }
      if (lower === "k") {
        for (let dx = -1; dx <= 1; dx += 1) {
          for (let dy = -1; dy <= 1; dy += 1) {
            if (dx === 0 && dy === 0) {
              continue;
            }
            addMove(x + dx, y + dy);
          }
        }
      }
      return moves;
    },
    [getChessColor, isChessInBounds],
  );

  const isChessInCheck = useCallback(
    (board: string[][], color: "w" | "b") => {
      let kingPos: GridPoint | null = null;
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const piece = board[y]?.[x] ?? "";
          if (piece && piece.toLowerCase() === "k") {
            const pieceColor = getChessColor(piece);
            if (pieceColor === color) {
              kingPos = { x, y };
            }
          }
        }
      }
      if (!kingPos) {
        return false;
      }
      const enemy = color === "w" ? "b" : "w";
      return isChessSquareAttacked(board, kingPos, enemy);
    },
    [getChessColor, isChessSquareAttacked],
  );

  const applyChessMove = useCallback(
    (board: string[][], from: GridPoint, to: GridPoint) => {
      const clone = board.map((row) => row.slice());
      const piece = clone[from.y]?.[from.x] ?? "";
      const color = getChessColor(piece);
      if (!piece || !color) {
        return clone;
      }
      const lower = piece.toLowerCase();
      const isEnPassant =
        lower === "p" &&
        from.x !== to.x &&
        !clone[to.y]?.[to.x] &&
        chessEnPassantRef.current &&
        chessEnPassantRef.current.x === to.x &&
        chessEnPassantRef.current.y === to.y;
      clone[from.y][from.x] = "";
      clone[to.y][to.x] = piece;
      if (isEnPassant) {
        const dir = color === "w" ? 1 : -1;
        clone[to.y + dir][to.x] = "";
      }
      if (lower === "k" && Math.abs(to.x - from.x) === 2) {
        const rookFromX = to.x > from.x ? 7 : 0;
        const rookToX = to.x > from.x ? to.x - 1 : to.x + 1;
        const rook = clone[from.y][rookFromX];
        clone[from.y][rookFromX] = "";
        clone[from.y][rookToX] = rook;
      }
      return clone;
    },
    [getChessColor],
  );

  const getChessLegalMoves = useCallback(
    (board: string[][], x: number, y: number) => {
      const piece = board[y]?.[x] ?? "";
      const color = getChessColor(piece);
      if (!piece || !color) {
        return [] as GridPoint[];
      }
      const moves = getChessMoves(board, x, y).slice();
      const lower = piece.toLowerCase();
      if (lower === "k") {
        const isWhite = color === "w";
        const rank = isWhite ? 7 : 0;
        const rights = chessCastlingRef.current;
        const kingStart = { x: 4, y: rank };
        if (
          x === kingStart.x &&
          y === kingStart.y &&
          !isChessInCheck(board, color)
        ) {
          if (isWhite ? rights.wK : rights.bK) {
            const path = [
              { x: 5, y: rank },
              { x: 6, y: rank },
            ];
            if (
              path.every((pos) => !board[pos.y]?.[pos.x]) &&
              path.every(
                (pos) =>
                  !isChessSquareAttacked(board, pos, isWhite ? "b" : "w"),
              )
            ) {
              moves.push({ x: 6, y: rank });
            }
          }
          if (isWhite ? rights.wQ : rights.bQ) {
            const path = [
              { x: 3, y: rank },
              { x: 2, y: rank },
              { x: 1, y: rank },
            ];
            if (
              path
                .slice(0, 2)
                .every(
                  (pos) =>
                    !isChessSquareAttacked(board, pos, isWhite ? "b" : "w"),
                ) &&
              path.every((pos) => !board[pos.y]?.[pos.x])
            ) {
              moves.push({ x: 2, y: rank });
            }
          }
        }
      }
      return moves.filter((move) => {
        const next = applyChessMove(board, { x, y }, move);
        return !isChessInCheck(next, color);
      });
    },
    [
      applyChessMove,
      getChessColor,
      getChessMoves,
      isChessInCheck,
      isChessSquareAttacked,
    ],
  );

  const hasChessLegalMove = useCallback(
    (board: string[][], color: "w" | "b") => {
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const piece = board[y]?.[x] ?? "";
          const pieceColor = getChessColor(piece);
          if (!piece || pieceColor !== color) {
            continue;
          }
          if (getChessLegalMoves(board, x, y).length > 0) {
            return true;
          }
        }
      }
      return false;
    },
    [getChessColor, getChessLegalMoves],
  );

  const attemptChessMove = useCallback(
    (from: GridPoint, to: GridPoint) => {
      if (chessPendingPromotionRef.current) {
        chessStatusRef.current = messages.chess.promotePawn;
        return false;
      }
      const board = chessBoardRef.current;
      const piece = board[from.y]?.[from.x] ?? "";
      if (!piece) {
        chessStatusRef.current = messages.chess.noPieceSelected;
        return false;
      }
      const color = getChessColor(piece);
      if (!color || color !== chessTurnRef.current) {
        chessStatusRef.current = messages.chess.notYourTurn;
        return false;
      }
      const moves = getChessLegalMoves(board, from.x, from.y);
      const isLegal = moves.some((move) => move.x === to.x && move.y === to.y);
      if (!isLegal) {
        chessStatusRef.current = messages.chess.illegalMove;
        return false;
      }
      const captured = board[to.y]?.[to.x] ?? "";
      const nextBoard = applyChessMove(board, from, to);
      const lower = piece.toLowerCase();
      const isWhite = color === "w";
      const promoteRow = isWhite ? 0 : 7;

      chessEnPassantRef.current = null;
      if (lower === "p" && Math.abs(to.y - from.y) === 2) {
        chessEnPassantRef.current = { x: from.x, y: (from.y + to.y) / 2 };
      }

      const rights = { ...chessCastlingRef.current };
      if (lower === "k") {
        if (isWhite) {
          rights.wK = false;
          rights.wQ = false;
        } else {
          rights.bK = false;
          rights.bQ = false;
        }
      }
      if (lower === "r") {
        if (isWhite && from.y === 7) {
          if (from.x === 0) rights.wQ = false;
          if (from.x === 7) rights.wK = false;
        }
        if (!isWhite && from.y === 0) {
          if (from.x === 0) rights.bQ = false;
          if (from.x === 7) rights.bK = false;
        }
      }
      if (captured.toLowerCase() === "r") {
        if (to.y === 7) {
          if (to.x === 0) rights.wQ = false;
          if (to.x === 7) rights.wK = false;
        }
        if (to.y === 0) {
          if (to.x === 0) rights.bQ = false;
          if (to.x === 7) rights.bK = false;
        }
      }
      chessCastlingRef.current = rights;

      chessBoardRef.current = nextBoard;

      const isPromotion = lower === "p" && to.y === promoteRow;
      const nextTurn = isWhite ? "b" : "w";
      if (isPromotion) {
        const isBotTurn =
          chessModeRef.current === "bot" &&
          chessTurnRef.current === chessBotColorRef.current;
        if (isBotTurn) {
          chessBoardRef.current[to.y][to.x] = isWhite ? "Q" : "q";
          chessTurnRef.current = nextTurn;
          chessMovesRef.current += 1;
        } else {
          chessPendingPromotionRef.current = {
            x: to.x,
            y: to.y,
            color,
            nextTurn,
          };
          chessPromotionChoiceRef.current = 0;
          chessStatusRef.current = messages.chess.promotePawn;
          return true;
        }
      } else {
        chessTurnRef.current = nextTurn;
        chessMovesRef.current += 1;
      }

      const enemyColor = chessTurnRef.current;
      const inCheck = isChessInCheck(chessBoardRef.current, enemyColor);
      if (!hasChessLegalMove(chessBoardRef.current, enemyColor)) {
        chessStatusRef.current = inCheck
          ? messages.chess.checkmate
          : messages.chess.stalemate;
      } else {
        chessStatusRef.current = inCheck ? messages.chess.check : null;
      }
      return true;
    },
    [
      applyChessMove,
      getChessColor,
      getChessLegalMoves,
      hasChessLegalMove,
      isChessInCheck,
      messages.chess,
    ],
  );

  const scheduleChessBotMove = useCallback(() => {
    if (appModeRef.current !== "chess") {
      return;
    }
    if (chessModeRef.current !== "bot") {
      return;
    }
    if (chessBotThinkingRef.current) {
      return;
    }
    const botColor = chessBotColorRef.current;
    if (chessTurnRef.current !== botColor) {
      return;
    }
    chessBotThinkingRef.current = true;
    chessStatusRef.current = messages.chess.botThinking;
    dirtyRef.current = true;

    const pickMove = () => {
      const board = chessBoardRef.current;
      const moves: Array<{
        from: GridPoint;
        to: GridPoint;
        capture: boolean;
        score: number;
      }> = [];
      const pieceValue: Record<string, number> = {
        p: 1,
        n: 3,
        b: 3,
        r: 5,
        q: 9,
        k: 100,
      };
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          const piece = board[y]?.[x] ?? "";
          const color = getChessColor(piece);
          if (!piece || color !== botColor) {
            continue;
          }
          const candidates = getChessLegalMoves(board, x, y);
          candidates.forEach((to) => {
            const target = board[to.y]?.[to.x] ?? "";
            const isEnPassant = Boolean(
              piece.toLowerCase() === "p" &&
              x !== to.x &&
              !target &&
              chessEnPassantRef.current &&
              chessEnPassantRef.current.x === to.x &&
              chessEnPassantRef.current.y === to.y,
            );
            const capture = Boolean(target) || isEnPassant;
            const clone = applyChessMove(board, { x, y }, to);
            const promoteRow = botColor === "w" ? 0 : 7;
            if (piece.toLowerCase() === "p" && to.y === promoteRow) {
              clone[to.y][to.x] = botColor === "w" ? "Q" : "q";
            }
            const capturedValue = isEnPassant
              ? pieceValue.p
              : target
                ? (pieceValue[target.toLowerCase()] ?? 0)
                : 0;
            const givesCheck = isChessInCheck(
              clone,
              botColor === "w" ? "b" : "w",
            );
            const score = capturedValue + (givesCheck ? 0.6 : 0);
            moves.push({ from: { x, y }, to, capture, score });
          });
        }
      }
      return moves;
    };

    window.setTimeout(() => {
      if (appModeRef.current !== "chess") {
        chessBotThinkingRef.current = false;
        return;
      }
      if (chessTurnRef.current !== chessBotColorRef.current) {
        chessBotThinkingRef.current = false;
        return;
      }
      const moves = pickMove();
      if (!moves.length) {
        const isCheck = isChessInCheck(
          chessBoardRef.current,
          chessTurnRef.current,
        );
        chessStatusRef.current = isCheck
          ? messages.chess.checkmate
          : messages.chess.stalemate;
        chessBotThinkingRef.current = false;
        dirtyRef.current = true;
        return;
      }
      const difficulty = chessDifficultyRef.current;
      let chosen = moves[Math.floor(Math.random() * moves.length)];
      if (difficulty !== "easy") {
        const sorted = moves.slice().sort((a, b) => b.score - a.score);
        if (difficulty === "medium") {
          const top = sorted.slice(0, Math.min(4, sorted.length));
          chosen = top[Math.floor(Math.random() * top.length)];
        } else {
          chosen = sorted[0];
        }
      }
      const moved = attemptChessMove(chosen.from, chosen.to);
      if (moved) {
        chessSelectedRef.current = null;
      }
      chessBotThinkingRef.current = false;
      dirtyRef.current = true;
      scheduleChessBotMove();
    }, 240);
  }, [
    applyChessMove,
    attemptChessMove,
    getChessColor,
    getChessLegalMoves,
    isChessInCheck,
    messages.chess,
  ]);

  const resetSolitaire = useCallback(() => {
    const deck: SolitaireCard[] = [];
    SOLITAIRE_SUITS.forEach((suit) => {
      SOLITAIRE_RANKS.forEach((rank) =>
        deck.push({ rank, suit, faceUp: false }),
      );
    });
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const tableau: SolitaireCard[][] = [];
    for (let i = 0; i < 7; i += 1) {
      const pile: SolitaireCard[] = [];
      for (let j = 0; j <= i; j += 1) {
        const card = deck.pop() as SolitaireCard;
        pile.push({ ...card, faceUp: j === i });
      }
      tableau.push(pile);
    }
    solitaireTableauRef.current = tableau;
    solitaireStockRef.current = deck.map((card) => ({
      ...card,
      faceUp: false,
    }));
    solitaireWasteRef.current = [];
    solitaireFoundationsRef.current = {
      "♠": [],
      "♥": [],
      "♦": [],
      "♣": [],
    };
    solitaireSelectionRef.current = null;
    solitaireMessageRef.current = messages.solitaire.hint;
    dirtyRef.current = true;
  }, [messages.solitaire.hint]);

  const getSolitaireRankIndex = useCallback(
    (rank: string) => SOLITAIRE_RANKS.findIndex((item) => item === rank),
    [],
  );

  const isSolitaireRed = useCallback(
    (suit: string) => suit === "♥" || suit === "♦",
    [],
  );

  const solitaireCardLabel = useCallback(
    (card: SolitaireCard) => `${card.rank}${card.suit}`,
    [],
  );

  const loadPyodideOnce = useCallback(async () => {
    if (pyodideRef.current) {
      return pyodideRef.current;
    }
    if (pyodideLoadingRef.current) {
      return pyodideLoadingRef.current;
    }
    if (typeof window === "undefined") {
      throw new Error("Python runtime unavailable");
    }
    const scriptSrc =
      "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js";
    const indexURL = "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/";
    pyodideLoadingRef.current = new Promise<PyodideInterface>(
      (resolve, reject) => {
        const existing = document.querySelector(
          `script[src=\"${scriptSrc}\"]`,
        ) as HTMLScriptElement | null;
        if (existing && window.loadPyodide) {
          window
            .loadPyodide({ indexURL })
            .then((runtime) => {
              pyodideRef.current = runtime;
              resolve(runtime);
            })
            .catch(reject);
          return;
        }
        const script = existing ?? document.createElement("script");
        if (!existing) {
          script.src = scriptSrc;
          script.async = true;
          script.onload = () => {
            if (!window.loadPyodide) {
              reject(new Error("loadPyodide missing"));
              return;
            }
            window
              .loadPyodide({ indexURL })
              .then((runtime) => {
                pyodideRef.current = runtime;
                resolve(runtime);
              })
              .catch(reject);
          };
          script.onerror = () => reject(new Error("Failed to load Pyodide"));
          document.head.appendChild(script);
          return;
        }
        reject(new Error("Pyodide load failed"));
      },
    );
    return pyodideLoadingRef.current;
  }, []);

  const runPythonCode = useCallback(
    async (code: string, filename = "<string>") => {
      const runtime = await loadPyodideOnce();
      runtime.globals.set("__code__", code);
      runtime.globals.set("__file__", filename);
      await runtime.runPythonAsync(
        "import sys, io\n__stdout = io.StringIO()\nsys.stdout = __stdout\nsys.stderr = __stdout\n",
      );
      try {
        await runtime.runPythonAsync(
          "import sys\n__globals = {'__name__': '__main__', '__file__': __file__}\nsys.argv = [__file__]\nexec(__code__, __globals)",
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { output: "", error: message };
      }
      const output = runtime.runPython("__stdout.getvalue()") as string;
      return { output, error: null } as {
        output: string;
        error: string | null;
      };
    },
    [loadPyodideOnce],
  );

  const buildAudioFrames = useCallback(
    (bars: number, frames: number, seed = 0) => {
      const result: number[][] = [];
      const rand = mulberry32(seed || 1);
      const phaseJitter = rand() * Math.PI * 2;
      const drift = 0.25 + rand() * 0.35;
      const alt = 0.18 + rand() * 0.22;
      for (let f = 0; f < frames; f += 1) {
        const row: number[] = [];
        for (let i = 0; i < bars; i += 1) {
          const phase = (f / frames) * Math.PI * 2 + i * (0.26 + rand() * 0.12);
          const wave =
            (Math.sin(phase + phaseJitter) +
              Math.sin(phase * (drift + 0.2) + 1.2 + alt)) *
              0.5 +
            0.5;
          row.push(Math.max(0.06, Math.min(1, wave)));
        }
        result.push(row);
      }
      return result;
    },
    [],
  );

  const createDriveCurve = useCallback(() => {
    const curve = new Float32Array(256);
    for (let i = 0; i < curve.length; i += 1) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.4) * 0.45;
    }
    return curve;
  }, []);

  const stopSynthAudio = useCallback((hard = false) => {
    audioOscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // ignore
      }
      try {
        osc.disconnect();
      } catch {
        // ignore
      }
    });
    audioOscillatorsRef.current = [];
    if (audioLfoRef.current) {
      try {
        audioLfoRef.current.stop();
      } catch {
        // ignore
      }
      try {
        audioLfoRef.current.disconnect();
      } catch {
        // ignore
      }
      audioLfoRef.current = null;
    }
    if (audioLfoGainRef.current) {
      try {
        audioLfoGainRef.current.disconnect();
      } catch {
        // ignore
      }
      audioLfoGainRef.current = null;
    }
    if (audioPulseRef.current) {
      try {
        audioPulseRef.current.stop();
      } catch {
        // ignore
      }
      try {
        audioPulseRef.current.disconnect();
      } catch {
        // ignore
      }
      audioPulseRef.current = null;
    }
    if (audioPulseGainRef.current) {
      try {
        audioPulseGainRef.current.disconnect();
      } catch {
        // ignore
      }
      audioPulseGainRef.current = null;
    }
    if (hard) {
      audioDriveRef.current?.disconnect();
      audioFilterRef.current?.disconnect();
      audioMasterRef.current?.disconnect();
      audioDriveRef.current = null;
      audioFilterRef.current = null;
      audioMasterRef.current = null;
    }
  }, []);

  const startSynthAudio = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    const AudioCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) {
      return;
    }
    let ctx = audioContextRef.current;
    if (!ctx) {
      ctx = new AudioCtor();
      audioContextRef.current = ctx;
    }
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }
    if (audioOscillatorsRef.current.length) {
      return;
    }

    const master = audioMasterRef.current ?? ctx.createGain();
    master.gain.value = 0;
    audioMasterRef.current = master;

    const filter = audioFilterRef.current ?? ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1050;
    filter.Q.value = 0.6;
    audioFilterRef.current = filter;

    const drive = audioDriveRef.current ?? ctx.createWaveShaper();
    drive.curve = createDriveCurve();
    drive.oversample = "2x";
    audioDriveRef.current = drive;

    const pulseGain = audioPulseGainRef.current ?? ctx.createGain();
    pulseGain.gain.value = 0.85;
    audioPulseGainRef.current = pulseGain;

    drive.connect(pulseGain);
    pulseGain.connect(filter);
    filter.connect(master);
    master.connect(ctx.destination);

    const oscA = ctx.createOscillator();
    oscA.type = "sawtooth";
    oscA.frequency.value = 110;
    oscA.detune.value = -7;
    const gainA = ctx.createGain();
    gainA.gain.value = 0.24;
    oscA.connect(gainA);
    gainA.connect(drive);

    const oscB = ctx.createOscillator();
    oscB.type = "square";
    oscB.frequency.value = 220;
    oscB.detune.value = 4;
    const gainB = ctx.createGain();
    gainB.gain.value = 0.18;
    oscB.connect(gainB);
    gainB.connect(drive);

    const oscC = ctx.createOscillator();
    oscC.type = "sine";
    oscC.frequency.value = 55;
    oscC.detune.value = -8;
    const gainC = ctx.createGain();
    gainC.gain.value = 0.1;
    oscC.connect(gainC);
    gainC.connect(drive);

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.35;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const pulseOsc = ctx.createOscillator();
    pulseOsc.type = "square";
    pulseOsc.frequency.value = 1.8;
    const pulseDepth = ctx.createGain();
    pulseDepth.gain.value = 0.45;
    pulseOsc.connect(pulseDepth);
    pulseDepth.connect(pulseGain.gain);

    const seed = hashString(playerTitleRef.current || "mp3");
    const rand = mulberry32(seed || 1);
    oscA.type = rand() > 0.5 ? "sawtooth" : "triangle";
    oscA.frequency.value = 96 + rand() * 60;
    oscA.detune.value = -12 + rand() * 24;
    gainA.gain.value = 0.14 + rand() * 0.06;
    oscB.type = rand() > 0.5 ? "square" : "sawtooth";
    oscB.frequency.value = 180 + rand() * 140;
    oscB.detune.value = -6 + rand() * 12;
    gainB.gain.value = 0.1 + rand() * 0.06;
    oscC.frequency.value = 48 + rand() * 28;
    oscC.detune.value = -16 + rand() * 10;
    gainC.gain.value = 0.08 + rand() * 0.05;
    lfo.frequency.value = 0.18 + rand() * 0.6;
    lfoGain.gain.value = 120 + rand() * 120;
    pulseOsc.frequency.value = 1.6 + rand() * 1.2;
    pulseDepth.gain.value = 0.35 + rand() * 0.25;

    oscA.start();
    oscB.start();
    oscC.start();
    lfo.start();
    pulseOsc.start();

    audioOscillatorsRef.current = [oscA, oscB, oscC];
    audioLfoRef.current = lfo;
    audioLfoGainRef.current = lfoGain;
    audioPulseRef.current = pulseOsc;
  }, [createDriveCurve]);

  const computeMp3TargetVolume = useCallback(() => {
    if (appModeRef.current !== "player" || playerModeRef.current !== "mp3") {
      return 0;
    }
    if (typeof document !== "undefined" && document.hidden) {
      return 0;
    }
    if (!playerIsPlayingRef.current) {
      return 0;
    }
    const scroll = scrollProgressRef?.current ?? 0;
    const fadeStart = 0.1;
    const fadeEnd = 0.85;
    const tRaw = (scroll - fadeStart) / Math.max(0.0001, fadeEnd - fadeStart);
    const t = clamp(tRaw, 0, 1);
    const smooth = t * t * (3 - 2 * t);
    const distanceAttenuation = 1 - smooth;
    return clamp(distanceAttenuation, 0, 1);
  }, [scrollProgressRef]);

  useEffect(() => {
    return () => {
      stopSynthAudio(true);
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => undefined);
        audioContextRef.current = null;
      }
    };
  }, [stopSynthAudio]);

  const parseVideoFrames = useCallback((content: string) => {
    const raw = content.trim();
    if (!raw) {
      return ["(empty)"];
    }
    const frames = raw.split(/\n---+\n/);
    return frames.length ? frames : [raw];
  }, []);

  const buildAsciiFromImage = useCallback(
    (image: HTMLImageElement) => {
      const canvas = canvasRef.current;
      const width = canvas?.width ?? 640;
      const maxCols = Math.max(28, Math.min(120, Math.floor(width / 9)));
      const aspect = image.height / Math.max(1, image.width);
      const rows = Math.max(
        14,
        Math.min(80, Math.floor(maxCols * aspect * 0.55)),
      );
      const offscreen = document.createElement("canvas");
      offscreen.width = maxCols;
      offscreen.height = rows;
      const ctx = offscreen.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        return messages.media.unableToLoadImage;
      }
      ctx.drawImage(image, 0, 0, maxCols, rows);
      const { data } = ctx.getImageData(0, 0, maxCols, rows);
      const ramp = " .:-=+*#%@";
      const lines: string[] = [];
      for (let y = 0; y < rows; y += 1) {
        let line = "";
        for (let x = 0; x < maxCols; x += 1) {
          const index = (y * maxCols + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];
          if (a < 12) {
            line += " ";
            continue;
          }
          const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          const gamma = Math.pow(luminance, 0.85);
          const rampIndex = Math.min(
            ramp.length - 1,
            Math.max(0, Math.round(gamma * (ramp.length - 1))),
          );
          line += ramp[rampIndex];
        }
        lines.push(line);
      }
      return lines.join("\n");
    },
    [messages.media.unableToLoadImage],
  );

  const loadImageAscii = useCallback(
    (src: string) =>
      new Promise<string>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        image.onload = () => resolve(buildAsciiFromImage(image));
        image.onerror = () =>
          reject(new Error(messages.media.unableToLoadImage));
        image.src = src;
      }),
    [buildAsciiFromImage, messages.media.unableToLoadImage],
  );

  const resolveImagePlaylist = useCallback(() => {
    const home = envRef.current.HOME || homePath;
    const mediaDir = `${home}/media`;
    const node = findNode(fsRef.current, mediaDir);
    if (!node || node.type !== "dir") {
      return { mediaDir, paths: [] };
    }
    const paths = Object.entries(node.children)
      .filter(
        ([name, child]) =>
          child.type === "file" && /\.(png|jpg|jpeg|txt)$/i.test(name),
      )
      .map(([name]) => `${mediaDir}/${name}`.replace(/\/+/g, "/"))
      .sort();
    return { mediaDir, paths };
  }, [homePath]);

  const stepPlayer = useCallback(() => {
    if (!playerIsPlayingRef.current) {
      return;
    }
    if (playerModeRef.current === "mp3") {
      playerProgressRef.current = Math.min(
        playerDurationRef.current,
        playerProgressRef.current + 1,
      );
      if (playerProgressRef.current >= playerDurationRef.current) {
        playerIsPlayingRef.current = false;
        playerStatusRef.current = messages.media.playbackComplete;
      }
      playerFrameIndexRef.current =
        (playerFrameIndexRef.current + 1) %
        Math.max(1, playerBarsRef.current.length);
    } else if (playerModeRef.current === "video") {
      playerFrameIndexRef.current =
        (playerFrameIndexRef.current + 1) %
        Math.max(1, playerFramesRef.current.length);
      playerProgressRef.current = Math.min(
        playerDurationRef.current,
        playerProgressRef.current + 1,
      );
    }
  }, [messages.media.playbackComplete]);

  const startGameLoop = useCallback(
    (mode: AppMode) => {
      stopGameLoop();
      const baseInterval =
        mode === "snake"
          ? 120
          : mode === "pacman"
            ? 140
            : mode === "pong"
              ? 32
              : mode === "doom"
                ? 34
                : 90;
      const lowPowerInterval =
        mode === "snake"
          ? 200
          : mode === "pacman"
            ? 220
            : mode === "pong"
              ? 52
              : mode === "doom"
                ? 60
                : 150;
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
        } else if (mode === "pong") {
          stepPong();
        } else if (mode === "doom") {
          stepDoom();
        } else if (mode === "player") {
          stepPlayer();
        }
        dirtyRef.current = true;
      }, interval);
    },
    [
      isMobile,
      perfTier,
      stepPacman,
      stepDoom,
      stepPlayer,
      stepPong,
      stepSnake,
      stopGameLoop,
    ],
  );

  const startPlayer = useCallback(
    (mode: "mp3" | "video" | "image", title: string, content?: string) => {
      stopGameLoop();
      appModeRef.current = "player";
      hasTerminalContentRef.current = true;
      playerModeRef.current = mode;
      playerTitleRef.current = title;
      playerFrameIndexRef.current = 0;
      playerProgressRef.current = 0;
      playerStatusRef.current = null;
      playerIsPlayingRef.current = mode !== "image";
      if (mode === "image") {
        playerImageZoomRef.current = 1;
      }
      audioAutoPausedRef.current = false;
      if (mode === "mp3") {
        playerDurationRef.current = 180;
        playerBarsRef.current = buildAudioFrames(32, 48, hashString(title));
        startGameLoop("player");
        void startSynthAudio();
      } else if (mode === "video") {
        playerFramesRef.current = parseVideoFrames(content ?? "");
        playerDurationRef.current = Math.max(1, playerFramesRef.current.length);
        startGameLoop("player");
        stopSynthAudio();
      } else {
        const { paths } = resolveImagePlaylist();
        playerImageListRef.current = paths;
        const baseTitle = title.split("/").pop() ?? title;
        const matchedIndex = paths.findIndex(
          (path) => path === title || path.endsWith(`/${baseTitle}`),
        );
        playerImageIndexRef.current = matchedIndex >= 0 ? matchedIndex : 0;
        playerDurationRef.current = 1;
        playerFramesRef.current = [content ?? "(empty)"];
        stopSynthAudio();
      }
      dirtyRef.current = true;
    },
    [
      buildAudioFrames,
      parseVideoFrames,
      resolveImagePlaylist,
      startGameLoop,
      startSynthAudio,
      stopGameLoop,
      stopSynthAudio,
    ],
  );

  const cycleImage = useCallback(
    (direction: number) => {
      const { paths } = resolveImagePlaylist();
      if (!paths.length) {
        playerStatusRef.current = messages.media.noImagesFound;
        dirtyRef.current = true;
        return;
      }
      const currentTitle = playerTitleRef.current;
      const currentBase = currentTitle.split("/").pop() ?? currentTitle;
      let index = paths.findIndex(
        (path) => path === currentTitle || path.endsWith(`/${currentBase}`),
      );
      if (index < 0) {
        index = playerImageIndexRef.current;
      }
      const nextIndex =
        (index + direction + paths.length) % Math.max(1, paths.length);
      playerImageIndexRef.current = nextIndex;
      const nextPath = paths[nextIndex] ?? paths[0];
      const node = findNode(fsRef.current, nextPath);
      const lower = nextPath.toLowerCase();
      if (lower.endsWith(".txt")) {
        const text = node && node.type === "file" ? node.content : "(empty)";
        startPlayer("image", nextPath, text);
        return;
      }
      const dataSource =
        node &&
        node.type === "file" &&
        node.content.trim().startsWith("data:image/")
          ? node.content.trim()
          : null;
      const src = dataSource ?? nextPath;
      playerStatusRef.current = messages.media.loadingImage;
      dirtyRef.current = true;
      void loadImageAscii(src)
        .then((ascii) => {
          startPlayer("image", nextPath, ascii);
        })
        .catch(() => {
          playerStatusRef.current = messages.media.unableToLoadImage;
          dirtyRef.current = true;
        });
    },
    [
      loadImageAscii,
      messages.media.loadingImage,
      messages.media.noImagesFound,
      messages.media.unableToLoadImage,
      resolveImagePlaylist,
      startPlayer,
    ],
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
      } else if (mode === "pong") {
        resetPong();
        startGameLoop(mode);
      } else if (mode === "calc") {
        resetCalc();
      } else if (mode === "doom") {
        beginDoomBoot();
        resetDoom();
        startGameLoop(mode);
      } else if (mode === "chess") {
        resetChess();
        scheduleChessBotMove();
      } else if (mode === "solitaire") {
        resetSolitaire();
      }
      dirtyRef.current = true;
    },
    [
      placeSnakeFood,
      resetCalc,
      resetChess,
      resetDoom,
      resetPacman,
      resetPong,
      resetSnake,
      resetSolitaire,
      scheduleChessBotMove,
      startGameLoop,
      stopGameLoop,
      beginDoomBoot,
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
    const mode = appModeRef.current;
    if (!isActive) {
      if (mode !== "player") {
        stopGameLoop();
      }
      return;
    }
    if (
      mode === "snake" ||
      mode === "pacman" ||
      mode === "pong" ||
      mode === "doom" ||
      mode === "player"
    ) {
      startGameLoop(mode);
    }
  }, [isActive, startGameLoop, stopGameLoop]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isActive) {
      audioTargetRef.current = 0;
      audioVolumeRef.current = 0;
      stopSynthAudio();
      if (audioTimerRef.current) {
        window.clearTimeout(audioTimerRef.current);
        audioTimerRef.current = null;
      }
      return;
    }
    if (audioTimerRef.current) {
      window.clearTimeout(audioTimerRef.current);
    }
    let alive = true;
    audioLastTickRef.current =
      typeof performance !== "undefined" ? performance.now() : 0;

    const tick = () => {
      if (!alive) {
        return;
      }
      const now = typeof performance !== "undefined" ? performance.now() : 0;
      const dt = Math.max(0, now - (audioLastTickRef.current || now));
      audioLastTickRef.current = now;
      const target = computeMp3TargetVolume();
      audioTargetRef.current = target;
      const ctx = audioContextRef.current;
      const master = audioMasterRef.current;
      if (ctx && master) {
        const { current } = audioVolumeRef;
        const tau = 200;
        const alpha = tau > 0 ? 1 - Math.exp(-dt / tau) : 1;
        const next = current + (target - current) * alpha;
        audioVolumeRef.current = next;
        master.gain.setTargetAtTime(next * 0.24, ctx.currentTime, 0.18);
        if (audioFilterRef.current) {
          audioFilterRef.current.frequency.setTargetAtTime(
            420 + next * 1200,
            ctx.currentTime,
            0.22,
          );
        }
      }

      const isMp3Player =
        appModeRef.current === "player" && playerModeRef.current === "mp3";
      const shouldAudiblyPlay =
        isMp3Player &&
        playerIsPlayingRef.current &&
        target > 0.02 &&
        !(typeof document !== "undefined" && document.hidden);

      if (shouldAudiblyPlay) {
        if (!audioOscillatorsRef.current.length) {
          void startSynthAudio();
        }
      } else if (audioOscillatorsRef.current.length) {
        stopSynthAudio();
      }

      const delay =
        shouldAudiblyPlay || audioOscillatorsRef.current.length
          ? 50
          : isMp3Player && playerIsPlayingRef.current
            ? 120
            : 260;
      audioTimerRef.current = window.setTimeout(tick, delay);
    };

    audioTimerRef.current = window.setTimeout(tick, 120);
    return () => {
      alive = false;
      if (audioTimerRef.current) {
        window.clearTimeout(audioTimerRef.current);
        audioTimerRef.current = null;
      }
    };
  }, [computeMp3TargetVolume, isActive, startSynthAudio, stopSynthAudio]);

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

  const runPipCommand = useCallback(
    (pipArgs: string[]) => {
      if (!pipArgs.length || pipArgs.includes("--help")) {
        appendLine(messages.pip.help);
        return;
      }
      const [action, ...rest] = pipArgs;
      const packages = pipPackagesRef.current;
      if (action === "list" || action === "freeze") {
        packages.forEach((pkg) => appendLine(pkg));
        return;
      }
      if (action === "install") {
        if (!rest.length) {
          appendLine(messages.pip.missingPackage);
          return;
        }
        rest.forEach((pkg) => {
          if (!packages.includes(pkg)) {
            packages.push(pkg);
          }
          appendLine(formatMessage(messages.pip.installed, { pkg }));
        });
        packages.sort();
        return;
      }
      if (action === "uninstall") {
        if (!rest.length) {
          appendLine(messages.pip.missingPackage);
          return;
        }
        rest.forEach((pkg) => {
          const index = packages.indexOf(pkg);
          if (index >= 0) {
            packages.splice(index, 1);
            appendLine(formatMessage(messages.pip.uninstalled, { pkg }));
          } else {
            appendLine(formatMessage(messages.pip.packageNotFound, { pkg }));
          }
        });
        return;
      }
      appendLine(formatMessage(messages.pip.unknownCommand, { cmd: action }));
    },
    [appendLine, formatMessage, messages.pip],
  );

  const stopApp = useCallback(
    (message?: string) => {
      stopGameLoop();
      stopSynthAudio();
      audioAutoPausedRef.current = false;
      const ended = appModeRef.current;
      appModeRef.current = null;
      if (ended) {
        appendLine(
          message ?? formatMessage(messages.system.exit, { app: ended }),
        );
      }
      dirtyRef.current = true;
    },
    [
      appendLine,
      formatMessage,
      messages.system.exit,
      stopGameLoop,
      stopSynthAudio,
    ],
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

  const formatEditorLine = useCallback(
    (line: string, index: number, showLineNumbers: boolean) =>
      showLineNumbers ? `${String(index + 1).padStart(3, " ")}| ${line}` : line,
    [],
  );

  const printEditorBuffer = useCallback(
    (state: EditorState) => {
      appendLine(
        formatMessage(messages.editor.header, {
          path: state.path,
          lines: String(state.buffer.length),
        }),
      );
      state.buffer.forEach((line, index) => {
        appendLine(formatEditorLine(line, index, state.showLineNumbers));
      });
    },
    [appendLine, formatEditorLine, formatMessage, messages.editor.header],
  );

  const handleEditorInputLine = useCallback(
    (inputLine: string) => {
      const state = editorRef.current;
      if (!state) {
        return false;
      }
      appendLine(inputLine);
      const trimmed = inputLine.trim();
      if (trimmed.startsWith(":")) {
        const parts = trimmed.slice(1).split(/\s+/).filter(Boolean);
        const cmd = parts[0] ?? "";
        const arg = parts.slice(1).join(" ");
        const saveTo = (path: string) => {
          const sanitized = state.buffer.filter(
            (line) => !/^:\w/.test(line.trim()),
          );
          const ok = writeFile(path, sanitized.join("\n"), { create: true });
          if (!ok) {
            appendLine(messages.editor.saveFailed);
            return false;
          }
          state.modified = false;
          return true;
        };
        if (cmd === "q") {
          if (state.modified) {
            appendLine(messages.editor.unsavedChanges);
          } else {
            editorRef.current = null;
            appendLine(messages.editor.exit);
          }
        } else if (cmd === "q!") {
          editorRef.current = null;
          appendLine(messages.editor.exit);
        } else if (cmd === "w" && arg) {
          if (saveTo(arg)) {
            state.path = arg;
            appendLine(formatMessage(messages.editor.savedAs, { path: arg }));
          }
        } else if (cmd === "w") {
          if (saveTo(state.path)) {
            appendLine(messages.editor.saved);
          }
        } else if (cmd === "wq") {
          if (saveTo(state.path)) {
            appendLine(messages.editor.saved);
            editorRef.current = null;
            appendLine(messages.editor.exit);
          }
        } else if (cmd === "set") {
          if (arg === "nu" || arg === "number") {
            state.showLineNumbers = true;
            appendLine(messages.editor.lineNumbersOn);
          } else if (arg === "nonu" || arg === "nonumber") {
            state.showLineNumbers = false;
            appendLine(messages.editor.lineNumbersOff);
          } else {
            appendLine(messages.editor.usageSet);
          }
        } else if (cmd === "p") {
          printEditorBuffer(state);
        } else if (cmd === "help") {
          appendLine(messages.editor.help);
        } else if (cmd === "d") {
          const index = Number.parseInt(parts[1] ?? "", 10) - 1;
          if (
            Number.isNaN(index) ||
            index < 0 ||
            index >= state.buffer.length
          ) {
            appendLine(messages.editor.invalidLineNumber);
          } else {
            state.buffer.splice(index, 1);
            state.modified = true;
            appendLine(
              formatMessage(messages.editor.lineDeleted, {
                line: String(index + 1),
              }),
            );
          }
        } else if (cmd === "i") {
          const index = Number.parseInt(parts[1] ?? "", 10) - 1;
          if (Number.isNaN(index) || index < 0) {
            appendLine(messages.editor.invalidLineNumber);
          } else {
            const text = parts.slice(2).join(" ");
            if (index >= state.buffer.length) {
              while (state.buffer.length < index) {
                state.buffer.push("");
              }
              state.buffer.push(text);
            } else {
              state.buffer.splice(index, 0, text);
            }
            state.modified = true;
            appendLine(
              formatMessage(messages.editor.lineInserted, {
                line: String(Math.min(index + 1, state.buffer.length)),
              }),
            );
          }
        } else {
          appendLine(messages.editor.unknownCommand);
        }
        syncInputValue("");
        dirtyRef.current = true;
        return true;
      }
      const lineMatch = inputLine.match(/^\s*(\d+)\s*:\s*(.*)$/);
      if (lineMatch) {
        const index = Number.parseInt(lineMatch[1], 10) - 1;
        if (Number.isNaN(index) || index < 0) {
          appendLine(messages.editor.invalidLineNumber);
        } else {
          const text = lineMatch[2] ?? "";
          const wasExisting = index < state.buffer.length;
          while (state.buffer.length <= index) {
            state.buffer.push("");
          }
          state.buffer[index] = text;
          state.modified = true;
          appendLine(
            formatMessage(
              wasExisting
                ? messages.editor.lineUpdated
                : messages.editor.lineAdded,
              { line: String(index + 1) },
            ),
          );
        }
        syncInputValue("");
        dirtyRef.current = true;
        return true;
      }
      state.buffer.push(inputLine);
      state.modified = true;
      syncInputValue("");
      dirtyRef.current = true;
      return true;
    },
    [
      appendLine,
      formatMessage,
      messages.editor,
      printEditorBuffer,
      syncInputValue,
      writeFile,
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
              appendLine(messages.commands.echoMissingFile);
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
          appendLine(new Date().toLocaleString(languageMeta[language].locale));
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
            appendLine(messages.system.historyCleared);
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
              appendLine(
                formatMessage(messages.commands.mkdirCannotCreate, {
                  dir: value,
                }),
              );
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
            appendLine(messages.commands.rmMissingOperand);
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
              appendLine(
                formatMessage(messages.commands.rmIsDirectory, {
                  path: value,
                }),
              );
              return;
            }
            removeNode(value, recursive);
          });
          break;
        }
        case "rmdir": {
          if (!params.length) {
            appendLine(messages.commands.rmdirMissingOperand);
            break;
          }
          params.forEach((value) => {
            const node = findNode(fsRef.current, resolveArg(value));
            if (!node || node.type !== "dir") {
              reportNoDir(value);
              return;
            }
            if (Object.keys(node.children).length > 0) {
              appendLine(
                formatMessage(messages.commands.rmdirNotEmpty, {
                  path: value,
                }),
              );
              return;
            }
            removeNode(value, true);
          });
          break;
        }
        case "cp": {
          if (params.length < 2) {
            appendLine(messages.commands.cpMissingOperand);
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
              appendLine(
                formatMessage(messages.commands.cpIsDirectory, {
                  path: source,
                }),
              );
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
            appendLine(messages.commands.mvMissingOperand);
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
            appendLine(messages.commands.catMissingOperand);
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
            appendLine(messages.editor.missingFile);
            break;
          }
          const targetPath = resolveArg(arg);
          const node = findNode(fsRef.current, targetPath);
          if (node && node.type === "dir") {
            appendLine(messages.editor.targetIsDirectory);
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
            showLineNumbers: true,
            modified: false,
          };
          appendLine(formatMessage(messages.editor.editing, { path: arg }));
          appendLine(messages.editor.help);
          if (content) {
            printEditorBuffer(editorRef.current);
          }
          break;
        }
        case "head":
        case "tail": {
          if (!params.length) {
            appendLine(
              formatMessage(messages.commands.headMissingOperand, { cmd }),
            );
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
            appendLine(messages.commands.grepMissing);
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
            appendLine(messages.commands.whichMissing);
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
            appendLine(
              formatMessage(messages.commands.whichBuiltin, {
                cmd: commandName,
              }),
            );
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
            appendLine(
              formatMessage(messages.commands.whichNotFound, {
                cmd: commandName,
              }),
            );
          }
          break;
        }
        case "man": {
          const target = params[0];
          if (!target) {
            appendLine(messages.commands.manMissingTopic);
            break;
          }
          const manualsTr: Record<string, string[]> = {
            help: ["help - komut listesi", "Kullanım: help"],
            man: ["man - komut yardım sayfası", "Kullanım: man <komut>"],
            ls: [
              "ls - dizin içeriğini listeler",
              "Kullanım: ls [-a] [-l] [dizin]",
              "-a: gizli dosyaları göster  -l: uzun liste",
            ],
            cd: ["cd - dizin değiştir", "Kullanım: cd [dizin|-]"],
            pwd: ["pwd - mevcut dizini yazdır", "Kullanım: pwd"],
            cat: ["cat - dosya içeriklerini yazdır", "Kullanım: cat <dosya>"],
            less: ["less - dosya görüntüle", "Kullanım: less <dosya>"],
            head: [
              "head - dosyanın başından satır alır",
              "Kullanım: head [-n N] <dosya>",
            ],
            tail: [
              "tail - dosyanın sonundan satır alır",
              "Kullanım: tail [-n N] <dosya>",
            ],
            tree: ["tree - dizin ağacı", "Kullanım: tree [-L N] [dizin]"],
            find: [
              "find - dosya/dizin ara",
              "Kullanım: find [dizin] -name <kalip>",
            ],
            grep: [
              "grep - içerikte ara",
              "Kullanım: grep [-i] [-r] <kalip> <dosya|dizin>",
            ],
            mkdir: ["mkdir - dizin oluştur", "Kullanım: mkdir [-p] <ad>"],
            touch: ["touch - dosya oluştur", "Kullanım: touch <dosya>"],
            rm: ["rm - dosya/dizin sil", "Kullanım: rm [-r] [-f] <yol>"],
            rmdir: ["rmdir - boş dizin sil", "Kullanım: rmdir <dizin>"],
            mv: ["mv - taşı/yeniden adlandır", "Kullanım: mv <kaynak> <hedef>"],
            cp: ["cp - kopyala", "Kullanım: cp [-r] <kaynak> <hedef>"],
            echo: ["echo - metin yazdır", "Kullanım: echo <metin> [> dosya]"],
            clear: ["clear - ekran temizle", "Kullanım: clear"],
            history: ["history - komut geçmişi", "Kullanım: history [-c]"],
            env: ["env - ortam değişkenleri", "Kullanım: env"],
            export: [
              "export - ortam değişkeni ayarla",
              "Kullanım: export KEY=VALUE",
            ],
            alias: ["alias - kısayol tanımla", "Kullanım: alias isim=komut"],
            unalias: ["unalias - kısayol sil", "Kullanım: unalias isim"],
            which: ["which - komut yolunu göster", "Kullanım: which <komut>"],
            python: [
              "python - runtime (pyodide)",
              "Kullanım: python -c <code> | python <file.py>",
            ],
            pip: [
              "pip - paket yöneticisi (simülasyon)",
              "Kullanım: pip list | pip install <paket>",
            ],
            calc: ["calc - hesap makinesi", "Kullanım: calc [ifade]"],
            snake: ["snake - mini oyun"],
            pacman: ["pacman - mini oyun"],
            pong: ["pong - mini oyun"],
            doom: ["doom - retro mini oyun"],
            chess: [
              "chess - minimalist satranç",
              "Kullanım: chess [--pvp|--bot[=white|black]] [--easy|--medium|--hard]",
              "Oyun içi: 1/2/3 zorluk, B bot, P pvp, C bot rengi",
            ],
            solitaire: ["solitaire - mini kart oyunu"],
            mp3: ["mp3 - ascii player", "Kullanım: mp3 [dosya.mp3]"],
            video: ["video - ascii player", "Kullanım: video [dosya.vid]"],
            image: [
              "image - ascii görüntüleyici",
              "Kullanım: image <dosya.png|dosya.jpg|dosya.txt>",
            ],
            edit: ["edit - basit düzenleyici", "Kullanım: edit <dosya>"],
          };
          const manualsEn: Record<string, string[]> = {
            help: ["help - command list", "Usage: help"],
            man: ["man - command help", "Usage: man <cmd>"],
            ls: [
              "ls - list directory contents",
              "Usage: ls [-a] [-l] [dir]",
              "-a: show hidden  -l: long list",
            ],
            cd: ["cd - change directory", "Usage: cd [dir|-]"],
            pwd: ["pwd - print working directory", "Usage: pwd"],
            cat: ["cat - print files", "Usage: cat <file>"],
            less: ["less - view file", "Usage: less <file>"],
            head: ["head - print first lines", "Usage: head [-n N] <file>"],
            tail: ["tail - print last lines", "Usage: tail [-n N] <file>"],
            tree: ["tree - directory tree", "Usage: tree [-L N] [dir]"],
            find: ["find - search files", "Usage: find [dir] -name <pattern>"],
            grep: [
              "grep - search content",
              "Usage: grep [-i] [-r] <pattern> <file|dir>",
            ],
            mkdir: ["mkdir - create directory", "Usage: mkdir [-p] <name>"],
            touch: ["touch - create file", "Usage: touch <file>"],
            rm: ["rm - remove file/dir", "Usage: rm [-r] [-f] <path>"],
            rmdir: ["rmdir - remove empty dir", "Usage: rmdir <dir>"],
            mv: ["mv - move/rename", "Usage: mv <src> <dest>"],
            cp: ["cp - copy", "Usage: cp [-r] <src> <dest>"],
            echo: ["echo - print text", "Usage: echo <text> [> file]"],
            clear: ["clear - clear screen", "Usage: clear"],
            history: ["history - command history", "Usage: history [-c]"],
            env: ["env - list env vars", "Usage: env"],
            export: ["export - set env var", "Usage: export KEY=VALUE"],
            alias: ["alias - define alias", "Usage: alias name=cmd"],
            unalias: ["unalias - remove alias", "Usage: unalias name"],
            which: ["which - show command path", "Usage: which <cmd>"],
            python: [
              "python - runtime (pyodide)",
              "Usage: python -c <code> | python <file.py>",
            ],
            pip: [
              "pip - simulated package manager",
              "Usage: pip list | pip install <pkg>",
            ],
            calc: ["calc - calculator", "Usage: calc [expression]"],
            snake: ["snake - mini game"],
            pacman: ["pacman - mini game"],
            pong: ["pong - mini game"],
            doom: ["doom - retro mini game"],
            chess: [
              "chess - minimalist board",
              "Usage: chess [--pvp|--bot[=white|black]] [--easy|--medium|--hard]",
              "In-game: 1/2/3 difficulty, B bot, P pvp, C bot color",
            ],
            solitaire: ["solitaire - mini card game"],
            mp3: ["mp3 - ascii player", "Usage: mp3 [file.mp3]"],
            video: ["video - ascii player", "Usage: video [file.vid]"],
            image: [
              "image - ascii viewer",
              "Usage: image <file.png|file.jpg|file.txt>",
            ],
            edit: ["edit - simple editor", "Usage: edit <file>"],
          };
          const manuals = language === "tr" ? manualsTr : manualsEn;
          const manual = manuals[target];
          if (manual) {
            manual.forEach((line) => appendLine(line));
          } else {
            appendLine(
              formatMessage(messages.commands.manNoEntry, { topic: target }),
            );
          }
          break;
        }
        case "pip": {
          runPipCommand(args);
          break;
        }
        case "python":
        case "python2": {
          if (hasFlag("V") || hasFlag("v")) {
            appendLine(messages.python.version);
            break;
          }
          const moduleIndex = args.findIndex((value) => value === "-m");
          if (moduleIndex >= 0 && args[moduleIndex + 1] === "pip") {
            runPipCommand(args.slice(moduleIndex + 2));
            break;
          }
          if (!params.length) {
            appendLine(messages.python.version);
            appendLine(messages.python.usage);
            break;
          }
          const codeIndex = args.findIndex((value) => value === "-c");
          if (codeIndex >= 0) {
            const code = args.slice(codeIndex + 1).join(" ");
            if (!code) {
              appendLine(messages.python.missingCode);
              break;
            }
            appendLine(">>> " + code);
            if (!pyodideRef.current) {
              appendLine(messages.python.loading);
            }
            void runPythonCode(code, "<string>").then(({ output, error }) => {
              if (error) {
                appendLine(formatMessage(messages.python.error, { error }));
                return;
              }
              output
                .split("\n")
                .filter((line) => line.length > 0)
                .forEach((line) => appendLine(line));
              if (!output.trim()) {
                appendLine(messages.system.noOutput);
              }
            });
            break;
          }
          const scriptPath = params[0];
          const node = findNode(fsRef.current, resolveArg(scriptPath));
          if (!node || node.type !== "file") {
            appendLine(
              formatMessage(messages.python.cantOpen, { file: scriptPath }),
            );
            break;
          }
          if (!pyodideRef.current) {
            appendLine(messages.python.loading);
          }
          const resolvedScript = resolveArg(scriptPath);
          void runPythonCode(node.content, resolvedScript).then(
            ({ output, error }) => {
              if (error) {
                appendLine(formatMessage(messages.python.error, { error }));
                return;
              }
              output
                .split("\n")
                .filter((line) => line.length > 0)
                .forEach((line) => appendLine(line));
              if (!output.trim()) {
                appendLine(messages.system.noOutput);
              }
            },
          );
          break;
        }
        case "mp3": {
          const mediaDir = `${home}/media`;
          const entries = listDir(mediaDir) ?? [];
          const pickRandom = (ext: string) => {
            const options = entries.filter((entry) =>
              entry.toLowerCase().endsWith(ext),
            );
            if (!options.length) {
              return null;
            }
            return `${mediaDir}/${options[Math.floor(Math.random() * options.length)]}`;
          };
          const target = params[0] ?? pickRandom(".mp3");
          if (!target) {
            appendLine(messages.media.mp3NoMedia);
            break;
          }
          const node = findNode(fsRef.current, resolveArg(target));
          if (!node || node.type !== "file") {
            reportNoFile(target);
            break;
          }
          startPlayer("mp3", target);
          break;
        }
        case "video": {
          const mediaDir = `${home}/media`;
          const entries = listDir(mediaDir) ?? [];
          const pickRandom = (ext: string) => {
            const options = entries.filter((entry) =>
              entry.toLowerCase().endsWith(ext),
            );
            if (!options.length) {
              return null;
            }
            return `${mediaDir}/${options[Math.floor(Math.random() * options.length)]}`;
          };
          const target = params[0] ?? pickRandom(".vid");
          if (!target) {
            appendLine(messages.media.videoNoMedia);
            break;
          }
          const node = findNode(fsRef.current, resolveArg(target));
          if (!node || node.type !== "file") {
            reportNoFile(target);
            break;
          }
          startPlayer("video", target, node.content);
          break;
        }
        case "image": {
          const mediaDir = `${home}/media`;
          const entries = listDir(mediaDir) ?? [];
          const pickRandom = (exts: string[]) => {
            const options = entries.filter((entry) =>
              exts.some((ext) => entry.toLowerCase().endsWith(ext)),
            );
            if (!options.length) {
              return null;
            }
            return `${mediaDir}/${options[Math.floor(Math.random() * options.length)]}`;
          };
          const target =
            params[0] ?? pickRandom([".txt", ".png", ".jpg", ".jpeg"]);
          if (!target) {
            appendLine(messages.media.imageNoMedia);
            break;
          }
          const lower = target.toLowerCase();
          const isText = lower.endsWith(".txt");
          const isImage =
            lower.endsWith(".png") ||
            lower.endsWith(".jpg") ||
            lower.endsWith(".jpeg");
          if (isText) {
            const node = findNode(fsRef.current, resolveArg(target));
            if (!node || node.type !== "file") {
              reportNoFile(target);
              break;
            }
            startPlayer("image", target, node.content);
            break;
          }
          if (!isImage) {
            appendLine(messages.media.imageUnsupported);
            break;
          }
          const imageNode = findNode(fsRef.current, resolveArg(target));
          const dataSource =
            imageNode &&
            imageNode.type === "file" &&
            imageNode.content.trim().startsWith("data:image/")
              ? imageNode.content.trim()
              : null;
          const resolved = resolveArg(target);
          const src =
            dataSource ||
            (/^https?:\/\//i.test(target)
              ? target
              : resolved.startsWith("/")
                ? resolved
                : `/${resolved}`);
          appendLine(
            formatMessage(messages.media.imageLoading, { file: target }),
          );
          void loadImageAscii(src)
            .then((ascii) => {
              startPlayer("image", target, ascii);
            })
            .catch((error) => {
              const message =
                error instanceof Error
                  ? error.message
                  : messages.media.unableToLoadImage;
              appendLine(
                formatMessage(messages.media.imageLoadError, {
                  error: message,
                }),
              );
            });
          break;
        }
        case "calc": {
          const expr = params.join(" ");
          if (!expr) {
            appendLine(messages.calc.launch);
            startApp("calc");
            break;
          }
          if (!/^[0-9a-zA-Z+\-*/^().,\s]+$/.test(expr)) {
            appendLine(messages.calc.invalidChars);
            break;
          }
          try {
            const result = evaluateScientificExpression(expr);
            appendLine(String(result));
          } catch {
            appendLine(messages.calc.evalError);
          }
          break;
        }
        case "snake":
          appendLine(messages.apps.launchSnake);
          startApp("snake");
          break;
        case "pacman":
          appendLine(messages.apps.launchPacman);
          startApp("pacman");
          break;
        case "pong":
          appendLine(messages.apps.launchPong);
          startApp("pong");
          break;
        case "doom":
          appendLine(doomText("launch"));
          startApp("doom");
          break;
        case "chess":
          {
            const lowerArgs = args.map((value) => value.toLowerCase());
            const difficulty = lowerArgs.find((value) =>
              [
                "--easy",
                "--medium",
                "--hard",
                "easy",
                "medium",
                "hard",
              ].includes(value),
            );
            if (difficulty) {
              const normalized = difficulty.replace("--", "") as
                | "easy"
                | "medium"
                | "hard";
              chessDifficultyRef.current = normalized;
            }
            const botToken = lowerArgs.find(
              (value) =>
                value === "--bot" ||
                value === "bot" ||
                value.startsWith("--bot="),
            );
            const pvpToken = lowerArgs.find(
              (value) => value === "--pvp" || value === "pvp",
            );
            if (pvpToken) {
              chessModeRef.current = "pvp";
            }
            if (botToken) {
              chessModeRef.current = "bot";
              const colorValue = botToken.includes("=")
                ? botToken.split("=")[1]
                : "black";
              if (colorValue === "white" || colorValue === "w") {
                chessBotColorRef.current = "w";
              } else if (colorValue === "black" || colorValue === "b") {
                chessBotColorRef.current = "b";
              }
            }
            appendLine(messages.apps.launchChess);
            appendLine(
              formatMessage(messages.apps.modeStatus, {
                mode: chessModeRef.current,
                difficulty: chessDifficultyRef.current,
              }),
              theme.palette.terminalDim,
            );
            startApp("chess");
          }
          break;
        case "solitaire":
          appendLine(messages.apps.launchSolitaire);
          startApp("solitaire");
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
      doomText,
      listDir,
      loadImageAscii,
      messages,
      printFile,
      printEditorBuffer,
      profileName,
      removeNode,
      runPipCommand,
      runPythonCode,
      startApp,
      startPlayer,
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

      if (perfTier !== "low" && !isMobile && gradientCache.glass) {
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

      if (mode === "player") {
        const pad = Math.floor(Math.min(width, height) * 0.12);
        const boxW = width - pad * 2;
        const boxH = height - pad * 2;
        ctx.strokeStyle = dim;
        ctx.lineWidth = 2;
        ctx.strokeRect(pad, pad, boxW, boxH);
        ctx.fillStyle = accent;
        const playerMode = playerModeRef.current ?? "media";
        ctx.fillText(
          formatMessage(messages.ui.player, {
            mode: playerMode.toUpperCase(),
          }),
          pad + 12,
          pad + 8,
        );
        ctx.fillStyle = dim;
        ctx.fillText(playerTitleRef.current, pad + 12, pad + 32);

        const innerTop = pad + 64;
        const innerHeight = boxH - 120;
        if (playerMode === "mp3") {
          const bars = playerBarsRef.current[playerFrameIndexRef.current] ?? [];
          const barCount = Math.max(1, bars.length);
          const barWidth = Math.max(4, Math.floor(boxW / (barCount + 2)));
          const maxBarHeight = Math.max(18, Math.floor(innerHeight * 0.7));
          bars.forEach((value, index) => {
            const heightScale = Math.floor(value * maxBarHeight);
            const x = pad + barWidth + index * barWidth;
            const y = innerTop + innerHeight - heightScale;
            ctx.fillStyle = "#f6c27a";
            ctx.fillRect(x, y, barWidth - 2, heightScale);
          });
        } else {
          const frame =
            playerFramesRef.current[playerFrameIndexRef.current] ?? "";
          const lines = frame.split("\n");
          const isImage = playerMode === "image";
          const zoom = isImage ? clamp(playerImageZoomRef.current, 0.5, 3) : 1;
          const fontSizeAscii = Math.max(8, Math.floor(fontSize * 0.95 * zoom));
          ctx.font = `${fontSizeAscii}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
          const lineHeight = Math.floor(fontSizeAscii * 1.35);
          const maxLines = Math.max(1, Math.floor(innerHeight / lineHeight));
          const charWidth = Math.max(1, ctx.measureText("M").width || 1);
          const maxChars = Math.max(1, Math.floor((boxW - 24) / charWidth));
          ctx.save();
          ctx.beginPath();
          ctx.rect(pad + 12, innerTop, boxW - 24, innerHeight);
          ctx.clip();
          lines.slice(0, maxLines).forEach((line, index) => {
            const visible = isImage ? line.slice(0, maxChars) : line;
            ctx.fillStyle = accent;
            ctx.fillText(visible, pad + 12, innerTop + index * lineHeight);
          });
          ctx.restore();
          ctx.font = `${headerSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        }

        const progress =
          playerDurationRef.current > 0
            ? playerProgressRef.current / playerDurationRef.current
            : 0;
        const barW = Math.floor(boxW * 0.78);
        const barX = pad + 12;
        const barY = pad + boxH - 44;
        ctx.strokeStyle = dim;
        ctx.strokeRect(barX, barY, barW, 10);
        ctx.fillStyle = accent;
        ctx.fillRect(barX, barY, Math.floor(barW * progress), 10);
        if (playerStatusRef.current) {
          ctx.fillStyle = dim;
          ctx.fillText(playerStatusRef.current, pad + 12, pad + boxH - 24);
        }
        ctx.fillStyle = dim;
        const controlsText =
          playerMode === "image"
            ? messages.ui.playerControlsImage
            : messages.ui.playerControlsMedia;
        ctx.fillText(controlsText, pad + 12, pad + boxH + 6);
      } else if (mode === "calc") {
        const pad = Math.floor(Math.min(width, height) * 0.12);
        const boxW = width - pad * 2;
        const boxH = height - pad * 2;
        ctx.strokeStyle = dim;
        ctx.lineWidth = 2;
        ctx.strokeRect(pad, pad, boxW, boxH);
        ctx.fillStyle = accent;
        ctx.fillText(messages.ui.sciCalc, pad + 12, pad + 8);
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
        const gridTop = pad + 120;
        const gridBottom = height - pad - 18;
        const gridHeight = Math.max(120, gridBottom - gridTop);
        const rows = CALC_BUTTONS.length;
        const cols = Math.max(...CALC_BUTTONS.map((row) => row.length));
        const buttonW = Math.floor((boxW - 24) / cols);
        const buttonH = Math.floor(gridHeight / rows);
        const startX = pad + 12;
        const cursor = calcCursorRef.current;
        ctx.font = `${Math.max(10, Math.floor(fontSize * 0.85))}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        CALC_BUTTONS.forEach((row, rowIndex) => {
          row.forEach((label, colIndex) => {
            const x = startX + colIndex * buttonW;
            const y = gridTop + rowIndex * buttonH;
            const isActive = cursor.row === rowIndex && cursor.col === colIndex;
            ctx.fillStyle = isActive ? accent : "rgba(255,255,255,0.06)";
            ctx.fillRect(x + 2, y + 2, buttonW - 4, buttonH - 4);
            ctx.strokeStyle = isActive ? accent : dim;
            ctx.strokeRect(x + 2, y + 2, buttonW - 4, buttonH - 4);
            ctx.fillStyle = isActive ? "#0b0f0e" : accent;
            const textWidth = ctx.measureText(label).width;
            const textX = x + buttonW / 2 - textWidth / 2;
            const textY = y + buttonH / 2 - 6;
            ctx.fillText(label, textX, textY + 6);
          });
        });
        ctx.fillStyle = dim;
        ctx.fillText(messages.ui.calcControls, pad + 12, height - pad - 6);
      } else if (mode === "doom") {
        const map = doomMapRef.current;
        const pad = Math.floor(Math.min(width, height) * 0.1);
        const viewX = pad;
        const viewY = pad;
        const viewW = width - pad * 2;
        const viewH = height - pad * 2;
        const bootProgress = getDoomBootProgress();
        if (bootProgress < 1) {
          ctx.fillStyle = "#120d0b";
          ctx.fillRect(viewX, viewY, viewW, viewH);
          ctx.fillStyle = "#1a1411";
          ctx.fillRect(viewX, viewY, viewW, Math.floor(viewH * 0.55));
          ctx.fillStyle = "#2b231d";
          ctx.fillRect(
            viewX,
            viewY + Math.floor(viewH * 0.55),
            viewW,
            Math.ceil(viewH * 0.45),
          );
          ctx.fillStyle = theme.palette.terminalText;
          ctx.fillText(messages.ui.retroFps, viewX + 12, viewY + 10);
          ctx.fillStyle = theme.palette.terminalDim;
          ctx.fillText(doomText("loading"), viewX + 12, viewY + 34);
          const barW = Math.floor(viewW * 0.6);
          const barH = 12;
          const barX = Math.floor(viewX + (viewW - barW) / 2);
          const barY = Math.floor(viewY + viewH * 0.62);
          ctx.strokeStyle = theme.palette.terminalDim;
          ctx.strokeRect(barX, barY, barW, barH);
          ctx.fillStyle = "#f4d35e";
          ctx.fillRect(
            barX + 1,
            barY + 1,
            Math.floor((barW - 2) * bootProgress),
            barH - 2,
          );
          ctx.fillStyle = theme.palette.terminalDim;
          ctx.fillText(
            `${Math.floor(bootProgress * 100)}%`,
            barX + barW + 10,
            barY - 2,
          );
          finalizeFrame();
          return;
        }
        ctx.fillStyle = "#1b1512";
        ctx.fillRect(viewX, viewY, viewW, viewH);
        ctx.fillStyle = "#1a1411";
        ctx.fillRect(viewX, viewY, viewW, Math.floor(viewH / 2));
        ctx.fillStyle = "#2b231d";
        ctx.fillRect(
          viewX,
          viewY + Math.floor(viewH / 2),
          viewW,
          Math.ceil(viewH / 2),
        );
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = "#000";
        for (let y = viewY + Math.floor(viewH / 2); y < viewY + viewH; y += 6) {
          ctx.fillRect(viewX, y, viewW, 1);
        }
        ctx.fillStyle = "#fff";
        for (let y = viewY + 6; y < viewY + viewH / 2; y += 8) {
          ctx.fillRect(viewX, y, viewW, 1);
        }
        ctx.globalAlpha = 1;
        if (map.length) {
          const player = doomPlayerRef.current;
          const fov = Math.PI / 3;
          const rayDivisor =
            perfTier === "low" ? 5 : perfTier === "mid" ? 4 : 3;
          const rayCount = Math.max(28, Math.floor(viewW / rayDivisor));
          const colWidth = viewW / rayCount;
          const maxSteps =
            perfTier === "low" ? 48 : perfTier === "mid" ? 56 : 64;
          const wallDistances = new Array(rayCount).fill(999);
          const wallTypes = new Array(rayCount).fill(1);
          for (let i = 0; i < rayCount; i += 1) {
            const rayAngle = player.angle + (i / rayCount - 0.5) * fov;
            const dirX = Math.cos(rayAngle) || 0.0001;
            const dirY = Math.sin(rayAngle) || 0.0001;
            let mapX = Math.floor(player.x);
            let mapY = Math.floor(player.y);
            const deltaDistX = Math.abs(1 / dirX);
            const deltaDistY = Math.abs(1 / dirY);
            const stepX = dirX < 0 ? -1 : 1;
            const stepY = dirY < 0 ? -1 : 1;
            let sideDistX =
              (dirX < 0 ? player.x - mapX : mapX + 1 - player.x) * deltaDistX;
            let sideDistY =
              (dirY < 0 ? player.y - mapY : mapY + 1 - player.y) * deltaDistY;
            let hit = false;
            let side = 0;
            for (let step = 0; step < maxSteps; step += 1) {
              if (sideDistX < sideDistY) {
                sideDistX += deltaDistX;
                mapX += stepX;
                side = 0;
              } else {
                sideDistY += deltaDistY;
                mapY += stepY;
                side = 1;
              }
              if (map[mapY]?.[mapX] >= 1) {
                hit = true;
                wallTypes[i] = map[mapY]?.[mapX] ?? 1;
                break;
              }
            }
            if (!hit) {
              continue;
            }
            const rawDist =
              side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
            const corrected = Math.max(
              0.0001,
              rawDist * Math.cos(rayAngle - player.angle),
            );
            wallDistances[i] = corrected;
            const wallHeight = Math.min(viewH, Math.floor(viewH / corrected));
            const bob = Math.sin(doomBobRef.current) * 4;
            const wallTop = Math.floor(viewY + (viewH - wallHeight) / 2 + bob);
            const shade = clamp(1 - corrected / 10, 0.15, 1);
            const sideShade = side === 1 ? 0.7 : 1;
            const baseTone = Math.floor(120 + 110 * shade * sideShade);
            const textureShift = (i % 6) * 3;
            const isDoor = wallTypes[i] === 2;
            const r = clamp(
              baseTone + (isDoor ? 60 : 30) + textureShift,
              0,
              255,
            );
            const g = clamp(
              baseTone + (isDoor ? 20 : 0) + textureShift,
              0,
              255,
            );
            const b = clamp(baseTone - (isDoor ? 10 : 25), 0, 255);
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            const wallX = Math.floor(viewX + i * colWidth);
            const wallW = Math.ceil(colWidth) + 1;
            ctx.fillRect(wallX, wallTop, wallW, wallHeight);
            if (isDoor) {
              ctx.fillStyle = "rgba(0,0,0,0.25)";
              ctx.fillRect(
                wallX + Math.floor(wallW * 0.18),
                wallTop,
                Math.max(1, Math.floor(wallW * 0.12)),
                wallHeight,
              );
              ctx.fillRect(
                wallX + Math.floor(wallW * 0.68),
                wallTop,
                Math.max(1, Math.floor(wallW * 0.12)),
                wallHeight,
              );
              ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
              ctx.fillRect(
                wallX + Math.floor(wallW * 0.42),
                wallTop,
                Math.max(1, Math.floor(wallW * 0.06)),
                wallHeight,
              );
              ctx.fillStyle = "#f4d35e";
              ctx.fillRect(
                wallX + Math.floor(wallW * 0.62),
                wallTop + Math.floor(wallHeight * 0.55),
                Math.max(1, Math.floor(wallW * 0.08)),
                Math.max(2, Math.floor(wallHeight * 0.06)),
              );
            }
          }

          const drawDoomSprite = (
            kind:
              | "pillar"
              | "crate"
              | "torch"
              | "ammo"
              | "med"
              | "shield"
              | "bomb"
              | "chest",
            x: number,
            y: number,
            w: number,
            h: number,
          ) => {
            const left = Math.floor(x - w / 2);
            const top = Math.floor(y);
            if (kind === "pillar") {
              ctx.fillStyle = "#6d5c4f";
              ctx.fillRect(left + w * 0.22, top, w * 0.56, h);
              ctx.fillStyle = "rgba(0,0,0,0.35)";
              ctx.fillRect(left + w * 0.22, top, w * 0.14, h);
              ctx.fillStyle = "rgba(255,255,255,0.08)";
              ctx.fillRect(left + w * 0.62, top + h * 0.1, w * 0.08, h * 0.8);
              return;
            }
            if (kind === "crate") {
              ctx.fillStyle = "#b8894f";
              ctx.fillRect(left, top + h * 0.15, w, h * 0.7);
              ctx.strokeStyle = "rgba(40,30,25,0.6)";
              ctx.lineWidth = 2;
              ctx.strokeRect(left, top + h * 0.15, w, h * 0.7);
              ctx.beginPath();
              ctx.moveTo(left + w * 0.15, top + h * 0.2);
              ctx.lineTo(left + w * 0.85, top + h * 0.8);
              ctx.stroke();
              return;
            }
            if (kind === "torch") {
              ctx.fillStyle = "#8f7b6a";
              ctx.fillRect(left + w * 0.42, top + h * 0.4, w * 0.16, h * 0.5);
              ctx.fillStyle = "#f6c27a";
              ctx.beginPath();
              ctx.arc(left + w * 0.5, top + h * 0.3, w * 0.18, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "#d6735b";
              ctx.beginPath();
              ctx.arc(left + w * 0.5, top + h * 0.28, w * 0.1, 0, Math.PI * 2);
              ctx.fill();
              return;
            }
            if (kind === "chest") {
              ctx.fillStyle = "#d6a45b";
              ctx.fillRect(left, top + h * 0.35, w, h * 0.5);
              ctx.fillStyle = "#b8894f";
              ctx.fillRect(left, top + h * 0.2, w, h * 0.2);
              ctx.fillStyle = "#f4d35e";
              ctx.fillRect(left + w * 0.45, top + h * 0.45, w * 0.1, h * 0.18);
              return;
            }
            if (kind === "ammo") {
              ctx.fillStyle = "#f4d35e";
              ctx.fillRect(left, top + h * 0.35, w, h * 0.4);
              ctx.fillStyle = "#6b4a2a";
              ctx.fillRect(left + w * 0.12, top + h * 0.4, w * 0.15, h * 0.3);
              ctx.fillRect(left + w * 0.38, top + h * 0.4, w * 0.15, h * 0.3);
              ctx.fillRect(left + w * 0.64, top + h * 0.4, w * 0.15, h * 0.3);
              return;
            }
            if (kind === "med") {
              ctx.fillStyle = "#6fd68d";
              ctx.fillRect(left, top + h * 0.3, w, h * 0.45);
              ctx.fillStyle = "#1b1512";
              ctx.fillRect(left + w * 0.42, top + h * 0.35, w * 0.16, h * 0.35);
              ctx.fillRect(left + w * 0.32, top + h * 0.47, w * 0.36, h * 0.12);
              return;
            }
            if (kind === "shield") {
              ctx.fillStyle = "#5bb5d6";
              ctx.beginPath();
              ctx.moveTo(left + w * 0.5, top + h * 0.2);
              ctx.lineTo(left + w * 0.85, top + h * 0.35);
              ctx.lineTo(left + w * 0.7, top + h * 0.85);
              ctx.lineTo(left + w * 0.5, top + h * 0.95);
              ctx.lineTo(left + w * 0.3, top + h * 0.85);
              ctx.lineTo(left + w * 0.15, top + h * 0.35);
              ctx.closePath();
              ctx.fill();
              return;
            }
            if (kind === "bomb") {
              ctx.fillStyle = "#d6735b";
              ctx.beginPath();
              ctx.arc(left + w * 0.5, top + h * 0.55, w * 0.35, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = "#f4d35e";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(left + w * 0.5, top + h * 0.2);
              ctx.lineTo(left + w * 0.72, top + h * 0.05);
              ctx.stroke();
            }
          };

          const props = doomPropsRef.current.slice();
          const pickups = doomPickupsRef.current;
          const sprites = [
            ...props.map((prop) => ({
              x: prop.x,
              y: prop.y,
              kind: prop.type,
            })),
            ...pickups.map((pickup) => ({
              x: pickup.x,
              y: pickup.y,
              kind: pickup.type,
            })),
          ].sort((a, b) => {
            const da = Math.hypot(a.x - player.x, a.y - player.y);
            const db = Math.hypot(b.x - player.x, b.y - player.y);
            return db - da;
          });
          const maxSprites =
            perfTier === "low" ? 10 : perfTier === "mid" ? 14 : 20;
          sprites.slice(0, maxSprites).forEach((sprite) => {
            const dx = sprite.x - player.x;
            const dy = sprite.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.2 || dist > 12) {
              return;
            }
            const angle = Math.atan2(dy, dx);
            const delta = Math.atan2(
              Math.sin(angle - player.angle),
              Math.cos(angle - player.angle),
            );
            if (Math.abs(delta) > fov * 0.6) {
              return;
            }
            const screenX = viewX + (0.5 + delta / fov) * Math.max(1, viewW);
            const column = Math.floor((screenX - viewX) / colWidth);
            if (column < 0 || column >= wallDistances.length) {
              return;
            }
            if (dist >= wallDistances[column]) {
              return;
            }
            const spriteH = Math.min(viewH, Math.floor(viewH / dist));
            const spriteW = Math.max(12, Math.floor(spriteH * 0.5));
            const bob = Math.sin(doomBobRef.current + dist) * 2;
            const top = Math.floor(viewY + (viewH - spriteH) / 2 + bob);
            drawDoomSprite(sprite.kind, screenX, top, spriteW, spriteH);
          });

          const enemies = doomEnemiesRef.current.slice().sort((a, b) => {
            const da = Math.hypot(a.x - player.x, a.y - player.y);
            const db = Math.hypot(b.x - player.x, b.y - player.y);
            return db - da;
          });
          const maxEnemies =
            perfTier === "low" ? 8 : perfTier === "mid" ? 12 : 18;
          enemies.slice(0, maxEnemies).forEach((enemy) => {
            const dx = enemy.x - player.x;
            const dy = enemy.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.2 || dist > 12) {
              return;
            }
            const angle = Math.atan2(dy, dx);
            const delta = Math.atan2(
              Math.sin(angle - player.angle),
              Math.cos(angle - player.angle),
            );
            if (Math.abs(delta) > fov * 0.6) {
              return;
            }
            const screenX = viewX + (0.5 + delta / fov) * Math.max(1, viewW);
            const column = Math.floor((screenX - viewX) / colWidth);
            if (column < 0 || column >= wallDistances.length) {
              return;
            }
            if (dist >= wallDistances[column]) {
              return;
            }
            const spriteH = Math.min(viewH, Math.floor(viewH / dist));
            const spriteW = Math.max(14, Math.floor(spriteH * 0.5));
            const bob = Math.sin(doomBobRef.current + dist) * 2;
            const top = Math.floor(viewY + (viewH - spriteH) / 2 + bob);
            const shade = clamp(1 - dist / 8, 0.2, 1);
            const base = Math.floor(180 * shade);
            const bodyW = Math.floor(spriteW * 0.75);
            const headW = Math.floor(spriteW * 0.5);
            const left = Math.floor(screenX - spriteW / 2);
            ctx.fillStyle = `rgb(${base + 40}, ${base}, ${base - 10})`;
            ctx.fillRect(
              left + Math.floor(spriteW * 0.12),
              top + Math.floor(spriteH * 0.25),
              bodyW,
              Math.floor(spriteH * 0.6),
            );
            ctx.fillStyle = `rgb(${base + 60}, ${base + 10}, ${base})`;
            ctx.fillRect(
              left + Math.floor((spriteW - headW) / 2),
              top + Math.floor(spriteH * 0.1),
              headW,
              Math.floor(spriteH * 0.18),
            );
            ctx.fillStyle = "#1b1512";
            ctx.fillRect(
              left + Math.floor(spriteW * 0.38),
              top + Math.floor(spriteH * 0.18),
              Math.max(2, Math.floor(spriteW * 0.08)),
              Math.max(2, Math.floor(spriteH * 0.06)),
            );
            ctx.fillRect(
              left + Math.floor(spriteW * 0.56),
              top + Math.floor(spriteH * 0.18),
              Math.max(2, Math.floor(spriteW * 0.08)),
              Math.max(2, Math.floor(spriteH * 0.06)),
            );
            ctx.fillStyle = `rgb(${base + 20}, ${base - 5}, ${base - 20})`;
            ctx.fillRect(
              left + Math.floor(spriteW * 0.02),
              top + Math.floor(spriteH * 0.4),
              Math.floor(spriteW * 0.18),
              Math.floor(spriteH * 0.28),
            );
            ctx.fillRect(
              left + Math.floor(spriteW * 0.8),
              top + Math.floor(spriteH * 0.4),
              Math.floor(spriteW * 0.18),
              Math.floor(spriteH * 0.28),
            );
          });
        }
        if (doomFlashRef.current > 0) {
          ctx.fillStyle = `rgba(246, 194, 122, ${0.12 * doomFlashRef.current})`;
          ctx.fillRect(viewX, viewY, viewW, viewH);
        }
        const weaponW = 120;
        const weaponH = 52;
        const weaponX = viewX + viewW - weaponW - 16;
        const weaponY = viewY + viewH - weaponH - 10;
        ctx.fillStyle = "rgba(30, 22, 18, 0.92)";
        ctx.fillRect(weaponX, weaponY, weaponW, weaponH);
        ctx.fillStyle = "#d6735b";
        ctx.fillRect(weaponX + 10, weaponY + 12, weaponW - 24, 14);
        ctx.fillStyle = "#8f7b6a";
        ctx.fillRect(weaponX + 48, weaponY + 26, 24, 18);
        ctx.fillStyle = "#b8894f";
        ctx.beginPath();
        ctx.arc(weaponX + 36, weaponY + 36, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f4d35e";
        ctx.fillRect(weaponX + weaponW - 20, weaponY + 14, 6, 4);

        ctx.fillStyle = accent;
        ctx.fillText(messages.ui.retroFps, viewX, viewY - 24);
        if (doomMessageRef.current) {
          ctx.fillStyle = dim;
          ctx.fillText(doomMessageRef.current, viewX + 110, viewY - 24);
        }
        const hudY = viewY + viewH + 30;
        const barW = Math.max(80, Math.floor(viewW * 0.18));
        const barH = 8;
        ctx.fillStyle = dim;
        ctx.fillText(
          `HP ${String(doomHealthRef.current).padStart(3, "0")}  SH ${String(
            doomShieldRef.current,
          ).padStart(3, "0")}  AMMO ${String(doomAmmoRef.current).padStart(
            2,
            "0",
          )}  BOMBS ${doomBombsRef.current}  SCORE ${doomScoreRef.current}`,
          viewX,
          hudY,
        );
        const hpRatio = clamp(doomHealthRef.current / 100, 0, 1);
        const shRatio = clamp(doomShieldRef.current / 100, 0, 1);
        ctx.strokeStyle = dim;
        ctx.strokeRect(viewX, hudY + 14, barW, barH);
        ctx.fillStyle = "#d6735b";
        ctx.fillRect(viewX, hudY + 14, Math.floor(barW * hpRatio), barH);
        ctx.strokeRect(viewX + barW + 12, hudY + 14, barW, barH);
        ctx.fillStyle = "#5bb5d6";
        ctx.fillRect(
          viewX + barW + 12,
          hudY + 14,
          Math.floor(barW * shRatio),
          barH,
        );
        if (doomGameOverRef.current) {
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.fillRect(viewX, viewY, viewW, viewH);
          ctx.fillStyle = "#d6735b";
          ctx.fillText(
            doomText("gameOver"),
            viewX + Math.floor(viewW * 0.2),
            viewY + Math.floor(viewH * 0.45),
          );
        }
        if (doomMiniMapRef.current && map.length) {
          const mapScale = Math.max(4, Math.floor(viewW / 120));
          const mapW = map[0]?.length ?? 0;
          const mapH = map.length;
          const miniW = mapW * mapScale;
          const miniH = mapH * mapScale;
          const miniX = viewX + viewW - miniW - 8;
          const miniY = viewY + 8;
          ctx.fillStyle = "rgba(10, 8, 7, 0.6)";
          ctx.fillRect(miniX - 4, miniY - 4, miniW + 8, miniH + 8);
          for (let y = 0; y < mapH; y += 1) {
            for (let x = 0; x < mapW; x += 1) {
              if (map[y]?.[x] === 1) {
                ctx.fillStyle = "#3b2f28";
                ctx.fillRect(
                  miniX + x * mapScale,
                  miniY + y * mapScale,
                  mapScale,
                  mapScale,
                );
              } else if (map[y]?.[x] === 2) {
                ctx.fillStyle = "#6b4a2a";
                ctx.fillRect(
                  miniX + x * mapScale,
                  miniY + y * mapScale,
                  mapScale,
                  mapScale,
                );
              }
            }
          }
          doomPropsRef.current.forEach((prop) => {
            ctx.fillStyle = "#8f7b6a";
            ctx.fillRect(
              miniX + prop.x * mapScale - 1,
              miniY + prop.y * mapScale - 1,
              2,
              2,
            );
          });
          doomPickupsRef.current.forEach((pickup) => {
            ctx.fillStyle = pickup.type === "ammo" ? "#f6c27a" : "#6fd68d";
            ctx.fillRect(
              miniX + pickup.x * mapScale - 1,
              miniY + pickup.y * mapScale - 1,
              2,
              2,
            );
          });
          doomEnemiesRef.current.forEach((enemy) => {
            ctx.fillStyle = "#d6735b";
            ctx.fillRect(
              miniX + enemy.x * mapScale - 1,
              miniY + enemy.y * mapScale - 1,
              2,
              2,
            );
          });
          ctx.fillStyle = "#f4d35e";
          ctx.fillRect(
            miniX + doomPlayerRef.current.x * mapScale - 2,
            miniY + doomPlayerRef.current.y * mapScale - 2,
            4,
            4,
          );
        }
        const infoY = Math.min(height - padding - 18, viewY + viewH - 16);
        ctx.fillStyle = dim;
        ctx.fillText(doomText("controls1"), viewX, infoY);
        ctx.fillText(doomText("controls2"), viewX, infoY + 16);
      } else if (mode === "chess") {
        const board = chessBoardRef.current;
        const boardSize = 8;
        const cellSize = Math.floor(
          Math.min(
            (width - padding * 2) / boardSize,
            (height - padding * 2) / boardSize,
          ),
        );
        const boardW = cellSize * boardSize;
        const boardH = cellSize * boardSize;
        const offsetX = Math.floor((width - boardW) / 2);
        const offsetY = Math.floor((height - boardH) / 2);
        ctx.fillStyle = accent;
        const botColorLabel =
          chessBotColorRef.current === "w"
            ? messages.chess.colorWhite
            : messages.chess.colorBlack;
        const chessModeLabel =
          chessModeRef.current === "bot"
            ? formatMessage(messages.chess.modeLabelBot, {
                difficulty: chessDifficultyRef.current.toUpperCase(),
                color: botColorLabel,
              })
            : messages.chess.modeLabelPvp;
        const turnLabel =
          chessTurnRef.current === "w"
            ? messages.chess.colorWhite
            : messages.chess.colorBlack;
        ctx.fillText(
          formatMessage(messages.chess.header, {
            mode: chessModeLabel,
            turn: turnLabel,
            count: String(chessMovesRef.current),
          }),
          offsetX,
          offsetY - 24,
        );
        const cursor = chessCursorRef.current;
        const selected = chessSelectedRef.current;
        const legalMoves = selected
          ? getChessLegalMoves(board, selected.x, selected.y)
          : [];
        const legalMap = new Set(
          legalMoves.map((move) => `${move.x},${move.y}`),
        );
        const kingInCheck = isChessInCheck(board, "w")
          ? "w"
          : isChessInCheck(board, "b")
            ? "b"
            : null;
        const findKingPos = (color: "w" | "b") => {
          for (let ky = 0; ky < 8; ky += 1) {
            for (let kx = 0; kx < 8; kx += 1) {
              const piece = board[ky]?.[kx] ?? "";
              if (piece && piece.toLowerCase() === "k") {
                const pieceColor = piece === piece.toUpperCase() ? "w" : "b";
                if (pieceColor === color) {
                  return { x: kx, y: ky };
                }
              }
            }
          }
          return null;
        };
        const kingPos = kingInCheck ? findKingPos(kingInCheck) : null;
        const pieceMap: Record<string, string> = {
          K: "♔",
          Q: "♕",
          R: "♖",
          B: "♗",
          N: "♘",
          P: "♙",
          k: "♚",
          q: "♛",
          r: "♜",
          b: "♝",
          n: "♞",
          p: "♟︎",
        };
        for (let y = 0; y < boardSize; y += 1) {
          for (let x = 0; x < boardSize; x += 1) {
            const isDark = (x + y) % 2 === 1;
            ctx.fillStyle = isDark ? "#1f1a17" : "#2e2622";
            ctx.fillRect(
              offsetX + x * cellSize,
              offsetY + y * cellSize,
              cellSize,
              cellSize,
            );
            if (legalMap.has(`${x},${y}`)) {
              const targetPiece = board[y]?.[x] ?? "";
              if (targetPiece) {
                ctx.strokeStyle = "rgba(214, 115, 91, 0.85)";
                ctx.lineWidth = 2;
                ctx.strokeRect(
                  offsetX + x * cellSize + 4,
                  offsetY + y * cellSize + 4,
                  cellSize - 8,
                  cellSize - 8,
                );
              } else {
                ctx.fillStyle = "rgba(246, 194, 122, 0.6)";
                ctx.beginPath();
                ctx.arc(
                  offsetX + x * cellSize + cellSize / 2,
                  offsetY + y * cellSize + cellSize / 2,
                  Math.max(3, cellSize * 0.12),
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
              }
            }
            if (selected && selected.x === x && selected.y === y) {
              ctx.strokeStyle = "#f4d35e";
              ctx.lineWidth = 2;
              ctx.strokeRect(
                offsetX + x * cellSize + 1,
                offsetY + y * cellSize + 1,
                cellSize - 2,
                cellSize - 2,
              );
            }
            if (cursor.x === x && cursor.y === y) {
              ctx.strokeStyle = "#6fd68d";
              ctx.lineWidth = 2;
              ctx.strokeRect(
                offsetX + x * cellSize + 3,
                offsetY + y * cellSize + 3,
                cellSize - 6,
                cellSize - 6,
              );
            }
            if (kingPos && kingPos.x === x && kingPos.y === y) {
              ctx.strokeStyle = "#d6735b";
              ctx.lineWidth = 3;
              ctx.strokeRect(
                offsetX + x * cellSize + 2,
                offsetY + y * cellSize + 2,
                cellSize - 4,
                cellSize - 4,
              );
            }
            const piece = board[y]?.[x] ?? "";
            const glyph = pieceMap[piece];
            if (glyph) {
              ctx.fillStyle =
                piece === piece.toUpperCase() ? "#f4d35e" : "#d6735b";
              ctx.font = `${Math.floor(cellSize * 0.62)}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
              ctx.fillText(
                glyph,
                offsetX + x * cellSize + cellSize * 0.2,
                offsetY + y * cellSize + cellSize * 0.12,
              );
            }
          }
        }
        ctx.font = `${headerSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillStyle = dim;
        ctx.fillText(messages.ui.chessControls, offsetX, offsetY + boardH + 12);
        ctx.fillText(messages.ui.chessMeta, offsetX, offsetY + boardH + 32);
        if (chessStatusRef.current) {
          ctx.fillStyle = accent;
          ctx.fillText(chessStatusRef.current, offsetX, offsetY + boardH + 52);
        }
        if (chessPendingPromotionRef.current) {
          const promotionLabels = ["Q", "R", "B", "N"];
          const choiceIndex = clamp(chessPromotionChoiceRef.current, 0, 3);
          const optionText = promotionLabels
            .map((label, index) =>
              index === choiceIndex ? `[${label}]` : ` ${label} `,
            )
            .join(" ");
          ctx.fillStyle = accent;
          ctx.fillText(
            formatMessage(messages.chess.promoteOptions, {
              options: optionText,
            }),
            offsetX,
            offsetY + boardH + 72,
          );
        }
      } else if (mode === "solitaire") {
        const pad = Math.floor(Math.min(width, height) * 0.1);
        const areaW = width - pad * 2;
        const cardW = Math.min(90, Math.floor(areaW / 9));
        const cardH = Math.floor(cardW * 1.35);
        const gap = Math.max(8, Math.floor(cardW * 0.2));
        const topRowY = pad + 28;
        const tableauStartY = topRowY + cardH + gap * 1.4;
        const stock = solitaireStockRef.current;
        const waste = solitaireWasteRef.current;
        const wasteCard = waste[waste.length - 1];
        const foundations = solitaireFoundationsRef.current;
        const selection = solitaireSelectionRef.current;
        const suits = ["♠", "♥", "♦", "♣"] as const;

        const drawSlot = (x: number, y: number, label?: string) => {
          ctx.strokeStyle = dim;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cardW, cardH);
          if (label) {
            ctx.fillStyle = dim;
            ctx.fillText(label, x + 6, y + 6);
          }
        };
        const drawCard = (
          x: number,
          y: number,
          card: SolitaireCard,
          highlight = false,
        ) => {
          ctx.fillStyle = card.faceUp ? "#fdf6e3" : "#2b231d";
          ctx.fillRect(x, y, cardW, cardH);
          ctx.strokeStyle = card.faceUp ? "#c9b29b" : dim;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cardW, cardH);
          if (card.faceUp) {
            const isRed = card.suit === "♥" || card.suit === "♦";
            ctx.fillStyle = isRed ? "#d6735b" : accent;
            const labelSize = Math.max(10, Math.floor(cardW * 0.28));
            ctx.font = `${labelSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
            ctx.fillText(`${card.rank}${card.suit}`, x + 6, y + 6);
            ctx.fillText(card.suit, x + 6, y + cardH - labelSize - 6);
            ctx.font = `${headerSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
          } else {
            ctx.strokeStyle = "rgba(246, 194, 122, 0.25)";
            ctx.beginPath();
            ctx.moveTo(x + 6, y + 10);
            ctx.lineTo(x + cardW - 6, y + cardH - 10);
            ctx.stroke();
          }
          if (highlight) {
            ctx.strokeStyle = "#f4d35e";
            ctx.lineWidth = 3;
            ctx.strokeRect(x + 2, y + 2, cardW - 4, cardH - 4);
          }
        };

        ctx.fillStyle = accent;
        ctx.fillText(messages.ui.solitaireTitle, pad, pad);

        const stockX = pad;
        const wasteX = pad + cardW + gap;
        const foundationStartX = pad + areaW - (cardW * 4 + gap * 3);

        if (stock.length) {
          drawCard(stockX, topRowY, {
            ...stock[stock.length - 1],
            faceUp: false,
          });
        } else {
          drawSlot(stockX, topRowY, messages.ui.solitaireStock);
        }

        if (wasteCard) {
          drawCard(wasteX, topRowY, wasteCard, selection?.type === "waste");
        } else {
          drawSlot(wasteX, topRowY, messages.ui.solitaireWaste);
        }

        suits.forEach((suit, index) => {
          const x = foundationStartX + index * (cardW + gap);
          const pile = foundations[suit];
          const top = pile[pile.length - 1];
          if (top) {
            drawCard(x, topRowY, top);
          } else {
            drawSlot(x, topRowY, suit);
          }
        });

        const tableau = solitaireTableauRef.current;
        const availableHeight = height - pad - 70 - tableauStartY;
        tableau.forEach((pile, index) => {
          const x = pad + index * (cardW + gap);
          const maxStack = Math.max(1, pile.length);
          const defaultOffset = Math.max(8, Math.floor(cardH * 0.24));
          const offset =
            maxStack * defaultOffset + cardH > availableHeight
              ? Math.max(
                  6,
                  Math.floor(
                    (availableHeight - cardH) / Math.max(1, maxStack - 1),
                  ),
                )
              : defaultOffset;
          pile.forEach((card, cardIndex) => {
            const y = tableauStartY + cardIndex * offset;
            const highlight =
              selection?.type === "tableau" &&
              selection.index === index &&
              cardIndex === pile.length - 1 &&
              card.faceUp;
            drawCard(x, y, card, highlight);
          });
          if (!pile.length) {
            drawSlot(x, tableauStartY, `T${index + 1}`);
          }
        });

        if (solitaireMessageRef.current) {
          ctx.fillStyle = accent;
          ctx.fillText(solitaireMessageRef.current, pad, height - pad - 44);
        }
        ctx.fillStyle = dim;
        ctx.fillText(messages.ui.solitaireControls, pad, height - pad - 20);
      } else {
        const grid =
          mode === "snake"
            ? snakeGridRef.current
            : mode === "pacman"
              ? {
                  cols: pacmanGridRef.current[0]?.length ?? 24,
                  rows: pacmanGridRef.current.length ?? 16,
                }
              : pongGridRef.current;
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
            formatMessage(messages.ui.snakeHeader, {
              score: String(snakeScoreRef.current),
            }),
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
          if (snakeWonRef.current) {
            ctx.fillStyle = "#6fd68d";
            ctx.fillText(messages.ui.snakeWin, offsetX, offsetY + boardH + 12);
          } else if (!snakeAliveRef.current) {
            ctx.fillStyle = "#d6735b";
            ctx.fillText(
              messages.ui.snakeGameOver,
              offsetX,
              offsetY + boardH + 12,
            );
          } else {
            ctx.fillStyle = dim;
            ctx.fillText(
              messages.ui.snakeControls,
              offsetX,
              offsetY + boardH + 12,
            );
          }
        } else if (mode === "pacman") {
          ctx.fillStyle = accent;
          ctx.fillText(
            formatMessage(messages.ui.pacmanHeader, {
              score: String(pacmanScoreRef.current),
            }),
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
              } else if (cell === 2 || cell === 3) {
                ctx.fillStyle = accent;
                ctx.beginPath();
                ctx.arc(
                  offsetX + x * cellSize + cellSize / 2,
                  offsetY + y * cellSize + cellSize / 2,
                  cell === 3
                    ? Math.max(2, cellSize * 0.28)
                    : Math.max(1, cellSize * 0.12),
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
              }
            }
          }
          pacmanGhostsRef.current.forEach((ghost) => {
            const scared = ghost.scared > 0 || pacmanPowerRef.current > 0;
            ctx.fillStyle = scared ? "#5bb5d6" : ghost.color;
            ctx.beginPath();
            ctx.arc(
              offsetX + ghost.pos.x * cellSize + cellSize / 2,
              offsetY + ghost.pos.y * cellSize + cellSize / 2,
              cellSize * 0.36,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          });
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
            ctx.fillText(messages.ui.pacmanWin, offsetX, offsetY + boardH + 12);
          } else if (pacmanGameOverRef.current) {
            ctx.fillStyle = "#d6735b";
            ctx.fillText(
              messages.ui.pacmanGameOver,
              offsetX,
              offsetY + boardH + 12,
            );
          } else {
            ctx.fillStyle = dim;
            ctx.fillText(
              messages.ui.pacmanControls,
              offsetX,
              offsetY + boardH + 12,
            );
          }
        } else if (mode === "pong") {
          const paddleWidth = Math.max(4, Math.floor(cols * 0.2));
          ctx.fillStyle = accent;
          ctx.fillText(
            formatMessage(messages.ui.pongHeader, {
              player: String(pongScoreRef.current.player),
              ai: String(pongScoreRef.current.ai),
              lives: String(pongLivesRef.current),
            }),
            offsetX,
            offsetY - 24,
          );
          ctx.fillStyle = "#f6c27a";
          ctx.fillRect(
            offsetX + pongAiRef.current * cellSize,
            offsetY + 1 * cellSize,
            paddleWidth * cellSize,
            cellSize * 0.6,
          );
          ctx.fillRect(
            offsetX + pongPaddleRef.current * cellSize,
            offsetY + (rows - 2) * cellSize,
            paddleWidth * cellSize,
            cellSize * 0.6,
          );
          ctx.fillStyle = "#d6735b";
          ctx.beginPath();
          ctx.arc(
            offsetX + pongBallRef.current.x * cellSize,
            offsetY + pongBallRef.current.y * cellSize,
            Math.max(2, cellSize * 0.35),
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.fillStyle = dim;
          ctx.fillText(
            messages.ui.pongControls,
            offsetX,
            offsetY + boardH + 12,
          );
          if (pongOverRef.current) {
            ctx.fillStyle = "#d6735b";
            ctx.fillText(
              messages.ui.pongGameOver,
              offsetX + Math.floor(boardW * 0.35),
              offsetY + Math.floor(boardH * 0.45),
            );
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
    getChessLegalMoves,
    getDoomBootProgress,
    isChessInCheck,
    isFirefox,
    isMobile,
    perfTier,
    prompt,
    doomText,
    formatMessage,
    messages,
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
        stopApp(messages.system.exitLine);
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
        } else if (mode === "pong") {
          resetPong();
        } else if (mode === "chess") {
          resetChess();
        } else if (mode === "doom") {
          beginDoomBoot();
          resetDoom();
        } else if (mode === "solitaire") {
          resetSolitaire();
        }
        event.preventDefault();
        return true;
      }

      if (mode === "calc") {
        const applyCalcButton = (label: string) => {
          if (label === "C") {
            resetCalc();
            return;
          }
          if (label === "←") {
            calcInputRef.current = calcInputRef.current.slice(0, -1);
            calcErrorRef.current = null;
            return;
          }
          if (label === "=") {
            const expr = calcInputRef.current.trim();
            if (!expr) {
              calcResultRef.current = "0";
              calcErrorRef.current = null;
            } else if (!/^[0-9a-zA-Z+\-*/^().,\s]+$/.test(expr)) {
              calcErrorRef.current = messages.calc.invalid;
            } else {
              try {
                calcResultRef.current = String(
                  evaluateScientificExpression(expr),
                );
                calcErrorRef.current = null;
              } catch {
                calcErrorRef.current = messages.calc.error;
              }
            }
            return;
          }
          if (label === "pi" || label === "e") {
            calcInputRef.current += label;
            calcErrorRef.current = null;
            return;
          }
          if (
            ["sin", "cos", "tan", "sqrt", "log", "ln", "pow"].includes(label)
          ) {
            calcInputRef.current += `${label}(`;
            calcErrorRef.current = null;
            return;
          }
          calcInputRef.current += label;
          calcErrorRef.current = null;
        };

        if (
          key === "ArrowUp" ||
          key === "ArrowDown" ||
          key === "ArrowLeft" ||
          key === "ArrowRight"
        ) {
          const cursor = calcCursorRef.current;
          if (key === "ArrowUp") {
            cursor.row = Math.max(0, cursor.row - 1);
          } else if (key === "ArrowDown") {
            cursor.row = Math.min(CALC_BUTTONS.length - 1, cursor.row + 1);
          } else if (key === "ArrowLeft") {
            cursor.col = Math.max(0, cursor.col - 1);
          } else if (key === "ArrowRight") {
            cursor.col = Math.min(
              CALC_BUTTONS[cursor.row].length - 1,
              cursor.col + 1,
            );
          }
          const rowLen = CALC_BUTTONS[cursor.row].length;
          cursor.col = Math.min(cursor.col, rowLen - 1);
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }

        if (key === "Enter") {
          const cursor = calcCursorRef.current;
          const label = CALC_BUTTONS[cursor.row][cursor.col];
          applyCalcButton(label);
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }

        if (key === "=") {
          applyCalcButton("=");
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "Backspace") {
          applyCalcButton("←");
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (lower === "c") {
          applyCalcButton("C");
          event.preventDefault();
          return true;
        }
        if (key.length === 1 && /[0-9a-zA-Z+\-*/^().,\s]/.test(key)) {
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
      if (mode === "pong") {
        if (key === "ArrowLeft" || lower === "a") {
          pongPaddleRef.current -= 2;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "ArrowRight" || lower === "d") {
          pongPaddleRef.current += 2;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        event.preventDefault();
        return true;
      }
      if (mode === "player") {
        if (key === " " || key === "Enter") {
          playerIsPlayingRef.current = !playerIsPlayingRef.current;
          playerStatusRef.current = playerIsPlayingRef.current
            ? messages.media.playing
            : messages.media.paused;
          audioAutoPausedRef.current = false;
          if (playerModeRef.current === "mp3") {
            if (playerIsPlayingRef.current) {
              void startSynthAudio();
            } else {
              stopSynthAudio();
            }
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (
          playerModeRef.current === "image" &&
          (key === "ArrowLeft" || key === "ArrowRight")
        ) {
          cycleImage(key === "ArrowLeft" ? -1 : 1);
          event.preventDefault();
          return true;
        }
        if (playerModeRef.current === "image") {
          if (key === "+" || key === "=") {
            playerImageZoomRef.current = clamp(
              playerImageZoomRef.current + 0.1,
              0.5,
              3,
            );
            dirtyRef.current = true;
            event.preventDefault();
            return true;
          }
          if (key === "-" || key === "_") {
            playerImageZoomRef.current = clamp(
              playerImageZoomRef.current - 0.1,
              0.5,
              3,
            );
            dirtyRef.current = true;
            event.preventDefault();
            return true;
          }
          if (key === "0") {
            playerImageZoomRef.current = 1;
            dirtyRef.current = true;
            event.preventDefault();
            return true;
          }
        }
        if (key === "ArrowLeft" || key === "ArrowRight") {
          const delta = key === "ArrowLeft" ? -5 : 5;
          const next = clamp(
            playerProgressRef.current + delta,
            0,
            playerDurationRef.current,
          );
          playerProgressRef.current = next;
          if (playerModeRef.current === "video") {
            const total = Math.max(1, playerFramesRef.current.length);
            playerFrameIndexRef.current = Math.floor(
              (next / playerDurationRef.current) * total,
            );
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        event.preventDefault();
        return true;
      }
      if (mode === "doom") {
        if (getDoomBootProgress() < 1) {
          event.preventDefault();
          return true;
        }
        const impulse = doomImpulseRef.current;
        const step = 0.08;
        const turn = 0.06;
        if (key === "ArrowUp" || lower === "w") {
          impulse.move = clamp(impulse.move + step, -0.25, 0.25);
          event.preventDefault();
          return true;
        }
        if (key === "ArrowDown" || lower === "s") {
          impulse.move = clamp(impulse.move - step, -0.25, 0.25);
          event.preventDefault();
          return true;
        }
        if (key === "ArrowLeft") {
          impulse.turn = clamp(impulse.turn - turn, -0.2, 0.2);
          event.preventDefault();
          return true;
        }
        if (key === "ArrowRight") {
          impulse.turn = clamp(impulse.turn + turn, -0.2, 0.2);
          event.preventDefault();
          return true;
        }
        if (lower === "a") {
          impulse.strafe = clamp(impulse.strafe - step, -0.25, 0.25);
          event.preventDefault();
          return true;
        }
        if (lower === "d") {
          impulse.strafe = clamp(impulse.strafe + step, -0.25, 0.25);
          event.preventDefault();
          return true;
        }
        if (lower === "m") {
          doomMiniMapRef.current = !doomMiniMapRef.current;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (lower === "e") {
          openDoomDoor();
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (lower === "b") {
          throwDoomBomb();
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === " " || key === "Enter") {
          shootDoom();
          event.preventDefault();
          return true;
        }
        event.preventDefault();
        return true;
      }
      if (mode === "chess") {
        const pendingPromotion = chessPendingPromotionRef.current;
        if (pendingPromotion) {
          const promotionKeys = ["q", "r", "b", "n"] as const;
          const applyPromotion = (choice: (typeof promotionKeys)[number]) => {
            const nextPiece =
              pendingPromotion.color === "w" ? choice.toUpperCase() : choice;
            chessBoardRef.current[pendingPromotion.y][pendingPromotion.x] =
              nextPiece;
            chessPendingPromotionRef.current = null;
            chessTurnRef.current = pendingPromotion.nextTurn;
            chessMovesRef.current += 1;
            const enemyColor = chessTurnRef.current;
            const inCheck = isChessInCheck(chessBoardRef.current, enemyColor);
            if (!hasChessLegalMove(chessBoardRef.current, enemyColor)) {
              chessStatusRef.current = inCheck
                ? messages.chess.checkmate
                : messages.chess.stalemate;
            } else {
              chessStatusRef.current = inCheck ? messages.chess.check : null;
            }
            dirtyRef.current = true;
            scheduleChessBotMove();
          };

          if (key === "ArrowLeft" || key === "ArrowUp") {
            chessPromotionChoiceRef.current =
              (chessPromotionChoiceRef.current + promotionKeys.length - 1) %
              promotionKeys.length;
            chessStatusRef.current = messages.chess.promotePawn;
            dirtyRef.current = true;
            event.preventDefault();
            return true;
          }
          if (key === "ArrowRight" || key === "ArrowDown") {
            chessPromotionChoiceRef.current =
              (chessPromotionChoiceRef.current + 1) % promotionKeys.length;
            chessStatusRef.current = messages.chess.promotePawn;
            dirtyRef.current = true;
            event.preventDefault();
            return true;
          }
          if (key === "Enter" || key === " ") {
            const choice =
              promotionKeys[chessPromotionChoiceRef.current] ?? "q";
            applyPromotion(choice);
            event.preventDefault();
            return true;
          }
          if (key >= "1" && key <= "4") {
            const index = Number(key) - 1;
            const choice = promotionKeys[index] ?? "q";
            chessPromotionChoiceRef.current = index;
            applyPromotion(choice);
            event.preventDefault();
            return true;
          }
          const promoteKey = lower;
          if (
            promoteKey === "q" ||
            promoteKey === "r" ||
            promoteKey === "b" ||
            promoteKey === "n"
          ) {
            chessPromotionChoiceRef.current = promotionKeys.indexOf(promoteKey);
            applyPromotion(promoteKey);
            event.preventDefault();
            return true;
          }
          chessStatusRef.current = messages.chess.promotePawn;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (lower === "1" || lower === "2" || lower === "3") {
          chessDifficultyRef.current =
            lower === "1" ? "easy" : lower === "2" ? "medium" : "hard";
          chessStatusRef.current = formatMessage(messages.chess.difficulty, {
            level: chessDifficultyRef.current,
          });
          dirtyRef.current = true;
          scheduleChessBotMove();
          event.preventDefault();
          return true;
        }
        if (lower === "b") {
          chessModeRef.current = "bot";
          chessStatusRef.current = messages.chess.modeBot;
          dirtyRef.current = true;
          scheduleChessBotMove();
          event.preventDefault();
          return true;
        }
        if (lower === "p") {
          chessModeRef.current = "pvp";
          chessStatusRef.current = messages.chess.modePvp;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (lower === "c") {
          chessBotColorRef.current =
            chessBotColorRef.current === "w" ? "b" : "w";
          chessStatusRef.current = formatMessage(messages.chess.botColor, {
            color:
              chessBotColorRef.current === "w"
                ? messages.chess.colorWhite
                : messages.chess.colorBlack,
          });
          dirtyRef.current = true;
          scheduleChessBotMove();
          event.preventDefault();
          return true;
        }
        if (
          chessModeRef.current === "bot" &&
          chessTurnRef.current === chessBotColorRef.current
        ) {
          chessStatusRef.current = messages.chess.botThinking;
          dirtyRef.current = true;
          scheduleChessBotMove();
          event.preventDefault();
          return true;
        }
        const cursor = chessCursorRef.current;
        const moveCursor = (dx: number, dy: number) => {
          cursor.x = clamp(cursor.x + dx, 0, 7);
          cursor.y = clamp(cursor.y + dy, 0, 7);
          dirtyRef.current = true;
        };
        if (key === "ArrowUp" || lower === "w") {
          moveCursor(0, -1);
          event.preventDefault();
          return true;
        }
        if (key === "ArrowDown" || lower === "s") {
          moveCursor(0, 1);
          event.preventDefault();
          return true;
        }
        if (key === "ArrowLeft" || lower === "a") {
          moveCursor(-1, 0);
          event.preventDefault();
          return true;
        }
        if (key === "ArrowRight" || lower === "d") {
          moveCursor(1, 0);
          event.preventDefault();
          return true;
        }
        if (key === "Enter" || key === " ") {
          const board = chessBoardRef.current;
          const selected = chessSelectedRef.current;
          const piece = board[cursor.y]?.[cursor.x] ?? "";
          const color = piece && piece === piece.toUpperCase() ? "w" : "b";
          if (!selected) {
            if (piece && color === chessTurnRef.current) {
              chessSelectedRef.current = { x: cursor.x, y: cursor.y };
              chessStatusRef.current = null;
              dirtyRef.current = true;
            }
          } else if (selected.x === cursor.x && selected.y === cursor.y) {
            chessSelectedRef.current = null;
            chessStatusRef.current = null;
            dirtyRef.current = true;
          } else {
            const moved = attemptChessMove(selected, cursor);
            if (moved) {
              chessSelectedRef.current = null;
              scheduleChessBotMove();
            }
            dirtyRef.current = true;
          }
          event.preventDefault();
          return true;
        }
        if (lower === "x") {
          chessSelectedRef.current = null;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        event.preventDefault();
        return true;
      }
      if (mode === "solitaire") {
        const tableau = solitaireTableauRef.current;
        const stock = solitaireStockRef.current;
        const waste = solitaireWasteRef.current;
        const foundations = solitaireFoundationsRef.current;
        const selection = solitaireSelectionRef.current;
        const canStackOnTableau = (
          moving: SolitaireCard,
          target?: SolitaireCard,
        ) => {
          if (!target) {
            return moving.rank === "K";
          }
          const rankDelta =
            getSolitaireRankIndex(target.rank) -
            getSolitaireRankIndex(moving.rank);
          if (rankDelta !== 1) {
            return false;
          }
          return isSolitaireRed(moving.suit) !== isSolitaireRed(target.suit);
        };
        const canStackOnFoundation = (moving: SolitaireCard) => {
          const foundation = foundations[moving.suit];
          if (!foundation.length) {
            return moving.rank === "A";
          }
          const top = foundation[foundation.length - 1];
          return (
            getSolitaireRankIndex(moving.rank) ===
            getSolitaireRankIndex(top.rank) + 1
          );
        };
        const revealTop = (pile: SolitaireCard[]) => {
          const top = pile[pile.length - 1];
          if (top && !top.faceUp) {
            top.faceUp = true;
          }
        };

        if (lower === "d") {
          if (stock.length === 0) {
            if (waste.length) {
              solitaireStockRef.current = waste
                .slice()
                .reverse()
                .map((card) => ({ ...card, faceUp: false }));
              solitaireWasteRef.current = [];
              solitaireMessageRef.current = messages.solitaire.stockRecycled;
            } else {
              solitaireMessageRef.current = messages.solitaire.noCardsLeft;
            }
          } else {
            const card = stock.pop();
            if (card) {
              solitaireWasteRef.current.push({ ...card, faceUp: true });
              solitaireMessageRef.current = formatMessage(
                messages.solitaire.drawCard,
                { card: solitaireCardLabel(card) },
              );
            }
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }

        if (lower === "w") {
          if (!waste.length) {
            solitaireMessageRef.current = messages.solitaire.wasteEmpty;
          } else {
            solitaireSelectionRef.current = { type: "waste" };
            solitaireMessageRef.current = messages.solitaire.selectedWaste;
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }

        if (lower === "f") {
          let moving: SolitaireCard | undefined;
          let sourcePile: SolitaireCard[] | null = null;
          if (selection?.type === "waste") {
            moving = waste[waste.length - 1];
            sourcePile = waste;
          } else if (selection?.type === "tableau") {
            const pile = tableau[selection.index];
            const top = pile?.[pile.length - 1];
            if (top?.faceUp) {
              moving = top;
              sourcePile = pile;
            }
          }
          if (!moving || !sourcePile) {
            solitaireMessageRef.current = messages.solitaire.selectCardFirst;
          } else if (!canStackOnFoundation(moving)) {
            solitaireMessageRef.current =
              messages.solitaire.cannotMoveFoundation;
          } else {
            foundations[moving.suit].push({ ...moving, faceUp: true });
            sourcePile.pop();
            if (sourcePile !== waste) {
              revealTop(sourcePile);
            }
            solitaireSelectionRef.current = null;
            solitaireMessageRef.current = formatMessage(
              messages.solitaire.placedCard,
              { card: solitaireCardLabel(moving) },
            );
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }

        if (/^[1-7]$/.test(key)) {
          const index = Number(key) - 1;
          const targetPile = tableau[index];
          if (!targetPile) {
            return true;
          }
          if (!selection) {
            const top = targetPile[targetPile.length - 1];
            if (!top) {
              solitaireMessageRef.current = messages.solitaire.emptyPile;
            } else if (!top.faceUp) {
              top.faceUp = true;
              solitaireMessageRef.current = messages.solitaire.flippedCard;
            } else {
              solitaireSelectionRef.current = { type: "tableau", index };
              solitaireMessageRef.current = formatMessage(
                messages.solitaire.selectedPile,
                { index: String(index + 1) },
              );
            }
          } else {
            let moving: SolitaireCard | undefined;
            let sourcePile: SolitaireCard[] | null = null;
            if (selection.type === "waste") {
              moving = waste[waste.length - 1];
              sourcePile = waste;
            } else if (selection.type === "tableau") {
              const fromPile = tableau[selection.index];
              const top = fromPile?.[fromPile.length - 1];
              if (top?.faceUp) {
                moving = top;
                sourcePile = fromPile;
              }
            }
            const targetTop = targetPile[targetPile.length - 1];
            if (!moving || !sourcePile) {
              solitaireMessageRef.current = messages.solitaire.selectCardFirst;
            } else if (!canStackOnTableau(moving, targetTop)) {
              solitaireMessageRef.current = messages.solitaire.cannotStack;
            } else {
              targetPile.push({ ...moving, faceUp: true });
              sourcePile.pop();
              if (sourcePile !== waste) {
                revealTop(sourcePile);
              }
              solitaireSelectionRef.current = null;
              solitaireMessageRef.current = formatMessage(
                messages.solitaire.movedCard,
                { card: solitaireCardLabel(moving) },
              );
            }
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
    [
      attemptChessMove,
      beginDoomBoot,
      cycleImage,
      getDoomBootProgress,
      getSolitaireRankIndex,
      isSolitaireRed,
      placeSnakeFood,
      resetCalc,
      resetChess,
      resetDoom,
      resetPacman,
      resetPong,
      resetSnake,
      resetSolitaire,
      scheduleChessBotMove,
      shootDoom,
      throwDoomBomb,
      openDoomDoor,
      hasChessLegalMove,
      isChessInCheck,
      solitaireCardLabel,
      startSynthAudio,
      stopSynthAudio,
      stopApp,
      formatMessage,
      messages,
    ],
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
        if (editorRef.current) {
          replaceSelection("  ");
          dirtyRef.current = true;
        } else {
          completeInput();
        }
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
        if (editorRef.current) {
          return;
        }
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
        if (editorRef.current) {
          return;
        }
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
        syncSelection();
        const inputLine = inputValueRef.current;
        if (handleEditorInputLine(inputLine)) {
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
      handleEditorInputLine,
      handleSelectionUpdate,
      onFocusChangeAction,
      prompt,
      replaceSelection,
      runCommand,
      setSelectionRange,
      syncSelection,
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
        if (editorRef.current) {
          replaceSelection("  ");
          dirtyRef.current = true;
        } else {
          completeInput();
        }
        event.preventDefault();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        syncSelection();
        const inputLine = input.value;
        if (handleEditorInputLine(inputLine)) {
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
        if (editorRef.current) {
          return;
        }
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
      handleEditorInputLine,
      handleAppKey,
      handleKeyAction,
      prompt,
      replaceSelection,
      runCommand,
      syncSelection,
      syncInputValue,
      theme.palette.terminalText,
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
        ? isMobile || perfTier === "low"
          ? 90
          : isFirefox
            ? 90
            : perfTier === "mid"
              ? 50
              : 33
        : isMobile || isFirefox || perfTier === "low"
          ? 180
          : perfTier === "high"
            ? 120
            : 140;
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
