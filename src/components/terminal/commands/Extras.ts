import { Command } from "./Command";
import { TerminalEngine } from "../TerminalEngine";

const format = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce(
        (acc, [key, value]) => acc.replaceAll(`{${key}}`, value),
        template,
    );

const safeEval = (expression: string) => {
    const input = expression.replace(/\s+/g, "");
    if (!input) return 0;
    if (!/^[0-9+\-*/().,^a-zA-Z]*$/.test(input)) {
        throw new Error("invalid");
    }
    const replaced = input
        .replace(/\^/g, "**")
        .replace(/\bpi\b/gi, "Math.PI")
        .replace(/\be\b/gi, "Math.E")
        .replace(/\bsin\b/gi, "Math.sin")
        .replace(/\bcos\b/gi, "Math.cos")
        .replace(/\btan\b/gi, "Math.tan")
        .replace(/\bsqrt\b/gi, "Math.sqrt")
        .replace(/\blog\b/gi, "Math.log10")
        .replace(/\bln\b/gi, "Math.log");
    const fn = new Function(`return (${replaced});`);
    const result = fn();
    if (typeof result !== "number" || Number.isNaN(result)) {
        throw new Error("invalid");
    }
    return result;
};

export const CalcCmd: Command = {
    name: "calc",
    description: "Calculator",
    execute: (engine: TerminalEngine, args: string[]) => {
        if (!args.length) {
            engine.println(engine.messages.calc?.launch ?? "Launching calc...");
            engine.println(engine.messages.calc?.hintLine1 ?? "calc 2+2");
            engine.println(engine.messages.calc?.hintLine2 ?? "C: clear  Q: quit");
            return;
        }
        const expression = args.join(" ");
        try {
            const result = safeEval(expression);
            engine.println(String(result));
        } catch {
            engine.println(engine.messages.calc?.evalError ?? "calc: error evaluating expression");
        }
    },
};

export const PythonCmd: Command = {
    name: "python",
    description: "Python runtime",
    execute: (engine: TerminalEngine, args: string[]) => {
        const usage = engine.messages.python?.usage ?? "Usage: python -c <code> | python <file.py>";
        if (!args.length) {
            engine.println(usage);
            return;
        }
        if (args[0] === "-c") {
            const code = args.slice(1).join(" ");
            if (!code) {
                engine.println(engine.messages.python?.missingCode ?? "python: missing code after -c");
                return;
            }
            engine.println(engine.messages.python?.loading ?? "python: loading runtime...");
            engine.println("(python runtime not available in this build)");
            return;
        }
        const target = args[0];
        const content = engine.fs.readFile(target);
        if (content === null) {
            engine.println(format(engine.messages.python?.cantOpen ?? "python: can't open file '{file}'", { file: target }));
            return;
        }
        engine.println(engine.messages.python?.loading ?? "python: loading runtime...");
        engine.println("(python runtime not available in this build)");
        engine.println(content);
    },
};

export const PipCmd: Command = {
    name: "pip",
    description: "Pip (simulated)",
    execute: (engine: TerminalEngine, args: string[]) => {
        const sub = args[0] ?? "help";
        if (sub === "help") {
            engine.println(engine.messages.pip?.help ?? "pip help");
            return;
        }
        if (sub === "list" || sub === "freeze") {
            engine.println("pip 23.3.1");
            return;
        }
        if (sub === "install" || sub === "uninstall") {
            const pkg = args[1];
            if (!pkg) {
                engine.println(engine.messages.pip?.missingPackage ?? "pip: missing package name");
                return;
            }
            const template = sub === "install" ? engine.messages.pip?.installed : engine.messages.pip?.uninstalled;
            engine.println(format(template ?? "{pkg}", { pkg }));
            return;
        }
        engine.println(format(engine.messages.pip?.unknownCommand ?? "pip: unknown command '{cmd}'", { cmd: sub }));
    },
};
