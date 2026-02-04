export interface PongState {
    board: { cols: number; rows: number };
    ball: { x: number; y: number };
    vel: { x: number; y: number };
    paddle: number;
    ai: number;
    score: { player: number; ai: number };
    lives: number;
    over: boolean;
}

export class PongGame {
    private cols = 28;
    private rows = 18;

    // State
    private ball = { x: 14, y: 9 };
    private vel = { x: 0.25, y: 0.25 }; // Slower unit velocity (grid based)
    private paddle = 10;
    private ai = 10;
    private score = { player: 0, ai: 0 };
    private lives = 3;
    private over = false;

    // Constants
    private paddleWidth = 6;

    constructor() {
        this.resetBall();
    }

    private clamp(val: number, min: number, max: number) {
        return Math.min(Math.max(val, min), max);
    }

    private resetBall() {
        this.ball = { x: this.cols / 2, y: this.rows / 2 };
        this.vel = {
            x: (Math.random() < 0.5 ? -1 : 1) * 0.25,
            y: (Math.random() < 0.5 ? -1 : 1) * 0.25
        };
    }

    onInput(key: string) {
        if (this.over) {
            if (key === "Enter" || key === " ") {
                // Restart
                this.lives = 3;
                this.score = { player: 0, ai: 0 };
                this.over = false;
                this.resetBall();
            }
            return;
        }

        const step = 2;
        if (key === "ArrowLeft" || key === "a") {
            this.paddle -= step;
        }
        if (key === "ArrowRight" || key === "d") {
            this.paddle += step;
        }
        this.paddle = this.clamp(this.paddle, 0, this.cols - this.paddleWidth);
    }

    tick(_dt: number) {
        void _dt;
        if (this.over) return;

        // Sub-steps for smoother physics at low frame rates if needed, 
        // but for now simple Euler integration per tick
        // Assuming dt is around 16ms, but we might just run logic per tick call
        // The original code ran in requestAnimationFrame which is ~60fps

        // Move Ball
        this.ball.x += this.vel.x;
        this.ball.y += this.vel.y;

        // Wall Bounce (Left/Right)
        if (this.ball.x <= 0) {
            this.ball.x = 0;
            this.vel.x *= -1;
        }
        if (this.ball.x >= this.cols - 1) {
            this.ball.x = this.cols - 1;
            this.vel.x *= -1;
        }

        // AI Logic
        const aiTarget = this.ball.x - this.paddleWidth / 2;
        const aiMove = Math.sign(aiTarget - this.ai) * 0.15; // Speed limit
        this.ai = this.clamp(this.ai + aiMove, 0, this.cols - this.paddleWidth);

        // Paddle Collision limits
        const aiY = 1;
        const playerY = this.rows - 2;

        // AI Collision (Top)
        if (this.ball.y <= aiY + 0.5) {
            if (this.ball.x >= this.ai - 1 && this.ball.x <= this.ai + this.paddleWidth + 1) {
                this.vel.y = Math.abs(this.vel.y); // Bounce down
                this.ball.y = aiY + 0.6;
                // Add some english/spin based on hit position
                this.vel.x += (Math.random() - 0.5) * 0.1;
            } else if (this.ball.y < 0) {
                // Player Scored
                this.score.player += 1;
                this.resetBall();
                this.vel.y = Math.abs(this.vel.y);
            }
        }

        // Player Collision (Bottom)
        if (this.ball.y >= playerY - 0.5) {
            if (this.ball.x >= this.paddle - 1 && this.ball.x <= this.paddle + this.paddleWidth + 1) {
                this.vel.y = -Math.abs(this.vel.y); // Bounce up
                this.ball.y = playerY - 0.6;
                this.vel.x += (Math.random() - 0.5) * 0.1;
            } else if (this.ball.y > this.rows - 1) {
                // AI Scored
                this.lives -= 1;
                if (this.lives <= 0) {
                    this.over = true;
                } else {
                    this.resetBall();
                    this.vel.y = -Math.abs(this.vel.y);
                }
            }
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(ctx: CanvasRenderingContext2D, width: number, height: number, theme: any) {
        // Calculate Grid
        // Use a fixed aspect ratio area in the center of the screen
        const cellSize = Math.min(Math.floor(width / (this.cols + 4)), Math.floor(height / (this.rows + 4)));
        const boardW = this.cols * cellSize;
        const boardH = this.rows * cellSize;
        const offsetX = Math.floor((width - boardW) / 2);
        const offsetY = Math.floor((height - boardH) / 2);

        // Colors
        const accent = theme?.palette?.accent || "#0f0";
        const dim = theme?.palette?.dim || "#444";
        const text = theme?.palette?.text || "#fff";
        const warn = "#d6735b";

        // Draw Header
        ctx.fillStyle = accent;
        ctx.font = "16px monospace";
        ctx.textAlign = "left";
        ctx.fillText(`P1: ${this.score.player}  AI: ${this.score.ai}  ♥ ${this.lives}`, offsetX, offsetY - 10);

        // Draw Arena Boundary
        ctx.strokeStyle = dim;
        ctx.lineWidth = 1;
        ctx.strokeRect(offsetX - 2, offsetY - 2, boardW + 4, boardH + 4);

        // Draw Player Paddle
        ctx.fillStyle = text;
        ctx.fillRect(
            offsetX + this.paddle * cellSize,
            offsetY + (this.rows - 2) * cellSize,
            this.paddleWidth * cellSize,
            cellSize * 0.6
        );

        // Draw AI Paddle
        ctx.fillStyle = dim; // Different color for AI
        ctx.fillRect(
            offsetX + this.ai * cellSize,
            offsetY + 1 * cellSize,
            this.paddleWidth * cellSize,
            cellSize * 0.6
        );

        // Draw Ball
        ctx.fillStyle = warn;
        ctx.beginPath();
        const ballScreenX = offsetX + this.ball.x * cellSize;
        const ballScreenY = offsetY + this.ball.y * cellSize;
        ctx.arc(ballScreenX, ballScreenY, cellSize * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Draw Game Over
        if (this.over) {
            ctx.fillStyle = warn;
            ctx.textAlign = "center";
            ctx.font = "bold 24px monospace";
            ctx.fillText("GAME OVER", width / 2, height / 2);
            ctx.font = "14px monospace";
            ctx.fillStyle = text;
            ctx.fillText("Press ENTER to restart", width / 2, height / 2 + 30);
        }
    }
}
