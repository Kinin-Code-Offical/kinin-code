import { useRef, useState } from "react";
import { FileSystem } from "./FileSystem";
import { Command } from "./commands/Command";
import { Help } from "./commands/Help";
import { Clear } from "./commands/Clear";
import { Ls } from "./commands/Ls";
import { Cd } from "./commands/Cd";
import { Cat } from "./commands/Cat";
import {
    Alias,
    Cp,
    DateCmd,
    Echo,
    Env,
    ExportCmd,
    Find,
    Grep,
    Head,
    Hello,
    History,
    Man,
    Mkdir,
    Mv,
    Open,
    Pwd,
    Rm,
    Rmdir,
    SetCmd,
    Show,
    Tail,
    Touch,
    Tree,
    Uname,
    Unalias,
    Uptime,
    Which,
    Whoami,
    Less,
} from "./commands/Core";
import { NanoCmd, ImageCmd, Mp3Cmd, VideoCmd } from "./commands/Apps";
import {
    SnakeCmd,
    PongCmd,
    ChessCmd,
    PacmanCmd,
    SolitaireCmd,
    DoomCmd,
} from "./commands/Games";
import { CalcCmd, PipCmd, PythonCmd } from "./commands/Extras";
import { Program, TerminalConfig, TerminalMessages } from "./types";

export type TerminalMode = "shell" | "editor" | "game";

export class TerminalEngine {
    lines: string[] = [];
    cursor = { x: 0, y: 0 };
    mode: TerminalMode = "shell";
    prompt: string = "$";
    messages: TerminalMessages;
    homePath: string = "/";
    private initialized = false;
    history: string[] = [];
    env: Record<string, string> = {};
    alias: Record<string, string> = {};
    sessionStart = Date.now();
    onNavigateAction?: (section: string) => void;

    // FileSystem
    fs: FileSystem;

    // Commands
    commands: Map<string, Command> = new Map();

    // Active Program
    activeProgram: Program | null = null;
    activeProgramId: string | null = null;

    inputBuffer: string = "";

    constructor(config: TerminalConfig) {
        this.messages = config.messages;
        this.fs = new FileSystem(config.files, config.homePath);
        this.applyConfig(config, true);
        this.registerCommands();
    }

    applyConfig(config: TerminalConfig, reset = false) {
        this.prompt = config.prompt;
        this.messages = config.messages;
        this.homePath = config.homePath;
        this.onNavigateAction = config.onNavigateAction;
        this.fs = new FileSystem(config.files, config.homePath, this.fs?.cwd ?? config.homePath);
        if (!this.initialized || reset) {
            this.lines = [...config.introLines, this.promptLine()];
            this.inputBuffer = "";
            this.initialized = true;
        }
        if (!Object.keys(this.env).length) {
            const user = this.prompt.split("@")[0] || this.messages.system?.userFallback || "user";
            this.env = {
                USER: user,
                HOME: this.homePath,
                SHELL: "/bin/kinin",
                LANG: "en_US.UTF-8",
                PATH: "/usr/local/bin:/usr/bin:/bin",
                TERM: "kinin-term",
            };
        }
        if (!Object.keys(this.alias).length) {
            this.alias = {
                ll: "ls -al",
                la: "ls -a",
                l: "ls",
            };
        }
    }

    registerCommands() {
        const cmds = [
            Help, Clear, Ls, Cd, Cat, Less,
            Pwd, Echo, Mkdir, Touch, Rm, Rmdir, Mv, Cp,
            Head, Tail, Tree, Find, Grep,
            History, Env, ExportCmd, Alias, Unalias,
            Whoami, Uname, DateCmd, Uptime,
            Man, Which, SetCmd, Open, Show, Hello,
            NanoCmd, ImageCmd, Mp3Cmd, VideoCmd,
            CalcCmd, PythonCmd, PipCmd,
            SnakeCmd, PongCmd, ChessCmd, PacmanCmd, SolitaireCmd, DoomCmd
        ];
        cmds.forEach(c => this.commands.set(c.name, c));
    }

    println(text: string) {
        this.lines.push(text);
        if (this.lines.length > 100) this.lines.shift();
    }

    clear() {
        this.lines = [this.promptLine()];
        this.inputBuffer = "";
    }

    private formatMessage(template: string, vars: Record<string, string>) {
        return Object.entries(vars).reduce(
            (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
            template,
        );
    }

    private promptLine() {
        return `${this.prompt} `;
    }

    private tokenizeInput(input: string) {
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
                if (quote === char) {
                    quote = null;
                } else if (!quote) {
                    quote = char;
                } else {
                    current += char;
                }
                continue;
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
    }

    private expandEnv(value: string) {
        return value.replace(
            /\$(\w+)|\$\{([^}]+)\}/g,
            (_, key, braced) => this.env[key || braced] ?? "",
        );
    }

    launchProgram(program: Program, id: string) {
        this.mode = "game";
        this.activeProgram = program;
        this.activeProgramId = id;
        this.println(`Starting ${id}...`);
    }

    launch(commandLine: string) {
        if (!commandLine.trim()) return;
        this.history.push(commandLine);
        const tokens = this.tokenizeInput(commandLine).map((token) =>
            this.expandEnv(token),
        );
        if (!tokens.length) {
            return;
        }
        const aliasValue = this.alias[tokens[0]];
        if (aliasValue) {
            const expanded = this.tokenizeInput(aliasValue);
            tokens.splice(0, 1, ...expanded);
        }
        const cmdName = tokens[0].toLowerCase();
        const cmdArgs = tokens.slice(1);

        const command = this.commands.get(cmdName);
        if (command) {
            command.execute(this, cmdArgs);
        } else if (cmdName === "exit") {
            if (this.mode === "game") {
                this.mode = "shell";
                this.activeProgram = null;
                this.println("Exited program.");
            }
        } else {
            this.println(this.formatMessage(this.messages.commandNotFound, { cmd: cmdName }));
        }
    }

    handleInput(key: string) {
        if (this.mode === "game" && this.activeProgram) {
            if (key === "Escape") {
                // Emergency exit
                this.mode = "shell";
                this.activeProgram = null;
                this.inputBuffer = "";
                this.println("Program terminated.");
                this.println(this.promptLine());
            } else {
                this.activeProgram.onInput(key);
            }
        } else if (key === "Enter") {
            const cmd = this.inputBuffer;

            // Commit the current line
            this.lines[this.lines.length - 1] = this.promptLine() + cmd;

            this.inputBuffer = "";
            this.launch(cmd);

            if (this.mode === "shell") {
                this.println(this.promptLine()); // New prompt
            }
        } else if (key === "Backspace") {
            this.inputBuffer = this.inputBuffer.slice(0, -1);
            this.updateCurrentLine();
        } else if (key.length === 1) {
            this.inputBuffer += key;
            this.updateCurrentLine();
        }
    }

    updateCurrentLine() {
        // Replace last line with prompt + buffer
        if (this.lines.length > 0) {
            this.lines[this.lines.length - 1] = this.promptLine() + this.inputBuffer;
        }
    }
}


export function useTerminalEngine(config: TerminalConfig) {
    const engine = useRef(new TerminalEngine(config));
    const [revision, setRevision] = useState(0);

    const forceUpdate = () => setRevision(r => r + 1);

    if (engine.current) {
        engine.current.applyConfig(config);
    }

    return {
        engine: engine.current,
        forceUpdate,
        lines: engine.current.lines
    };
}
