import { Command } from "./Command";
import { TerminalEngine } from "../TerminalEngine";
import { Nano } from "../programs/Nano";
import { ImageViewer } from "../programs/ImageViewer";
import { MusicPlayer } from "../programs/MusicPlayer";

export const NanoCmd: Command = {
    name: "nano",
    description: "Text Editor",
    execute: (engine: TerminalEngine, args: string[]) => {
        const file = args[0] || "untitled";
        const content = engine.fs.readFile(file) || "";
        engine.launchProgram(new Nano(file, content), "nano");
    }
};

export const ImageCmd: Command = {
    name: "image",
    description: "Image Viewer",
    execute: (engine: TerminalEngine, args: string[]) => {
        const file = args[0];
        if (!file) {
            engine.println("Usage: image <filename>");
            return;
        }
        engine.launchProgram(new ImageViewer(file), "image");
    }
};

export const Mp3Cmd: Command = {
    name: "mp3",
    description: "Music Player",
    execute: (engine: TerminalEngine, args: string[]) => {
        const file = args[0];
        if (!file) {
            engine.println("Usage: mp3 <filename>");
            return;
        }
        engine.launchProgram(new MusicPlayer(file), "mp3");
    }
};

export const VideoCmd: Command = {
    name: "video",
    description: "Video Viewer",
    execute: (engine: TerminalEngine, args: string[]) => {
        const file = args[0];
        if (!file) {
            engine.println("Usage: video <filename>");
            return;
        }
        const content = engine.fs.readFile(file);
        if (content === null) {
            engine.println(engine.messages.media?.videoNoMedia ?? "video: no media found (.vid)");
            return;
        }
        content.split("\n").forEach((line) => engine.println(line));
    },
};
