import { Command } from "./Command";
import { TerminalEngine } from "../TerminalEngine";

export const Cat: Command = {
    name: "cat",
    description: "Print file content",
    execute: (engine: TerminalEngine, args: string[]) => {
        const path = args[0];
        if (!path) {
            engine.println(
                engine.messages.commands?.catMissingOperand ?? "cat: missing file operand",
            );
            return;
        }

        const content = engine.fs.readFile(path);
        if (content !== null) {
            engine.println(content);
        } else {
            engine.println(
                engine.messages.fileNotFound.replace("{file}", path),
            );
        }
    }
};
