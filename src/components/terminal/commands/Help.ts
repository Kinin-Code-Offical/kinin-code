import { Command } from "./Command";
import { TerminalEngine } from "../TerminalEngine";

export const Help: Command = {
    name: "help",
    description: "List available commands",
    execute: (engine: TerminalEngine) => {
        engine.messages.help.forEach((line) => engine.println(line));
    }
};
