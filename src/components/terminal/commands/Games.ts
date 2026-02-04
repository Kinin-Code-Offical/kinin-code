import { Command } from "./Command";
import { TerminalEngine } from "../TerminalEngine";
import { SnakeGame } from "../programs/Snake";
import { PongGame } from "../programs/Pong";
import { ChessGame } from "../programs/Chess";
import { PacmanGame } from "../programs/Pacman";
import { TextProgram } from "../programs/TextProgram";

export const SnakeCmd: Command = {
    name: "snake",
    description: "Classic Snake Game",
    execute: (engine: TerminalEngine) => {
        engine.launchProgram(new SnakeGame(1024, 600), "snake");
    }
};

export const PongCmd: Command = {
    name: "pong",
    description: "Ping Pong Game",
    execute: (engine: TerminalEngine) => {
        engine.launchProgram(new PongGame(), "pong");
    }
};

export const ChessCmd: Command = {
    name: "chess",
    description: "Chess Game",
    execute: (engine: TerminalEngine) => {
        engine.launchProgram(new ChessGame(), "chess");
    }
};

export const PacmanCmd: Command = {
    name: "pacman",
    description: "Pacman Game",
    execute: (engine: TerminalEngine) => {
        engine.launchProgram(new PacmanGame(), "pacman");
    }
};

export const SolitaireCmd: Command = {
    name: "solitaire",
    description: "Solitaire Game",
    execute: (engine: TerminalEngine) => {
        engine.launchProgram(
            new TextProgram("SOLITAIRE", ["Feature moving to new system."]),
            "solitaire",
        );
    },
};

export const DoomCmd: Command = {
    name: "hellrun",
    description: "Retro FPS",
    execute: (engine: TerminalEngine) => {
        engine.launchProgram(
            new TextProgram("HELLRUN", ["Feature moving to new system."]),
            "hellrun",
        );
    },
};
