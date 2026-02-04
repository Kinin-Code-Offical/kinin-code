import { Command } from "./Command";
import { TerminalEngine } from "../TerminalEngine";

export const Cd: Command = {
    name: "cd",
    description: "Change directory",
    execute: (engine: TerminalEngine, args: string[]) => {
        const path = args[0];
        const target = path ?? engine.fs.homePath;
        const ok = engine.fs.changeDir(target);
        if (!ok) {
            engine.println(
                engine.messages.noSuchDirectory.replace("{dir}", target),
            );
        }
    }
};
