import { Command } from "./Command";
import { TerminalEngine } from "../TerminalEngine";
import { FileSystemNode } from "../FileSystem";

const format = (template: string | undefined, vars: Record<string, string>) => {
    if (!template) {
        return "";
    }
    return Object.entries(vars).reduce(
        (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
        template,
    );
};

const formatDate = (date: Date) =>
    date.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.max(0, Math.floor(seconds % 60));
    const parts: string[] = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (!parts.length) parts.push(`${secs}s`);
    return parts.join(" ");
};

const listTree = (
    node: FileSystemNode,
    prefix: string,
    lines: string[],
    depth: number,
    maxDepth: number,
) => {
    if (maxDepth >= 0 && depth > maxDepth) {
        return;
    }
    if (node.type === "directory") {
        const children = node.children ?? [];
        children.forEach((child, index) => {
            const last = index === children.length - 1;
            const line = `${prefix}${last ? "└─" : "├─"}${child.name}${child.type === "directory" ? "/" : ""
                }`;
            lines.push(line);
            const nextPrefix = `${prefix}${last ? "  " : "│ "}`;
            listTree(child, nextPrefix, lines, depth + 1, maxDepth);
        });
    }
};

export const Pwd: Command = {
    name: "pwd",
    description: "Print working directory",
    execute: (engine: TerminalEngine) => {
        engine.println(engine.fs.cwd || "/");
    },
};

export const Echo: Command = {
    name: "echo",
    description: "Print text",
    execute: (engine: TerminalEngine, args: string[]) => {
        const redirectIndex = args.findIndex((arg) => arg === ">" || arg === ">>");
        if (redirectIndex >= 0) {
            const isAppend = args[redirectIndex] === ">>";
            const target = args[redirectIndex + 1];
            if (!target) {
                engine.println(engine.messages.commands?.echoMissingFile ?? "echo: missing file");
                return;
            }
            const text = args.slice(0, redirectIndex).join(" ");
            const ok = engine.fs.writeFile(target, text + "\n", {
                append: isAppend,
                create: true,
            });
            if (!ok) {
                engine.println(engine.messages.commands?.echoMissingFile ?? "echo: missing file");
            }
            return;
        }
        engine.println(args.join(" "));
    },
};

export const Mkdir: Command = {
    name: "mkdir",
    description: "Create directory",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (!args.length) {
            engine.println(engine.messages.mkdirMissing ?? "mkdir: name required");
            return;
        }
        const recursive = args.includes("-p");
        const targets = args.filter((arg) => arg !== "-p");
        targets.forEach((target) => {
            const ok = engine.fs.createDir(target, recursive);
            if (!ok) {
                engine.println(
                    format(engine.messages.commands?.mkdirCannotCreate, { dir: target }) ||
                    `mkdir: cannot create directory '${target}'`,
                );
            }
        });
    },
};

export const Touch: Command = {
    name: "touch",
    description: "Create file",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (!args.length) {
            engine.println(engine.messages.touchMissing ?? "touch: name required");
            return;
        }
        args.forEach((target) => {
            engine.fs.createFile(target);
        });
    },
};

export const Rm: Command = {
    name: "rm",
    description: "Remove file",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (!args.length) {
            engine.println(engine.messages.commands?.rmMissingOperand ?? "rm: missing operand");
            return;
        }
        const recursive = args.includes("-r") || args.includes("-rf") || args.includes("-fr");
        const targets = args.filter((arg) => !arg.startsWith("-"));
        targets.forEach((target) => {
            const removed = engine.fs.remove(target, recursive);
            if (removed === "not-empty") {
                engine.println(
                    format(engine.messages.commands?.rmIsDirectory, { path: target }) ||
                    `rm: ${target}: is a directory`,
                );
            } else if (!removed) {
                engine.println(format(engine.messages.fileNotFound, { file: target }));
            }
        });
    },
};

export const Rmdir: Command = {
    name: "rmdir",
    description: "Remove empty directory",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (!args.length) {
            engine.println(engine.messages.commands?.rmdirMissingOperand ?? "rmdir: missing operand");
            return;
        }
        args.forEach((target) => {
            const removed = engine.fs.remove(target, false);
            if (removed === "not-empty") {
                engine.println(
                    format(engine.messages.commands?.rmdirNotEmpty, { path: target }) ||
                    `rmdir: ${target}: directory not empty`,
                );
            } else if (!removed) {
                engine.println(format(engine.messages.noSuchDirectory, { dir: target }));
            }
        });
    },
};

export const Mv: Command = {
    name: "mv",
    description: "Move or rename",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (args.length < 2) {
            engine.println(engine.messages.commands?.mvMissingOperand ?? "mv: missing file operand");
            return;
        }
        const [source, dest] = args;
        const ok = engine.fs.move(source, dest);
        if (!ok) {
            engine.println(format(engine.messages.fileNotFound, { file: source }));
        }
    },
};

export const Cp: Command = {
    name: "cp",
    description: "Copy",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (args.length < 2) {
            engine.println(engine.messages.commands?.cpMissingOperand ?? "cp: missing file operand");
            return;
        }
        const [source, dest] = args;
        const ok = engine.fs.copy(source, dest);
        if (!ok) {
            engine.println(format(engine.messages.fileNotFound, { file: source }));
        }
    },
};

export const Less: Command = {
    name: "less",
    description: "View file",
    execute: (engine: TerminalEngine, args: string[]) => {
        const target = args[0];
        if (!target) {
            engine.println(
                format(engine.messages.commands?.catMissingOperand, {}) ||
                "cat: missing file operand",
            );
            return;
        }
        const content = engine.fs.readFile(target);
        if (content === null) {
            engine.println(format(engine.messages.fileNotFound, { file: target }));
            return;
        }
        content.split("\n").forEach((line) => engine.println(line));
    },
};

export const Head: Command = {
    name: "head",
    description: "Show file head",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (!args.length) {
            engine.println(format(engine.messages.commands?.headMissingOperand, { cmd: "head" }) || "head: missing file operand");
            return;
        }
        let count = 10;
        let target = args[0];
        if (args[0] === "-n" && args[1]) {
            count = Number.parseInt(args[1], 10) || 10;
            target = args[2];
        }
        if (!target) {
            engine.println(format(engine.messages.commands?.headMissingOperand, { cmd: "head" }) || "head: missing file operand");
            return;
        }
        const content = engine.fs.readFile(target);
        if (content === null) {
            engine.println(format(engine.messages.fileNotFound, { file: target }));
            return;
        }
        content.split("\n").slice(0, count).forEach((line) => engine.println(line));
    },
};

export const Tail: Command = {
    name: "tail",
    description: "Show file tail",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (!args.length) {
            engine.println(format(engine.messages.commands?.headMissingOperand, { cmd: "tail" }) || "tail: missing file operand");
            return;
        }
        let count = 10;
        let target = args[0];
        if (args[0] === "-n" && args[1]) {
            count = Number.parseInt(args[1], 10) || 10;
            target = args[2];
        }
        if (!target) {
            engine.println(format(engine.messages.commands?.headMissingOperand, { cmd: "tail" }) || "tail: missing file operand");
            return;
        }
        const content = engine.fs.readFile(target);
        if (content === null) {
            engine.println(format(engine.messages.fileNotFound, { file: target }));
            return;
        }
        const lines = content.split("\n");
        lines.slice(Math.max(0, lines.length - count)).forEach((line) => engine.println(line));
    },
};

export const Tree: Command = {
    name: "tree",
    description: "Directory tree",
    execute: (engine: TerminalEngine, args: string[]) => {
        let depth = -1;
        let target = engine.fs.cwd;
        const depthIndex = args.findIndex((arg) => arg === "-L");
        if (depthIndex >= 0 && args[depthIndex + 1]) {
            depth = Number.parseInt(args[depthIndex + 1], 10);
        }
        const targetArg = args.find((arg) => !arg.startsWith("-"));
        if (targetArg) {
            target = targetArg;
        }
        const node = engine.fs.getNode(target);
        if (!node || node.type !== "directory") {
            engine.println(format(engine.messages.noSuchDirectory, { dir: target }));
            return;
        }
        const lines: string[] = [];
        listTree(node, "", lines, 0, depth);
        if (!lines.length) {
            engine.println(engine.messages.system?.noOutput ?? "(no output)");
            return;
        }
        lines.forEach((line) => engine.println(line));
    },
};

export const Find: Command = {
    name: "find",
    description: "Find files",
    execute: (engine: TerminalEngine, args: string[]) => {
        const nameIndex = args.findIndex((arg) => arg === "-name");
        const pattern = nameIndex >= 0 ? args[nameIndex + 1] : undefined;
        const target = args[0] && !args[0].startsWith("-") ? args[0] : engine.fs.cwd;
        if (!pattern) {
            engine.println(engine.messages.commands?.grepMissing ?? "find: missing pattern");
            return;
        }
        const regex = new RegExp(pattern.replace(/\*/g, ".*"));
        const results = engine.fs.walk(target).filter(({ node }) => regex.test(node.name));
        if (!results.length) {
            engine.println(engine.messages.system?.noOutput ?? "(no output)");
            return;
        }
        results.forEach(({ path }) => engine.println(path || "/"));
    },
};

export const Grep: Command = {
    name: "grep",
    description: "Search content",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (args.length < 2) {
            engine.println(engine.messages.commands?.grepMissing ?? "grep: missing pattern or file");
            return;
        }
        const ignoreCase = args.includes("-i");
        const recursive = args.includes("-r");
        const filtered = args.filter((arg) => !arg.startsWith("-"));
        const pattern = filtered[0];
        const target = filtered[1];
        if (!pattern || !target) {
            engine.println(engine.messages.commands?.grepMissing ?? "grep: missing pattern or file");
            return;
        }
        const flags = ignoreCase ? "i" : "";
        const regex = new RegExp(pattern, flags);
        const node = engine.fs.getNode(target);
        if (!node) {
            engine.println(format(engine.messages.fileNotFound, { file: target }));
            return;
        }
        const matches: string[] = [];
        const visitFile = (fileNode: FileSystemNode, fullPath: string) => {
            if (fileNode.type !== "file") {
                return;
            }
            const content = fileNode.content ?? "";
            content.split("\n").forEach((line, index) => {
                if (regex.test(line)) {
                    matches.push(`${fullPath}:${index + 1}:${line}`);
                }
            });
        };
        if (node.type === "file") {
            visitFile(node, target);
        } else if (recursive) {
            engine.fs.walk(target, (child, fullPath) => {
                if (child.type === "file") {
                    visitFile(child, fullPath || "/");
                }
            });
        }
        if (!matches.length) {
            engine.println(engine.messages.system?.noOutput ?? "(no output)");
            return;
        }
        matches.forEach((line) => engine.println(line));
    },
};

export const History: Command = {
    name: "history",
    description: "Command history",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (args.includes("-c")) {
            engine.history = [];
            engine.println(engine.messages.system?.historyCleared ?? "history cleared");
            return;
        }
        if (!engine.history.length) {
            engine.println(engine.messages.system?.noOutput ?? "(no output)");
            return;
        }
        engine.history.forEach((entry, index) => {
            engine.println(`${index + 1}  ${entry}`);
        });
    },
};

export const Env: Command = {
    name: "env",
    description: "List env vars",
    execute: (engine: TerminalEngine) => {
        Object.entries(engine.env).forEach(([key, value]) => {
            engine.println(`${key}=${value}`);
        });
    },
};

export const ExportCmd: Command = {
    name: "export",
    description: "Set env var",
    execute: (engine: TerminalEngine, args: string[]) => {
        args.forEach((arg) => {
            const [key, ...rest] = arg.split("=");
            if (!key) return;
            engine.env[key] = rest.join("=");
        });
    },
};

export const Alias: Command = {
    name: "alias",
    description: "Define alias",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (!args.length) {
            Object.entries(engine.alias).forEach(([key, value]) => {
                const template = engine.messages.commands?.aliasDefinition;
                engine.println(format(template, { name: key, value }));
            });
            return;
        }
        args.forEach((arg) => {
            const [name, value] = arg.split("=");
            if (!name || value === undefined) {
                return;
            }
            engine.alias[name] = value.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
            const template = engine.messages.commands?.aliasDefinition;
            engine.println(format(template, { name, value: engine.alias[name] }));
        });
    },
};

export const Unalias: Command = {
    name: "unalias",
    description: "Remove alias",
    execute: (engine: TerminalEngine, args: string[]) => {
        args.forEach((arg) => {
            delete engine.alias[arg];
        });
    },
};

export const Whoami: Command = {
    name: "whoami",
    description: "Current user",
    execute: (engine: TerminalEngine) => {
        engine.println(engine.env.USER ?? "user");
    },
};

export const Uname: Command = {
    name: "uname",
    description: "System name",
    execute: (engine: TerminalEngine, args: string[]) => {
        const long = args.includes("-a");
        const { system } = engine.messages;
        if (!system) {
            engine.println(long ? "KininOS" : "KininOS");
            return;
        }
        engine.println(long ? system.unameLong : system.unameShort);
    },
};

export const DateCmd: Command = {
    name: "date",
    description: "Show date",
    execute: (engine: TerminalEngine) => {
        engine.println(formatDate(new Date()));
    },
};

export const Uptime: Command = {
    name: "uptime",
    description: "Show uptime",
    execute: (engine: TerminalEngine) => {
        const elapsed = (Date.now() - engine.sessionStart) / 1000;
        const template = engine.messages.system?.uptime ?? "uptime {time}";
        engine.println(format(template, { time: formatUptime(elapsed) }));
    },
};

export const Man: Command = {
    name: "man",
    description: "Manual",
    execute: (engine: TerminalEngine, args: string[]) => {
        const topic = args[0];
        if (!topic) {
            engine.println(engine.messages.commands?.manMissingTopic ?? "man: missing topic");
            return;
        }
        const manual = engine.messages.manuals?.[topic];
        if (!manual) {
            engine.println(format(engine.messages.commands?.manNoEntry, { topic }) || `No manual entry for ${topic}`);
            return;
        }
        manual.forEach((line) => engine.println(line));
    },
};

export const Which: Command = {
    name: "which",
    description: "Show command path",
    execute: (engine: TerminalEngine, args: string[]) => {
        const target = args[0];
        if (!target) {
            engine.println(engine.messages.commands?.whichMissing ?? "which: missing command");
            return;
        }
        if (engine.commands.has(target)) {
            engine.println(format(engine.messages.commands?.whichBuiltin, { cmd: target }) || `${target}: builtin`);
            return;
        }
        engine.println(format(engine.messages.commands?.whichNotFound, { cmd: target }) || `${target}: not found`);
    },
};

export const PwdAlias: Command = Pwd;

export const SetCmd: Command = {
    name: "set",
    description: "Set or list env",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (!args.length) {
            Object.entries(engine.env).forEach(([key, value]) => {
                engine.println(`${key}=${value}`);
            });
            return;
        }
        args.forEach((arg) => {
            const [key, ...rest] = arg.split("=");
            if (!key) return;
            engine.env[key] = rest.join("=");
        });
    },
};

export const Open: Command = {
    name: "open",
    description: "Open section",
    execute: (engine: TerminalEngine, args: string[]) => {
        const target = args[0];
        if (!target) {
            engine.println(format(engine.messages.fileNotFound, { file: "" }));
            return;
        }
        const node = engine.fs.getNode(target);
        const section = node?.section;
        if (section && engine.onNavigateAction) {
            engine.onNavigateAction(section);
            return;
        }
        engine.println(format(engine.messages.fileNotFound, { file: target }));
    },
};

export const Show: Command = {
    name: "show",
    description: "Show section",
    execute: (engine: TerminalEngine, args: string[]) => {
        Open.execute(engine, args);
    },
};

export const Hello: Command = {
    name: "hello",
    description: "Greet",
    execute: (engine: TerminalEngine) => {
        const template = engine.messages.hello ?? "Hello, {name}!";
        const name = engine.env.USER ?? "user";
        engine.println(format(template, { name }));
    },
};
