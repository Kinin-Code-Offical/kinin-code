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
import { createChessBot, type ChessBot } from "./chess/bot";
import {
  createMusicPlayer,
  describeTrack,
  type MusicPlayer,
} from "./media/music";
import { DEMOS, demoForFile, renderDemo, type DemoId } from "./media/asciiDemos";
import { HellrunGame } from "./hellrun";
import {
  getGameStatus,
  positionKey,
  type ChessState,
  type EngineMove,
} from "./chess/engine";

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
      moreResults: string;
      userFallback: string;
      unameShort: string;
      unameLong: string;
      uptime: string;
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
      title: string;
      noBuffer: string;
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
      statusLine: string;
      copied: string;
      cut: string;
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
      aliasDefinition: string;
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
    manuals: Record<string, readonly string[]>;
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
      hintLine1: string;
      hintLine2: string;
    };
    apps: {
      launchSnake: string;
      launchPacman: string;
      launchPong: string;
      launchChess: string;
      launchSolitaire: string;
      modeStatus: string;
    };
    doom: {
      ready: string;
      noAmmo: string;
      noShells: string;
      noRockets: string;
      fire: string;
      punch: string;
      saw: string;
      rocket: string;
      targetDown: string;
      hit: string;
      noBombs: string;
      boom: string;
      reload: string;
      doorOpen: string;
      doorClose: string;
      noDoor: string;
      interactDoor: string;
      interactPickup: string;
      interactExit: string;
      exitReady: string;
      nextLevel: string;
      ammoPlus: string;
      shellsPlus: string;
      rocketsPlus: string;
      healthPlus: string;
      shieldPlus: string;
      bombPlus: string;
      chest: string;
      shotgun: string;
      chainsaw: string;
      chaingun: string;
      launcher: string;
      weaponFist: string;
      weaponChainsaw: string;
      weaponPistol: string;
      weaponShotgun: string;
      weaponChaingun: string;
      weaponLauncher: string;
      noShotgun: string;
      noChainsaw: string;
      noChaingun: string;
      noLauncher: string;
      damage: string;
      died: string;
      clear: string;
      launch: string;
      loading: string;
      hudLabel: string;
      shieldLabel: string;
      ammoLabel: string;
      shellsLabel: string;
      rocketsLabel: string;
      bombLabel: string;
      scoreLabel: string;
      controls1: string;
      controls2: string;
      gameOver: string;
    };
    chess: {
      selectPiece: string;
      promotePawn: string;
      noPieceSelected: string;
      notYourTurn: string;
      illegalMove: string;
      checkmate: string;
      stalemate: string;
      draw: string;
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
      checkmateTitle: string;
      stalemateTitle: string;
      drawTitle: string;
      youWin: string;
      botWins: string;
      whiteWins: string;
      blackWins: string;
      drawResult: string;
      newGameHint: string;
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
      inputLabel: string;
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
  /** Portrait-phone view: the screen is shown rotated (see HeroScene). */
  screenRotated?: boolean;
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
type ChessOutcome = {
  winner: "w" | "b" | null;
  reason: "checkmate" | "stalemate" | "draw";
} | null;
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

type DirNode = { type: "dir"; children: Record<string, FsNode> };

/** Walks to an absolute path, creating missing directories along the way
 * (only the last one unless `recursive`). Returns the directory or null. */
const ensureDirIn = (
  root: FsNode,
  absolutePath: string,
  recursive: boolean,
): DirNode | null => {
  const parts = absolutePath.split("/").filter((part) => part.length > 0);
  let node: FsNode = root;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (node.type !== "dir") {
      return null;
    }
    const existing: FsNode | undefined = node.children[part];
    if (!existing) {
      if (!recursive && i < parts.length - 1) {
        return null;
      }
      node.children[part] = { type: "dir", children: {} };
    } else if (existing.type !== "dir") {
      return null;
    }
    node = node.children[part];
  }
  return node.type === "dir" ? node : null;
};

/** Deep copy of a virtual file-system node (used by cp -r / mv). */
const cloneNode = (node: FsNode): FsNode => {
  if (node.type === "file") {
    return { type: "file", content: node.content, section: node.section };
  }
  const children: Record<string, FsNode> = {};
  Object.entries(node.children).forEach(([key, child]) => {
    children[key] = cloneNode(child);
  });
  return { type: "dir", children };
};

const markdownToLines = (text: string, locale?: string): Line[] => {
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
      // Locale-aware so Turkish headings become "İLETİŞİM", not "İLETIŞIM".
      lines.push({ text: clean.toLocaleUpperCase(locale) });
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
  screenRotated = false,
  fontScale,
  scrollProgressRef,
  onNavigateAction,
  onReadyAction,
  onBootReadyAction,
  onFocusChangeAction,
  onDebugAction,
}: TerminalCanvasProps) {
  const userName = useMemo(
    () => prompt.split("@")[0] || messages.system.userFallback,
    [messages.system.userFallback, prompt],
  );
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
  // Set on mount (Date.now() during render is impure).
  const sessionStartRef = useRef(0);
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
  const chessBoardRef = useRef<string[][]>([]);
  const chessCursorRef = useRef<GridPoint>({ x: 0, y: 7 });
  const chessSelectedRef = useRef<GridPoint | null>(null);
  const chessTurnRef = useRef<"w" | "b">("w");
  const chessMovesRef = useRef(0);
  const chessStatusRef = useRef<string | null>(null);
  // Default to playing against the engine: an empty PvP board on a single
  // keyboard is not what visitors expect when they type "chess".
  const chessModeRef = useRef<"pvp" | "bot">("bot");
  const chessOutcomeCacheRef = useRef<{
    key: string;
    outcome: ChessOutcome;
  } | null>(null);
  const chessLastMoveRef = useRef<{ from: GridPoint; to: GridPoint } | null>(
    null,
  );
  const chessHistoryRef = useRef<string[]>([]);
  const chessBotRef = useRef<ChessBot | null>(null);
  const hellrunRef = useRef<HellrunGame | null>(null);
  const hellrunLastFrameRef = useRef(0);
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
  const playerLastTickRef = useRef(0);
  const musicPlayerRef = useRef<MusicPlayer | null>(null);
  const musicTrackRef = useRef<string | null>(null);
  const musicEndedRef = useRef(false);
  const playerSpectrumRef = useRef<Uint8Array>(new Uint8Array(40));
  const demoIdRef = useRef<DemoId>("plasma");
  const demoStateRef = useRef<unknown>(undefined);
  const playerIsPlayingRef = useRef(false);
  const playerStatusRef = useRef<string | null>(null);
  const playerImageListRef = useRef<string[]>([]);
  const playerImageIndexRef = useRef(0);
  const playerImageZoomRef = useRef(1);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioVolumeRef = useRef(0);
  const audioTargetRef = useRef(0);
  const audioTimerRef = useRef<number | null>(null);
  const audioLastTickRef = useRef(0);
  const audioAutoPausedRef = useRef(false);
  const pyodideRef = useRef<PyodideInterface | null>(null);
  const pyodideLoadingRef = useRef<Promise<PyodideInterface> | null>(null);
  const pipPackagesRef = useRef<string[]>(["pip", "setuptools", "wheel"]);
  // Ref (not state): blinking must not re-render this whole component.
  const cursorVisibleRef = useRef(true);
  // In the rotated portrait view a sticky note on the bezel overlaps the top
  // corner of the screen, so shell text starts a little lower there.
  const screenRotatedRef = useRef(screenRotated);
  useEffect(() => {
    screenRotatedRef.current = screenRotated;
    dirtyRef.current = true;
  }, [screenRotated]);
  const [ready, setReady] = useState(false);
  const noiseCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const freezeTextureRef = useRef(false);
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
          ? 1024
          : perfTier === "low"
            ? 760
            : 900
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
    if (!sessionStartRef.current) {
      sessionStartRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (isActive) {
      dirtyRef.current = true;
      if (focusedRef.current) {
        cursorVisibleRef.current = true;
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
        cursorVisibleRef.current = true;
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
    chessLastMoveRef.current = null;
    chessHistoryRef.current = [];
    chessOutcomeCacheRef.current = null;
    // Drop any search still running for the previous game.
    chessBotRef.current?.cancel();
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

  // Snapshot of the game in the engine's format (also used for repetition keys).
  const buildChessState = useCallback(
    (): ChessState => ({
      board: chessBoardRef.current.map((row) => row.slice()),
      turn: chessTurnRef.current,
      castling: { ...chessCastlingRef.current },
      enPassant: chessEnPassantRef.current
        ? { ...chessEnPassantRef.current }
        : null,
      history: chessHistoryRef.current.slice(),
    }),
    [],
  );

  // Final result of the current position (null while the game goes on).
  // Cached per position so drawing it every frame stays cheap.
  const getChessOutcome = useCallback((): ChessOutcome => {
    if (chessPendingPromotionRef.current) {
      return null;
    }
    const board = chessBoardRef.current;
    const turn = chessTurnRef.current;
    const key = `${turn}:${chessHistoryRef.current.length}:${board
      .map((row) => row.map((piece) => piece || ".").join(""))
      .join("/")}`;
    const cached = chessOutcomeCacheRef.current;
    if (cached && cached.key === key) {
      return cached.outcome;
    }
    let outcome: ChessOutcome = null;
    if (!hasChessLegalMove(board, turn)) {
      outcome = isChessInCheck(board, turn)
        ? { winner: turn === "w" ? "b" : "w", reason: "checkmate" }
        : { winner: null, reason: "stalemate" };
    } else {
      const { status } = getGameStatus(buildChessState());
      if (
        status === "threefold" ||
        status === "fifty-move" ||
        status === "insufficient-material"
      ) {
        outcome = { winner: null, reason: "draw" };
      }
    }
    chessOutcomeCacheRef.current = { key, outcome };
    return outcome;
  }, [buildChessState, hasChessLegalMove, isChessInCheck]);

  const attemptChessMove = useCallback(
    (from: GridPoint, to: GridPoint, promotion?: EngineMove["promotion"]) => {
      if (getChessOutcome()) {
        // The game is over: no more moves until a new game starts.
        return false;
      }
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
      // Remember the position we are leaving (threefold-repetition detection).
      chessHistoryRef.current.push(positionKey(buildChessState()));
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
      chessLastMoveRef.current = { from: { ...from }, to: { ...to } };

      const isPromotion = lower === "p" && to.y === promoteRow;
      const nextTurn = isWhite ? "b" : "w";
      if (isPromotion) {
        const isBotTurn =
          chessModeRef.current === "bot" &&
          chessTurnRef.current === chessBotColorRef.current;
        if (isBotTurn) {
          const promoted = promotion ?? "q";
          chessBoardRef.current[to.y][to.x] = isWhite
            ? promoted.toUpperCase()
            : promoted;
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
        const { status } = getGameStatus(buildChessState());
        chessStatusRef.current =
          status === "threefold" ||
          status === "fifty-move" ||
          status === "insufficient-material"
            ? messages.chess.draw
            : inCheck
              ? messages.chess.check
              : null;
      }
      return true;
    },
    [
      getChessOutcome,
      applyChessMove,
      buildChessState,
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
    if (getChessOutcome()) {
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

    // The engine (alpha-beta search, see ./chess/engine.ts) runs in a Web
    // Worker so the terminal keeps animating while it thinks. A result is only
    // applied if the game is still at the position it was computed for.
    if (!chessBotRef.current) {
      chessBotRef.current = createChessBot();
    }
    const bot = chessBotRef.current;
    const startedAt = performance.now();
    const moveNumber = chessMovesRef.current;
    const stateAtRequest = buildChessState();
    const minThinkMs = 280;
    const finish = () => {
      chessBotThinkingRef.current = false;
      dirtyRef.current = true;
    };
    bot
      .bestMove(stateAtRequest, chessDifficultyRef.current)
      .then((result) => {
        const stillValid = () =>
          appModeRef.current === "chess" &&
          chessModeRef.current === "bot" &&
          chessMovesRef.current === moveNumber &&
          chessTurnRef.current === botColor &&
          !chessPendingPromotionRef.current;
        const apply = () => {
          if (!stillValid()) {
            finish();
            return;
          }
          if (!result.move) {
            const inCheck = isChessInCheck(chessBoardRef.current, botColor);
            chessStatusRef.current = inCheck
              ? messages.chess.checkmate
              : messages.chess.stalemate;
            finish();
            return;
          }
          const moved = attemptChessMove(
            result.move.from,
            result.move.to,
            result.move.promotion,
          );
          if (moved) {
            chessSelectedRef.current = null;
          }
          finish();
        };
        // A tiny minimum delay so instant replies don't feel jarring.
        const wait = Math.max(0, minThinkMs - (performance.now() - startedAt));
        if (wait > 0) {
          window.setTimeout(apply, wait);
        } else {
          apply();
        }
      })
      .catch(() => {
        finish();
      });
  }, [
    getChessOutcome,
    attemptChessMove,
    buildChessState,
    isChessInCheck,
    messages.chess,
  ]);

  useEffect(
    () => () => {
      chessBotRef.current?.dispose();
      chessBotRef.current = null;
    },
    [],
  );

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

  // Procedural music (./media/music.ts: sequenced drums, bass, chords and
  // lead, with a real analyser) replaces the old three-oscillator drone.
  const getMusicPlayer = useCallback(() => {
    if (!musicPlayerRef.current) {
      const player = createMusicPlayer();
      player.onEnded(() => {
        musicEndedRef.current = true;
        dirtyRef.current = true;
      });
      musicPlayerRef.current = player;
    }
    return musicPlayerRef.current;
  }, []);

  const stopSynthAudio = useCallback((hard = false) => {
    const player = musicPlayerRef.current;
    if (!player) {
      return;
    }
    player.pause();
    if (hard) {
      player.dispose();
      musicPlayerRef.current = null;
      musicTrackRef.current = null;
    }
  }, []);

  const startSynthAudio = useCallback(async () => {
    if (typeof window === "undefined") {
      return;
    }
    const player = getMusicPlayer();
    const fileName =
      playerTitleRef.current.split("/").pop() || playerTitleRef.current;
    try {
      if (musicTrackRef.current !== fileName) {
        musicTrackRef.current = fileName;
        musicEndedRef.current = false;
        player.setVolume(audioVolumeRef.current);
        await player.play(fileName);
      } else if (!player.isPlaying()) {
        musicEndedRef.current = false;
        await player.resume();
      }
    } catch {
      // Autoplay blocked or no Web Audio: the visualiser simply stays idle.
    }
  }, [getMusicPlayer]);

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
    const now = performance.now();
    const last = playerLastTickRef.current || now;
    playerLastTickRef.current = now;
    const dtSeconds = Math.min(0.5, Math.max(0, (now - last) / 1000));
    if (playerModeRef.current === "mp3") {
      const player = musicPlayerRef.current;
      if (player) {
        // Real position and a real spectrum from the Web Audio analyser.
        playerProgressRef.current = Math.min(
          playerDurationRef.current,
          player.currentTime(),
        );
        player.getSpectrum(playerSpectrumRef.current);
      } else {
        playerProgressRef.current = Math.min(
          playerDurationRef.current,
          playerProgressRef.current + dtSeconds,
        );
      }
      if (
        musicEndedRef.current ||
        playerProgressRef.current >= playerDurationRef.current
      ) {
        musicEndedRef.current = false;
        playerIsPlayingRef.current = false;
        playerStatusRef.current = messages.media.playbackComplete;
      }
    } else if (playerModeRef.current === "video") {
      // ASCII demos are endless: progress is simply elapsed play time.
      playerProgressRef.current += dtSeconds;
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
                : mode === "player"
                  ? 40
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
                : mode === "player"
                  ? 70
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
      playerLastTickRef.current = 0;
      playerStatusRef.current = null;
      playerIsPlayingRef.current = mode !== "image";
      if (mode === "image") {
        playerImageZoomRef.current = 1;
      }
      audioAutoPausedRef.current = false;
      const fileName = title.split("/").pop() ?? title;
      if (mode === "mp3") {
        playerDurationRef.current = describeTrack(fileName).durationSec;
        playerSpectrumRef.current.fill(0);
        // Force a fresh start even when the same file is replayed.
        musicTrackRef.current = null;
        startGameLoop("player");
        void startSynthAudio();
      } else if (mode === "video") {
        demoIdRef.current = demoForFile(fileName);
        demoStateRef.current = undefined;
        playerFramesRef.current = [];
        playerDurationRef.current = 0;
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

  const listMediaFiles = useCallback(
    (pattern: RegExp) => {
      const home = envRef.current.HOME || homePath;
      const mediaDir = `${home}/media`;
      const node = findNode(fsRef.current, mediaDir);
      if (!node || node.type !== "dir") {
        return [] as string[];
      }
      return Object.entries(node.children)
        .filter(([name, child]) => child.type === "file" && pattern.test(name))
        .map(([name]) => `${mediaDir}/${name}`.replace(/\/+/g, "/"))
        .sort();
    },
    [homePath],
  );

  const cycleTrack = useCallback(
    (direction: number) => {
      const mode = playerModeRef.current;
      if (mode !== "mp3" && mode !== "video") {
        return;
      }
      const paths = listMediaFiles(mode === "mp3" ? /\.mp3$/i : /\.vid$/i);
      if (!paths.length) {
        return;
      }
      const currentBase =
        playerTitleRef.current.split("/").pop() ?? playerTitleRef.current;
      const index = paths.findIndex((path) =>
        path.endsWith(`/${currentBase}`),
      );
      const nextPath =
        paths[(Math.max(0, index) + direction + paths.length) % paths.length];
      const node = findNode(fsRef.current, nextPath);
      startPlayer(
        mode,
        nextPath,
        node && node.type === "file" ? node.content : undefined,
      );
    },
    [listMediaFiles, startPlayer],
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
        // HELLRUN runs off the draw loop (update + render every frame).
        hellrunRef.current?.dispose();
        hellrunRef.current = new HellrunGame({
          lang: language,
          lowPower: perfTier === "low" || isMobile,
        });
        hellrunLastFrameRef.current = 0;
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
      resetPacman,
      resetPong,
      resetSnake,
      resetSolitaire,
      scheduleChessBotMove,
      startGameLoop,
      stopGameLoop,
      language,
      perfTier,
      isMobile,
    ],
  );

  // HELLRUN needs key-ups (held movement keys) and must release keys when
  // the window loses focus; it also follows language switches.
  useEffect(() => {
    const handleKeyUp = (event: KeyboardEvent) => {
      if (appModeRef.current === "doom") {
        hellrunRef.current?.keyUp({ key: event.key, code: event.code });
      }
    };
    const handleBlur = () => hellrunRef.current?.blur();
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
      window.removeEventListener("blur", handleBlur);
      hellrunRef.current?.dispose();
      hellrunRef.current = null;
    };
  }, []);

  useEffect(() => {
    hellrunRef.current?.setLang(language);
  }, [language]);

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
      ctx.fillStyle = theme.palette.terminalBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    // Keep the same texture object: the screen material references it. A new
    // object here left the 3D screen showing a stale (frozen) texture, so
    // typed text never appeared. dispose() frees the GPU storage so it is
    // re-allocated with the new canvas dimensions on the next upload.
    textureRef.current.dispose();
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
        // While the page scrolls the terminal texture stays as-is: no 2D
        // redraws and no GPU uploads competing with the scroll frames.
        freezeTextureRef.current = true;
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
      cursorVisibleRef.current = !cursorVisibleRef.current;
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
      if (musicPlayerRef.current?.isPlaying()) {
        // Remember to continue where we left off when the hero is back.
        audioAutoPausedRef.current = true;
      }
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
    if (
      audioAutoPausedRef.current &&
      appModeRef.current === "player" &&
      playerModeRef.current === "mp3" &&
      playerIsPlayingRef.current
    ) {
      audioAutoPausedRef.current = false;
      void startSynthAudio();
    }

    const tick = () => {
      if (!alive) {
        return;
      }
      const now = typeof performance !== "undefined" ? performance.now() : 0;
      const dt = Math.max(0, now - (audioLastTickRef.current || now));
      audioLastTickRef.current = now;
      // Volume follows the scroll position (fades out as the camera pulls
      // back); playback itself is only paused/resumed by the user or when
      // the terminal becomes inactive.
      const target = computeMp3TargetVolume();
      audioTargetRef.current = target;
      const { current } = audioVolumeRef;
      const alpha = 1 - Math.exp(-dt / 200);
      const next = current + (target - current) * alpha;
      audioVolumeRef.current = next;
      musicPlayerRef.current?.setVolume(next);

      const isMp3Player =
        appModeRef.current === "player" && playerModeRef.current === "mp3";
      const delay = isMp3Player && playerIsPlayingRef.current ? 50 : 260;
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
      if (hellrunRef.current) {
        hellrunRef.current.dispose();
        hellrunRef.current = null;
      }
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
    (input: string, recursive = false) =>
      ensureDirIn(
        fsRef.current,
        resolvePath(cwdRef.current, input, homePath),
        recursive,
      ),
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
      markdownToLines(node.content, languageMeta[language].locale).forEach(
        (line) =>
          appendLine(line.text, line.color ?? theme.palette.terminalText),
      );
    },
    [
      appendLine,
      files,
      formatMessage,
      homePath,
      language,
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
          appendLine(env.USER || messages.system.userFallback);
          break;
        case "uname":
          appendLine(
            hasFlag("a")
              ? messages.system.unameLong
              : messages.system.unameShort,
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
          appendLine(
            formatMessage(messages.system.uptime, {
              time: formatUptime(seconds),
            }),
          );
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
              .forEach(([key, value]) =>
                appendLine(
                  formatMessage(messages.commands.aliasDefinition, {
                    name: key,
                    value,
                  }),
                ),
              );
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
            appendLine(
              formatMessage(messages.system.moreResults, {
                count: String(results.length - 120),
              }),
            );
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
              formatMessage(messages.commands.aliasDefinition, {
                name: commandName,
                value: aliasRef.current[commandName],
              }),
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
          const { manuals } = messages;
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
          appendLine(messages.doom.launch);
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
      hasTerminalContentRef.current &&
      !focusedRef.current
    ) {
      // Frozen while the page scrolls: keep dirtyRef set so the latest state
      // is painted as soon as scrolling stops.
      return;
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
    const shellTopInset = screenRotatedRef.current
      ? Math.floor(height * 0.09)
      : 0;
    const availableHeight = Math.max(1, height - padding * 2 - shellTopInset);
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
        const commandsArea = Math.max(24, Math.floor(lineHeight * 1.4));
        const boxH = height - pad * 2 - commandsArea;
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
          ctx.fillText(messages.editor.title, pad + 12, pad + 8);
          ctx.fillStyle = dim;
          ctx.fillText(messages.editor.noBuffer, pad + 12, pad + 32);
          finalizeFrame();
          return;
        }

        ensureEditorBuffer(state);

        ctx.fillStyle = accent;
        ctx.fillText(
          `${messages.editor.title}  ${state.path}`,
          pad + 12,
          pad + 8,
        );

        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(pad + 1, textAreaY - 4, boxW - 2, 1);

        const textFont = `${fontSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.font = textFont;
        const charWidth = Math.max(6, Math.ceil(ctx.measureText("M").width));
        const visibleLines = Math.max(1, Math.floor(textAreaH / lineHeight));
        const maxLineDigits = String(state.buffer.length).length;
        const lineNumberWidth = state.showLineNumbers
          ? (maxLineDigits + 2) * charWidth
          : 0;
        const textAreaWidth = Math.max(1, boxW - 24 - lineNumberWidth);
        const maxCharsPerLine = Math.max(
          1,
          Math.floor(textAreaWidth / charWidth),
        );
        const wrapEditorLine = (text: string) => {
          if (!text) {
            return [{ text: "", start: 0, end: 0 }];
          }
          const segments: { text: string; start: number; end: number }[] = [];
          let cursor = 0;
          while (cursor < text.length) {
            const sliceEnd = Math.min(cursor + maxCharsPerLine, text.length);
            segments.push({
              text: text.slice(cursor, sliceEnd),
              start: cursor,
              end: sliceEnd,
            });
            cursor = sliceEnd;
          }
          return segments;
        };

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

        let displayRow = 0;
        for (
          let lineIndex = top;
          lineIndex < state.buffer.length && displayRow < visibleLines;
          lineIndex += 1
        ) {
          const line = state.buffer[lineIndex] ?? "";
          const segments = wrapEditorLine(line);
          for (let segIndex = 0; segIndex < segments.length; segIndex += 1) {
            if (displayRow >= visibleLines) {
              break;
            }
            const segment = segments[segIndex];
            const y = textAreaY + displayRow * lineHeight;
            const textX = pad + 12 + lineNumberWidth;

            if (state.showLineNumbers && segIndex === 0) {
              ctx.fillStyle = dim;
              const numberText = String(lineIndex + 1).padStart(maxLineDigits);
              ctx.fillText(numberText, pad + 12, y);
            }

            ctx.fillStyle = accent;
            ctx.fillText(segment.text, textX, y);

            if (selection) {
              const { start, end } = selection;
              if (lineIndex >= start.row && lineIndex <= end.row) {
                const startCol = lineIndex === start.row ? start.col : 0;
                const endCol = lineIndex === end.row ? end.col : line.length;
                const segStart = Math.max(startCol, segment.start);
                const segEnd = Math.min(endCol, segment.end);
                if (segEnd > segStart) {
                  ctx.fillStyle = "rgba(246,194,122,0.18)";
                  ctx.fillRect(
                    textX + (segStart - segment.start) * charWidth,
                    y - 1,
                    Math.max(1, (segEnd - segStart) * charWidth),
                    lineHeight,
                  );
                  ctx.fillStyle = accent;
                  ctx.fillText(segment.text, textX, y);
                }
              }
            }

            if (
              cursorVisibleRef.current &&
              lineIndex === cursor.row &&
              !editorCommandRef.current.active
            ) {
              if (cursor.col >= segment.start && cursor.col <= segment.end) {
                const cursorX =
                  textX + (cursor.col - segment.start) * charWidth;
                ctx.fillStyle = accent;
                ctx.fillRect(cursorX, y - 1, 2, lineHeight);
              }
            }

            displayRow += 1;
          }
        }

        ctx.restore();

        const statusY = pad + boxH - footerHeight + 6;
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(pad + 1, statusY - 4, boxW - 2, footerHeight - 6);

        const modifiedMark = state.modified ? "*" : "";
        const statusText =
          editorStatusRef.current ??
          formatMessage(messages.editor.statusLine, {
            row: String(cursor.row + 1),
            col: String(cursor.col + 1),
          });
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

        const helpText = messages.editor.help;
        const footerFont = Math.max(9, Math.floor(fontSize * 0.7));
        ctx.font = `${footerFont}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        const helpY =
          pad +
          boxH +
          Math.max(8, Math.floor((commandsArea - footerFont) * 0.6));
        const helpMaxW = boxW - 24;
        if (helpMaxW > 160) {
          const safeHelp = trimToWidth(helpText, helpMaxW);
          ctx.fillStyle = dim;
          ctx.fillText(safeHelp, pad + 12, helpY);
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
        const playerMode = playerModeRef.current ?? "mp3";
        const pad = Math.floor(Math.min(width, height) * 0.08);
        const lineGap = Math.max(16, Math.floor(headerSize * 1.45));
        const footerSpace = lineGap * 2;
        const boxX = pad;
        const boxY = pad;
        const boxW = width - pad * 2;
        const boxH = height - pad * 2 - footerSpace;
        const monoFont = (size: number) =>
          `${size}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        const fitText = (text: string, maxW: number) => {
          if (ctx.measureText(text).width <= maxW) {
            return text;
          }
          let cut = text;
          while (cut.length > 4 && ctx.measureText(`${cut}…`).width > maxW) {
            cut = cut.slice(0, -1);
          }
          return `${cut}…`;
        };
        const formatClock = (seconds: number) => {
          const total = Math.max(0, Math.floor(seconds));
          return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
        };
        ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeStyle = dim;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

        // Header: type glyph + file name, position in the playlist on the right.
        const title = playerTitleRef.current;
        const fileName = title.split("/").pop() ?? title;
        const playlist =
          playerMode === "mp3"
            ? listMediaFiles(/\.mp3$/i)
            : playerMode === "video"
              ? listMediaFiles(/\.vid$/i)
              : resolveImagePlaylist().paths;
        const playlistIndex = playlist.findIndex((path) =>
          path.endsWith(`/${fileName}`),
        );
        const counter =
          playlist.length > 0 && playlistIndex >= 0
            ? `${playlistIndex + 1}/${playlist.length}`
            : "";
        const glyph =
          playerMode === "mp3" ? "♪" : playerMode === "video" ? "▶" : "▣";
        const trackInfo = playerMode === "mp3" ? describeTrack(fileName) : null;
        const demoTitle =
          playerMode === "video"
            ? (DEMOS.find((demo) => demo.id === demoIdRef.current)?.title[
                language
              ] ?? fileName)
            : null;
        const headerName = trackInfo
          ? `${trackInfo.title} · ${trackInfo.style} · ${trackInfo.bpm} BPM`
          : (demoTitle ?? fileName);
        ctx.font = monoFont(headerSize);
        const counterW = counter ? ctx.measureText(counter).width : 0;
        ctx.fillStyle = dim;
        if (counter) {
          ctx.fillText(counter, boxX + boxW - 14 - counterW, boxY + 12);
        }
        ctx.fillStyle = accent;
        ctx.fillText(
          fitText(
            `${glyph}  ${formatMessage(messages.ui.player, {
              mode:
                language === "tr"
                  ? { mp3: "MÜZİK", video: "VİDEO", image: "GÖRSEL" }[
                      playerMode
                    ]
                  : { mp3: "MUSIC", video: "VIDEO", image: "IMAGE" }[
                      playerMode
                    ],
            })}  ${headerName}`,
            boxW - 40 - counterW,
          ),
          boxX + 14,
          boxY + 12,
        );
        const headerBottom = boxY + 12 + lineGap + 4;
        ctx.strokeStyle = dim;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(boxX + 14, headerBottom);
        ctx.lineTo(boxX + boxW - 14, headerBottom);
        ctx.stroke();
        ctx.globalAlpha = 1;

        const hasTimeline = playerMode !== "image";
        const contentTop = headerBottom + 12;
        const contentBottom =
          boxY + boxH - (hasTimeline ? lineGap * 2 + 18 : 14);
        const contentH = Math.max(20, contentBottom - contentTop);
        const contentX = boxX + 18;
        const contentW = boxW - 36;
        const playing = playerIsPlayingRef.current;

        if (playerMode === "mp3") {
          const spectrum = playerSpectrumRef.current;
          const bars = Array.from(spectrum, (value) => value / 255);
          const barCount = Math.max(1, bars.length);
          const slot = contentW / barCount;
          const barW = Math.max(2, Math.floor(slot * 0.72));
          const baseY = contentTop + contentH;
          ctx.globalAlpha = playing ? 1 : 0.35;
          bars.forEach((value, index) => {
            const h = Math.max(2, Math.floor(value * contentH * 0.92));
            const x = Math.floor(contentX + index * slot + (slot - barW) / 2);
            ctx.fillStyle = index % 2 === 0 ? "#f6c27a" : "#e9a95e";
            ctx.fillRect(x, baseY - h, barW, h);
            ctx.fillStyle = "#fff1d6";
            ctx.fillRect(x, baseY - h - 3, barW, 2);
          });
          ctx.globalAlpha = 1;
        } else if (playerMode === "video") {
          // Real-time ASCII demo (./media/asciiDemos.ts), sized to the box.
          const demoSize = Math.max(7, Math.floor(fontSize * 0.78));
          ctx.font = monoFont(demoSize);
          const charW = Math.max(1, ctx.measureText("M").width || demoSize * 0.6);
          const lineH = Math.max(6, Math.floor(demoSize * 1.12));
          const cols = Math.max(8, Math.floor(contentW / charW));
          const rows = Math.max(4, Math.floor(contentH / lineH));
          const result = renderDemo(
            demoIdRef.current,
            playerProgressRef.current,
            cols,
            rows,
            demoStateRef.current,
          );
          demoStateRef.current = result.state;
          const demoLines = result.text.split("\n");
          const startX = contentX + (contentW - cols * charW) / 2;
          const startY = contentTop + (contentH - demoLines.length * lineH) / 2;
          ctx.fillStyle = accent;
          demoLines.forEach((line, index) => {
            ctx.fillText(line, startX, startY + index * lineH);
          });
          ctx.font = monoFont(headerSize);
        } else {
          const frame =
            playerFramesRef.current[playerFrameIndexRef.current] ?? "";
          const lines = frame.replace(/\s+$/, "").split("\n");
          const longest = lines.reduce(
            (max, line) => Math.max(max, line.length),
            1,
          );
          const zoom =
            playerMode === "image"
              ? clamp(playerImageZoomRef.current, 0.5, 3)
              : 1;
          // Fit the whole picture into the content area, then apply zoom.
          ctx.font = monoFont(100);
          const charRatio = (ctx.measureText("M").width || 60) / 100;
          const fitSize = Math.min(
            contentW / (longest * charRatio),
            contentH / (lines.length * 1.18),
          );
          const asciiSize = Math.max(
            5,
            Math.min(Math.floor(fontSize * 1.8), Math.floor(fitSize * zoom)),
          );
          ctx.font = monoFont(asciiSize);
          const lineH = Math.max(5, Math.floor(asciiSize * 1.18));
          const blockW = longest * asciiSize * charRatio;
          const blockH = lines.length * lineH;
          const startX = contentX + Math.max(0, (contentW - blockW) / 2);
          const startY = contentTop + Math.max(0, (contentH - blockH) / 2);
          ctx.save();
          ctx.beginPath();
          ctx.rect(contentX, contentTop, contentW, contentH);
          ctx.clip();
          ctx.fillStyle = accent;
          lines.forEach((line, index) => {
            ctx.fillText(line, startX, startY + index * lineH);
          });
          ctx.restore();
          ctx.font = monoFont(headerSize);
        }

        if (hasTimeline) {
          const barX = boxX + 18;
          const barW = boxW - 36;
          const barY = boxY + boxH - lineGap - 16;
          // Demos are endless: the bar sweeps once per minute instead.
          const progress =
            playerMode === "video"
              ? (playerProgressRef.current % 60) / 60
              : playerDurationRef.current > 0
                ? clamp(
                    playerProgressRef.current / playerDurationRef.current,
                    0,
                    1,
                  )
                : 0;
          ctx.fillStyle = "rgba(246, 194, 122, 0.16)";
          ctx.fillRect(barX, barY, barW, 6);
          ctx.fillStyle = accent;
          ctx.fillRect(barX, barY, Math.floor(barW * progress), 6);
          ctx.beginPath();
          ctx.arc(barX + barW * progress, barY + 3, 6, 0, Math.PI * 2);
          ctx.fill();
          const stateGlyph = playing ? "▶" : "❚❚";
          const timeText =
            playerMode === "mp3"
              ? `${stateGlyph}  ${formatClock(playerProgressRef.current)} / ${formatClock(playerDurationRef.current)}`
              : `${stateGlyph}  ${formatClock(playerProgressRef.current)}`;
          ctx.fillStyle = accent;
          ctx.fillText(timeText, barX, barY + 14);
          if (playerStatusRef.current) {
            const statusW = ctx.measureText(playerStatusRef.current).width;
            ctx.fillStyle = dim;
            ctx.fillText(
              playerStatusRef.current,
              barX + barW - statusW,
              barY + 14,
            );
          }
        } else if (playerStatusRef.current) {
          ctx.fillStyle = dim;
          ctx.fillText(
            playerStatusRef.current,
            boxX + 18,
            boxY + boxH - lineGap - 6,
          );
        }

        ctx.fillStyle = dim;
        const controlsText =
          playerMode === "image"
            ? messages.ui.playerControlsImage
            : messages.ui.playerControlsMedia;
        ctx.fillText(
          fitText(controlsText, boxW),
          boxX,
          boxY + boxH + Math.floor(lineGap * 0.6),
        );
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
        ctx.fillText(messages.calc.hintLine1, pad + 12, height - 54);
        ctx.fillText(messages.calc.hintLine2, pad + 12, height - 36);
      } else if (mode === "doom") {
        // HELLRUN (./hellrun): raycaster with Freedoom art, its own HUD,
        // menus and fixed-step simulation. It owns the whole canvas.
        const game = hellrunRef.current;
        if (game) {
          const now = performance.now();
          const last = hellrunLastFrameRef.current || now;
          hellrunLastFrameRef.current = now;
          game.update(Math.min(250, now - last));
          game.render(ctx, 0, 0, width, height, now);
        }
      } else if (mode === "chess") {
        const board = chessBoardRef.current;
        const boardSize = 8;
        // Reserve room for the header line above and three text lines below
        // the board (controls, options, status), plus file/rank labels -
        // previously the board used the full height and the help text was
        // pushed off the screen.
        const labelGutter = Math.max(12, Math.floor(headerSize * 1.1));
        const lineGap = Math.max(16, Math.floor(headerSize * 1.45));
        const headerSpace = lineGap + 6;
        const footerSpace = lineGap * 3 + 8;
        const cellSize = Math.max(
          8,
          Math.floor(
            Math.min(
              (width - padding * 2 - labelGutter) / boardSize,
              (height - padding * 2 - headerSpace - footerSpace - labelGutter) /
                boardSize,
            ),
          ),
        );
        const boardW = cellSize * boardSize;
        const boardH = cellSize * boardSize;
        const offsetX = Math.floor((width - boardW + labelGutter) / 2);
        const offsetY = Math.floor(
          padding +
            headerSpace +
            (height -
              padding * 2 -
              headerSpace -
              footerSpace -
              labelGutter -
              boardH) /
              2,
        );
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
          offsetY - lineGap,
        );
        const cursor = chessCursorRef.current;
        const lastMove = chessLastMoveRef.current;
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
            if (
              lastMove &&
              ((lastMove.from.x === x && lastMove.from.y === y) ||
                (lastMove.to.x === x && lastMove.to.y === y))
            ) {
              ctx.fillStyle = "rgba(246, 194, 122, 0.16)";
              ctx.fillRect(
                offsetX + x * cellSize,
                offsetY + y * cellSize,
                cellSize,
                cellSize,
              );
            }
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
        // File (a-h) and rank (1-8) labels.
        const labelSize = Math.max(10, Math.floor(labelGutter * 0.72));
        ctx.font = `${labelSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.fillStyle = dim;
        for (let i = 0; i < boardSize; i += 1) {
          const file = String.fromCharCode(97 + i);
          const fileW = ctx.measureText(file).width;
          ctx.fillText(
            file,
            offsetX + i * cellSize + cellSize / 2 - fileW / 2,
            offsetY + boardH + 3,
          );
          const rank = String(8 - i);
          const rankW = ctx.measureText(rank).width;
          ctx.fillText(
            rank,
            offsetX - rankW - 6,
            offsetY + i * cellSize + cellSize / 2 - labelSize / 2,
          );
        }
        // Game over: dim the board and say clearly who won.
        const outcome = getChessOutcome();
        if (outcome) {
          const mono = `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
          ctx.fillStyle = "rgba(10, 9, 8, 0.8)";
          ctx.fillRect(offsetX, offsetY, boardW, boardH);
          const isBotGame = chessModeRef.current === "bot";
          const title =
            outcome.reason === "checkmate"
              ? messages.chess.checkmateTitle
              : outcome.reason === "stalemate"
                ? messages.chess.stalemateTitle
                : messages.chess.drawTitle;
          const result =
            outcome.winner === null
              ? messages.chess.drawResult
              : isBotGame
                ? outcome.winner === chessBotColorRef.current
                  ? messages.chess.botWins
                  : messages.chess.youWin
                : outcome.winner === "w"
                  ? messages.chess.whiteWins
                  : messages.chess.blackWins;
          const centerX = offsetX + boardW / 2;
          const centerY = offsetY + boardH / 2;
          const drawCentered = (text: string, y: number, size: number, color: string) => {
            ctx.font = `700 ${size}px ${mono}`;
            let w = ctx.measureText(text).width;
            let fontSize = size;
            while (w > boardW * 0.9 && fontSize > 10) {
              fontSize -= 2;
              ctx.font = `700 ${fontSize}px ${mono}`;
              w = ctx.measureText(text).width;
            }
            ctx.fillStyle = color;
            ctx.fillText(text, centerX - w / 2, y - fontSize / 2);
          };
          const titleSize = Math.max(18, Math.floor(cellSize * 0.85));
          const resultSize = Math.max(14, Math.floor(cellSize * 0.45));
          drawCentered(title, centerY - cellSize * 0.55, titleSize, "#ff8a1e");
          drawCentered(
            result,
            centerY + cellSize * 0.35,
            resultSize,
            outcome.winner !== null &&
              isBotGame &&
              outcome.winner === chessBotColorRef.current
              ? "#d6735b"
              : "#f4d35e",
          );
          drawCentered(
            messages.chess.newGameHint,
            centerY + cellSize * 1.05,
            Math.max(11, Math.floor(headerSize * 0.95)),
            "#c2a87f",
          );
        }
        ctx.font = `${headerSize}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
        const footerY = offsetY + boardH + labelGutter + 4;
        const footerX = Math.max(padding, offsetX - labelGutter);
        const fitText = (text: string, maxW: number) => {
          if (ctx.measureText(text).width <= maxW) {
            return text;
          }
          let cut = text;
          while (cut.length > 4 && ctx.measureText(`${cut}…`).width > maxW) {
            cut = cut.slice(0, -1);
          }
          return `${cut}…`;
        };
        const footerMaxW = width - footerX - padding;
        ctx.fillStyle = dim;
        ctx.fillText(
          fitText(messages.ui.chessControls, footerMaxW),
          footerX,
          footerY,
        );
        ctx.fillText(
          fitText(messages.ui.chessMeta, footerMaxW),
          footerX,
          footerY + lineGap,
        );
        if (chessStatusRef.current && !chessPendingPromotionRef.current) {
          ctx.fillStyle = accent;
          ctx.fillText(
            fitText(chessStatusRef.current, footerMaxW),
            footerX,
            footerY + lineGap * 2,
          );
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
            footerX,
            footerY + lineGap * 2,
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
      ctx.fillText(
        line.text,
        padding,
        padding + shellTopInset + index * lineHeight,
      );
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
      const y =
        padding + shellTopInset + (visibleOutput.length + index) * lineHeight;
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
        cursorVisibleRef.current &&
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
    getChessOutcome,
    language,
    listMediaFiles,
    resolveImagePlaylist,
    ensureEditorBuffer,
    normalizeEditorSelection,
    updateEditorScroll,
    fontScale,
    homePath,
    getChessLegalMoves,
    isChessInCheck,
    isFirefox,
    isMobile,
    perfTier,
    prompt,
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
        await new Promise((resolve) => setTimeout(resolve, 140));
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
      code?: string;
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
      if (mode === "doom") {
        // HELLRUN owns every key (Esc pauses, Q quits from the pause menu,
        // R restarts after death); key-ups are forwarded separately.
        const game = hellrunRef.current;
        if (!game) {
          stopApp(messages.system.exitLine);
          event.preventDefault();
          return true;
        }
        const handled = game.keyDown({
          key,
          code: event.code ?? "",
          shiftKey: event.shiftKey,
        });
        if (game.wantsExit) {
          stopApp(messages.system.exitLine);
        }
        if (handled) {
          event.preventDefault();
        }
        return handled;
      }
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
            editorStatusRef.current = messages.editor.copied;
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
            editorStatusRef.current = messages.editor.cut;
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
          (playerModeRef.current === "mp3" ||
            playerModeRef.current === "video") &&
          (key === "ArrowUp" ||
            key === "ArrowDown" ||
            lower === "n" ||
            lower === "p")
        ) {
          cycleTrack(key === "ArrowUp" || lower === "p" ? -1 : 1);
          event.preventDefault();
          return true;
        }
        if (
          playerModeRef.current === "image" &&
          (key === "ArrowLeft" ||
            key === "ArrowRight" ||
            key === "ArrowUp" ||
            key === "ArrowDown")
        ) {
          cycleImage(key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1);
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
          if (playerModeRef.current === "video") {
            // Endless demo: just move the demo clock.
            playerProgressRef.current = Math.max(
              0,
              playerProgressRef.current + delta,
            );
          } else {
            const next = clamp(
              playerProgressRef.current + delta,
              0,
              playerDurationRef.current,
            );
            playerProgressRef.current = next;
            musicPlayerRef.current?.seek(next);
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
        event.preventDefault();
        return true;
      }
      if (mode === "chess") {
        if (getChessOutcome()) {
          // Game over screen: Enter/Space starts a new game (R and Q are
          // handled above), every other key is ignored.
          if (key === "Enter" || key === " ") {
            resetChess();
            scheduleChessBotMove();
          }
          dirtyRef.current = true;
          event.preventDefault();
          return true;
        }
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
      getChessOutcome,
      attemptChessMove,
      cycleImage,
      cycleTrack,
      deleteEditorChar,
      deleteEditorSelection,
      ensureEditorBuffer,
      executeEditorCommand,
      getEditorSelectionText,
      getSolitaireRankIndex,
      isSolitaireRed,
      insertEditorNewline,
      insertEditorText,
      placeSnakeFood,
      resetCalc,
      resetChess,
      resetPacman,
      resetPong,
      resetSnake,
      resetSolitaire,
      scheduleChessBotMove,
      moveEditorCursor,
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
      // HELLRUN is a real-time game: redraw every display frame (capped at
      // ~30 fps on low-power devices) instead of the terminal's text cadence.
      const playingGame = appModeRef.current === "doom" && hellrunRef.current;
      if (playingGame) {
        dirtyRef.current = true;
      }
      const targetInterval = playingGame
        ? isMobile || perfTier === "low"
          ? 32
          : 0
        : focusedRef.current
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
        aria-label={messages.ui.inputLabel}
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
