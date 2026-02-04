export interface GridPoint { x: number; y: number }

export class PacmanGame {
    private grid: number[][] = [];
    private pos: GridPoint = { x: 1, y: 1 };
    private dir: GridPoint = { x: 1, y: 0 };
    private nextDir: GridPoint = { x: 1, y: 0 };
    private ghosts: { pos: GridPoint; dir: GridPoint; home: GridPoint; scared: number; color: string; style: string }[] = [];

    private score: number = 0;
    private pellets: number = 0;
    private power: number = 0;
    private scatter: number = 0;
    private won: boolean = false;
    private gameOver: boolean = false;

    private cols = 36;
    private rows = 20;

    constructor() {
        this.reset();
    }

    private buildGrid(cols: number, rows: number) {
        const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 2)); // 2 = pellet
        // Walls
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if (x === 0 || y === 0 || x === cols - 1 || y === rows - 1) grid[y][x] = 1;
            }
        }
        // Obstacles
        for (let y = 2; y < rows - 2; y += 4) {
            for (let x = 2; x < cols - 2; x++) {
                if (x % 6 === 0) continue;
                grid[y][x] = 1;
            }
        }
        for (let x = 3; x < cols - 3; x += 6) {
            for (let y = 2; y < rows - 2; y++) {
                if (y % 5 === 0) continue;
                grid[y][x] = 1;
            }
        }
        // Spawn Area
        const midRow = Math.floor(rows / 2);
        for (let x = 1; x < cols - 1; x++) grid[midRow][x] = 0;
        grid[midRow][0] = 0; grid[midRow][cols - 1] = 0;

        // More random complexity adaptation
        for (let y = 3; y < rows - 3; y += 5) {
            for (let x = 3; x < cols - 3; x += 7) {
                grid[y][x] = 1;
                if (grid[y + 1]?.[x] !== undefined) grid[y + 1][x] = 1;
            }
        }
        grid[1][1] = 0; grid[1][2] = 0; grid[2][1] = 0;

        // Power Pellets
        const powerPellets: GridPoint[] = [
            { x: cols - 2, y: 1 },
            { x: 1, y: rows - 2 },
            { x: cols - 2, y: rows - 2 },
            { x: Math.max(1, Math.floor(cols / 2)), y: 1 },
        ];
        powerPellets.forEach(cell => {
            if (this.isValid(cell.x, cell.y, grid) && grid[cell.y][cell.x] === 2) {
                grid[cell.y][cell.x] = 3;
            }
        });
        return grid;
    }

    private isValid(x: number, y: number, grid = this.grid) {
        return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length;
    }

    reset() {
        this.grid = this.buildGrid(this.cols, this.rows);
        this.pos = { x: 1, y: 1 };
        this.dir = { x: 1, y: 0 };
        this.nextDir = { x: 1, y: 0 };

        // Ghosts
        const resolveStart = (preferred: GridPoint) => {
            if (this.grid[preferred.y]?.[preferred.x] !== 1) return preferred;
            // Scan for empty
            for (let y = this.rows - 2; y >= 1; y--) {
                for (let x = this.cols - 2; x >= 1; x--) {
                    if (this.grid[y][x] !== 1) return { x, y };
                }
            }
            return { x: 1, y: 1 };
        };
        const starts = [
            resolveStart({ x: this.cols - 2, y: this.rows - 2 }),
            resolveStart({ x: this.cols - 2, y: 1 }),
            resolveStart({ x: Math.max(1, Math.floor(this.cols / 2)), y: this.rows - 2 })
        ];
        const colors = ["#d6735b", "#6fd68d", "#5bb5d6"];
        const styles = ["chase", "ambush", "random"];
        this.ghosts = starts.map((pos, i) => ({
            pos: { ...pos },
            dir: { x: -1, y: 0 },
            home: { ...pos },
            scared: 0,
            color: colors[i],
            style: styles[i]
        }));

        this.score = 0;
        this.won = false;
        this.gameOver = false;
        this.power = 0;
        this.scatter = 0;
        this.pellets = 0;
        this.grid.forEach(row => row.forEach(c => { if (c === 2 || c === 3) this.pellets++; }));
    }

    private wrap(x: number, y: number) {
        if (x < 0) return this.grid[y]?.[this.cols - 1] !== 1 ? this.cols - 1 : x;
        if (x >= this.cols) return this.grid[y]?.[0] !== 1 ? 0 : x;
        return x;
    }

    private getNextPos(origin: GridPoint, dir: GridPoint) {
        const ny = origin.y + dir.y;
        const nx = this.wrap(origin.x + dir.x, ny);
        return { x: nx, y: ny };
    }

    onInput(key: string) {
        const lower = key.toLowerCase();
        const map: Record<string, GridPoint> = {
            arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
            arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
            arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
            arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 }
        };
        if (map[lower]) {
            this.nextDir = map[lower];
        }
        if (this.won || this.gameOver) {
            if (key === "Enter" || key === " ") this.reset();
        }
    }

    private tickDelay = 0;

    tick(dt: number) {
        void dt;
        if (this.won || this.gameOver) return;

        // Slow down logic if using shared loop (60fps is too fast for grid pacman usually, unless lerping)
        // Original code seemed to run freely but maybe update rate was controlled?
        // Snake had a timer. Pacman likely needs one.
        this.tickDelay++;
        if (this.tickDelay < 8) return; // Run at ~7.5fps (60/8)
        this.tickDelay = 0;

        // Player Move
        const nextPos = this.getNextPos(this.pos, this.nextDir);
        if (this.grid[nextPos.y]?.[nextPos.x] !== 1) {
            this.dir = this.nextDir;
        }
        const movePos = this.getNextPos(this.pos, this.dir);
        if (this.grid[movePos.y]?.[movePos.x] !== 1) {
            this.pos = movePos;
            // Eat
            const cell = this.grid[this.pos.y][this.pos.x];
            if (cell === 2 || cell === 3) {
                this.grid[this.pos.y][this.pos.x] = 0;
                this.score += cell === 3 ? 5 : 1;
                this.pellets--;
                if (cell === 3) {
                    this.power = 60; // Steps duration
                    this.ghosts.forEach(g => {
                        g.scared = 60;
                        g.dir = { x: -g.dir.x, y: -g.dir.y };
                    });
                }
                if (this.pellets <= 0) this.won = true;
            }
        }

        if (this.power > 0) this.power--;
        this.scatter = (this.scatter + 1) % 400;
        const scatterMode = this.scatter < 80;

        // Ghost Move
        this.ghosts.forEach(ghost => {
            if (ghost.scared > 0) ghost.scared--;

            // Check Collision
            if (ghost.pos.x === this.pos.x && ghost.pos.y === this.pos.y) {
                if (ghost.scared > 0) {
                    this.score += 20;
                    ghost.pos = { ...ghost.home };
                    ghost.scared = 0;
                } else {
                    this.gameOver = true;
                }
            }
        });

        const dirs = [
            { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
        ];

        this.ghosts.forEach((ghost, i) => {
            // Check Collision again
            if (this.gameOver) return;

            const opts = dirs.filter(d => {
                const p = this.getNextPos(ghost.pos, d);
                return this.grid[p.y]?.[p.x] !== 1;
            });
            if (opts.length === 0) return;

            const reverse = { x: -ghost.dir.x, y: -ghost.dir.y };
            const nonReverse = opts.filter(d => d.x !== reverse.x || d.y !== reverse.y);
            const usable = nonReverse.length ? nonReverse : opts;

            // Target
            let target = this.pos;
            if (ghost.scared > 0) target = ghost.home; // Flee home-ish
            else if (scatterMode) target = ghost.home;
            else if (ghost.style === "ambush") {
                target = { ...this.pos, x: this.pos.x + this.dir.x * 2, y: this.pos.y + this.dir.y * 2 };
            } else if (ghost.style === "random") {
                target = { x: Math.floor(this.cols / 2) + (i - 1) * 3, y: Math.floor(this.rows / 2) };
            }

            // Choose best dir
            let best = usable[0];
            let bestDist = 99999;
            // If scared, maximize distance? Original code minimizes distance to target (where target is home/pos)
            // But if scared target should be away? Original code sets target=pos if scared? 
            // Wait, original: `target = ghost.scared > 0 ? pos : baseTarget`.
            // logic: `return candScore >= bestScore ? candidate : best` (Maximize distance to target if scared)
            // Ah, so target IS player when scared, but we MAXIMIZE distance.

            usable.forEach(d => {
                const p = this.getNextPos(ghost.pos, d);
                const dist = Math.abs(target.x - p.x) + Math.abs(target.y - p.y);
                if (ghost.scared > 0) {
                    if (dist > bestDist) { bestDist = dist; best = d; } // Maximize
                } else {
                    if (dist < bestDist) { bestDist = dist; best = d; } // Minimize
                }
            });
            // Flip for simple Max/Min logic (fix)
            // Re-reading original:
            /*
            if (ghost.scared > 0 || pacmanPowerRef.current > 0) {
                return candScore >= bestScore ? candidate : best;
            }
            return candScore <= bestScore ? candidate : best;
            */
            // Yes.

            // 35% Randomness
            if (Math.random() < 0.35) {
                best = usable[Math.floor(Math.random() * usable.length)];
            }

            // Move
            if (ghost.scared > 0 && this.scatter % 2 !== 0) {
                // Half speed
            } else {
                ghost.dir = best;
                ghost.pos = this.getNextPos(ghost.pos, best);
            }

            // Collision check post move
            if (ghost.pos.x === this.pos.x && ghost.pos.y === this.pos.y) {
                if (ghost.scared > 0) {
                    this.score += 20;
                    ghost.pos = { ...ghost.home };
                    ghost.scared = 0;
                } else {
                    this.gameOver = true;
                }
            }
        });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(ctx: CanvasRenderingContext2D, width: number, height: number, theme: any) {
        const cellSize = Math.floor(Math.min(width / (this.cols + 2), height / (this.rows + 6)));
        const boardW = this.cols * cellSize;
        const boardH = this.rows * cellSize;
        const offsetX = Math.floor((width - boardW) / 2);
        const offsetY = Math.floor((height - boardH) / 2);

        const accent = theme?.palette?.accent || "#ffeb3b";
        const wallColor = theme?.palette?.dim || "#555";
        const dotColor = "#f4d35e"; // yellow-ish

        // Draw Walls & Pellets
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const cell = this.grid[y][x];
                if (cell === 1) {
                    ctx.fillStyle = wallColor;
                    ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
                } else if (cell === 2) {
                    ctx.fillStyle = dotColor;
                    ctx.beginPath();
                    ctx.arc(offsetX + x * cellSize + cellSize / 2, offsetY + y * cellSize + cellSize / 2, 2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (cell === 3) {
                    ctx.fillStyle = dotColor;
                    ctx.beginPath();
                    ctx.arc(offsetX + x * cellSize + cellSize / 2, offsetY + y * cellSize + cellSize / 2, 6, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // Player
        ctx.fillStyle = "#ff0";
        ctx.beginPath();
        const px = offsetX + this.pos.x * cellSize + cellSize / 2;
        const py = offsetY + this.pos.y * cellSize + cellSize / 2;
        // Mouth animation could go here
        ctx.arc(px, py, cellSize / 2 - 2, 0.2 * Math.PI, 1.8 * Math.PI);
        ctx.lineTo(px, py);
        ctx.fill();

        // Ghosts
        this.ghosts.forEach(g => {
            ctx.fillStyle = g.scared > 0 ? "#aaf" : g.color;
            const gx = offsetX + g.pos.x * cellSize + 2;
            const gy = offsetY + g.pos.y * cellSize + 2;
            ctx.fillRect(gx, gy, cellSize - 4, cellSize - 4);
        });

        // HUD
        ctx.fillStyle = accent;
        ctx.font = "20px monospace";
        ctx.fillText(`SCORE: ${this.score}`, offsetX, offsetY - 20);

        if (this.gameOver) {
            ctx.fillStyle = "#f00";
            ctx.font = "40px monospace";
            ctx.textAlign = "center";
            ctx.fillText("GAME OVER", width / 2, height / 2);
            ctx.font = "20px monospace";
            ctx.fillText("Press ENTER", width / 2, height / 2 + 40);
        }
        if (this.won) {
            ctx.fillStyle = "#0f0";
            ctx.font = "40px monospace";
            ctx.textAlign = "center";
            ctx.fillText("YOU WIN!", width / 2, height / 2);
        }
    }
}
