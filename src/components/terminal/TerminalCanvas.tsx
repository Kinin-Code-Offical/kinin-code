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
  | "doom"
  | "editor";

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
      "hellrun",
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
  const editorCursorRef = useRef({ row: 0, col: 0 });
  const editorScrollRef = useRef(0);
  const editorCommandRef = useRef({ active: false, value: "" });
  const editorSelectionRef = useRef<{
    start: { row: number; col: number };
    end: { row: number; col: number };
  } | null>(null);
  const editorStatusRef = useRef<string | null>(null);
  const editorQuitArmedRef = useRef(false);
  const editorClipboardRef = useRef<string | null>(null);
  const sessionStartRef = useRef(Date.now());
  const lastCanvasSizeRef = useRef({ width: 0, height: 0 });
  const dirtyRef = useRef(true);
  const appModeRef = useRef<AppMode | null>(null);
  const gameTimerRef = useRef<number | null>(null);
  const gamePausedRef = useRef(false);
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
    Array<{
      x: number;
      y: number;
      hp: number;
      cooldown: number;
      type: "raider" | "spitter" | "charger" | "brute";
    }>
  >([]);
  const doomPickupsRef = useRef<
    Array<{
      x: number;
      y: number;
      type:
        | "ammo"
        | "shells"
        | "rockets"
        | "med"
        | "shield"
        | "bomb"
        | "chest"
        | "shotgun"
        | "chainsaw"
        | "chaingun"
        | "launcher";
    }>
  >([]);
  const doomPropsRef = useRef<
    Array<{
      x: number;
      y: number;
      type: "pillar" | "crate" | "torch" | "barrel";
      hp?: number;
    }>
  >([]);
  const doomAmmoRef = useRef(24);
  const doomShellsRef = useRef(10);
  const doomRocketsRef = useRef(2);
  const doomHealthRef = useRef(100);
  const doomShieldRef = useRef(60);
  const doomBombsRef = useRef(2);
  const doomScoreRef = useRef(0);
  const doomCooldownRef = useRef(0);
  const doomGameOverRef = useRef(false);
  const doomMiniMapRef = useRef(true);
  const doomBobRef = useRef(0);
  const doomLevelRef = useRef(0);
  const doomExitRef = useRef<{ x: number; y: number } | null>(null);
  const doomDoorStatesRef = useRef<
    Record<
      string,
      { open: number; target: number; cooldown: number; locked?: boolean }
    >
  >({});
  const doomHintRef = useRef<string | null>(null);
  const doomHintWindowRef = useRef(true);
  const doomMuzzleRef = useRef(0);
  const doomHurtRef = useRef(0);
  const doomTexturesRef = useRef<{
    size: number;
    brick: HTMLCanvasElement;
    tech: HTMLCanvasElement;
    stone: HTMLCanvasElement;
    door: HTMLCanvasElement;
  } | null>(null);
  const doomWeaponRef = useRef<
    "fist" | "chainsaw" | "pistol" | "shotgun" | "chaingun" | "launcher"
  >("pistol");
  const doomShotgunUnlockedRef = useRef(false);
  const doomChainsawUnlockedRef = useRef(false);
  const doomChaingunUnlockedRef = useRef(false);
  const doomLauncherUnlockedRef = useRef(false);
  const doomProjectilesRef = useRef<
    Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      kind: "fireball" | "rocket";
      friendly: boolean;
      damage: number;
      radius: number;
    }>
  >([]);
  const doomExplosionRef = useRef<{
    life: number;
    x: number;
    y: number;
  } | null>(null);
  const doomBombRef = useRef<{
    active: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
  } | null>(null);
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
          noShells: "FİŞEK YOK",
          noRockets: "ROKET YOK",
          fire: "ATEŞ!",
          punch: "YUMRUK!",
          saw: "TESTERE!",
          rocket: "ROKET!",
          targetDown: "HEDEF İNDİ",
          hit: "İSABET",
          noBombs: "BOMBA YOK",
          boom: "PATLAMA",
          doorOpen: "KAPI AÇILDI",
          doorClose: "KAPI KAPANDI",
          noDoor: "KAPI YOK",
          interactDoor: "E: Kapı",
          interactPickup: "E: Al",
          exitReady: "ÇIKIŞ",
          nextLevel: "BÖLÜM",
          ammoPlus: "MERMİ +",
          shellsPlus: "FİŞEK +",
          rocketsPlus: "ROKET +",
          healthPlus: "CAN +",
          shieldPlus: "KALKAN +",
          bombPlus: "BOMBA +",
          chest: "SANDIK!",
          shotgun: "POMPALI!",
          chainsaw: "TESTERE!",
          chaingun: "MİNİGUN!",
          launcher: "ROKETATAR!",
          weaponFist: "YUMRUK",
          weaponChainsaw: "TESTERE",
          weaponPistol: "TABANCA",
          weaponShotgun: "POMPALI",
          weaponChaingun: "MİNİGUN",
          weaponLauncher: "ROKETATAR",
          noShotgun: "POMPALI YOK",
          noChainsaw: "TESTERE YOK",
          noChaingun: "MİNİGUN YOK",
          noLauncher: "ROKETATAR YOK",
          damage: "HASAR!",
          died: "ÖLDÜN",
          clear: "TEMİZ",
          launch: "HELLRUN başlatılıyor...",
          loading: "YÜKLENİYOR...",
          hudLabel: "CAN",
          shieldLabel: "KALKAN",
          ammoLabel: "MERMİ",
          shellsLabel: "FİŞEK",
          rocketsLabel: "ROKET",
          bombLabel: "BOMBA",
          scoreLabel: "SKOR",
          controls1:
            "W/S: hareket  A/D: kay  ←/→: dön  Shift: koş  Boşluk: saldırı",
          controls2:
            "1: yumruk/testere  2: tabanca  3: pompalı  4: minigun  5: roketatar  B: bomba  E: etkileşim  M: harita  H: ipucu  R: reset  Q: çıkış",
          gameOver: "ÖLDÜN - R: yeniden",
        },
        en: {
          ready: "READY",
          noAmmo: "NO AMMO",
          noShells: "NO SHELLS",
          noRockets: "NO ROCKETS",
          fire: "FIRE!",
          punch: "PUNCH!",
          saw: "SAW!",
          rocket: "ROCKET!",
          targetDown: "TARGET DOWN",
          hit: "HIT",
          noBombs: "NO BOMBS",
          boom: "BOOM",
          doorOpen: "DOOR OPEN",
          doorClose: "DOOR CLOSED",
          noDoor: "NO DOOR",
          interactDoor: "E: Door",
          interactPickup: "E: Pickup",
          exitReady: "EXIT",
          nextLevel: "LEVEL",
          ammoPlus: "AMMO +",
          shellsPlus: "SHELLS +",
          rocketsPlus: "ROCKETS +",
          healthPlus: "HEALTH +",
          shieldPlus: "SHIELD +",
          bombPlus: "BOMB +",
          chest: "CHEST!",
          shotgun: "SHOTGUN!",
          chainsaw: "CHAINSAW!",
          chaingun: "CHAINGUN!",
          launcher: "LAUNCHER!",
          weaponFist: "FISTS",
          weaponChainsaw: "CHAINSAW",
          weaponPistol: "PISTOL",
          weaponShotgun: "SHOTGUN",
          weaponChaingun: "CHAINGUN",
          weaponLauncher: "LAUNCHER",
          noShotgun: "NO SHOTGUN",
          noChainsaw: "NO CHAINSAW",
          noChaingun: "NO CHAINGUN",
          noLauncher: "NO LAUNCHER",
          damage: "HIT!",
          died: "YOU DIED",
          clear: "ALL CLEAR",
          launch: "Launching HELLRUN...",
          loading: "LOADING...",
          hudLabel: "HP",
          shieldLabel: "SHIELD",
          ammoLabel: "AMMO",
          shellsLabel: "SHELLS",
          rocketsLabel: "ROCKETS",
          bombLabel: "BOMBS",
          scoreLabel: "SCORE",
          controls1:
            "W/S: move  A/D: strafe  ←/→: turn  Shift: run  Space: attack",
          controls2:
            "1: fists/saw  2: pistol  3: shotgun  4: chaingun  5: launcher  B: bomb  E: interact  M: map  H: hint  R: reset  Q: quit",
          gameOver: "YOU DIED - R: restart",
        },
      } as const;
      const lang = language === "tr" ? "tr" : "en";
      return dict[lang][key as keyof (typeof dict)["tr"]] ?? key;
    },
    [language],
  );

  const ensureDoomTextures = useCallback(() => {
    if (doomTexturesRef.current) {
      return doomTexturesRef.current;
    }
    if (typeof document === "undefined") {
      return null;
    }
    const size = 64;
    const makeTexture = (
      seed: number,
      draw: (ctx: CanvasRenderingContext2D, rand: () => number) => void,
    ) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return canvas;
      }
      ctx.imageSmoothingEnabled = false;
      const rand = mulberry32(seed);
      draw(ctx, rand);
      return canvas;
    };

    const brick = makeTexture(hashString("hellrun-brick"), (ctx, rand) => {
      ctx.fillStyle = "#2a1412";
      ctx.fillRect(0, 0, size, size);
      const brickW = 16;
      const brickH = 8;
      for (let y = 0; y < size; y += brickH) {
        const row = Math.floor(y / brickH);
        const offset = row % 2 === 0 ? 0 : Math.floor(brickW / 2);
        for (let x = -offset; x < size; x += brickW) {
          const shade = 0.75 + rand() * 0.35;
          const r = Math.floor(120 * shade);
          const g = Math.floor(46 * shade);
          const b = Math.floor(38 * shade);
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x + 1, y + 1, brickW - 2, brickH - 2);
        }
      }
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      for (let y = 0; y < size; y += brickH) {
        ctx.fillRect(0, y, size, 1);
      }
      for (let y = 0; y < size; y += brickH) {
        const row = Math.floor(y / brickH);
        const offset = row % 2 === 0 ? 0 : Math.floor(brickW / 2);
        for (let x = -offset; x < size; x += brickW) {
          ctx.fillRect(x, y, 1, brickH);
        }
      }
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      for (let i = 0; i < 18; i += 1) {
        const x = Math.floor(rand() * size);
        const y = Math.floor(rand() * size);
        ctx.fillRect(x, y, 1, 1);
      }
    });

    const tech = makeTexture(hashString("hellrun-tech"), (ctx, rand) => {
      ctx.fillStyle = "#1e2326";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 12; i += 1) {
        const x = Math.floor(rand() * (size - 10));
        const y = Math.floor(rand() * (size - 10));
        const w = 10 + Math.floor(rand() * 24);
        const h = 8 + Math.floor(rand() * 18);
        ctx.fillStyle = `rgba(120, 150, 155, ${0.06 + rand() * 0.08})`;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      }
      ctx.fillStyle = "rgba(246,194,122,0.12)";
      for (let y = 0; y < size; y += 4) {
        ctx.fillRect(0, y, size, 1);
      }
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      for (let x = 0; x < size; x += 8) {
        ctx.fillRect(x, 0, 1, size);
      }
      ctx.fillStyle = "rgba(246,194,122,0.2)";
      ctx.fillRect(Math.floor(size * 0.75), 0, 2, size);
    });

    const stone = makeTexture(hashString("hellrun-stone"), (ctx, rand) => {
      ctx.fillStyle = "#2a241d";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 260; i += 1) {
        const x = Math.floor(rand() * size);
        const y = Math.floor(rand() * size);
        const v = 60 + Math.floor(rand() * 80);
        ctx.fillStyle = `rgba(${v}, ${Math.floor(v * 0.9)}, ${Math.floor(
          v * 0.75,
        )}, 0.22)`;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      for (let y = 0; y < size; y += 8) {
        for (let x = 0; x < size; x += 8) {
          if (rand() > 0.75) {
            ctx.fillRect(x, y, 8, 1);
          }
        }
      }
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let i = 0; i < 32; i += 1) {
        ctx.fillRect(
          Math.floor(rand() * size),
          Math.floor(rand() * size),
          2,
          1,
        );
      }
    });

    const door = makeTexture(hashString("hellrun-door"), (ctx, rand) => {
      ctx.fillStyle = "#3b2a1c";
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      for (let x = 0; x < size; x += 10) {
        ctx.fillRect(x, 0, 2, size);
      }
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      for (let x = 6; x < size; x += 12) {
        ctx.fillRect(x, 0, 1, size);
      }
      ctx.fillStyle = "rgba(246,194,122,0.22)";
      ctx.fillRect(Math.floor(size * 0.62), 0, 3, size);
      ctx.fillStyle = "#f4d35e";
      ctx.fillRect(Math.floor(size * 0.7), Math.floor(size * 0.6), 6, 4);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      for (let i = 0; i < 22; i += 1) {
        ctx.fillRect(
          Math.floor(rand() * size),
          Math.floor(rand() * size),
          1,
          1,
        );
      }
    });

    doomTexturesRef.current = { size, brick, tech, stone, door };
    return doomTexturesRef.current;
  }, []);

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

  const doomLevels = useMemo(
    () => [
      [
        "#################",
        "#..D..V.#...D..X#",
        "#..##...#..I..A.#",
        "#..#....#.......#",
        "#..#..SF#..##...#",
        "#..####.#..#..K.#",
        "#......D#..#..#.#",
        "#..P..Q..#..B.#.#",
        "#..##..T.#..V...#",
        "#..#.....#..###.#",
        "#..#..Z..#......#",
        "#..D..G.Y#..C..H#",
        "#################",
      ],
      [
        "####################",
        "#S..#....D..I..A..X#",
        "#..###..#####..##..#",
        "#..#..Q.#..P....#..#",
        "#..#..T.#..###..#..#",
        "#..#....#..V.#..#..#",
        "#..####..D##.#..#..#",
        "#..#..Z.....#..B..##",
        "#..#..###.#.#..#####",
        "#..#..K..U#.#..Y...#",
        "#..#..#######..C.RH#",
        "####################",
      ],
      [
        "####################",
        "#S....#..D..I..A..X#",
        "#.#######..#######.#",
        "#..#....#..#....#..#",
        "#..#..T.#..#..P.#..#",
        "#..#..Q.#..#..V.#..#",
        "#..####.#..####.#..#",
        "#..#..O.#..#..B.#R.#",
        "#..#....#..#....#..#",
        "#..#..K.#..####.#..#",
        "#..#....#..L..C..YH#",
        "####################",
      ],
      [
        "####################",
        "#S..A......#....D.X#",
        "#..####...#..###...#",
        "#..#..I...#..#O#...#",
        "#..#..V...#..###...#",
        "#..#..Q...#........#",
        "#..#..#####....#...#",
        "#..#..#...Z....#...#",
        "#....V#....####....#",
        "#..U..#..R.....Q...#",
        "#..#######..#####..#",
        "#..B..K..L..Y..H...#",
        "####################",
      ],
    ],
    [],
  );

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

  const loadDoomLevel = useCallback(
    (index: number, resetStats: boolean) => {
      const clampedIndex = clamp(index, 0, doomLevels.length - 1);
      const layout = doomLevels[clampedIndex] ?? doomLevels[0];
      const enemies: Array<{
        x: number;
        y: number;
        hp: number;
        cooldown: number;
        type: "raider" | "spitter" | "charger" | "brute";
      }> = [];
      const pickups: Array<{
        x: number;
        y: number;
        type:
          | "ammo"
          | "shells"
          | "rockets"
          | "med"
          | "shield"
          | "bomb"
          | "chest"
          | "shotgun"
          | "chainsaw"
          | "chaingun"
          | "launcher";
      }> = [];
      const props: Array<{
        x: number;
        y: number;
        type: "pillar" | "crate" | "torch" | "barrel";
        hp?: number;
      }> = [];
      const doors: Record<
        string,
        { open: number; target: number; cooldown: number; locked?: boolean }
      > = {};
      let exit: { x: number; y: number } | null = null;
      const map = layout.map((row, y) =>
        row.split("").map((cell, x) => {
          if (cell === "E") {
            enemies.push({
              x: x + 0.5,
              y: y + 0.5,
              hp: 4,
              cooldown: 0,
              type: "raider",
            });
            return 0;
          }
          if (cell === "I") {
            enemies.push({
              x: x + 0.5,
              y: y + 0.5,
              hp: 3,
              cooldown: 0,
              type: "spitter",
            });
            return 0;
          }
          if (cell === "Z") {
            enemies.push({
              x: x + 0.5,
              y: y + 0.5,
              hp: 5,
              cooldown: 0,
              type: "charger",
            });
            return 0;
          }
          if (cell === "O") {
            enemies.push({
              x: x + 0.5,
              y: y + 0.5,
              hp: 9,
              cooldown: 0,
              type: "brute",
            });
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
          if (cell === "G") {
            pickups.push({ x: x + 0.5, y: y + 0.5, type: "shotgun" });
            return 0;
          }
          if (cell === "Y") {
            pickups.push({ x: x + 0.5, y: y + 0.5, type: "shells" });
            return 0;
          }
          if (cell === "R") {
            pickups.push({ x: x + 0.5, y: y + 0.5, type: "rockets" });
            return 0;
          }
          if (cell === "F") {
            pickups.push({ x: x + 0.5, y: y + 0.5, type: "chainsaw" });
            return 0;
          }
          if (cell === "U") {
            pickups.push({ x: x + 0.5, y: y + 0.5, type: "chaingun" });
            return 0;
          }
          if (cell === "L") {
            pickups.push({ x: x + 0.5, y: y + 0.5, type: "launcher" });
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
          if (cell === "Q") {
            props.push({ x: x + 0.5, y: y + 0.5, type: "crate", hp: 6 });
            return 0;
          }
          if (cell === "V") {
            props.push({ x: x + 0.5, y: y + 0.5, type: "barrel", hp: 3 });
            return 0;
          }
          if (cell === "D") {
            doors[`${x},${y}`] = { open: 0, target: 0, cooldown: 0 };
            return 2;
          }
          if (cell === "X") {
            exit = { x: x + 0.5, y: y + 0.5 };
            return 0;
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
      doomDoorStatesRef.current = doors;
      doomExitRef.current = exit;
      doomLevelRef.current = clampedIndex;
      doomPlayerRef.current = { x: spawn.x, y: spawn.y, angle: 0 };
      doomImpulseRef.current = { move: 0, strafe: 0, turn: 0 };
      doomFlashRef.current = 0;
      doomMuzzleRef.current = 0;
      doomHurtRef.current = 0;
      doomExplosionRef.current = null;
      doomBombRef.current = null;
      doomProjectilesRef.current = [];
      doomHintRef.current = null;
      doomHintWindowRef.current = true;
      doomCooldownRef.current = 0;
      doomGameOverRef.current = false;
      doomBobRef.current = 0;
      if (resetStats) {
        doomAmmoRef.current = 40;
        doomShellsRef.current = 8;
        doomRocketsRef.current = 2;
        doomHealthRef.current = 100;
        doomShieldRef.current = 60;
        doomBombsRef.current = 2;
        doomScoreRef.current = 0;
        doomWeaponRef.current = "pistol";
        doomShotgunUnlockedRef.current = false;
        doomChainsawUnlockedRef.current = false;
        doomChaingunUnlockedRef.current = false;
        doomLauncherUnlockedRef.current = false;
      }
      doomMessageRef.current = resetStats
        ? doomText("ready")
        : `${doomText("nextLevel")} ${clampedIndex + 1}`;
      dirtyRef.current = true;
    },
    [doomLevels, doomText],
  );

  const resetDoom = useCallback(() => {
    loadDoomLevel(0, true);
  }, [loadDoomLevel]);

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
        if (cell === 2) {
          const doorOpen =
            doomDoorStatesRef.current[`${mapX},${mapY}`]?.open ?? 0;
          if (doorOpen >= 0.7) {
            continue;
          }
        }
        if (!cell || cell < 1) {
          const props = doomPropsRef.current;
          for (let i = 0; i < props.length; i += 1) {
            const prop = props[i];
            if (!prop || prop.type === "torch") {
              continue;
            }
            if (Math.floor(prop.x) === mapX && Math.floor(prop.y) === mapY) {
              const raw =
                side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
              distance = Math.min(maxDist, raw);
              return distance;
            }
          }
        }
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

  const applyDoomPickup = useCallback(
    (pickup: {
      type:
        | "ammo"
        | "shells"
        | "rockets"
        | "med"
        | "shield"
        | "bomb"
        | "chest"
        | "shotgun"
        | "chainsaw"
        | "chaingun"
        | "launcher";
    }) => {
      if (pickup.type === "ammo") {
        doomAmmoRef.current = Math.min(99, doomAmmoRef.current + 12);
        doomMessageRef.current = doomText("ammoPlus");
        return;
      }
      if (pickup.type === "shells") {
        doomShellsRef.current = Math.min(99, doomShellsRef.current + 5);
        doomMessageRef.current = doomText("shellsPlus");
        return;
      }
      if (pickup.type === "rockets") {
        doomRocketsRef.current = Math.min(50, doomRocketsRef.current + 2);
        doomMessageRef.current = doomText("rocketsPlus");
        return;
      }
      if (pickup.type === "med") {
        doomHealthRef.current = Math.min(100, doomHealthRef.current + 20);
        doomMessageRef.current = doomText("healthPlus");
        return;
      }
      if (pickup.type === "shield") {
        doomShieldRef.current = Math.min(100, doomShieldRef.current + 35);
        doomMessageRef.current = doomText("shieldPlus");
        return;
      }
      if (pickup.type === "bomb") {
        doomBombsRef.current = Math.min(9, doomBombsRef.current + 1);
        doomMessageRef.current = doomText("bombPlus");
        return;
      }
      if (pickup.type === "shotgun") {
        doomShotgunUnlockedRef.current = true;
        doomWeaponRef.current = "shotgun";
        doomShellsRef.current = Math.min(99, doomShellsRef.current + 6);
        doomMessageRef.current = doomText("shotgun");
        return;
      }
      if (pickup.type === "chainsaw") {
        doomChainsawUnlockedRef.current = true;
        doomWeaponRef.current = "chainsaw";
        doomMessageRef.current = doomText("chainsaw");
        return;
      }
      if (pickup.type === "chaingun") {
        doomChaingunUnlockedRef.current = true;
        doomWeaponRef.current = "chaingun";
        doomAmmoRef.current = Math.min(99, doomAmmoRef.current + 18);
        doomMessageRef.current = doomText("chaingun");
        return;
      }
      if (pickup.type === "launcher") {
        doomLauncherUnlockedRef.current = true;
        doomWeaponRef.current = "launcher";
        doomRocketsRef.current = Math.min(50, doomRocketsRef.current + 2);
        doomMessageRef.current = doomText("launcher");
        return;
      }
      doomScoreRef.current += 5;
      doomAmmoRef.current = Math.min(99, doomAmmoRef.current + 6);
      doomShellsRef.current = Math.min(99, doomShellsRef.current + 2);
      doomMessageRef.current = doomText("chest");
    },
    [doomText],
  );

  const findNearestDoomPickup = useCallback((radius: number) => {
    const player = doomPlayerRef.current;
    let bestIndex = -1;
    let bestDist = radius;
    doomPickupsRef.current.forEach((pickup, index) => {
      const dist = Math.hypot(pickup.x - player.x, pickup.y - player.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = index;
      }
    });
    return bestIndex >= 0 ? { index: bestIndex, dist: bestDist } : null;
  }, []);

  const applyDoomPlayerDamage = useCallback(
    (damage: number, flash = 2) => {
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
      doomFlashRef.current = Math.max(doomFlashRef.current, flash);
      doomHurtRef.current = 14;
      doomMessageRef.current = doomText("damage");
      if (doomHealthRef.current <= 0) {
        doomGameOverRef.current = true;
        doomMessageRef.current = doomText("died");
      }
    },
    [doomText],
  );

  const triggerDoomExplosion = useCallback(
    (
      x: number,
      y: number,
      opts: {
        radius: number;
        damage: number;
        flash: number;
        life: number;
        scorePerKill: number;
      },
    ) => {
      const pending: Array<{ x: number; y: number; strength: number }> = [
        { x, y, strength: 1 },
      ];
      const seen = new Set<string>();
      let loops = 0;
      while (pending.length && loops < 12) {
        loops += 1;
        const next = pending.shift();
        if (!next) {
          break;
        }
        const key = `${Math.floor(next.x * 10)},${Math.floor(next.y * 10)}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        const strength = clamp(next.strength, 0.4, 1);
        const radius = opts.radius * strength;
        const damage = opts.damage * strength;
        const flash = opts.flash * strength;
        const life = Math.max(8, Math.round(opts.life * strength));

        doomExplosionRef.current = { life, x: next.x, y: next.y };
        doomFlashRef.current = Math.max(doomFlashRef.current, flash);

        const enemies = doomEnemiesRef.current;
        for (let i = enemies.length - 1; i >= 0; i -= 1) {
          const enemy = enemies[i];
          const dist = Math.hypot(enemy.x - next.x, enemy.y - next.y);
          if (dist > radius) {
            continue;
          }
          const scale = 1 - dist / Math.max(0.0001, radius);
          const dmg = Math.max(1, Math.round(damage * scale));
          enemy.hp -= dmg;
          if (enemy.hp <= 0) {
            enemies.splice(i, 1);
            doomScoreRef.current += opts.scorePerKill;
          }
        }

        const props = doomPropsRef.current;
        for (let i = props.length - 1; i >= 0; i -= 1) {
          const prop = props[i];
          if (!prop || prop.type === "torch" || prop.type === "pillar") {
            continue;
          }
          const dist = Math.hypot(prop.x - next.x, prop.y - next.y);
          if (dist > radius) {
            continue;
          }
          const scale = 1 - dist / Math.max(0.0001, radius);
          const dmg = Math.max(1, Math.round(damage * 0.9 * scale));
          prop.hp = Math.max(0, (prop.hp ?? 1) - dmg);
          if (prop.hp <= 0) {
            props.splice(i, 1);
            if (prop.type === "barrel") {
              pending.push({ x: prop.x, y: prop.y, strength: strength * 0.7 });
            } else if (prop.type === "crate") {
              const roll = Math.random();
              const pickupType =
                roll < 0.5
                  ? "ammo"
                  : roll < 0.78
                    ? "shells"
                    : roll < 0.9
                      ? "bomb"
                      : "med";
              doomPickupsRef.current.push({
                x: prop.x,
                y: prop.y,
                type: pickupType,
              });
            }
          }
        }

        const player = doomPlayerRef.current;
        const playerDist = Math.hypot(player.x - next.x, player.y - next.y);
        if (playerDist < radius * 0.92) {
          const scale = 1 - playerDist / Math.max(0.0001, radius);
          applyDoomPlayerDamage(
            Math.max(3, Math.round(damage * 0.45 * scale)),
            flash + 1,
          );
        }
      }
    },
    [applyDoomPlayerDamage],
  );

  const shootDoom = useCallback(() => {
    if (doomGameOverRef.current) {
      return;
    }
    if (doomCooldownRef.current > 0) {
      return;
    }
    const weapon = doomWeaponRef.current;
    const player = doomPlayerRef.current;
    const enemies = doomEnemiesRef.current;

    const applyDamage = (index: number, damage: number) => {
      const enemy = enemies[index];
      if (!enemy) {
        return false;
      }
      enemy.hp -= damage;
      if (enemy.hp <= 0) {
        enemies.splice(index, 1);
        doomScoreRef.current += 1;
        doomMessageRef.current = doomText("targetDown");
      } else {
        doomMessageRef.current = doomText("hit");
      }
      return true;
    };

    const pickEnemyTarget = (
      aimAngle: number,
      maxRange: number,
      halfFov: number,
    ) => {
      let bestIndex = -1;
      let bestDist = 999;
      for (let i = 0; i < enemies.length; i += 1) {
        const enemy = enemies[i];
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.25 || dist > maxRange) {
          continue;
        }
        const angle = Math.atan2(dy, dx);
        const delta = Math.atan2(
          Math.sin(angle - aimAngle),
          Math.cos(angle - aimAngle),
        );
        if (Math.abs(delta) > halfFov) {
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
      return bestIndex >= 0 ? { index: bestIndex, dist: bestDist } : null;
    };

    const pickPropTarget = (
      aimAngle: number,
      maxRange: number,
      halfFov: number,
    ) => {
      const props = doomPropsRef.current;
      let bestIndex = -1;
      let bestDist = 999;
      for (let i = 0; i < props.length; i += 1) {
        const prop = props[i];
        if (!prop || prop.type === "torch" || prop.type === "pillar") {
          continue;
        }
        const dx = prop.x - player.x;
        const dy = prop.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.25 || dist > maxRange) {
          continue;
        }
        const angle = Math.atan2(dy, dx);
        const delta = Math.atan2(
          Math.sin(angle - aimAngle),
          Math.cos(angle - aimAngle),
        );
        if (Math.abs(delta) > halfFov) {
          continue;
        }
        const wallDist = castDoomDistance(player, angle, dist + 0.05);
        if (wallDist + 0.25 < dist) {
          continue;
        }
        if (dist < bestDist) {
          bestDist = dist;
          bestIndex = i;
        }
      }
      return bestIndex >= 0 ? { index: bestIndex, dist: bestDist } : null;
    };

    const damageProp = (index: number, damage: number) => {
      const props = doomPropsRef.current;
      const prop = props[index];
      if (!prop || prop.type === "torch" || prop.type === "pillar") {
        return false;
      }
      prop.hp = Math.max(0, (prop.hp ?? 1) - damage);
      if (prop.hp > 0) {
        doomMessageRef.current = doomText("hit");
        return true;
      }
      props.splice(index, 1);
      if (prop.type === "barrel") {
        triggerDoomExplosion(prop.x, prop.y, {
          radius: 2.4,
          damage: 12,
          flash: 7,
          life: 12,
          scorePerKill: 1,
        });
        doomMessageRef.current = doomText("boom");
        return true;
      }
      if (prop.type === "crate") {
        doomScoreRef.current += 1;
        const roll = Math.random();
        const pickupType =
          roll < 0.5
            ? "ammo"
            : roll < 0.78
              ? "shells"
              : roll < 0.9
                ? "bomb"
                : "med";
        doomPickupsRef.current.push({ x: prop.x, y: prop.y, type: pickupType });
        doomMessageRef.current = doomText("hit");
        return true;
      }
      doomMessageRef.current = doomText("hit");
      return true;
    };

    if (weapon === "fist" || weapon === "chainsaw") {
      doomCooldownRef.current = weapon === "chainsaw" ? 4 : 14;
      doomMuzzleRef.current = weapon === "chainsaw" ? 10 : 8;
      doomMessageRef.current = doomText(
        weapon === "chainsaw" ? "saw" : "punch",
      );
      const enemyTarget = pickEnemyTarget(
        player.angle,
        weapon === "chainsaw" ? 1.35 : 1.05,
        weapon === "chainsaw" ? 0.85 : 0.65,
      );
      const propTarget = pickPropTarget(
        player.angle,
        weapon === "chainsaw" ? 1.35 : 1.05,
        weapon === "chainsaw" ? 0.75 : 0.6,
      );
      if (propTarget && (!enemyTarget || propTarget.dist <= enemyTarget.dist)) {
        damageProp(propTarget.index, weapon === "chainsaw" ? 2 : 3);
        return;
      }
      if (enemyTarget) {
        applyDamage(enemyTarget.index, weapon === "chainsaw" ? 2 : 3);
      }
      return;
    }

    if (weapon === "launcher") {
      if (!doomLauncherUnlockedRef.current) {
        doomMessageRef.current = doomText("noLauncher");
        return;
      }
      if (doomRocketsRef.current <= 0) {
        doomMessageRef.current = doomText("noRockets");
        return;
      }
      doomRocketsRef.current -= 1;
      doomCooldownRef.current = 26;
      doomFlashRef.current = 10;
      doomMuzzleRef.current = 16;
      doomMessageRef.current = doomText("rocket");
      const dirX = Math.cos(player.angle);
      const dirY = Math.sin(player.angle);
      doomProjectilesRef.current.push({
        x: player.x + dirX * 0.35,
        y: player.y + dirY * 0.35,
        vx: dirX * 0.24,
        vy: dirY * 0.24,
        life: 70,
        kind: "rocket",
        friendly: true,
        damage: 18,
        radius: 2.8,
      });
      return;
    }

    if (weapon === "shotgun") {
      if (!doomShotgunUnlockedRef.current) {
        doomMessageRef.current = doomText("noShotgun");
        return;
      }
      if (doomShellsRef.current <= 0) {
        doomMessageRef.current = doomText("noShells");
        return;
      }
      doomShellsRef.current -= 1;
      doomCooldownRef.current = 18;
      doomFlashRef.current = 8;
      doomMuzzleRef.current = 14;
      doomMessageRef.current = doomText("fire");
      const pellets = 7;
      const spread = 0.22;
      const pelletFov = 0.14;
      const pelletHits = new Array(enemies.length).fill(0);
      for (let pellet = 0; pellet < pellets; pellet += 1) {
        const aimAngle = player.angle + (Math.random() - 0.5) * spread;
        const target = pickEnemyTarget(aimAngle, 8.5, pelletFov);
        if (target) {
          pelletHits[target.index] += 1;
        }
      }
      let anyHit = false;
      for (let i = enemies.length - 1; i >= 0; i -= 1) {
        const hits = pelletHits[i] ?? 0;
        if (hits <= 0) {
          continue;
        }
        anyHit = true;
        applyDamage(i, hits);
      }
      if (!anyHit) {
        const propTarget = pickPropTarget(player.angle, 8.5, 0.16);
        if (propTarget) {
          damageProp(propTarget.index, 4);
        } else {
          doomMessageRef.current = doomText("fire");
        }
      }
      return;
    }

    const isChaingun = weapon === "chaingun";
    if (isChaingun && !doomChaingunUnlockedRef.current) {
      doomMessageRef.current = doomText("noChaingun");
      return;
    }
    if (doomAmmoRef.current <= 0) {
      doomMessageRef.current = doomText("noAmmo");
      return;
    }
    doomAmmoRef.current -= 1;
    doomCooldownRef.current = isChaingun ? 4 : 10;
    doomFlashRef.current = isChaingun ? 5 : 6;
    doomMuzzleRef.current = isChaingun ? 8 : 10;
    doomMessageRef.current = doomText("fire");
    const aimAngle =
      player.angle + (isChaingun ? (Math.random() - 0.5) * 0.06 : 0);
    const enemyTarget = pickEnemyTarget(aimAngle, 9, isChaingun ? 0.18 : 0.22);
    const propTarget = pickPropTarget(aimAngle, 9, isChaingun ? 0.16 : 0.18);
    if (propTarget && (!enemyTarget || propTarget.dist <= enemyTarget.dist)) {
      damageProp(propTarget.index, 1);
      return;
    }
    if (enemyTarget) {
      applyDamage(enemyTarget.index, 1);
    }
  }, [castDoomDistance, doomText, triggerDoomExplosion]);

  const throwDoomBomb = useCallback(() => {
    if (doomGameOverRef.current) {
      return;
    }
    if (doomBombsRef.current <= 0) {
      doomMessageRef.current = doomText("noBombs");
      return;
    }
    doomBombsRef.current -= 1;
    const player = doomPlayerRef.current;
    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    doomBombRef.current = {
      active: true,
      x: player.x + dirX * 0.3,
      y: player.y + dirY * 0.3,
      vx: dirX * 0.18,
      vy: dirY * 0.18,
      life: 42,
    };
    doomMessageRef.current = doomText("boom");
  }, [doomText]);

  const openDoomDoor = useCallback(() => {
    const map = doomMapRef.current;
    if (!map.length) {
      return false;
    }
    const player = doomPlayerRef.current;
    const lookX = player.x + Math.cos(player.angle) * 0.8;
    const lookY = player.y + Math.sin(player.angle) * 0.8;
    const gx = Math.floor(lookX);
    const gy = Math.floor(lookY);
    if (map[gy]?.[gx] !== 2) {
      doomMessageRef.current = doomText("noDoor");
      return false;
    }
    const key = `${gx},${gy}`;
    const door = doomDoorStatesRef.current[key];
    if (!door) {
      doomMessageRef.current = doomText("noDoor");
      return false;
    }
    const nextTarget = door.target > 0.5 ? 0 : 1;
    door.target = nextTarget;
    door.cooldown = 140;
    doomMessageRef.current =
      nextTarget > 0 ? doomText("doorOpen") : doomText("doorClose");
    return true;
  }, [doomText]);

  const interactDoom = useCallback(() => {
    if (openDoomDoor()) {
      return true;
    }
    const nearest = findNearestDoomPickup(0.9);
    if (!nearest) {
      return false;
    }
    const pickup = doomPickupsRef.current[nearest.index];
    if (!pickup) {
      return false;
    }
    applyDoomPickup(pickup);
    doomPickupsRef.current = doomPickupsRef.current.filter(
      (_, index) => index !== nearest.index,
    );
    return true;
  }, [applyDoomPickup, findNearestDoomPickup, openDoomDoor]);

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
    if (doomMuzzleRef.current > 0) {
      doomMuzzleRef.current -= 1;
    }
    if (doomHurtRef.current > 0) {
      doomHurtRef.current -= 1;
    }
    if (doomExplosionRef.current) {
      doomExplosionRef.current.life -= 1;
      if (doomExplosionRef.current.life <= 0) {
        doomExplosionRef.current = null;
      }
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
      if (cell === 2) {
        const door = doomDoorStatesRef.current[`${gx},${gy}`];
        return (door?.open ?? 0) < 0.7;
      }
      if (cell >= 1) {
        return true;
      }
      const props = doomPropsRef.current;
      for (let i = 0; i < props.length; i += 1) {
        const prop = props[i];
        if (!prop || prop.type === "torch") {
          continue;
        }
        const dx = prop.x - x;
        const dy = prop.y - y;
        const radius =
          prop.type === "pillar" ? 0.28 : prop.type === "barrel" ? 0.24 : 0.26;
        if (dx * dx + dy * dy < radius * radius) {
          return true;
        }
      }
      return false;
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

    const doors = doomDoorStatesRef.current;
    Object.entries(doors).forEach(([key, door]) => {
      const [sx, sy] = key.split(",").map((value) => Number(value));
      const centerX = sx + 0.5;
      const centerY = sy + 0.5;
      const dist = Math.hypot(centerX - player.x, centerY - player.y);
      if (door.cooldown > 0) {
        door.cooldown -= 1;
      }
      if (door.target > 0.5 && dist < 1.1) {
        door.target = 1;
      } else if (door.cooldown <= 0) {
        door.target = 0;
      }
      const next = door.open + (door.target - door.open) * 0.18;
      door.open = clamp(next, 0, 1);
    });

    const autoPickup = findNearestDoomPickup(0.45);
    if (autoPickup) {
      const pickup = doomPickupsRef.current[autoPickup.index];
      if (pickup) {
        applyDoomPickup(pickup);
        doomPickupsRef.current = doomPickupsRef.current.filter(
          (_, index) => index !== autoPickup.index,
        );
      }
    }

    const pickups = doomPickupsRef.current;
    const nearestPickup = findNearestDoomPickup(1.15);
    let hint: string | null = null;
    if (nearestPickup) {
      const pickup = pickups[nearestPickup.index];
      const labelMap: Record<string, string> = {
        ammo: "AMMO",
        shells: "SHELLS",
        rockets: "ROCKETS",
        med: "MED",
        shield: "SHIELD",
        bomb: "BOMB",
        chest: "CHEST",
        shotgun: "SHOTGUN",
        chainsaw: "CHAINSAW",
        chaingun: "CHAINGUN",
        launcher: "LAUNCHER",
      };
      hint =
        `${doomText("interactPickup")} ${labelMap[pickup.type] ?? ""}`.trim();
    }
    const lookX = player.x + Math.cos(player.angle) * 0.9;
    const lookY = player.y + Math.sin(player.angle) * 0.9;
    const lookGX = Math.floor(lookX);
    const lookGY = Math.floor(lookY);
    if (!hint && map[lookGY]?.[lookGX] === 2) {
      hint = doomText("interactDoor");
    }
    const exit = doomExitRef.current;
    if (
      !hint &&
      exit &&
      Math.hypot(exit.x - player.x, exit.y - player.y) < 1.1
    ) {
      hint = doomText("exitReady");
    }
    doomHintRef.current = hint;

    if (exit && Math.hypot(exit.x - player.x, exit.y - player.y) < 0.6) {
      const nextLevel = doomLevelRef.current + 1;
      if (nextLevel < doomLevels.length) {
        doomAmmoRef.current = Math.min(99, doomAmmoRef.current + 8);
        doomHealthRef.current = Math.min(100, doomHealthRef.current + 10);
        loadDoomLevel(nextLevel, false);
      } else {
        doomMessageRef.current = doomText("clear");
      }
      return;
    }

    const bomb = doomBombRef.current;
    if (bomb?.active) {
      bomb.x += bomb.vx;
      bomb.y += bomb.vy;
      bomb.life -= 1;
      const hitWall = isWall(bomb.x, bomb.y);
      if (bomb.life <= 0 || hitWall) {
        doomBombRef.current = null;
        triggerDoomExplosion(bomb.x, bomb.y, {
          radius: 2.6,
          damage: 14,
          flash: 8,
          life: 12,
          scorePerKill: 2,
        });
      }
    }

    const projectiles = doomProjectilesRef.current;
    for (let i = projectiles.length - 1; i >= 0; i -= 1) {
      const projectile = projectiles[i];
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;
      projectile.life -= 1;
      const hitWall = isWall(projectile.x, projectile.y);
      if (projectile.life <= 0 || hitWall) {
        if (projectile.kind === "rocket") {
          triggerDoomExplosion(projectile.x, projectile.y, {
            radius: projectile.radius,
            damage: projectile.damage,
            flash: 10,
            life: 14,
            scorePerKill: 2,
          });
        }
        projectiles.splice(i, 1);
        continue;
      }
      if (projectile.friendly) {
        if (projectile.kind === "rocket") {
          const enemies = doomEnemiesRef.current;
          let hit = false;
          for (let e = 0; e < enemies.length; e += 1) {
            const enemy = enemies[e];
            if (
              Math.hypot(enemy.x - projectile.x, enemy.y - projectile.y) < 0.25
            ) {
              hit = true;
              break;
            }
          }
          if (hit) {
            triggerDoomExplosion(projectile.x, projectile.y, {
              radius: projectile.radius,
              damage: projectile.damage,
              flash: 10,
              life: 14,
              scorePerKill: 2,
            });
            projectiles.splice(i, 1);
          }
        }
        continue;
      }
      const dist = Math.hypot(projectile.x - player.x, projectile.y - player.y);
      if (dist < 0.22) {
        projectiles.splice(i, 1);
        applyDoomPlayerDamage(projectile.damage, 3);
      }
    }

    const enemies = doomEnemiesRef.current;
    const maxEnemyProjectiles =
      perfTier === "low" ? 8 : perfTier === "mid" ? 12 : 18;
    const hasEnemyLineOfSight = (enemyX: number, enemyY: number) => {
      const dx = player.x - enemyX;
      const dy = player.y - enemyY;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.0001) {
        return true;
      }
      const angle = Math.atan2(dy, dx);
      const wallDist = castDoomDistance(
        { x: enemyX, y: enemyY },
        angle,
        dist + 0.05,
      );
      return wallDist + 0.05 >= dist;
    };
    enemies.forEach((enemy, index) => {
      if (enemy.cooldown > 0) {
        enemy.cooldown -= 1;
      }
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.0001) {
        return;
      }
      const inv = 1 / Math.max(0.0001, dist);
      const dirX = dx * inv;
      const dirY = dy * inv;

      let speed = 0.018;
      let meleeRange = 0.6;
      let meleeDamage = 5;
      let meleeCooldown = 26;
      let canShoot = true;
      let shootRange = 4.8;
      let shootCooldown = 56;
      let projectileSpeed = 0.12;
      let projectileDamage = 6;
      let projectileVariance = 0.06;
      let strafe = 0;

      if (enemy.type === "raider") {
        speed = 0.017;
        meleeRange = 0.55;
        meleeDamage = 4;
        meleeCooldown = 30;
        canShoot = true;
        shootRange = 6.4;
        shootCooldown = 46;
        projectileSpeed = 0.13;
        projectileDamage = 4;
        projectileVariance = 0.12;
        if (dist < 2.8) {
          strafe = (index % 2 === 0 ? 1 : -1) * 0.55;
        }
      } else if (enemy.type === "spitter") {
        speed = 0.014;
        meleeRange = 0.55;
        meleeDamage = 3;
        meleeCooldown = 34;
        canShoot = true;
        shootRange = 7.2;
        shootCooldown = 54;
        projectileSpeed = 0.115;
        projectileDamage = 6;
        projectileVariance = 0.08;
      } else if (enemy.type === "charger") {
        speed = dist < 3.2 ? 0.028 : 0.021;
        meleeRange = 0.76;
        meleeDamage = 7;
        meleeCooldown = 22;
        canShoot = false;
      } else if (enemy.type === "brute") {
        speed = 0.012;
        meleeRange = 0.82;
        meleeDamage = 10;
        meleeCooldown = 30;
        canShoot = true;
        shootRange = 6.2;
        shootCooldown = 68;
        projectileSpeed = 0.105;
        projectileDamage = 8;
        projectileVariance = 0.05;
      }

      if (dist < meleeRange) {
        if (enemy.cooldown <= 0) {
          enemy.cooldown = meleeCooldown;
          applyDoomPlayerDamage(meleeDamage, 2);
        }
        return;
      }

      if (
        canShoot &&
        dist < shootRange &&
        enemy.cooldown <= 0 &&
        doomProjectilesRef.current.length < maxEnemyProjectiles &&
        hasEnemyLineOfSight(enemy.x, enemy.y)
      ) {
        const variance = (Math.random() - 0.5) * projectileVariance;
        const rotX = dirX * Math.cos(variance) - dirY * Math.sin(variance);
        const rotY = dirX * Math.sin(variance) + dirY * Math.cos(variance);
        doomProjectilesRef.current.push({
          x: enemy.x + rotX * 0.2,
          y: enemy.y + rotY * 0.2,
          vx: rotX * projectileSpeed,
          vy: rotY * projectileSpeed,
          life: 90,
          kind: "fireball",
          friendly: false,
          damage: projectileDamage,
          radius: 0,
        });
        enemy.cooldown = shootCooldown;
      }

      const sideX = -dirY;
      const sideY = dirX;
      const moveX = dirX + sideX * strafe;
      const moveY = dirY + sideY * strafe;
      const moveInv = 1 / Math.max(0.0001, Math.hypot(moveX, moveY));
      const nx = enemy.x + moveX * moveInv * speed;
      const ny = enemy.y + moveY * moveInv * speed;
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
  }, [
    applyDoomPickup,
    applyDoomPlayerDamage,
    castDoomDistance,
    doomLevels.length,
    doomText,
    findNearestDoomPickup,
    getDoomBootProgress,
    loadDoomLevel,
    perfTier,
    triggerDoomExplosion,
  ]);

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

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (gameTimerRef.current) {
          gamePausedRef.current = true;
          stopGameLoop();
        }
        return;
      }
      if (!gamePausedRef.current || !isActiveRef.current) {
        return;
      }
      gamePausedRef.current = false;
      const mode = appModeRef.current;
      if (
        mode === "snake" ||
        mode === "pacman" ||
        mode === "pong" ||
        mode === "doom" ||
        mode === "player"
      ) {
        startGameLoop(mode);
        lastDrawRef.current =
          typeof performance !== "undefined" ? performance.now() : Date.now();
        dirtyRef.current = true;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [startGameLoop, stopGameLoop]);

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
      } else if (mode === "editor") {
        // editor runs without a game loop
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

  const normalizeEditorSelection = useCallback(
    (selection: {
      start: { row: number; col: number };
      end: { row: number; col: number };
    }) => {
      const { start, end } = selection;
      if (start.row < end.row) {
        return selection;
      }
      if (start.row > end.row) {
        return { start: end, end: start };
      }
      if (start.col <= end.col) {
        return selection;
      }
      return { start: end, end: start };
    },
    [],
  );

  const ensureEditorBuffer = useCallback((state: EditorState) => {
    if (!state.buffer.length) {
      state.buffer.push("");
    }
  }, []);

  const clampEditorCursor = useCallback(
    (state: EditorState, row: number, col: number) => {
      const safeRow = clamp(row, 0, Math.max(0, state.buffer.length - 1));
      const line = state.buffer[safeRow] ?? "";
      const safeCol = clamp(col, 0, line.length);
      return { row: safeRow, col: safeCol };
    },
    [],
  );

  const updateEditorScroll = useCallback((visibleLines: number) => {
    const state = editorRef.current;
    if (!state) {
      return;
    }
    const cursor = editorCursorRef.current;
    const top = editorScrollRef.current;
    const bottom = top + Math.max(1, visibleLines - 1);
    if (cursor.row < top) {
      editorScrollRef.current = cursor.row;
    } else if (cursor.row > bottom) {
      editorScrollRef.current = cursor.row - Math.max(1, visibleLines - 1);
    }
  }, []);

  const clearEditorSelection = useCallback(() => {
    editorSelectionRef.current = null;
  }, []);

  const deleteEditorSelection = useCallback(() => {
    const state = editorRef.current;
    const selection = editorSelectionRef.current;
    if (!state || !selection) {
      return false;
    }
    const normalized = normalizeEditorSelection(selection);
    const { start, end } = normalized;
    if (start.row === end.row) {
      const line = state.buffer[start.row] ?? "";
      state.buffer[start.row] = line.slice(0, start.col) + line.slice(end.col);
    } else {
      const first = state.buffer[start.row] ?? "";
      const last = state.buffer[end.row] ?? "";
      const merged = first.slice(0, start.col) + last.slice(end.col);
      state.buffer.splice(start.row, end.row - start.row + 1, merged);
    }
    editorCursorRef.current = { row: start.row, col: start.col };
    clearEditorSelection();
    state.modified = true;
    return true;
  }, [clearEditorSelection, normalizeEditorSelection]);

  const insertEditorText = useCallback(
    (text: string) => {
      const state = editorRef.current;
      if (!state) {
        return;
      }
      ensureEditorBuffer(state);
      if (editorSelectionRef.current) {
        deleteEditorSelection();
      }
      const cursor = editorCursorRef.current;
      const line = state.buffer[cursor.row] ?? "";
      const next = line.slice(0, cursor.col) + text + line.slice(cursor.col);
      state.buffer[cursor.row] = next;
      editorCursorRef.current = {
        row: cursor.row,
        col: cursor.col + text.length,
      };
      state.modified = true;
    },
    [deleteEditorSelection, ensureEditorBuffer],
  );

  const insertEditorNewline = useCallback(() => {
    const state = editorRef.current;
    if (!state) {
      return;
    }
    ensureEditorBuffer(state);
    if (editorSelectionRef.current) {
      deleteEditorSelection();
    }
    const cursor = editorCursorRef.current;
    const line = state.buffer[cursor.row] ?? "";
    const left = line.slice(0, cursor.col);
    const right = line.slice(cursor.col);
    state.buffer.splice(cursor.row, 1, left, right);
    editorCursorRef.current = { row: cursor.row + 1, col: 0 };
    state.modified = true;
  }, [deleteEditorSelection, ensureEditorBuffer]);

  const deleteEditorChar = useCallback(
    (direction: "back" | "forward") => {
      const state = editorRef.current;
      if (!state) {
        return;
      }
      ensureEditorBuffer(state);
      if (editorSelectionRef.current) {
        deleteEditorSelection();
        return;
      }
      const cursor = editorCursorRef.current;
      const line = state.buffer[cursor.row] ?? "";
      if (direction === "back") {
        if (cursor.col > 0) {
          state.buffer[cursor.row] =
            line.slice(0, cursor.col - 1) + line.slice(cursor.col);
          editorCursorRef.current = {
            row: cursor.row,
            col: cursor.col - 1,
          };
          state.modified = true;
        } else if (cursor.row > 0) {
          const prevLine = state.buffer[cursor.row - 1] ?? "";
          state.buffer[cursor.row - 1] = prevLine + line;
          state.buffer.splice(cursor.row, 1);
          editorCursorRef.current = {
            row: cursor.row - 1,
            col: prevLine.length,
          };
          state.modified = true;
        }
        return;
      }
      if (cursor.col < line.length) {
        state.buffer[cursor.row] =
          line.slice(0, cursor.col) + line.slice(cursor.col + 1);
        state.modified = true;
      } else if (cursor.row < state.buffer.length - 1) {
        const nextLine = state.buffer[cursor.row + 1] ?? "";
        state.buffer[cursor.row] = line + nextLine;
        state.buffer.splice(cursor.row + 1, 1);
        state.modified = true;
      }
    },
    [deleteEditorSelection, ensureEditorBuffer],
  );

  const moveEditorCursor = useCallback(
    (
      deltaRow: number,
      deltaCol: number,
      options?: { extend?: boolean; byWord?: boolean },
    ) => {
      const state = editorRef.current;
      if (!state) {
        return;
      }
      ensureEditorBuffer(state);
      const { row: currentRow, col: currentCol } = editorCursorRef.current;
      const nextRow = currentRow + deltaRow;
      let nextCol = currentCol + deltaCol;
      if (options?.byWord) {
        const line = state.buffer[currentRow] ?? "";
        if (deltaCol < 0) {
          nextCol = findPrevWord(line, currentCol);
        } else if (deltaCol > 0) {
          nextCol = findNextWord(line, currentCol);
        }
      }
      const next = clampEditorCursor(state, nextRow, nextCol);
      editorCursorRef.current = next;
      if (options?.extend) {
        const selection = editorSelectionRef.current;
        if (!selection) {
          editorSelectionRef.current = {
            start: { row: currentRow, col: currentCol },
            end: { ...next },
          };
        } else {
          editorSelectionRef.current = {
            start: selection.start,
            end: { ...next },
          };
        }
      } else {
        clearEditorSelection();
      }
    },
    [clampEditorCursor, clearEditorSelection, ensureEditorBuffer],
  );

  const getEditorSelectionText = useCallback(() => {
    const state = editorRef.current;
    const selection = editorSelectionRef.current;
    if (!state || !selection) {
      return "";
    }
    const normalized = normalizeEditorSelection(selection);
    const { start, end } = normalized;
    if (start.row === end.row) {
      const line = state.buffer[start.row] ?? "";
      return line.slice(start.col, end.col);
    }
    const parts: string[] = [];
    const firstLine = state.buffer[start.row] ?? "";
    parts.push(firstLine.slice(start.col));
    for (let row = start.row + 1; row < end.row; row += 1) {
      parts.push(state.buffer[row] ?? "");
    }
    const lastLine = state.buffer[end.row] ?? "";
    parts.push(lastLine.slice(0, end.col));
    return parts.join("\n");
  }, [normalizeEditorSelection]);

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

  const executeEditorCommand = useCallback(
    (value: string) => {
      const state = editorRef.current;
      if (!state) {
        return;
      }
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }
      const parts = trimmed.split(/\s+/).filter(Boolean);
      const cmd = parts[0] ?? "";
      const arg = parts.slice(1).join(" ");

      const closeEditor = (message?: string) => {
        editorRef.current = null;
        editorCommandRef.current = { active: false, value: "" };
        editorSelectionRef.current = null;
        editorQuitArmedRef.current = false;
        stopApp(message ?? messages.editor.exit);
      };

      const saveTo = (path: string) => {
        const ok = writeFile(path, state.buffer.join("\n"), { create: true });
        if (!ok) {
          editorStatusRef.current = messages.editor.saveFailed;
          return false;
        }
        state.modified = false;
        editorQuitArmedRef.current = false;
        editorStatusRef.current = messages.editor.saved;
        return true;
      };

      if (cmd === "q") {
        if (state.modified) {
          editorStatusRef.current = messages.editor.unsavedChanges;
          editorQuitArmedRef.current = true;
        } else {
          closeEditor(messages.editor.exit);
        }
        return;
      }
      if (cmd === "q!") {
        closeEditor(messages.editor.exit);
        return;
      }
      if (cmd === "wq") {
        if (saveTo(arg || state.path)) {
          if (arg) {
            state.path = arg;
          }
          closeEditor(messages.editor.exit);
        }
        return;
      }
      if (cmd === "w") {
        if (saveTo(arg || state.path) && arg) {
          state.path = arg;
          editorStatusRef.current = formatMessage(messages.editor.savedAs, {
            path: arg,
          });
        }
        return;
      }
      if (cmd === "set") {
        if (arg === "nu" || arg === "number") {
          state.showLineNumbers = true;
          editorStatusRef.current = messages.editor.lineNumbersOn;
        } else if (arg === "nonu" || arg === "nonumber") {
          state.showLineNumbers = false;
          editorStatusRef.current = messages.editor.lineNumbersOff;
        } else {
          editorStatusRef.current = messages.editor.usageSet;
        }
        return;
      }
      if (cmd === "help") {
        editorStatusRef.current = messages.editor.help;
        return;
      }
      editorStatusRef.current = messages.editor.unknownCommand;
    },
    [formatMessage, messages.editor, stopApp, writeFile],
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
            buffer: content ? content.split("\n") : [""],
            showLineNumbers: true,
            modified: false,
          };
          editorCursorRef.current = { row: 0, col: 0 };
          editorScrollRef.current = 0;
          editorSelectionRef.current = null;
          editorCommandRef.current = { active: false, value: "" };
          editorStatusRef.current = messages.editor.help;
          editorQuitArmedRef.current = false;
          appendLine(formatMessage(messages.editor.editing, { path: arg }));
          startApp("editor");
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
            hellrun: ["hellrun - retro FPS mini oyun"],
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
            hellrun: ["hellrun - retro FPS mini game"],
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
        case "hellrun":
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

      if (mode === "editor") {
        const pad = Math.floor(Math.min(width, height) * 0.1);
        const boxW = width - pad * 2;
        const boxH = height - pad * 2;
        const headerHeight = Math.floor(lineHeight * 1.2) + 8;
        const footerHeight = Math.floor(lineHeight * 1.6) + 10;
        const textAreaY = pad + headerHeight;
        const textAreaH = boxH - headerHeight - footerHeight;

        ctx.strokeStyle = dim;
        ctx.lineWidth = 2;
        ctx.strokeRect(pad, pad, boxW, boxH);

        const state = editorRef.current;
        if (!state) {
          ctx.fillStyle = accent;
          ctx.fillText("NANO", pad + 12, pad + 8);
          ctx.fillStyle = dim;
          ctx.fillText("(no buffer)", pad + 12, pad + 32);
          finalizeFrame();
          return;
        }

        ensureEditorBuffer(state);

        ctx.fillStyle = accent;
        ctx.fillText(`NANO  ${state.path}`, pad + 12, pad + 8);

        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(pad + 1, textAreaY - 4, boxW - 2, 1);

        const charWidth = Math.max(6, Math.ceil(ctx.measureText("M").width));
        const visibleLines = Math.max(1, Math.floor(textAreaH / lineHeight));
        const maxLineDigits = String(state.buffer.length).length;
        const lineNumberWidth = state.showLineNumbers
          ? (maxLineDigits + 2) * charWidth
          : 0;

        updateEditorScroll(visibleLines);
        const top = clamp(
          editorScrollRef.current,
          0,
          Math.max(0, state.buffer.length - 1),
        );
        editorScrollRef.current = top;

        const cursor = editorCursorRef.current;
        const selection = editorSelectionRef.current
          ? normalizeEditorSelection(editorSelectionRef.current)
          : null;

        ctx.save();
        ctx.beginPath();
        ctx.rect(pad + 6, textAreaY, boxW - 12, textAreaH);
        ctx.clip();

        for (let i = 0; i < visibleLines; i += 1) {
          const lineIndex = top + i;
          if (lineIndex >= state.buffer.length) {
            continue;
          }
          const line = state.buffer[lineIndex] ?? "";
          const y = textAreaY + i * lineHeight;
          if (state.showLineNumbers) {
            ctx.fillStyle = dim;
            const numberText = String(lineIndex + 1).padStart(maxLineDigits);
            ctx.fillText(numberText, pad + 12, y);
          }

          const textX = pad + 12 + lineNumberWidth;
          ctx.fillStyle = accent;
          ctx.fillText(line, textX, y);

          if (selection) {
            const { start, end } = selection;
            if (lineIndex >= start.row && lineIndex <= end.row) {
              const startCol = lineIndex === start.row ? start.col : 0;
              const endCol = lineIndex === end.row ? end.col : line.length;
              if (endCol > startCol) {
                ctx.fillStyle = "rgba(246,194,122,0.18)";
                ctx.fillRect(
                  textX + startCol * charWidth,
                  y - 1,
                  Math.max(1, (endCol - startCol) * charWidth),
                  lineHeight,
                );
                ctx.fillStyle = accent;
                ctx.fillText(line, textX, y);
              }
            }
          }

          if (
            cursorVisible &&
            lineIndex === cursor.row &&
            !editorCommandRef.current.active
          ) {
            const cursorX = textX + cursor.col * charWidth;
            ctx.fillStyle = accent;
            ctx.fillRect(cursorX, y - 1, 2, lineHeight);
          }
        }

        ctx.restore();

        const statusY = pad + boxH - footerHeight + 6;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(pad + 1, statusY - 4, boxW - 2, footerHeight - 6);

        const modifiedMark = state.modified ? "*" : "";
        const statusText =
          editorStatusRef.current ??
          (language === "tr"
            ? `SATIR ${cursor.row + 1}, SUTUN ${cursor.col + 1}`
            : `LINE ${cursor.row + 1}, COL ${cursor.col + 1}`);
        const trimToWidth = (text: string, maxWidth: number) => {
          if (ctx.measureText(text).width <= maxWidth) {
            return text;
          }
          let trimmed = text;
          while (
            trimmed.length > 3 &&
            ctx.measureText(`${trimmed}…`).width > maxWidth
          ) {
            trimmed = trimmed.slice(0, -1);
          }
          return `${trimmed}…`;
        };
        const statusMaxW = boxW - 24;
        const safePath = trimToWidth(
          `${modifiedMark}${state.path}`,
          statusMaxW,
        );
        const safeStatus = trimToWidth(statusText, statusMaxW);
        ctx.fillStyle = accent;
        ctx.fillText(safePath, pad + 12, statusY);
        ctx.fillStyle = dim;
        ctx.fillText(safeStatus, pad + 12, statusY + lineHeight);

        const helpText =
          language === "tr"
            ? "^S Kaydet  ^Q Çıkış  ^W Komut  : komut"
            : "^S Save  ^Q Quit  ^W Command  : cmd";
        const footerFont = Math.max(9, Math.floor(fontSize * 0.7));
        ctx.font = `${footerFont}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        const helpY = pad + boxH - Math.max(8, Math.floor(footerFont * 0.6));
        const helpMaxW = boxW - 24;
        if (helpMaxW > 240) {
          const safeHelp = trimToWidth(helpText, helpMaxW);
          ctx.save();
          ctx.beginPath();
          ctx.rect(
            pad + 6,
            pad + boxH - footerHeight + 4,
            boxW - 12,
            footerHeight - 8,
          );
          ctx.clip();
          ctx.fillStyle = dim;
          ctx.fillText(safeHelp, pad + 12, helpY);
          ctx.restore();
        }

        ctx.font = `${headerSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;

        if (editorCommandRef.current.active) {
          const cmdLine = `:${editorCommandRef.current.value}`;
          const safeCmd = trimToWidth(cmdLine, statusMaxW);
          ctx.fillStyle = accent;
          ctx.fillText(
            safeCmd,
            pad + boxW - 12 - ctx.measureText(safeCmd).width,
            statusY + lineHeight,
          );
        }
      } else if (mode === "player") {
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
        const inputText = calcInputRef.current;
        if (inputText) {
          ctx.fillText(inputText, pad + 12, pad + 46);
        }
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
        const hintLine1 =
          language === "tr"
            ? "Terminalde kullan: calc 2+2"
            : "Use in terminal: calc 2+2";
        const hintLine2 =
          language === "tr" ? "C: temizle  Q: çıkış" : "C: clear  Q: quit";
        ctx.fillText(hintLine1, pad + 12, height - 54);
        ctx.fillText(hintLine2, pad + 12, height - 36);
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
          ctx.imageSmoothingEnabled = false;
          const player = doomPlayerRef.current;
          const fov = Math.PI / 3;
          const rayDivisor =
            perfTier === "low" ? 5 : perfTier === "mid" ? 4 : 3;
          const rayCount = Math.max(28, Math.floor(viewW / rayDivisor));
          const colWidth = viewW / rayCount;
          const maxSteps =
            perfTier === "low" ? 48 : perfTier === "mid" ? 56 : 64;
          const wallDistances = new Array(rayCount).fill(999);
          const doorDistances = new Array(rayCount).fill(0);
          const doorBandBottoms = new Array(rayCount).fill(0);
          const cameraBob = Math.sin(doomBobRef.current) * 4;
          const textures = ensureDoomTextures();
          const texSize = textures?.size ?? 64;
          const pickWallTexture = (tileX: number, tileY: number) => {
            if (!textures) {
              return null;
            }
            const v = (tileX * 31 + tileY * 17 + (tileX ^ tileY) * 13) % 3;
            if (v === 1) {
              return textures.tech;
            }
            if (v === 2) {
              return textures.stone;
            }
            return textures.brick;
          };
          const now =
            typeof performance !== "undefined" ? performance.now() : Date.now();
          const sampleDoomLight = (x: number, y: number) => {
            let boost = 0;
            let warm = 0;
            let hot = 0;

            const props = doomPropsRef.current;
            for (let i = 0; i < props.length; i += 1) {
              const prop = props[i];
              if (!prop || prop.type !== "torch") {
                continue;
              }
              const dx = x - prop.x;
              const dy = y - prop.y;
              const dist = Math.hypot(dx, dy);
              const radius = 4.4;
              if (dist > radius) {
                continue;
              }
              const flicker =
                0.82 +
                0.18 *
                  Math.sin(now / 140 + prop.x * 2.3 + prop.y * 1.7 + i * 0.6);
              const t = (1 - dist / radius) * 0.35 * flicker;
              boost += t;
              warm += t;
            }

            const explosion = doomExplosionRef.current;
            if (explosion) {
              const dx = x - explosion.x;
              const dy = y - explosion.y;
              const dist = Math.hypot(dx, dy);
              const radius = 5.2;
              if (dist < radius) {
                const t = (1 - dist / radius) * 0.9;
                boost += t;
                hot += t;
              }
            }

            const bomb = doomBombRef.current;
            if (bomb?.active) {
              const dx = x - bomb.x;
              const dy = y - bomb.y;
              const dist = Math.hypot(dx, dy);
              const radius = 2.2;
              if (dist < radius) {
                const t = (1 - dist / radius) * 0.22;
                boost += t;
                hot += t * 0.6;
                warm += t * 0.3;
              }
            }

            if (perfTier !== "low") {
              const projectiles = doomProjectilesRef.current;
              const maxLights = perfTier === "mid" ? 8 : 12;
              for (let i = 0; i < projectiles.length && i < maxLights; i += 1) {
                const projectile = projectiles[i];
                const dx = x - projectile.x;
                const dy = y - projectile.y;
                const dist = Math.hypot(dx, dy);
                const radius = projectile.kind === "rocket" ? 3.2 : 2.4;
                if (dist > radius) {
                  continue;
                }
                const t =
                  (1 - dist / radius) *
                  (projectile.kind === "rocket" ? 0.22 : 0.18);
                boost += t;
                hot += t;
              }
            }

            if (doomMuzzleRef.current > 0) {
              const intensity = clamp(doomMuzzleRef.current / 16, 0, 1) * 0.16;
              boost += intensity;
              warm += intensity;
            }

            boost = clamp(boost, 0, 0.9);
            warm = clamp(warm, 0, 0.7);
            hot = clamp(hot, 0, 0.8);
            return { boost, warm, hot };
          };
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
            let side = 0;
            let doorHit: {
              rawDist: number;
              side: number;
              open: number;
              x: number;
              y: number;
            } | null = null;
            let wallHit: {
              rawDist: number;
              side: number;
              type: number;
              x: number;
              y: number;
            } | null = null;
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
              const cell = map[mapY]?.[mapX] ?? 0;
              const rawDist =
                side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
              if (cell === 2 && !doorHit) {
                doorHit = {
                  rawDist,
                  side,
                  open: doomDoorStatesRef.current[`${mapX},${mapY}`]?.open ?? 0,
                  x: mapX,
                  y: mapY,
                };
                continue;
              }
              if (cell >= 1) {
                wallHit = { rawDist, side, type: cell, x: mapX, y: mapY };
                break;
              }
            }

            const wall =
              wallHit ??
              (doorHit
                ? {
                    rawDist: doorHit.rawDist,
                    side: doorHit.side,
                    type: 2,
                    x: doorHit.x,
                    y: doorHit.y,
                  }
                : null);
            if (!wall) {
              continue;
            }
            const correction = Math.cos(rayAngle - player.angle);
            const correctedWall = Math.max(0.0001, wall.rawDist * correction);
            wallDistances[i] = correctedWall;

            const wallHeight = Math.min(
              viewH,
              Math.floor(viewH / correctedWall),
            );
            const wallTop = Math.floor(
              viewY + (viewH - wallHeight) / 2 + cameraBob,
            );
            const wallX = Math.floor(viewX + i * colWidth);
            const wallW = Math.ceil(colWidth) + 1;
            const wallCoord =
              wall.side === 0
                ? player.y + wall.rawDist * dirY
                : player.x + wall.rawDist * dirX;
            const wallFrac = wallCoord - Math.floor(wallCoord);
            let texX = clamp(Math.floor(wallFrac * texSize), 0, texSize - 1);
            if (wall.side === 0 && dirX > 0) {
              texX = texSize - texX - 1;
            }
            if (wall.side === 1 && dirY < 0) {
              texX = texSize - texX - 1;
            }
            const wallTex =
              wall.type === 2
                ? (textures?.door ?? null)
                : pickWallTexture(wall.x, wall.y);
            if (wallTex) {
              ctx.drawImage(
                wallTex,
                texX,
                0,
                1,
                texSize,
                wallX,
                wallTop,
                wallW,
                wallHeight,
              );
            } else {
              ctx.fillStyle = "#6b4a2a";
              ctx.fillRect(wallX, wallTop, wallW, wallHeight);
            }
            const hitX = player.x + dirX * wall.rawDist;
            const hitY = player.y + dirY * wall.rawDist;
            const lighting = sampleDoomLight(hitX, hitY);
            const distShadeRaw = clamp(1 - correctedWall / 12, 0.1, 1);
            const sideShade = wall.side === 1 ? 0.72 : 1;
            const baseLight = distShadeRaw * sideShade;
            const light = clamp(baseLight + lighting.boost * 0.55, 0, 1);
            const quant = Math.floor(light * 8) / 8;
            const dark = clamp(1 - quant, 0, 1);
            if (dark > 0.001) {
              ctx.fillStyle = `rgba(0,0,0,${0.7 * dark})`;
              ctx.fillRect(wallX, wallTop, wallW, wallHeight);
            }
            const warmAlpha = clamp(lighting.warm * 0.18, 0, 0.18);
            if (warmAlpha > 0.001) {
              ctx.fillStyle = `rgba(246,194,122,${warmAlpha})`;
              ctx.fillRect(wallX, wallTop, wallW, wallHeight);
            }
            const hotAlpha = clamp(lighting.hot * 0.16, 0, 0.16);
            if (hotAlpha > 0.001) {
              ctx.fillStyle = `rgba(214,115,91,${hotAlpha})`;
              ctx.fillRect(wallX, wallTop, wallW, wallHeight);
            }

            if (doorHit) {
              const correctedDoor = Math.max(
                0.0001,
                doorHit.rawDist * correction,
              );
              doorDistances[i] = correctedDoor;

              const doorHeight = Math.min(
                viewH,
                Math.floor(viewH / correctedDoor),
              );
              const doorTop = Math.floor(
                viewY + (viewH - doorHeight) / 2 + cameraBob,
              );
              const open = clamp(doorHit.open, 0, 1);
              const visibleHeight = Math.max(
                0,
                Math.floor(doorHeight * (1 - open)),
              );
              if (visibleHeight > 0) {
                doorBandBottoms[i] = doorTop + visibleHeight;
                const doorCoord =
                  doorHit.side === 0
                    ? player.y + doorHit.rawDist * dirY
                    : player.x + doorHit.rawDist * dirX;
                const doorFrac = doorCoord - Math.floor(doorCoord);
                let doorTexX = clamp(
                  Math.floor(doorFrac * texSize),
                  0,
                  texSize - 1,
                );
                if (doorHit.side === 0 && dirX > 0) {
                  doorTexX = texSize - doorTexX - 1;
                }
                if (doorHit.side === 1 && dirY < 0) {
                  doorTexX = texSize - doorTexX - 1;
                }
                const doorTex = textures?.door ?? null;
                if (doorTex) {
                  ctx.drawImage(
                    doorTex,
                    doorTexX,
                    0,
                    1,
                    texSize,
                    wallX,
                    doorTop,
                    wallW,
                    visibleHeight,
                  );
                } else {
                  ctx.fillStyle = "#8f7b6a";
                  ctx.fillRect(wallX, doorTop, wallW, visibleHeight);
                }
                const doorX = player.x + dirX * doorHit.rawDist;
                const doorY = player.y + dirY * doorHit.rawDist;
                const doorLighting = sampleDoomLight(doorX, doorY);
                const distShadeDoor = clamp(1 - correctedDoor / 11, 0.1, 1);
                const sideShadeDoor = doorHit.side === 1 ? 0.72 : 1;
                const baseDoorLight = distShadeDoor * sideShadeDoor;
                const lightDoor = clamp(
                  baseDoorLight + doorLighting.boost * 0.55,
                  0,
                  1,
                );
                const quantDoor = Math.floor(lightDoor * 8) / 8;
                const darkDoor = clamp(1 - quantDoor, 0, 1);
                if (darkDoor > 0.001) {
                  ctx.fillStyle = `rgba(0,0,0,${0.62 * darkDoor})`;
                  ctx.fillRect(wallX, doorTop, wallW, visibleHeight);
                }
                const warmAlphaDoor = clamp(doorLighting.warm * 0.16, 0, 0.16);
                if (warmAlphaDoor > 0.001) {
                  ctx.fillStyle = `rgba(246,194,122,${warmAlphaDoor})`;
                  ctx.fillRect(wallX, doorTop, wallW, visibleHeight);
                }
                const hotAlphaDoor = clamp(doorLighting.hot * 0.14, 0, 0.14);
                if (hotAlphaDoor > 0.001) {
                  ctx.fillStyle = `rgba(214,115,91,${hotAlphaDoor})`;
                  ctx.fillRect(wallX, doorTop, wallW, visibleHeight);
                }
              } else {
                doorBandBottoms[i] = 0;
              }
            } else {
              doorBandBottoms[i] = 0;
            }
          }

          const drawDoomSprite = (
            kind:
              | "pillar"
              | "crate"
              | "torch"
              | "barrel"
              | "ammo"
              | "shells"
              | "rockets"
              | "med"
              | "shield"
              | "bomb"
              | "chest"
              | "shotgun"
              | "chainsaw"
              | "chaingun"
              | "launcher",
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
            if (kind === "barrel") {
              ctx.fillStyle = "#d6735b";
              ctx.fillRect(left + w * 0.22, top + h * 0.22, w * 0.56, h * 0.66);
              ctx.fillStyle = "rgba(0,0,0,0.28)";
              ctx.fillRect(left + w * 0.22, top + h * 0.22, w * 0.14, h * 0.66);
              ctx.fillStyle = "#f4d35e";
              ctx.fillRect(left + w * 0.22, top + h * 0.32, w * 0.56, h * 0.06);
              ctx.fillRect(left + w * 0.22, top + h * 0.68, w * 0.56, h * 0.06);
              ctx.fillStyle = "rgba(255,255,255,0.12)";
              ctx.fillRect(left + w * 0.62, top + h * 0.28, w * 0.08, h * 0.5);
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
            if (kind === "shotgun") {
              ctx.fillStyle = "#8f7b6a";
              ctx.fillRect(left + w * 0.18, top + h * 0.58, w * 0.64, h * 0.14);
              ctx.fillStyle = "#d6735b";
              ctx.fillRect(left + w * 0.22, top + h * 0.42, w * 0.5, h * 0.18);
              ctx.fillStyle = "#b8894f";
              ctx.fillRect(left + w * 0.26, top + h * 0.62, w * 0.22, h * 0.22);
              ctx.fillStyle = "#1b1512";
              ctx.fillRect(left + w * 0.66, top + h * 0.52, w * 0.06, h * 0.06);
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
            if (kind === "shells") {
              ctx.fillStyle = "#d6735b";
              ctx.fillRect(left, top + h * 0.34, w, h * 0.42);
              ctx.fillStyle = "rgba(0,0,0,0.25)";
              ctx.fillRect(left, top + h * 0.34, w, h * 0.06);
              ctx.fillStyle = "#f4d35e";
              for (let i = 0; i < 4; i += 1) {
                const cx = left + w * (0.18 + i * 0.2);
                ctx.fillRect(cx, top + h * 0.42, w * 0.08, h * 0.26);
                ctx.fillStyle = "#1b1512";
                ctx.fillRect(cx, top + h * 0.4, w * 0.08, h * 0.04);
                ctx.fillStyle = "#f4d35e";
              }
              return;
            }
            if (kind === "rockets") {
              ctx.fillStyle = "#8f7b6a";
              ctx.fillRect(left + w * 0.18, top + h * 0.38, w * 0.64, h * 0.34);
              ctx.fillStyle = "#1b1512";
              ctx.fillRect(left + w * 0.18, top + h * 0.52, w * 0.64, h * 0.06);
              ctx.fillStyle = "#f4d35e";
              ctx.beginPath();
              ctx.moveTo(left + w * 0.5, top + h * 0.18);
              ctx.lineTo(left + w * 0.62, top + h * 0.38);
              ctx.lineTo(left + w * 0.38, top + h * 0.38);
              ctx.closePath();
              ctx.fill();
              ctx.fillStyle = "#d6735b";
              ctx.fillRect(left + w * 0.36, top + h * 0.72, w * 0.28, h * 0.1);
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
              return;
            }
            if (kind === "chainsaw") {
              ctx.fillStyle = "#8f7b6a";
              ctx.fillRect(left + w * 0.18, top + h * 0.42, w * 0.64, h * 0.32);
              ctx.fillStyle = "#d6735b";
              ctx.fillRect(left + w * 0.28, top + h * 0.52, w * 0.18, h * 0.26);
              ctx.fillStyle = "#1b1512";
              ctx.fillRect(left + w * 0.46, top + h * 0.44, w * 0.28, h * 0.08);
              ctx.fillRect(left + w * 0.78, top + h * 0.42, w * 0.12, h * 0.32);
              ctx.fillStyle = "#f4d35e";
              for (let i = 0; i < 6; i += 1) {
                ctx.fillRect(left + w * (0.8 + i * 0.03), top + h * 0.42, 2, 3);
              }
              return;
            }
            if (kind === "chaingun") {
              ctx.fillStyle = "#8f7b6a";
              ctx.fillRect(left + w * 0.18, top + h * 0.48, w * 0.64, h * 0.22);
              ctx.fillStyle = "#1b1512";
              ctx.fillRect(left + w * 0.22, top + h * 0.42, w * 0.56, h * 0.08);
              ctx.fillStyle = "#f4d35e";
              ctx.fillRect(left + w * 0.34, top + h * 0.72, w * 0.14, h * 0.14);
              ctx.fillRect(left + w * 0.52, top + h * 0.72, w * 0.14, h * 0.14);
              return;
            }
            if (kind === "launcher") {
              ctx.fillStyle = "#6fd68d";
              ctx.fillRect(left + w * 0.16, top + h * 0.46, w * 0.68, h * 0.24);
              ctx.fillStyle = "#1b1512";
              ctx.fillRect(left + w * 0.6, top + h * 0.42, w * 0.24, h * 0.08);
              ctx.fillStyle = "#d6735b";
              ctx.fillRect(left + w * 0.28, top + h * 0.7, w * 0.18, h * 0.14);
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
            const baseH = Math.min(viewH, Math.floor(viewH / dist));
            const scale =
              sprite.kind === "pillar"
                ? 1.05
                : sprite.kind === "crate"
                  ? 0.7
                  : sprite.kind === "barrel"
                    ? 0.75
                    : sprite.kind === "torch"
                      ? 0.8
                      : sprite.kind === "ammo"
                        ? 0.32
                        : sprite.kind === "shells"
                          ? 0.34
                          : sprite.kind === "rockets"
                            ? 0.38
                            : sprite.kind === "med"
                              ? 0.36
                              : sprite.kind === "shield"
                                ? 0.42
                                : sprite.kind === "chainsaw"
                                  ? 0.44
                                  : sprite.kind === "chaingun"
                                    ? 0.44
                                    : sprite.kind === "launcher"
                                      ? 0.44
                                      : sprite.kind === "shotgun"
                                        ? 0.4
                                        : sprite.kind === "bomb"
                                          ? 0.34
                                          : 0.48;
            const spriteH = Math.max(10, Math.floor(baseH * scale));
            const aspect =
              sprite.kind === "pillar"
                ? 0.35
                : sprite.kind === "torch"
                  ? 0.28
                  : sprite.kind === "crate"
                    ? 0.6
                    : sprite.kind === "barrel"
                      ? 0.5
                      : sprite.kind === "shotgun"
                        ? 0.8
                        : sprite.kind === "chainsaw"
                          ? 0.9
                          : sprite.kind === "chaingun"
                            ? 0.85
                            : sprite.kind === "launcher"
                              ? 0.9
                              : sprite.kind === "rockets"
                                ? 0.7
                                : sprite.kind === "shells"
                                  ? 0.7
                                  : 0.65;
            const spriteW = Math.max(10, Math.floor(spriteH * aspect));
            const floorY = Math.floor(viewY + (viewH + baseH) / 2 + cameraBob);
            const top = floorY - spriteH;
            const spriteLeft = Math.floor(screenX - spriteW / 2);
            const applySpriteLighting = () => {
              const lighting = sampleDoomLight(sprite.x, sprite.y);
              const warmAlpha = clamp(lighting.warm * 0.22, 0, 0.22);
              if (warmAlpha > 0.001) {
                ctx.fillStyle = `rgba(246,194,122,${warmAlpha})`;
                ctx.fillRect(spriteLeft, top, spriteW, spriteH);
              }
              const hotAlpha = clamp(lighting.hot * 0.16, 0, 0.16);
              if (hotAlpha > 0.001) {
                ctx.fillStyle = `rgba(214,115,91,${hotAlpha})`;
                ctx.fillRect(spriteLeft, top, spriteW, spriteH);
              }
            };

            const doorDist = doorDistances[column] ?? 0;
            const doorClipY = doorBandBottoms[column] ?? 0;
            const behindDoor =
              doorDist > 0 && dist > doorDist + 0.02 && doorClipY > 0;
            if (behindDoor) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(
                viewX,
                doorClipY,
                viewW,
                Math.max(0, viewY + viewH - doorClipY),
              );
              ctx.clip();
              drawDoomSprite(sprite.kind, screenX, top, spriteW, spriteH);
              applySpriteLighting();
              ctx.restore();
              return;
            }
            drawDoomSprite(sprite.kind, screenX, top, spriteW, spriteH);
            applySpriteLighting();
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
            const baseH = Math.min(viewH, Math.floor(viewH / dist));
            const enemyScale =
              enemy.type === "brute"
                ? 1.28
                : enemy.type === "charger"
                  ? 1.14
                  : enemy.type === "spitter"
                    ? 1.05
                    : 0.96;
            const spriteH = Math.max(22, Math.floor(baseH * 0.92 * enemyScale));
            const spriteW = Math.max(
              18,
              Math.floor(spriteH * (enemy.type === "brute" ? 0.62 : 0.55)),
            );
            const floorY = Math.floor(viewY + (viewH + baseH) / 2 + cameraBob);
            const top = floorY - spriteH;

            const drawEnemy = () => {
              const localLight = sampleDoomLight(enemy.x, enemy.y);
              const shade = clamp(
                1 - dist / 8 + localLight.boost * 0.35,
                0.18,
                1,
              );
              const base = Math.floor(170 * shade);
              const clampC = (value: number) =>
                clamp(Math.round(value), 0, 255);
              const bodyW = Math.floor(spriteW * 0.78);
              const headW = Math.floor(spriteW * 0.52);
              const left = Math.floor(screenX - spriteW / 2);
              let body = `rgb(${clampC(base + 40)}, ${clampC(base)}, ${clampC(
                base - 20,
              )})`;
              let head = `rgb(${clampC(base + 60)}, ${clampC(base + 10)}, ${clampC(
                base,
              )})`;
              let limb = `rgb(${clampC(base + 20)}, ${clampC(base - 5)}, ${clampC(
                base - 30,
              )})`;
              let eye = "#1b1512";
              if (enemy.type === "spitter") {
                body = `rgb(${clampC(base - 25)}, ${clampC(base + 65)}, ${clampC(
                  base - 10,
                )})`;
                head = `rgb(${clampC(base - 10)}, ${clampC(base + 85)}, ${clampC(
                  base + 20,
                )})`;
                limb = `rgb(${clampC(base - 40)}, ${clampC(base + 35)}, ${clampC(
                  base - 30,
                )})`;
                eye = "#f4d35e";
              } else if (enemy.type === "charger") {
                body = `rgb(${clampC(base + 85)}, ${clampC(base + 25)}, ${clampC(
                  base - 10,
                )})`;
                head = `rgb(${clampC(base + 110)}, ${clampC(base + 35)}, ${clampC(
                  base + 5,
                )})`;
                limb = `rgb(${clampC(base + 55)}, ${clampC(base + 10)}, ${clampC(
                  base - 25,
                )})`;
                eye = "#1b1512";
              } else if (enemy.type === "brute") {
                body = `rgb(${clampC(base + 25)}, ${clampC(base - 15)}, ${clampC(
                  base + 70,
                )})`;
                head = `rgb(${clampC(base + 45)}, ${clampC(base)}, ${clampC(
                  base + 95,
                )})`;
                limb = `rgb(${clampC(base + 10)}, ${clampC(base - 25)}, ${clampC(
                  base + 45,
                )})`;
                eye = "#f4d35e";
              }

              ctx.fillStyle = body;
              ctx.fillRect(
                left + Math.floor((spriteW - bodyW) / 2),
                top + Math.floor(spriteH * 0.26),
                bodyW,
                Math.floor(spriteH * 0.6),
              );
              ctx.fillStyle = head;
              ctx.fillRect(
                left + Math.floor((spriteW - headW) / 2),
                top + Math.floor(spriteH * 0.1),
                headW,
                Math.floor(spriteH * 0.18),
              );
              ctx.fillStyle = eye;
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
              ctx.fillStyle = limb;
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
              if (enemy.type === "charger") {
                ctx.fillStyle = "#f4d35e";
                ctx.beginPath();
                ctx.moveTo(
                  left + Math.floor(spriteW * 0.22),
                  top + Math.floor(spriteH * 0.1),
                );
                ctx.lineTo(
                  left + Math.floor(spriteW * 0.34),
                  top + Math.floor(spriteH * 0.04),
                );
                ctx.lineTo(
                  left + Math.floor(spriteW * 0.4),
                  top + Math.floor(spriteH * 0.12),
                );
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(
                  left + Math.floor(spriteW * 0.78),
                  top + Math.floor(spriteH * 0.1),
                );
                ctx.lineTo(
                  left + Math.floor(spriteW * 0.66),
                  top + Math.floor(spriteH * 0.04),
                );
                ctx.lineTo(
                  left + Math.floor(spriteW * 0.6),
                  top + Math.floor(spriteH * 0.12),
                );
                ctx.closePath();
                ctx.fill();
              } else if (enemy.type === "spitter") {
                ctx.fillStyle = "rgba(0,0,0,0.18)";
                ctx.fillRect(
                  left + Math.floor(spriteW * 0.42),
                  top + Math.floor(spriteH * 0.26),
                  Math.floor(spriteW * 0.16),
                  Math.floor(spriteH * 0.12),
                );
              } else if (enemy.type === "brute") {
                ctx.fillStyle = "rgba(0,0,0,0.24)";
                ctx.fillRect(
                  left + Math.floor(spriteW * 0.2),
                  top + Math.floor(spriteH * 0.22),
                  Math.floor(spriteW * 0.6),
                  Math.floor(spriteH * 0.08),
                );
              }
            };

            const doorDist = doorDistances[column] ?? 0;
            const doorClipY = doorBandBottoms[column] ?? 0;
            const behindDoor =
              doorDist > 0 && dist > doorDist + 0.02 && doorClipY > 0;
            if (behindDoor) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(
                viewX,
                doorClipY,
                viewW,
                Math.max(0, viewY + viewH - doorClipY),
              );
              ctx.clip();
              drawEnemy();
              ctx.restore();
              return;
            }
            drawEnemy();
          });

          const projectiles = doomProjectilesRef.current
            .slice()
            .sort((a, b) => {
              const da = Math.hypot(a.x - player.x, a.y - player.y);
              const db = Math.hypot(b.x - player.x, b.y - player.y);
              return db - da;
            });
          const maxProjectiles =
            perfTier === "low" ? 8 : perfTier === "mid" ? 12 : 18;
          projectiles.slice(0, maxProjectiles).forEach((projectile) => {
            const dx = projectile.x - player.x;
            const dy = projectile.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 0.2 || dist > 12) {
              return;
            }
            const angle = Math.atan2(dy, dx);
            const delta = Math.atan2(
              Math.sin(angle - player.angle),
              Math.cos(angle - player.angle),
            );
            if (Math.abs(delta) > fov * 0.65) {
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
            const baseH = Math.min(viewH, Math.floor(viewH / dist));
            const isRocket = projectile.kind === "rocket";
            const size = Math.max(
              isRocket ? 10 : 8,
              Math.floor(baseH * (isRocket ? 0.22 : 0.16)),
            );
            const top = Math.floor(
              viewY + viewH * 0.48 - size / 2 + cameraBob * 0.2,
            );

            const drawProjectile = () => {
              if (isRocket) {
                const bodyW = Math.max(6, Math.floor(size * 0.46));
                const bodyH = Math.max(10, Math.floor(size * 0.82));
                const left = Math.floor(screenX - bodyW / 2);
                const bodyY = top + Math.floor(size * 0.14);
                ctx.fillStyle = "rgba(143,123,106,0.9)";
                ctx.fillRect(left, bodyY, bodyW, bodyH);
                ctx.fillStyle = "rgba(0,0,0,0.22)";
                ctx.fillRect(left, bodyY + Math.floor(bodyH * 0.56), bodyW, 2);
                ctx.fillStyle = "#f4d35e";
                ctx.beginPath();
                ctx.moveTo(screenX, top);
                ctx.lineTo(left + bodyW, bodyY);
                ctx.lineTo(left, bodyY);
                ctx.closePath();
                ctx.fill();
                const flame = clamp(doomFlashRef.current / 10, 0.2, 1);
                ctx.fillStyle = `rgba(214,115,91,${0.5 * flame})`;
                ctx.beginPath();
                ctx.arc(
                  screenX,
                  bodyY + bodyH + Math.floor(size * 0.08),
                  Math.floor(size * 0.22),
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
                ctx.fillStyle = `rgba(246,194,122,${0.55 * flame})`;
                ctx.beginPath();
                ctx.arc(
                  screenX,
                  bodyY + bodyH + Math.floor(size * 0.08),
                  Math.floor(size * 0.14),
                  0,
                  Math.PI * 2,
                );
                ctx.fill();
                return;
              }
              ctx.fillStyle = "rgba(214,115,91,0.78)";
              ctx.beginPath();
              ctx.arc(screenX, top + size * 0.52, size * 0.48, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "rgba(246,194,122,0.72)";
              ctx.beginPath();
              ctx.arc(screenX, top + size * 0.5, size * 0.28, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = "rgba(255,255,255,0.28)";
              ctx.fillRect(
                screenX - size * 0.12,
                top + size * 0.38,
                size * 0.24,
                size * 0.24,
              );
            };

            const doorDist = doorDistances[column] ?? 0;
            const doorClipY = doorBandBottoms[column] ?? 0;
            const behindDoor =
              doorDist > 0 && dist > doorDist + 0.02 && doorClipY > 0;
            if (behindDoor) {
              ctx.save();
              ctx.beginPath();
              ctx.rect(
                viewX,
                doorClipY,
                viewW,
                Math.max(0, viewY + viewH - doorClipY),
              );
              ctx.clip();
              drawProjectile();
              ctx.restore();
              return;
            }
            drawProjectile();
          });

          const bomb = doomBombRef.current;
          if (bomb?.active) {
            const dx = bomb.x - player.x;
            const dy = bomb.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.2 && dist < 10) {
              const angle = Math.atan2(dy, dx);
              const delta = Math.atan2(
                Math.sin(angle - player.angle),
                Math.cos(angle - player.angle),
              );
              if (Math.abs(delta) <= fov * 0.7) {
                const screenX =
                  viewX + (0.5 + delta / fov) * Math.max(1, viewW);
                const spriteH = Math.min(viewH, Math.floor(viewH / dist));
                const size = Math.max(6, Math.floor(spriteH * 0.15));
                const top = Math.floor(viewY + (viewH - size) / 2);
                ctx.fillStyle = "#f4d35e";
                ctx.beginPath();
                ctx.arc(screenX, top + size * 0.6, size * 0.4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "rgba(214,115,91,0.65)";
                ctx.fillRect(
                  screenX - size * 0.5,
                  top + size * 0.55,
                  size,
                  size * 0.25,
                );
              }
            }
          }
          const explosion = doomExplosionRef.current;
          if (explosion) {
            const dx = explosion.x - player.x;
            const dy = explosion.y - player.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.2 && dist < 10) {
              const angle = Math.atan2(dy, dx);
              const delta = Math.atan2(
                Math.sin(angle - player.angle),
                Math.cos(angle - player.angle),
              );
              if (Math.abs(delta) <= fov * 0.7) {
                const screenX =
                  viewX + (0.5 + delta / fov) * Math.max(1, viewW);
                const spriteH = Math.min(viewH, Math.floor(viewH / dist));
                const size = Math.max(16, Math.floor(spriteH * 0.35));
                const top = Math.floor(viewY + (viewH - size) / 2);
                ctx.fillStyle = "rgba(246,194,122,0.6)";
                ctx.beginPath();
                ctx.arc(screenX, top + size * 0.5, size * 0.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "rgba(214,115,91,0.35)";
                ctx.beginPath();
                ctx.arc(screenX, top + size * 0.5, size * 0.3, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
        if (doomFlashRef.current > 0) {
          ctx.fillStyle = `rgba(246, 194, 122, ${0.12 * doomFlashRef.current})`;
          ctx.fillRect(viewX, viewY, viewW, viewH);
        }
        const healthNow = doomHealthRef.current;
        const injuryNow = clamp(1 - healthNow / 100, 0, 1);
        const hurtNow = clamp(doomHurtRef.current / 14, 0, 1);
        const injuryAlpha = clamp(injuryNow * 0.22 + hurtNow * 0.3, 0, 0.48);
        if (injuryAlpha > 0.001) {
          const cx = viewX + viewW / 2;
          const cy = viewY + viewH / 2;
          const radius = Math.max(viewW, viewH) * 0.58;
          const gradient = ctx.createRadialGradient(
            cx,
            cy,
            radius * 0.18,
            cx,
            cy,
            radius,
          );
          gradient.addColorStop(0, "rgba(214,115,91,0)");
          gradient.addColorStop(1, `rgba(214,115,91,${injuryAlpha})`);
          ctx.fillStyle = gradient;
          ctx.fillRect(viewX, viewY, viewW, viewH);
        }
        const hudHeight = Math.max(68, Math.floor(viewH * 0.18));
        const hudY = Math.floor(viewY + viewH - hudHeight);

        const recoil = clamp(doomMuzzleRef.current / 10, 0, 1);
        const bobX = Math.sin(doomBobRef.current) * 6;
        const bobY = Math.abs(Math.cos(doomBobRef.current)) * 5;
        const weaponMaxH = Math.max(72, Math.floor((hudY - viewY) * 0.62));
        const weaponW = clamp(Math.floor(viewW * 0.46), 170, 320);
        const weaponH = clamp(Math.floor(viewH * 0.22), 78, weaponMaxH);
        const weaponX = Math.floor(viewX + (viewW - weaponW) / 2 + bobX);
        const weaponY = Math.floor(hudY - weaponH - 6 + bobY - recoil * 10);
        const weapon = doomWeaponRef.current;
        const attack = clamp(doomMuzzleRef.current / 14, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.98;

        const drawHand = (x: number, y: number, w: number, h: number) => {
          ctx.fillStyle = "#caa57a";
          ctx.fillRect(x, y, w, h);
          ctx.fillStyle = "#b8894f";
          ctx.fillRect(x, y, w, Math.max(2, Math.floor(h * 0.18)));
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(x, y + Math.floor(h * 0.75), w, Math.floor(h * 0.25));
        };

        const drawFist = (x: number, y: number, w: number, h: number) => {
          ctx.fillStyle = "#caa57a";
          ctx.fillRect(x, y + Math.floor(h * 0.18), w, Math.floor(h * 0.82));
          ctx.fillRect(
            x + Math.floor(w * 0.08),
            y,
            Math.floor(w * 0.84),
            Math.floor(h * 0.32),
          );
          ctx.fillStyle = "#b8894f";
          ctx.fillRect(x, y + Math.floor(h * 0.18), w, Math.floor(h * 0.12));
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          for (let i = 0; i < 4; i += 1) {
            const fx = x + Math.floor(w * (0.18 + i * 0.2));
            ctx.fillRect(fx, y + Math.floor(h * 0.34), 2, Math.floor(h * 0.36));
          }
        };

        const drawMuzzleFlash = (mx: number, my: number, base: number) => {
          if (doomMuzzleRef.current <= 0) {
            return;
          }
          const glow = clamp(doomMuzzleRef.current / 12, 0, 1);
          ctx.fillStyle = `rgba(246, 194, 122, ${0.65 * glow})`;
          ctx.beginPath();
          ctx.arc(mx, my, base * (0.75 + glow * 0.35), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255,255,255,${0.55 * glow})`;
          ctx.fillRect(
            mx - base * 0.35,
            my - base * 0.35,
            base * 0.7,
            base * 0.7,
          );
        };

        if (weapon === "fist") {
          const fistW = Math.floor(weaponW * 0.28);
          const fistH = Math.floor(weaponH * 0.48);
          const baseY = weaponY + Math.floor(weaponH * 0.52);
          const leftX = weaponX + Math.floor(weaponW * 0.18);
          const rightBaseX = weaponX + Math.floor(weaponW * 0.54);
          const rightX = rightBaseX + Math.floor(attack * weaponW * 0.06);
          const rightY = baseY - Math.floor(attack * weaponH * 0.14);
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(
            weaponX + Math.floor(weaponW * 0.16),
            weaponY + Math.floor(weaponH * 0.84),
            Math.floor(weaponW * 0.68),
            Math.floor(weaponH * 0.16),
          );
          drawFist(leftX, baseY, fistW, fistH);
          drawFist(rightX, rightY, fistW, fistH);
          ctx.restore();
        } else if (weapon === "chainsaw") {
          const handW = Math.floor(weaponW * 0.2);
          const handH = Math.floor(weaponH * 0.4);
          const handY = weaponY + weaponH - handH;
          const leftHandX = weaponX + Math.floor(weaponW * 0.14);
          const rightHandX = weaponX + Math.floor(weaponW * 0.62);
          const sawJitter =
            attack > 0 ? Math.sin(doomBobRef.current * 6) * 2 : 0;
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(
            weaponX + Math.floor(weaponW * 0.12),
            weaponY + Math.floor(weaponH * 0.84),
            Math.floor(weaponW * 0.76),
            Math.floor(weaponH * 0.16),
          );
          drawHand(leftHandX, handY, handW, handH);
          drawHand(rightHandX, handY, handW, handH);

          const bodyX = weaponX + Math.floor(weaponW * 0.32);
          const bodyY = weaponY + Math.floor(weaponH * 0.54);
          const bodyW = Math.floor(weaponW * 0.42);
          const bodyH = Math.floor(weaponH * 0.22);
          ctx.fillStyle = "#d6735b";
          ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
          ctx.fillStyle = "#1b1512";
          ctx.fillRect(
            bodyX + Math.floor(bodyW * 0.12),
            bodyY + Math.floor(bodyH * 0.16),
            Math.floor(bodyW * 0.26),
            Math.floor(bodyH * 0.22),
          );
          ctx.fillStyle = "#8f7b6a";
          const bladeX = bodyX + bodyW;
          const bladeY =
            bodyY - Math.floor(bodyH * 0.1) + Math.floor(sawJitter);
          const bladeW = Math.floor(weaponW * 0.28);
          const bladeH = Math.floor(bodyH * 1.2);
          ctx.fillRect(bladeX, bladeY, bladeW, bladeH);
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(bladeX, bladeY + Math.floor(bladeH * 0.46), bladeW, 2);
          ctx.fillStyle = "#f4d35e";
          for (let t = 0; t < 10; t += 1) {
            const tx = bladeX + Math.floor((t / 10) * bladeW);
            const ty = bladeY + (t % 2 === 0 ? 0 : bladeH - 3);
            ctx.fillRect(tx, ty, 2, 3);
          }
          if (attack > 0.35) {
            const sparkX = bladeX + bladeW + 2;
            const sparkY = bladeY + Math.floor(bladeH * 0.5);
            ctx.strokeStyle = `rgba(246,194,122,${0.65 * attack})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sparkX, sparkY);
            ctx.lineTo(sparkX + 10, sparkY - 6);
            ctx.moveTo(sparkX, sparkY);
            ctx.lineTo(sparkX + 10, sparkY + 6);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          ctx.fillStyle = "rgba(0,0,0,0.18)";
          ctx.fillRect(
            weaponX + Math.floor(weaponW * 0.1),
            weaponY + Math.floor(weaponH * 0.84),
            Math.floor(weaponW * 0.8),
            Math.floor(weaponH * 0.16),
          );
          const handW = Math.floor(weaponW * 0.22);
          const handH = Math.floor(weaponH * 0.42);
          const handY = weaponY + weaponH - handH;
          drawHand(weaponX + Math.floor(weaponW * 0.14), handY, handW, handH);
          drawHand(weaponX + Math.floor(weaponW * 0.64), handY, handW, handH);

          const bodyX = weaponX + Math.floor(weaponW * 0.32);
          const bodyY = weaponY + Math.floor(weaponH * 0.5);
          const bodyW = Math.floor(weaponW * 0.36);
          const bodyH = Math.floor(weaponH * 0.22);
          const barrelW = Math.floor(weaponW * 0.28);
          const barrelH =
            weapon === "shotgun"
              ? Math.floor(weaponH * 0.1)
              : weapon === "chaingun"
                ? Math.floor(weaponH * 0.12)
                : weapon === "launcher"
                  ? Math.floor(weaponH * 0.14)
                  : Math.floor(weaponH * 0.08);
          const barrelX = weaponX + Math.floor(weaponW * 0.5);
          const barrelY =
            weaponY +
            (weapon === "shotgun"
              ? Math.floor(weaponH * 0.4)
              : weapon === "launcher"
                ? Math.floor(weaponH * 0.36)
                : Math.floor(weaponH * 0.42));

          ctx.fillStyle =
            weapon === "launcher"
              ? "#6fd68d"
              : weapon === "shotgun"
                ? "#b8894f"
                : "#8f7b6a";
          ctx.fillRect(bodyX, bodyY, bodyW, bodyH);
          ctx.fillStyle = "#1b1512";
          ctx.fillRect(barrelX, barrelY, barrelW, barrelH);
          ctx.fillStyle = "rgba(255,255,255,0.12)";
          ctx.fillRect(
            bodyX + Math.floor(bodyW * 0.12),
            bodyY + Math.floor(bodyH * 0.18),
            Math.floor(bodyW * 0.76),
            Math.max(2, Math.floor(bodyH * 0.08)),
          );
          if (weapon === "chaingun") {
            ctx.fillStyle = "#d6735b";
            ctx.fillRect(
              weaponX + Math.floor(weaponW * 0.42),
              weaponY + Math.floor(weaponH * 0.66),
              Math.floor(weaponW * 0.08),
              Math.floor(weaponH * 0.14),
            );
            ctx.fillRect(
              weaponX + Math.floor(weaponW * 0.52),
              weaponY + Math.floor(weaponH * 0.66),
              Math.floor(weaponW * 0.08),
              Math.floor(weaponH * 0.14),
            );
          } else if (weapon === "shotgun") {
            ctx.fillStyle = "#d6735b";
            ctx.fillRect(
              weaponX + Math.floor(weaponW * 0.44),
              weaponY + Math.floor(weaponH * 0.62),
              Math.floor(weaponW * 0.18),
              Math.floor(weaponH * 0.16),
            );
          } else if (weapon === "pistol") {
            ctx.fillStyle = "#d6735b";
            ctx.fillRect(
              weaponX + Math.floor(weaponW * 0.46),
              weaponY + Math.floor(weaponH * 0.62),
              Math.floor(weaponW * 0.12),
              Math.floor(weaponH * 0.2),
            );
          } else if (weapon === "launcher") {
            ctx.fillStyle = "#d6735b";
            ctx.fillRect(
              weaponX + Math.floor(weaponW * 0.36),
              weaponY + Math.floor(weaponH * 0.62),
              Math.floor(weaponW * 0.14),
              Math.floor(weaponH * 0.18),
            );
          }

          if (weapon !== "launcher") {
            drawMuzzleFlash(
              barrelX + barrelW,
              barrelY + barrelH / 2,
              Math.floor(weaponW * (weapon === "shotgun" ? 0.06 : 0.05)),
            );
          } else if (doomMuzzleRef.current > 0) {
            const mx = barrelX + barrelW;
            const my = barrelY + barrelH / 2;
            drawMuzzleFlash(mx, my, Math.floor(weaponW * 0.06));
            ctx.fillStyle = `rgba(255,255,255,${0.18 * attack})`;
            ctx.fillRect(mx + 4, my - 2, 10, 4);
          }
          ctx.restore();
        }

        ctx.fillStyle = accent;
        ctx.fillText(messages.ui.retroFps, viewX, viewY - 24);
        if (doomMessageRef.current) {
          ctx.fillStyle = dim;
          ctx.fillText(doomMessageRef.current, viewX + 110, viewY - 24);
        }
        ctx.save();
        ctx.textBaseline = "top";
        ctx.fillStyle = "#2c2c2c";
        ctx.fillRect(viewX, hudY, viewW, hudHeight);
        ctx.fillStyle = "#1b1b1b";
        ctx.fillRect(viewX, hudY, viewW, 4);
        ctx.fillStyle = "#3a3a3a";
        ctx.fillRect(viewX, hudY + 4, viewW, 2);

        const sectionPadding = Math.floor(hudHeight * 0.16);
        const faceSize = Math.floor(hudHeight * 0.72);
        const faceX = Math.floor(viewX + viewW / 2 - faceSize / 2);
        const faceY = Math.floor(hudY + (hudHeight - faceSize) / 2);

        const health = doomHealthRef.current;
        const armor = doomShieldRef.current;
        const ammo = doomAmmoRef.current;
        const shells = doomShellsRef.current;
        const rockets = doomRocketsRef.current;
        const bombs = doomBombsRef.current;
        const score = doomScoreRef.current;

        const hurt = doomHurtRef.current > 0;
        const dead = doomGameOverRef.current || health <= 0;
        const injury = clamp(1 - health / 100, 0, 1);
        const skin = dead
          ? "#a37b58"
          : injury > 0.65
            ? "#b07b4a"
            : injury > 0.35
              ? "#c08f5f"
              : "#caa57a";
        ctx.fillStyle = "#1f1f1f";
        ctx.fillRect(faceX - 6, faceY - 6, faceSize + 12, faceSize + 12);
        ctx.fillStyle = skin;
        ctx.fillRect(faceX, faceY, faceSize, faceSize);
        const eyeSize = Math.max(4, Math.floor(faceSize * 0.12));
        const eyeY = faceY + Math.floor(faceSize * (hurt ? 0.34 : 0.32));
        const eyeOffset = Math.floor(faceSize * 0.22);
        const leftEyeX = faceX + eyeOffset;
        const rightEyeX = faceX + faceSize - eyeOffset - eyeSize;
        ctx.fillStyle = "#1b1512";
        if (dead) {
          for (let i = 0; i < eyeSize; i += 2) {
            ctx.fillRect(leftEyeX + i, eyeY + i, 2, 2);
            ctx.fillRect(leftEyeX + (eyeSize - i - 2), eyeY + i, 2, 2);
            ctx.fillRect(rightEyeX + i, eyeY + i, 2, 2);
            ctx.fillRect(rightEyeX + (eyeSize - i - 2), eyeY + i, 2, 2);
          }
        } else if (hurt) {
          ctx.fillRect(leftEyeX, eyeY + Math.floor(eyeSize * 0.45), eyeSize, 2);
          ctx.fillRect(
            rightEyeX,
            eyeY + Math.floor(eyeSize * 0.45),
            eyeSize,
            2,
          );
        } else {
          ctx.fillRect(leftEyeX, eyeY, eyeSize, eyeSize);
          ctx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);
        }

        const mouthY = faceY + Math.floor(faceSize * 0.68);
        const mouthW = Math.floor(faceSize * 0.46);
        const mouthX = Math.floor(faceX + (faceSize - mouthW) / 2);
        if (dead) {
          ctx.fillRect(mouthX, mouthY, mouthW, Math.max(6, eyeSize));
        } else if (health > 70 && !hurt) {
          ctx.fillRect(mouthX, mouthY, Math.floor(mouthW * 0.4), 4);
          ctx.fillRect(
            mouthX + Math.floor(mouthW * 0.6),
            mouthY,
            Math.floor(mouthW * 0.4),
            4,
          );
        } else if (health > 35 && !hurt) {
          ctx.fillRect(mouthX, mouthY, mouthW, 4);
        } else {
          ctx.fillRect(mouthX, mouthY, mouthW, 6);
          ctx.fillStyle = "#f4d35e";
          ctx.fillRect(mouthX + 6, mouthY + 2, Math.max(6, mouthW - 12), 2);
        }

        if (!dead && injury > 0.25) {
          ctx.fillStyle = `rgba(214,115,91,${clamp(0.12 + injury * 0.45, 0, 0.7)})`;
          ctx.fillRect(
            faceX + Math.floor(faceSize * 0.1),
            faceY + Math.floor(faceSize * 0.58),
            Math.floor(faceSize * 0.22),
            Math.floor(faceSize * 0.12),
          );
          ctx.fillRect(
            faceX + Math.floor(faceSize * 0.62),
            faceY + Math.floor(faceSize * 0.5),
            Math.floor(faceSize * 0.18),
            Math.floor(faceSize * 0.1),
          );
        }
        if (!dead && injury > 0.6) {
          ctx.fillStyle = "rgba(240, 236, 224, 0.85)";
          ctx.fillRect(
            faceX + Math.floor(faceSize * 0.1),
            faceY + Math.floor(faceSize * 0.22),
            Math.floor(faceSize * 0.22),
            Math.max(2, Math.floor(faceSize * 0.08)),
          );
        }

        const labelFont = Math.max(9, Math.floor(hudHeight * 0.18));
        const valueFont = Math.max(16, Math.floor(hudHeight * 0.38));
        const labelY = hudY + Math.floor(hudHeight * 0.14);
        const valueY = hudY + Math.floor(hudHeight * 0.4);
        const statPad = Math.floor(sectionPadding * 0.4);

        const leftAreaW = Math.max(0, faceX - viewX - sectionPadding * 2);
        const rightAreaW = Math.max(
          0,
          viewX + viewW - (faceX + faceSize) - sectionPadding * 2,
        );
        const leftBlockW = Math.max(0, Math.floor(leftAreaW / 3));
        const rightBlockW = Math.max(0, Math.floor(rightAreaW / 3));
        const ammoX = viewX + sectionPadding;
        const shellsX = ammoX + leftBlockW + sectionPadding;
        const healthX = shellsX + leftBlockW + sectionPadding;
        const armorX = faceX + faceSize + sectionPadding;
        const rocketsX = armorX + rightBlockW + sectionPadding;
        const bombsX = rocketsX + rightBlockW + sectionPadding;

        ctx.font = `${labelFont}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillStyle = "#d6735b";
        ctx.fillText(doomText("ammoLabel"), ammoX + statPad, labelY);
        ctx.fillText(doomText("shellsLabel"), shellsX + statPad, labelY);
        ctx.fillText(doomText("hudLabel"), healthX + statPad, labelY);
        ctx.fillText(doomText("shieldLabel"), armorX + statPad, labelY);
        ctx.fillText(doomText("rocketsLabel"), rocketsX + statPad, labelY);
        ctx.fillText(doomText("bombLabel"), bombsX + statPad, labelY);

        ctx.font = `${valueFont}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillStyle = "#f4d35e";
        ctx.fillText(String(ammo).padStart(3, "0"), ammoX + statPad, valueY);
        ctx.fillText(
          String(shells).padStart(2, "0"),
          shellsX + statPad,
          valueY,
        );
        ctx.fillText(
          `${String(Math.max(0, health)).padStart(3, "0")}%`,
          healthX + statPad,
          valueY,
        );
        ctx.fillStyle = "#5bb5d6";
        ctx.fillText(
          `${String(Math.max(0, armor)).padStart(3, "0")}%`,
          armorX + statPad,
          valueY,
        );
        ctx.fillStyle = "#f4d35e";
        ctx.fillText(
          String(rockets).padStart(2, "0"),
          rocketsX + statPad,
          valueY,
        );
        ctx.fillStyle = "#f4d35e";
        ctx.fillText(String(bombs).padStart(2, "0"), bombsX + statPad, valueY);

        ctx.font = `${Math.max(9, Math.floor(hudHeight * 0.18))}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        const weaponKeyMap: Record<string, string> = {
          fist: "weaponFist",
          chainsaw: "weaponChainsaw",
          pistol: "weaponPistol",
          shotgun: "weaponShotgun",
          chaingun: "weaponChaingun",
          launcher: "weaponLauncher",
        };
        const weaponLabel = doomText(
          weaponKeyMap[doomWeaponRef.current] ?? "weaponPistol",
        );
        ctx.fillText(
          `${doomText("scoreLabel")}: ${String(score).padStart(3, "0")}  |  ${weaponLabel}`,
          viewX + sectionPadding,
          hudY + hudHeight - Math.floor(hudHeight * 0.22),
        );
        ctx.restore();
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
          const miniY = Math.min(viewY + 8, hudY - miniH - 8);
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
                const doorOpen =
                  doomDoorStatesRef.current[`${x},${y}`]?.open ?? 0;
                ctx.fillStyle = doorOpen > 0.7 ? "#8f7b6a" : "#6b4a2a";
                ctx.fillRect(
                  miniX + x * mapScale,
                  miniY + y * mapScale,
                  mapScale,
                  mapScale,
                );
              }
            }
          }
          const exit = doomExitRef.current;
          if (exit) {
            ctx.fillStyle = "#f4d35e";
            ctx.fillRect(
              miniX + exit.x * mapScale - 2,
              miniY + exit.y * mapScale - 2,
              4,
              4,
            );
          }
          doomPropsRef.current.forEach((prop) => {
            ctx.fillStyle =
              prop.type === "torch"
                ? "#f6c27a"
                : prop.type === "barrel"
                  ? "#d6735b"
                  : prop.type === "crate"
                    ? "#b8894f"
                    : "#8f7b6a";
            ctx.fillRect(
              miniX + prop.x * mapScale - 1,
              miniY + prop.y * mapScale - 1,
              2,
              2,
            );
          });
          const pickupMiniColors: Record<string, string> = {
            ammo: "#f6c27a",
            shells: "#f6c27a",
            rockets: "#8f7b6a",
            med: "#6fd68d",
            shield: "#5bb5d6",
            bomb: "#f4d35e",
            chest: "#d6a45b",
            shotgun: "#d6735b",
            chainsaw: "#d6735b",
            chaingun: "#8f7b6a",
            launcher: "#6fd68d",
          };
          doomPickupsRef.current.forEach((pickup) => {
            ctx.fillStyle = pickupMiniColors[pickup.type] ?? "#6fd68d";
            ctx.fillRect(
              miniX + pickup.x * mapScale - 1,
              miniY + pickup.y * mapScale - 1,
              2,
              2,
            );
          });
          doomEnemiesRef.current.forEach((enemy) => {
            ctx.fillStyle =
              enemy.type === "spitter"
                ? "#6fd68d"
                : enemy.type === "charger"
                  ? "#f4d35e"
                  : enemy.type === "brute"
                    ? "#8f7b6a"
                    : "#d6735b";
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
        const infoY = Math.min(hudY - 16, viewY + viewH - 16);
        const hintWindowVisible = doomHintWindowRef.current;
        if (hintWindowVisible) {
          const hintFont = Math.max(8, Math.floor(headerSize * 0.54));
          const hintLineHeight = Math.max(12, Math.floor(hintFont * 1.35));
          const panelPaddingX = 12;
          const panelPaddingY = 10;
          const colGap = 14;
          const desiredPanelW = Math.min(Math.floor(viewW * 0.72), 520);
          const panelW = clamp(
            desiredPanelW,
            Math.min(240, Math.floor(viewW)),
            Math.floor(viewW),
          );
          const innerW = panelW - panelPaddingX * 2;
          const colW = Math.max(80, Math.floor((innerW - colGap) / 2));
          const panelX = Math.floor(viewX + (viewW - panelW) / 2);

          ctx.save();
          ctx.font = `${hintFont}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.textBaseline = "top";

          const splitGroups = (value: string) =>
            value
              .split("  ")
              .map((part) => part.trim())
              .filter(Boolean);
          const packLines = (groups: string[], maxWidth: number) => {
            const lines: string[] = [];
            let current = "";
            groups.forEach((group) => {
              const next = current ? `${current}  ${group}` : group;
              if (!current) {
                current = next;
                return;
              }
              if (ctx.measureText(next).width <= maxWidth) {
                current = next;
              } else {
                lines.push(current);
                current = group;
              }
            });
            if (current) {
              lines.push(current);
            }
            return lines;
          };

          const leftGroups = splitGroups(doomText("controls1"));
          const rightGroups = splitGroups(doomText("controls2"));
          const leftLines = packLines(leftGroups, colW);
          const rightLines = packLines(rightGroups, colW);
          const interactionHint = doomHintRef.current;
          const rowCount = Math.max(leftLines.length, rightLines.length);
          const panelH =
            panelPaddingY * 2 +
            rowCount * hintLineHeight +
            (interactionHint ? hintLineHeight + 4 : 0);
          const panelY = Math.floor(
            viewY + Math.max(1, hudY - viewY) * 0.52 - panelH / 2,
          );

          ctx.fillStyle = "rgba(18,18,18,0.9)";
          ctx.fillRect(panelX, panelY, panelW, panelH);
          ctx.strokeStyle = "rgba(246,194,122,0.55)";
          ctx.strokeRect(panelX, panelY, panelW, panelH);

          const leftX = panelX + panelPaddingX;
          const rightX = panelX + panelPaddingX + colW + colGap;
          const startY = panelY + panelPaddingY;

          for (let row = 0; row < rowCount; row += 1) {
            const y = startY + row * hintLineHeight;
            const leftText = leftLines[row];
            const rightText = rightLines[row];
            if (leftText) {
              ctx.fillStyle = "#f4d35e";
              ctx.fillText(leftText, leftX, y);
            }
            if (rightText) {
              ctx.fillStyle = dim;
              ctx.fillText(rightText, rightX, y);
            }
          }
          if (interactionHint) {
            const y = startY + rowCount * hintLineHeight + 4;
            ctx.fillStyle = "#f4d35e";
            ctx.fillText(interactionHint, leftX, y);
          }
          ctx.restore();
        } else if (doomHintRef.current) {
          ctx.fillStyle = "#f4d35e";
          ctx.fillText(doomHintRef.current, viewX, infoY - 22);
        }
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
    ensureEditorBuffer,
    normalizeEditorSelection,
    updateEditorScroll,
    fontScale,
    homePath,
    getChessLegalMoves,
    getDoomBootProgress,
    ensureDoomTextures,
    isChessInCheck,
    isFirefox,
    isMobile,
    perfTier,
    prompt,
    language,
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
      if (mode !== "editor" && (key === "Escape" || lower === "q")) {
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

      if (mode === "editor") {
        const state = editorRef.current;
        if (!state) {
          event.preventDefault();
          return true;
        }
        ensureEditorBuffer(state);

        const lowerKey = key.toLowerCase();
        if (editorCommandRef.current.active) {
          if (key === "Enter") {
            executeEditorCommand(editorCommandRef.current.value);
            editorCommandRef.current = { active: false, value: "" };
            dirtyRef.current = true;
            event.preventDefault();
            return true;
          }
          if (key === "Escape") {
            editorCommandRef.current = { active: false, value: "" };
            dirtyRef.current = true;
            event.preventDefault();
            return true;
          }
          if (key === "Backspace") {
            editorCommandRef.current.value =
              editorCommandRef.current.value.slice(0, -1);
            dirtyRef.current = true;
            event.preventDefault();
            return true;
          }
          if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
            editorCommandRef.current.value += key;
            dirtyRef.current = true;
            event.preventDefault();
            return true;
          }
          event.preventDefault();
          return true;
        }

        if ((event.ctrlKey || event.metaKey) && lowerKey === "s") {
          executeEditorCommand("w");
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if ((event.ctrlKey || event.metaKey) && lowerKey === "q") {
          if (state.modified && !editorQuitArmedRef.current) {
            editorStatusRef.current = messages.editor.unsavedChanges;
            editorQuitArmedRef.current = true;
          } else {
            executeEditorCommand("q!");
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if ((event.ctrlKey || event.metaKey) && lowerKey === "w") {
          editorCommandRef.current = { active: true, value: "" };
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if ((event.ctrlKey || event.metaKey) && lowerKey === "g") {
          editorStatusRef.current = messages.editor.help;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if ((event.ctrlKey || event.metaKey) && lowerKey === "n") {
          state.showLineNumbers = !state.showLineNumbers;
          editorStatusRef.current = state.showLineNumbers
            ? messages.editor.lineNumbersOn
            : messages.editor.lineNumbersOff;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if ((event.ctrlKey || event.metaKey) && lowerKey === "c") {
          const text = getEditorSelectionText();
          if (text) {
            editorClipboardRef.current = text;
            if (navigator.clipboard?.writeText) {
              void navigator.clipboard.writeText(text).catch(() => null);
            }
            editorStatusRef.current =
              language === "tr" ? "Kopyalandı" : "Copied";
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if ((event.ctrlKey || event.metaKey) && lowerKey === "x") {
          const text = getEditorSelectionText();
          if (text) {
            editorClipboardRef.current = text;
            if (navigator.clipboard?.writeText) {
              void navigator.clipboard.writeText(text).catch(() => null);
            }
            deleteEditorSelection();
            editorStatusRef.current = language === "tr" ? "Kesildi" : "Cut";
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if ((event.ctrlKey || event.metaKey) && lowerKey === "v") {
          const clip = editorClipboardRef.current;
          if (clip) {
            insertEditorText(clip);
            editorStatusRef.current = null;
            editorQuitArmedRef.current = false;
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }

        if (key === ":") {
          editorCommandRef.current = { active: true, value: "" };
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }

        if (key === "ArrowUp" || key === "ArrowDown") {
          const delta = key === "ArrowUp" ? -1 : 1;
          const byWord = false;
          moveEditorCursor(delta, 0, {
            extend: Boolean(event.shiftKey),
            byWord,
          });
          editorQuitArmedRef.current = false;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "ArrowLeft" || key === "ArrowRight") {
          const delta = key === "ArrowLeft" ? -1 : 1;
          moveEditorCursor(0, delta, {
            extend: Boolean(event.shiftKey),
            byWord: Boolean(event.ctrlKey || event.metaKey),
          });
          editorQuitArmedRef.current = false;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "Home") {
          moveEditorCursor(0, -9999, { extend: Boolean(event.shiftKey) });
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "End") {
          moveEditorCursor(0, 9999, { extend: Boolean(event.shiftKey) });
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "PageUp" || key === "PageDown") {
          const delta = key === "PageUp" ? -8 : 8;
          moveEditorCursor(delta, 0, { extend: Boolean(event.shiftKey) });
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "Enter") {
          insertEditorNewline();
          editorQuitArmedRef.current = false;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "Tab") {
          insertEditorText("  ");
          editorQuitArmedRef.current = false;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "Backspace") {
          deleteEditorChar("back");
          editorQuitArmedRef.current = false;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "Delete") {
          deleteEditorChar("forward");
          editorQuitArmedRef.current = false;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key.length === 1 && !event.ctrlKey && !event.metaKey) {
          insertEditorText(key);
          editorQuitArmedRef.current = false;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
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
        const step = event.shiftKey ? 0.11 : 0.08;
        const turn = 0.06;
        if (key === "1") {
          if (doomChainsawUnlockedRef.current) {
            doomWeaponRef.current =
              doomWeaponRef.current === "chainsaw" ? "fist" : "chainsaw";
            doomMessageRef.current = doomText(
              doomWeaponRef.current === "chainsaw"
                ? "weaponChainsaw"
                : "weaponFist",
            );
          } else {
            doomWeaponRef.current = "fist";
            doomMessageRef.current = doomText("weaponFist");
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "2") {
          doomWeaponRef.current = "pistol";
          doomMessageRef.current = doomText("weaponPistol");
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "3") {
          if (doomShotgunUnlockedRef.current) {
            doomWeaponRef.current = "shotgun";
            doomMessageRef.current = doomText("weaponShotgun");
          } else {
            doomMessageRef.current = doomText("noShotgun");
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "4") {
          if (doomChaingunUnlockedRef.current) {
            doomWeaponRef.current = "chaingun";
            doomMessageRef.current = doomText("weaponChaingun");
          } else {
            doomMessageRef.current = doomText("noChaingun");
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (key === "5") {
          if (doomLauncherUnlockedRef.current) {
            doomWeaponRef.current = "launcher";
            doomMessageRef.current = doomText("weaponLauncher");
          } else {
            doomMessageRef.current = doomText("noLauncher");
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
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
        if (lower === "h") {
          doomHintWindowRef.current = !doomHintWindowRef.current;
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        if (lower === "e") {
          interactDoom();
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
      deleteEditorChar,
      deleteEditorSelection,
      doomText,
      ensureEditorBuffer,
      executeEditorCommand,
      getEditorSelectionText,
      getDoomBootProgress,
      getSolitaireRankIndex,
      isSolitaireRed,
      insertEditorNewline,
      insertEditorText,
      placeSnakeFood,
      resetCalc,
      resetChess,
      resetDoom,
      resetPacman,
      resetPong,
      resetSnake,
      resetSolitaire,
      scheduleChessBotMove,
      moveEditorCursor,
      interactDoom,
      shootDoom,
      throwDoomBomb,
      hasChessLegalMove,
      isChessInCheck,
      solitaireCardLabel,
      startSynthAudio,
      stopSynthAudio,
      stopApp,
      formatMessage,
      messages,
      language,
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
