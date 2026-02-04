import { Program } from "../types";

export class MusicPlayer implements Program {
    private fileName: string;
    private progress = 0;
    private playing = true;

    constructor(fileName: string) {
        this.fileName = fileName;
    }

    onInput(key: string): void {
        if (key === " ") {
            this.playing = !this.playing;
        }
    }

    tick(dt: number): void {
        if (this.playing) {
            this.progress += dt * 0.0005;
            if (this.progress > 1) this.progress = 0; // Loop
        }
    }

    render(ctx: CanvasRenderingContext2D, width: number, height: number, theme: any): void {
        const cx = width / 2;
        const cy = height / 2;

        // Background
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);

        // Visualizer Bars (Fake)
        const barCount = 32;
        const barWidth = (width - 100) / barCount;
        ctx.fillStyle = theme.accent;

        for (let i = 0; i < barCount; i++) {
            // Noise height
            const h = Math.random() * 200 * (this.playing ? 1 : 0.1);
            ctx.fillRect(50 + i * barWidth, cy + 50 - h, barWidth - 4, h);
        }

        // Song Info
        ctx.fillStyle = theme.text;
        ctx.textAlign = "center";
        ctx.font = '32px "JetBrains Mono"';
        ctx.fillText(`♫ ${this.fileName} ♫`, cx, cy - 100);

        // Progress Bar
        ctx.fillStyle = theme.dim;
        ctx.fillRect(cx - 200, cy + 100, 400, 4);
        ctx.fillStyle = theme.accent;
        ctx.fillRect(cx - 200, cy + 100, 400 * this.progress, 4);

        ctx.textAlign = "left";
        ctx.font = '20px "JetBrains Mono"';
        ctx.fillText(this.playing ? "PLAYING" : "PAUSED", 50, height - 30);
        ctx.fillText("SPACE to toggle", width - 200, height - 30);
    }
}
