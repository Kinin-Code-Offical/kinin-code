// src/components/terminal/programs/Snake.ts

export type GridPoint = { x: number; y: number };

export class SnakeGame {
    private width: number;
    private height: number;
    private cols: number = 24;
    private rows: number = 16;

    // Game State
    private body: GridPoint[] = [];
    private dir: GridPoint = { x: 1, y: 0 };
    private nextDir: GridPoint = { x: 1, y: 0 };
    private food: GridPoint | null = null;
    private alive: boolean = true;
    private won: boolean = false;
    private score: number = 0;

    // Scoring / Messages interface ideally passed in or handled by engine
    // For now we keep state internal

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.reset();
    }

    reset() {
        // Calculate grid size based on dimensions (approx 26px cells as per original)
        this.cols = Math.max(12, Math.min(32, Math.floor(this.width / 26)));
        this.rows = Math.max(12, Math.min(24, Math.floor(this.height / 26)));

        const startX = Math.floor(this.cols / 2);
        const startY = Math.floor(this.rows / 2);

        this.body = [
            { x: startX - 1, y: startY },
            { x: startX, y: startY },
            { x: startX + 1, y: startY },
        ];
        this.dir = { x: 1, y: 0 };
        this.nextDir = { x: 1, y: 0 };
        this.alive = true;
        this.won = false;
        this.score = 0;
        this.placeFood();
    }

    resize(width: number, height: number) {
        this.width = width;
        this.height = height;
        // Don't reset immediately on resize to avoid frustration, but grid computation changes.
        // For simplicity, we might just recompute bounds or reset if too broken.
        this.reset();
    }

    onInput(key: string) {
        if (!this.alive || this.won) {
            if (key === "Enter" || key === " ") {
                this.reset();
            }
            return;
        }

        const currentDir = this.dir;
        let newDir = null;

        if (key === "ArrowUp" || key === "w") newDir = { x: 0, y: -1 };
        if (key === "ArrowDown" || key === "s") newDir = { x: 0, y: 1 };
        if (key === "ArrowLeft" || key === "a") newDir = { x: -1, y: 0 };
        if (key === "ArrowRight" || key === "d") newDir = { x: 1, y: 0 };

        if (newDir) {
            // Prevent 180 turn
            if (currentDir.x + newDir.x === 0 && currentDir.y + newDir.y === 0) {
                return;
            }
            this.nextDir = newDir;
        }
    }

    private placeFood() {
        const maxTries = this.cols * this.rows;
        const occupySet = new Set(this.body.map(p => `${p.x},${p.y}`));

        for (let i = 0; i < maxTries; i++) {
            const x = Math.floor(Math.random() * this.cols);
            const y = Math.floor(Math.random() * this.rows);
            if (!occupySet.has(`${x},${y}`)) {
                this.food = { x, y };
                return;
            }
        }
        this.food = null; // No space left
    }

    tick() {
        if (!this.alive || this.won) return;

        this.dir = this.nextDir;
        const head = this.body[this.body.length - 1];
        const next = { x: head.x + this.dir.x, y: head.y + this.dir.y };

        // Wall collision
        if (next.x < 0 || next.y < 0 || next.x >= this.cols || next.y >= this.rows) {
            this.alive = false;
            return;
        }

        // Self collision
        if (this.body.some(p => p.x === next.x && p.y === next.y)) {
            this.alive = false;
            return;
        }

        this.body.push(next);

        // Food collision
        if (this.food && next.x === this.food.x && next.y === this.food.y) {
            this.score++;
            this.placeFood();
        } else {
            this.body.shift();
        }

        // Win condition
        if (this.body.length >= this.cols * this.rows) {
            this.won = true;
            this.alive = false;
        }
    }

    render(ctx: CanvasRenderingContext2D, width: number, height: number, theme: any) {
        // Background and border (Snake box)
        const pad = Math.floor(Math.min(width, height) * 0.1);
        const boxW = width - pad * 2;
        const boxH = height - pad * 2;

        ctx.strokeStyle = theme.dim;
        ctx.lineWidth = 2;
        ctx.strokeRect(pad, pad, boxW, boxH);

        // Title / Score
        ctx.fillStyle = theme.accent;
        ctx.font = '24px "JetBrains Mono"';
        ctx.fillText(`SNAKE  SCORE: ${this.score}`, pad + 12, pad + 32);

        if (!this.alive) {
            ctx.fillStyle = this.won ? "#6fd68d" : "#d6735b";
            ctx.fillText(this.won ? "YOU WON!" : "GAME OVER", pad + 12, pad + 64);
            ctx.fillStyle = theme.dim;
            ctx.fillText("Press ENTER to restart", pad + 12, pad + 96);
        } else {
            ctx.fillStyle = theme.dim;
            ctx.font = '14px "JetBrains Mono"';
            ctx.fillText("Arrows to move", pad + 12, pad + 64);
        }

        // Calculate cell size
        // We want to center the grid inside the box
        const availW = boxW - 24;
        const availH = boxH - 120; // Title area
        const startY = pad + 100;

        const cellW = Math.floor(availW / this.cols);
        const cellH = Math.floor(availH / this.rows);
        const size = Math.min(cellW, cellH);

        const offsetX = pad + 12 + Math.floor((availW - (size * this.cols)) / 2);
        const offsetY = startY + Math.floor((availH - (size * this.rows)) / 2);

        // Draw Grid Area (Optional background)
        ctx.fillStyle = "rgba(255,255,255,0.03)";
        ctx.fillRect(offsetX, offsetY, size * this.cols, size * this.rows);

        // Draw Food
        if (this.food) {
            ctx.fillStyle = "#d6735b"; // Red-ish for food
            ctx.fillRect(
                offsetX + this.food.x * size + 2,
                offsetY + this.food.y * size + 2,
                size - 4,
                size - 4
            );
        }

        // Draw Snake
        ctx.fillStyle = this.alive ? "#6fd68d" : theme.dim;
        this.body.forEach(part => {
            ctx.fillRect(
                offsetX + part.x * size + 1,
                offsetY + part.y * size + 1,
                size - 2,
                size - 2
            );
        });
    }
}
