"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

export type TerminalApi = {
  focus: () => void;
  blur: () => void;
  isFocused: () => boolean;
  texture: CanvasTexture;
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
  introLines: string[];
  prompt: string;
  helpText: string;
  theme: Theme;
  isMobile: boolean;
  onNavigate: (section: string) => void;
  onReady: (api: TerminalApi) => void;
  onFocusChange: (focused: boolean) => void;
};

type Line = {
  text: string;
  color?: string;
};

type FsNode =
  | { type: "dir"; children: Record<string, FsNode> }
  | { type: "file"; content: string };

const CURSOR = "█";

function buildFileTree(files: TerminalFile[]) {
  const root: FsNode = { type: "dir", children: {} };

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (i === parts.length - 1) {
        node.children[part] = { type: "file", content: file.content };
      } else {
        if (!node.children[part] || node.children[part].type !== "dir") {
          node.children[part] = { type: "dir", children: {} };
        }
        node = node.children[part] as { type: "dir"; children: Record<string, FsNode> };
      }
    }
  }

  return root;
}

function resolvePath(cwd: string, target: string) {
  if (target.startsWith("/")) {
    return target;
  }
  if (target === "..") {
    const parts = cwd.split("/").filter(Boolean);
    parts.pop();
    return `/${parts.join("/")}`;
  }
  if (target === ".") {
    return cwd;
  }
  const parts = cwd.split("/").filter(Boolean);
  const targetParts = target.split("/").filter(Boolean);
  return `/${[...parts, ...targetParts].join("/")}`;
}

function findNode(root: FsNode, path: string) {
  const parts = path.split("/").filter(Boolean);
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
}

function markdownToLines(text: string) {
  const lines: Line[] = [];
  const rawLines = text.split("\n");
  for (const raw of rawLines) {
    const line = raw.trimEnd();
    if (!line) {
      lines.push({ text: "" });
      continue;
    }
    if (line.startsWith("#")) {
      const clean = line.replace(/^#+\s*/, "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
      lines.push({ text: clean.toUpperCase() });
      continue;
    }
    if (line.startsWith("-")) {
      const clean = line.replace(/^-+\s*/, "").replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");
      lines.push({ text: `• ${clean}` });
      continue;
    }
    lines.push({
      text: line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)"),
    });
  }
  return lines;
}

export default function TerminalCanvas({
  files,
  introLines,
  prompt,
  helpText,
  theme,
  isMobile,
  onNavigate,
  onReady,
  onFocusChange,
}: TerminalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<CanvasTexture | null>(null);
  const linesRef = useRef<Line[]>([]);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const inputRef = useRef("");
  const scrollOffsetRef = useRef(0);
  const focusedRef = useRef(false);
  const cwdRef = useRef("/");
  const fsRef = useRef<FsNode>(buildFileTree(files));
  const [ready, setReady] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);

  const [terminalApi] = useState<TerminalApi>(() => ({
    focus: () => {
      focusedRef.current = true;
      onFocusChange(true);
    },
    blur: () => {
      focusedRef.current = false;
      onFocusChange(false);
    },
    isFocused: () => focusedRef.current,
    get texture() {
      return textureRef.current as CanvasTexture;
    },
  }));

  const size = useMemo(() => (isMobile ? 512 : 1024), [isMobile]);

  useEffect(() => {
    fsRef.current = buildFileTree(files);
  }, [files]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.width = size;
    canvas.height = size;
    const texture = new CanvasTexture(canvas);
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    textureRef.current = texture;
    onReady(terminalApi);
    setReady(true);
  }, [onReady, size, terminalApi]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 520);
    return () => window.clearInterval(interval);
  }, []);

  const appendLine = useCallback((text: string, color?: string) => {
    linesRef.current.push({ text, color });
  }, []);

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

  const runCommand = useCallback(
    (command: string) => {
      const [cmd, ...rest] = command.split(" ");
      const arg = rest.join(" ").trim();
      switch (cmd) {
        case "help":
          appendLine(helpText, theme.palette.terminalDim);
          break;
        case "show":
          if (arg === "-all") {
            appendLine(helpText, theme.palette.terminalDim);
            appendLine("Available files:", theme.palette.terminalText);
            files.forEach((file) => appendLine(file.path));
            appendLine(
              'Tip: show about.md / show projects.md / show contact.md',
              theme.palette.terminalDim,
            );
          } else {
            let targetPath = resolvePath(cwdRef.current, arg || "");
            if (arg && !arg.includes("/") && arg.endsWith(".md")) {
              const match = files.find((file) => file.path.endsWith(`/${arg}`));
              if (match) {
                targetPath = match.path;
              }
            }
            const node = findNode(fsRef.current, targetPath);
            if (!node || node.type !== "file") {
              appendLine(`File not found: ${arg}`, theme.palette.terminalDim);
              return;
            }
            const file = files.find((item) => item.path === targetPath);
            if (file?.section) {
              onNavigate(file.section);
            }
            markdownToLines(node.content).forEach((line) =>
              appendLine(line.text, line.color ?? theme.palette.terminalText),
            );
          }
          break;
        case "ls": {
          const node = findNode(fsRef.current, cwdRef.current);
          if (node && node.type === "dir") {
            appendLine(Object.keys(node.children).join(" "));
          }
          break;
        }
        case "cd": {
          const targetPath = resolvePath(cwdRef.current, arg || "/");
          const node = findNode(fsRef.current, targetPath);
          if (node && node.type === "dir") {
            cwdRef.current = targetPath || "/";
          } else {
            appendLine(`No such directory: ${arg}`, theme.palette.terminalDim);
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
          appendLine(`Hello, ${profileName()}!`, theme.palette.terminalText);
          break;
        case "mkdir":
          if (!arg) {
            appendLine("mkdir: missing name");
            break;
          }
          createDir(arg);
          break;
        case "touch":
          if (!arg) {
            appendLine("touch: missing name");
            break;
          }
          createFile(arg);
          break;
        default:
          appendLine(`Command not found: ${cmd}`, theme.palette.terminalDim);
      }
    },
    [
      appendLine,
      createDir,
      createFile,
      files,
      helpText,
      onNavigate,
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

    const width = canvas.width;
    const height = canvas.height;
    const padding = Math.floor(width * 0.06);
    const lineHeight = Math.floor(width * 0.035);
    const maxLines = Math.floor((height - padding * 2) / lineHeight);
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
      width * 0.8,
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);

    ctx.font = `${Math.floor(width * 0.032)}px "JetBrains Mono", monospace`;
    ctx.textBaseline = "top";

    const visibleLines = lines.slice(
      Math.max(0, lines.length - maxLines - scrollOffset),
      lines.length - scrollOffset,
    );

    const glow = isMobile ? theme.crt.glow * 0.6 : theme.crt.glow;
    visibleLines.forEach((line, index) => {
      ctx.fillStyle = line.color ?? theme.palette.terminalText;
      ctx.shadowColor = "rgba(255, 200, 140, 0.2)";
      ctx.shadowBlur = glow;
      ctx.fillText(line.text, padding, padding + index * lineHeight);
      ctx.shadowBlur = 0;
    });

    const promptLine = `${prompt} ${inputRef.current}${cursorVisible ? CURSOR : ""}`;
    ctx.fillStyle = theme.palette.terminalText;
    ctx.fillText(promptLine, padding, padding + visibleLines.length * lineHeight);

    ctx.globalAlpha = theme.crt.scanlineOpacity;
    ctx.fillStyle = "#000";
    const scanStep = isMobile ? 6 : 4;
    for (let y = 0; y < height; y += scanStep) {
      ctx.fillRect(0, y, width, 1);
    }
    ctx.globalAlpha = 1;

    ctx.globalAlpha = theme.crt.noiseOpacity;
    const noiseCount = isMobile ? 80 : 250;
    for (let i = 0; i < noiseCount; i += 1) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.2})`;
      ctx.fillRect(
        Math.random() * width,
        Math.random() * height,
        1 + Math.random() * 1.5,
        1 + Math.random() * 1.5,
      );
    }
    ctx.globalAlpha = 1;

    const glass = ctx.createLinearGradient(0, 0, width, height);
    glass.addColorStop(0, "rgba(255,255,255,0.06)");
    glass.addColorStop(0.4, "rgba(255,255,255,0)");
    glass.addColorStop(1, "rgba(255,255,255,0.08)");
    ctx.fillStyle = glass;
    ctx.fillRect(0, 0, width, height);

    textureRef.current.needsUpdate = true;
  }, [
    cursorVisible,
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
    let cancelled = false;

    const boot = async () => {
      for (const line of introLines) {
        if (cancelled) {
          return;
        }
        appendLine(line);
        await new Promise((resolve) => setTimeout(resolve, 320));
      }
      appendLine(`Welcome to ED-Linux 1.0 LTS`, theme.palette.terminalText);
      appendLine(`Scroll or type "help" to get started`, theme.palette.terminalDim);
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, [appendLine, introLines, ready, theme.palette.terminalDim, theme.palette.terminalText]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!focusedRef.current) {
        return;
      }

      if (event.key === "Escape") {
        focusedRef.current = false;
        onFocusChange(false);
        return;
      }

      if (event.key === "PageUp") {
        scrollOffsetRef.current = Math.min(scrollOffsetRef.current + 3, linesRef.current.length);
        event.preventDefault();
        return;
      }

      if (event.key === "PageDown") {
        scrollOffsetRef.current = Math.max(scrollOffsetRef.current - 3, 0);
        event.preventDefault();
        return;
      }

      if (event.key === "+" || event.key === "=") {
        scrollOffsetRef.current = Math.min(scrollOffsetRef.current + 2, linesRef.current.length);
        event.preventDefault();
        return;
      }

      if (event.key === "-") {
        scrollOffsetRef.current = Math.max(scrollOffsetRef.current - 2, 0);
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowUp") {
        const history = historyRef.current;
        if (!history.length) {
          return;
        }
        historyIndexRef.current = Math.min(
          historyIndexRef.current + 1,
          history.length - 1,
        );
        inputRef.current = history[history.length - 1 - historyIndexRef.current];
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowDown") {
        const history = historyRef.current;
        historyIndexRef.current = Math.max(historyIndexRef.current - 1, -1);
        inputRef.current =
          historyIndexRef.current === -1
            ? ""
            : history[history.length - 1 - historyIndexRef.current];
        event.preventDefault();
        return;
      }

      if (event.key === "Enter") {
        const command = inputRef.current.trim();
        appendLine(`${prompt} ${command}`, theme.palette.terminalText);
        inputRef.current = "";
        historyIndexRef.current = -1;
        if (command) {
          historyRef.current.push(command);
          runCommand(command);
        }
        event.preventDefault();
        return;
      }

      if (event.key === "Backspace") {
        inputRef.current = inputRef.current.slice(0, -1);
        event.preventDefault();
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
        inputRef.current += event.key;
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [appendLine, onFocusChange, prompt, runCommand, theme.palette.terminalText]);

  useEffect(() => {
    let rafId = 0;
    const drawLoop = () => {
      drawTerminal();
      rafId = requestAnimationFrame(drawLoop);
    };
    drawLoop();
    return () => cancelAnimationFrame(rafId);
  }, [drawTerminal]);

  return <canvas ref={canvasRef} className="terminal-canvas" />;
}
