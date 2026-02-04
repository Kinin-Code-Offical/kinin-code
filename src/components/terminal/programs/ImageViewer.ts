import { Program } from "../types";

export class ImageViewer implements Program {
    private fileName: string;
    // In a real app we'd load an Image bitmap here

    constructor(fileName: string) {
        this.fileName = fileName;
    }

    onInput(key: string): void {
        // q to quit handled by engine or here? Engine handles Esc.
    }

    tick(dt: number): void { }

    render(ctx: CanvasRenderingContext2D, width: number, height: number, theme: any): void {
        // Draw UI
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);

        // Frame
        ctx.strokeStyle = theme.dim;
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 20, width - 40, height - 80);

        // "Image"
        ctx.fillStyle = "#222";
        ctx.fillRect(30, 30, width - 60, height - 100);

        // Placeholder graphic (X)
        ctx.strokeStyle = theme.accent;
        ctx.beginPath();
        ctx.moveTo(30, 30);
        ctx.lineTo(width - 30, height - 70);
        ctx.moveTo(width - 30, 30);
        ctx.lineTo(30, height - 70);
        ctx.stroke();

        // Footer
        ctx.fillStyle = theme.text;
        ctx.font = '20px "JetBrains Mono"';
        ctx.fillText(`Viewing: ${this.fileName} [100%]`, 20, height - 30);
        ctx.fillStyle = theme.dim;
        ctx.fillText("Press ESC to close", width - 200, height - 30);
    }
}
