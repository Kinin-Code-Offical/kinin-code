import { TerminalEngine } from "../TerminalEngine";

export interface Command {
    name: string;
    description: string;
    execute(engine: TerminalEngine, args: string[]): void | Promise<void>;
}
