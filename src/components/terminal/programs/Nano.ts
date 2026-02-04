import { Program } from "../types";

export class Nano implements Program {
    private fileName: string;
    private content: string[];
    private cursor = { x: 0, y: 0 };
    private offset = { x: 0, y: 0 };
    private isDirty = false;

    constructor(fileName: string, content: string = "") {
        this.fileName = fileName;
        this.content = content.split('\n');
        if (this.content.length === 0) this.content = [""];
    }

    onInput(key: string): void {
        if (key === "ArrowUp") {
            if (this.cursor.y > 0) this.cursor.y--;
        } else if (key === "ArrowDown") {
            if (this.cursor.y < this.content.length - 1) this.cursor.y++;
        } else if (key === "ArrowLeft") {
            if (this.cursor.x > 0) this.cursor.x--;
        } else if (key === "ArrowRight") {
            if (this.cursor.x < this.content[this.cursor.y].length) this.cursor.x++;
        } else if (key === "Enter") {
            const line = this.content[this.cursor.y];
            const before = line.slice(0, this.cursor.x);
            const after = line.slice(this.cursor.x);
            this.content[this.cursor.y] = before;
            this.content.splice(this.cursor.y + 1, 0, after);
            this.cursor.y++;
            this.cursor.x = 0;
            this.isDirty = true;
        } else if (key === "Backspace") {
            if (this.cursor.x > 0) {
                const line = this.content[this.cursor.y];
                this.content[this.cursor.y] = line.slice(0, this.cursor.x - 1) + line.slice(this.cursor.x);
                this.cursor.x--;
                this.isDirty = true;
            } else if (this.cursor.y > 0) {
                // Merge with previous line
                const current = this.content[this.cursor.y];
                const prev = this.content[this.cursor.y - 1];
                this.cursor.x = prev.length;
                this.content[this.cursor.y - 1] = prev + current;
                this.content.splice(this.cursor.y, 1);
                this.cursor.y--;
                this.isDirty = true;
            }
        } else if (key.length === 1) {
            const line = this.content[this.cursor.y];
            this.content[this.cursor.y] = line.slice(0, this.cursor.x) + key + line.slice(this.cursor.x);
            this.cursor.x++;
            this.isDirty = true;
        }
    }

    tick(dt: number): void {
        // Blink logic handled by renderer usually, or here
    }

    render(ctx: CanvasRenderingContext2D, width: number, height: number, theme: any): void {
        const lineHeight = 24;
        const charWidth = 14;
        const headerHeight = 40;
        const footerHeight = 40;

        // Header
        ctx.fillStyle = theme.accent;
        ctx.fillRect(0, 0, width, headerHeight);
        ctx.fillStyle = theme.bg;
        ctx.font = '20px "JetBrains Mono"';
        ctx.fillText(`  GNU nano 5.4              File: ${this.fileName}${this.isDirty ? "*" : ""}`, 10, 28);

        // Content Area
        const viewHeight = height - headerHeight - footerHeight;
        const maxLines = Math.floor(viewHeight / lineHeight);

        // Adjust scroll
        if (this.cursor.y < this.offset.y) this.offset.y = this.cursor.y;
        if (this.cursor.y >= this.offset.y + maxLines) this.offset.y = this.cursor.y - maxLines + 1;

        ctx.fillStyle = theme.text;
        ctx.font = '20px "JetBrains Mono"';

        for (let i = 0; i < maxLines; i++) {
            const lineIndex = this.offset.y + i;
            if (lineIndex >= this.content.length) break;

            ctx.fillText(this.content[lineIndex], 10, headerHeight + 5 + i * lineHeight);
        }

        // Cursor
        const cursorScreenY = headerHeight + 5 + (this.cursor.y - this.offset.y) * lineHeight;
        const cursorScreenX = 10 + this.cursor.x * (charWidth * 0.85); // Approx char width adjust

        if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.fillStyle = theme.text;
            ctx.fillRect(cursorScreenX, cursorScreenY, 10, 20);
        }

        // Footer
        ctx.fillStyle = theme.dim; // Grey footer?
        ctx.fillRect(0, height - footerHeight, width, footerHeight);
        ctx.fillStyle = theme.bg;
        ctx.fillText("^X Exit  ^O Write Out", 10, height - 12);
    }
}
