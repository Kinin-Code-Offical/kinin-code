import { Program, TerminalRenderTheme } from "../types";

export class TextProgram implements Program {
    private title: string;
    private lines: string[];

    constructor(title: string, lines: string[]) {
        this.title = title;
        this.lines = lines;
    }

    onInput(key: string) {
        if (key === "Escape") {
            return;
        }
    }

    tick(_dt: number) {
        void _dt;
    }

    render(
        ctx: CanvasRenderingContext2D,
        width: number,
        height: number,
        theme: TerminalRenderTheme,
    ) {
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = theme.text;
        ctx.font = '22px "JetBrains Mono"';
        ctx.textBaseline = "top";
        const pad = 32;
        ctx.fillText(this.title, pad, pad);
        ctx.font = '16px "JetBrains Mono"';
        this.lines.forEach((line, index) => {
            ctx.fillText(line, pad, pad + 36 + index * 22);
        });
    }
}
