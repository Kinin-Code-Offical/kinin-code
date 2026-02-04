import { Command } from "./Command";
import { TerminalEngine } from "../TerminalEngine";

export const Clear: Command = {
    name: "clear",
    description: "Clear terminal output",
    execute: (engine: TerminalEngine) => {
        engine.clear();
    }
};
