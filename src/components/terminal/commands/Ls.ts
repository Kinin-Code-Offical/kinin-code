import { Command } from "./Command";
import { TerminalEngine } from "../TerminalEngine";

export const Ls: Command = {
    name: "ls",
    description: "List directory contents",
    execute: (engine: TerminalEngine, args: string[]) => {
        const all = args.includes("-a") || args.includes("-al") || args.includes("-la");
        const long = args.includes("-l") || args.includes("-al") || args.includes("-la");
        const target = args.find((arg) => !arg.startsWith("-"));
        const nodes = engine.fs.listDir(target);
        if (!nodes) {
            const name = target ?? engine.fs.cwd;
            engine.println(
                engine.messages.noSuchDirectory.replace("{dir}", name),
            );
            return;
        }
        const filtered = all
            ? nodes
            : nodes.filter((node) => !node.name.startsWith("."));
        if (long) {
            filtered.forEach((node) => {
                const type = node.type === "directory" ? "d" : "-";
                engine.println(`${type} ${node.name}`);
            });
            return;
        }
        const items = filtered.map((c) =>
            c.type === "directory" ? `${c.name}/` : c.name,
        );
        engine.println(items.join("  "));
    },
};
