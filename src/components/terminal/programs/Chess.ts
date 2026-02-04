export interface GridPoint { x: number; y: number }

export class ChessGame {
    private board: string[][] = [];
    private cursor: GridPoint = { x: 0, y: 7 };
    private selected: GridPoint | null = null;
    private turn: "w" | "b" = "w";
    private movesCount: number = 0;
    private status: string | null = "Select a piece";
    private mode: "pvp" | "bot" = "pvp";
    private botColor: "w" | "b" = "b";
    private difficulty: "easy" | "medium" | "hard" = "medium";
    private botThinking: boolean = false;
    private castling = { wK: true, wQ: true, bK: true, bQ: true };
    private enPassant: GridPoint | null = null;
    private pendingPromotion: { x: number; y: number; color: "w" | "b"; nextTurn: "w" | "b" } | null = null;
    private promotionChoice: number = 0;

    private moveTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.reset();
    }

    reset() {
        this.board = [
            ["r", "n", "b", "q", "k", "b", "n", "r"],
            ["p", "p", "p", "p", "p", "p", "p", "p"],
            ["", "", "", "", "", "", "", ""],
            ["", "", "", "", "", "", "", ""],
            ["", "", "", "", "", "", "", ""],
            ["", "", "", "", "", "", "", ""],
            ["P", "P", "P", "P", "P", "P", "P", "P"],
            ["R", "N", "B", "Q", "K", "B", "N", "R"],
        ];
        this.cursor = { x: 0, y: 7 };
        this.selected = null;
        this.turn = "w";
        this.movesCount = 0;
        this.status = "Select a piece (Arrow keys + Enter)";
        this.botThinking = false;
        this.castling = { wK: true, wQ: true, bK: true, bQ: true };
        this.enPassant = null;
        this.pendingPromotion = null;
    }

    private getColor(piece: string): "w" | "b" | null {
        if (!piece) return null;
        return piece === piece.toUpperCase() ? "w" : "b";
    }

    private inBounds(x: number, y: number) {
        return x >= 0 && x < 8 && y >= 0 && y < 8;
    }

    private getAttackSquares(board: string[][], x: number, y: number): GridPoint[] {
        const piece = board[y]?.[x] ?? "";
        const color = this.getColor(piece);
        if (!piece || !color) return [];

        const moves: GridPoint[] = [];
        const addMove = (nx: number, ny: number) => {
            if (!this.inBounds(nx, ny)) return false;
            moves.push({ x: nx, y: ny });
            const target = board[ny]?.[nx] ?? "";
            return !target; // continue ray if empty
        };
        const addRay = (dx: number, dy: number) => {
            let nx = x + dx;
            let ny = y + dy;
            while (this.inBounds(nx, ny)) {
                moves.push({ x: nx, y: ny });
                const target = board[ny]?.[nx] ?? "";
                if (target) break; // hit piece
                nx += dx;
                ny += dy;
            }
        };

        const lower = piece.toLowerCase();
        if (lower === "p") {
            const dir = color === "w" ? -1 : 1;
            const left = { x: x - 1, y: y + dir };
            const right = { x: x + 1, y: y + dir };
            if (this.inBounds(left.x, left.y)) moves.push(left);
            if (this.inBounds(right.x, right.y)) moves.push(right);
            return moves;
        }
        if (lower === "n") {
            const jumps = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
            jumps.forEach(([dx, dy]) => addMove(x + dx, y + dy));
            return moves;
        }
        if (lower === "b" || lower === "q") {
            addRay(1, 1); addRay(1, -1); addRay(-1, 1); addRay(-1, -1);
        }
        if (lower === "r" || lower === "q") {
            addRay(1, 0); addRay(-1, 0); addRay(0, 1); addRay(0, -1);
        }
        if (lower === "k") {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    addMove(x + dx, y + dy);
                }
            }
        }
        return moves;
    }

    private isSquareAttacked(board: string[][], target: GridPoint, byColor: "w" | "b") {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const piece = board[y]?.[x] ?? "";
                const color = this.getColor(piece);
                if (!piece || color !== byColor) continue;
                const attacks = this.getAttackSquares(board, x, y);
                if (attacks.some(m => m.x === target.x && m.y === target.y)) return true;
            }
        }
        return false;
    }

    private getMoves(board: string[][], x: number, y: number): GridPoint[] {
        const piece = board[y]?.[x] ?? "";
        const color = this.getColor(piece);
        if (!piece || !color) return [];

        const moves: GridPoint[] = [];
        const addMove = (nx: number, ny: number) => {
            if (!this.inBounds(nx, ny)) return false;
            const target = board[ny]?.[nx] ?? "";
            const targetColor = this.getColor(target);
            if (target && targetColor === color) return false; // blocked by self
            moves.push({ x: nx, y: ny });
            return !target;
        };
        const addRay = (dx: number, dy: number) => {
            let nx = x + dx;
            let ny = y + dy;
            while (this.inBounds(nx, ny)) {
                const target = board[ny]?.[nx] ?? "";
                const targetColor = this.getColor(target);
                if (target && targetColor === color) break;
                moves.push({ x: nx, y: ny });
                if (target) break; // capture
                nx += dx;
                ny += dy;
            }
        };

        const lower = piece.toLowerCase();
        if (lower === "p") {
            const dir = color === "w" ? -1 : 1;
            const startRow = color === "w" ? 6 : 1;
            const oneY = y + dir;
            if (this.inBounds(x, oneY) && !board[oneY]?.[x]) {
                moves.push({ x, y: oneY });
                const twoY = y + dir * 2;
                if (y === startRow && !board[twoY]?.[x]) moves.push({ x, y: twoY });
            }
            // Captures
            const offsets = [{ x: -1, y: dir }, { x: 1, y: dir }];
            offsets.forEach(off => {
                const nx = x + off.x;
                const ny = y + off.y;
                if (!this.inBounds(nx, ny)) return;
                const target = board[ny]?.[nx] ?? "";
                const targetColor = this.getColor(target);
                if (target && targetColor && targetColor !== color) {
                    moves.push({ x: nx, y: ny });
                    return;
                }
                if (this.enPassant && this.enPassant.x === nx && this.enPassant.y === ny) {
                    moves.push({ x: nx, y: ny });
                }
            });
            return moves;
        }
        // Logic same as attack squares for others
        if (lower === "n") {
            const jumps = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
            jumps.forEach(([dx, dy]) => addMove(x + dx, y + dy));
            return moves;
        }
        if (lower === "b" || lower === "q") {
            addRay(1, 1); addRay(1, -1); addRay(-1, 1); addRay(-1, -1);
        }
        if (lower === "r" || lower === "q") {
            addRay(1, 0); addRay(-1, 0); addRay(0, 1); addRay(0, -1);
        }
        if (lower === "k") {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    addMove(x + dx, y + dy);
                }
            }
        }
        return moves;
    }

    private inCheck(board: string[][], color: "w" | "b") {
        let kingPos: GridPoint | null = null;
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const p = board[y]?.[x] ?? "";
                if (p && p.toLowerCase() === "k" && this.getColor(p) === color) {
                    kingPos = { x, y };
                }
            }
        }
        if (!kingPos) return false;
        const enemy = color === "w" ? "b" : "w";
        return this.isSquareAttacked(board, kingPos, enemy);
    }

    private applyMove(board: string[][], from: GridPoint, to: GridPoint) {
        const clone = board.map(row => row.slice());
        const piece = clone[from.y]?.[from.x] ?? "";
        const color = this.getColor(piece);
        if (!piece) return clone;

        const lower = piece.toLowerCase();
        const isEnPassant = lower === "p" && from.x !== to.x && !clone[to.y]?.[to.x];

        clone[from.y][from.x] = "";
        clone[to.y][to.x] = piece;

        if (isEnPassant) {
            const dir = color === "w" ? 1 : -1;
            clone[to.y + dir][to.x] = "";
        }
        if (lower === "k" && Math.abs(to.x - from.x) === 2) {
            // Castling
            const rookFromX = to.x > from.x ? 7 : 0;
            const rookToX = to.x > from.x ? to.x - 1 : to.x + 1;
            const rook = clone[from.y][rookFromX];
            clone[from.y][rookFromX] = "";
            clone[from.y][rookToX] = rook;
        }
        return clone;
    }

    private getLegalMoves(board: string[][], x: number, y: number): GridPoint[] {
        const piece = board[y]?.[x] ?? "";
        const color = this.getColor(piece);
        if (!piece || !color) return [];

        const moves = this.getMoves(board, x, y);
        const lower = piece.toLowerCase();

        // Castling logic (simplified check)
        if (lower === "k" && !this.inCheck(board, color)) {
            const isWhite = color === "w";
            const rank = isWhite ? 7 : 0;
            const rights = this.castling;
            const enemy = isWhite ? "b" : "w";

            if (x === 4 && y === rank) {
                if (isWhite ? rights.wK : rights.bK) {
                    if (!board[rank][5] && !board[rank][6] &&
                        !this.isSquareAttacked(board, { x: 5, y: rank }, enemy) &&
                        !this.isSquareAttacked(board, { x: 6, y: rank }, enemy)) {
                        moves.push({ x: 6, y: rank });
                    }
                }
                if (isWhite ? rights.wQ : rights.bQ) {
                    if (!board[rank][3] && !board[rank][2] && !board[rank][1] &&
                        !this.isSquareAttacked(board, { x: 3, y: rank }, enemy) &&
                        !this.isSquareAttacked(board, { x: 2, y: rank }, enemy)) {
                        moves.push({ x: 2, y: rank });
                    }
                }
            }
        }

        return moves.filter(move => {
            const next = this.applyMove(board, { x, y }, move);
            return !this.inCheck(next, color);
        });
    }

    private hasLegalMoves(board: string[][], color: "w" | "b") {
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const p = board[y]?.[x] ?? "";
                if (this.getColor(p) === color && this.getLegalMoves(board, x, y).length > 0) return true;
            }
        }
        return false;
    }

    private attemptMove(from: GridPoint, to: GridPoint): boolean {
        if (this.pendingPromotion) return false;

        const piece = this.board[from.y]?.[from.x] ?? "";
        if (!piece) return false;
        const color = this.getColor(piece);
        if (color !== this.turn) {
            this.status = "Not your turn!";
            return false;
        }

        const legal = this.getLegalMoves(this.board, from.x, from.y);
        if (!legal.some(m => m.x === to.x && m.y === to.y)) {
            this.status = "Illegal move!";
            return false;
        }

        const nextBoard = this.applyMove(this.board, from, to);
        // Update Castling Rights
        const lower = piece.toLowerCase();
        const isWhite = color === "w";
        if (lower === "k") {
            if (isWhite) { this.castling.wK = false; this.castling.wQ = false; }
            else { this.castling.bK = false; this.castling.bQ = false; }
        }
        if (lower === "r") {
            if (isWhite && from.y === 7) {
                if (from.x === 0) this.castling.wQ = false;
                if (from.x === 7) this.castling.wK = false;
            }
            if (!isWhite && from.y === 0) {
                if (from.x === 0) this.castling.bQ = false;
                if (from.x === 7) this.castling.bK = false;
            }
        }
        // Promotion?
        const promoteRow = isWhite ? 0 : 7;
        const isPromotion = lower === "p" && to.y === promoteRow;

        this.board = nextBoard;
        this.enPassant = null;
        if (lower === "p" && Math.abs(to.y - from.y) === 2) {
            this.enPassant = { x: from.x, y: (from.y + to.y) / 2 };
        }

        if (isPromotion) {
            if (this.mode === "bot" && this.turn === this.botColor) {
                this.board[to.y][to.x] = isWhite ? "Q" : "q"; // Auto queen for bot
                this.finalizeTurn();
            } else {
                this.pendingPromotion = { x: to.x, y: to.y, color: color!, nextTurn: isWhite ? "b" : "w" };
                this.status = "Select Promotion (Arrow Keys + Enter)";
            }
        } else {
            this.finalizeTurn();
        }
        return true;
    }

    private finalizeTurn() {
        this.turn = this.turn === "w" ? "b" : "w";
        this.movesCount++;
        const enemy = this.turn;
        const inCheck = this.inCheck(this.board, enemy);
        if (!this.hasLegalMoves(this.board, enemy)) {
            this.status = inCheck ? "Checkmate!" : "Stalemate!";
        } else {
            this.status = inCheck ? "Check!" : null;
        }

        if (this.mode === "bot" && this.turn === this.botColor && !this.status?.includes("mate")) {
            this.scheduleBot();
        }
    }

    private scheduleBot() {
        if (this.botThinking) return;
        this.botThinking = true;
        this.status = "Thinking...";
        // Need to run this async to not block render
        // In this architecture, tick() is called every frame
        // We can use a simple simpler timer check in tick or just bare minimum timeout in attemptMove
        // But since this is a class, we cant use setTimeout easily without binding? We can.
        setTimeout(() => {
            this.runBot();
        }, 100);
    }

    private runBot() {
        // Simple Random Bot for now to save space/time, or rudimentary evaluation
        const moves: { from: GridPoint, to: GridPoint, score: number }[] = [];
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                if (this.getColor(this.board[y][x]) === this.botColor) {
                    const legals = this.getLegalMoves(this.board, x, y);
                    legals.forEach(to => {
                        const target = this.board[to.y]?.[to.x];
                        let score = target ? 10 : 0; // Capture bias
                        // Center bias
                        score += (3.5 - Math.abs(3.5 - to.x)) + (3.5 - Math.abs(3.5 - to.y));
                        moves.push({ from: { x, y }, to, score });
                    });
                }
            }
        }

        if (moves.length > 0) {
            moves.sort((a, b) => b.score - a.score);
            // Pick top 3 random
            const top = moves.slice(0, 3);
            const choice = top[Math.floor(Math.random() * top.length)];
            this.attemptMove(choice.from, choice.to);
        }
        this.botThinking = false;
        // status updated in finalizeTurn
    }

    onInput(key: string) {
        if (this.pendingPromotion) {
            const options = ["q", "r", "b", "n"];
            if (key === "ArrowLeft" || key === "ArrowUp") {
                this.promotionChoice = (this.promotionChoice + 3) % 4;
            }
            if (key === "ArrowRight" || key === "ArrowDown") {
                this.promotionChoice = (this.promotionChoice + 1) % 4;
            }
            if (key === "Enter" || key === " ") {
                const choice = options[this.promotionChoice];
                const pp = this.pendingPromotion;
                this.board[pp.y][pp.x] = pp.color === "w" ? choice.toUpperCase() : choice;
                this.pendingPromotion = null;
                this.finalizeTurn();
            }
            return;
        }

        if (key === "ArrowUp") this.cursor.y = Math.max(0, this.cursor.y - 1);
        if (key === "ArrowDown") this.cursor.y = Math.min(7, this.cursor.y + 1);
        if (key === "ArrowLeft") this.cursor.x = Math.max(0, this.cursor.x - 1);
        if (key === "ArrowRight") this.cursor.x = Math.min(7, this.cursor.x + 1);

        if (key === "Enter" || key === " ") {
            if (this.selected) {
                // Move
                if (this.selected.x === this.cursor.x && this.selected.y === this.cursor.y) {
                    this.selected = null; // Deselect
                } else {
                    const success = this.attemptMove(this.selected, this.cursor);
                    if (success) this.selected = null;
                }
            } else {
                // Select
                const piece = this.board[this.cursor.y][this.cursor.x];
                if (piece && this.getColor(piece) === this.turn) {
                    this.selected = { ...this.cursor };
                    this.status = "Selected";
                }
            }
        }

        // Bot controls
        if (key.toLowerCase() === "b") {
            this.mode = "bot";
            this.status = "Bot Mode Enabled";
        }
        if (key.toLowerCase() === "p") {
            this.mode = "pvp";
            this.status = "PvP Mode Enabled";
        }
    }

    tick(_dt: number) {
        void _dt;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(ctx: CanvasRenderingContext2D, width: number, height: number, theme: any) {
        const boardSize = 8;
        // Constrain cell size
        const cellSize = Math.floor(Math.min((width - 40) / 8, (height - 80) / 8));
        const boardW = cellSize * 8;
        const boardH = cellSize * 8;
        const offsetX = Math.floor((width - boardW) / 2);
        const offsetY = Math.floor((height - boardH) / 2);

        const accent = theme?.palette?.accent || "#0f0";
        const dim = theme?.palette?.dim || "#444";
        const text = theme?.palette?.text || "#fff";
        const warn = "#d6735b";

        // Draw Header
        ctx.fillStyle = accent;
        ctx.font = "16px monospace";
        ctx.textAlign = "left";
        const modeLabel = this.mode === "bot" ? `Bot (${this.botColor === "w" ? "White" : "Black"})` : "PvP";
        const turnLabel = this.turn === "w" ? "White" : "Black";
        ctx.fillText(`Chess - ${modeLabel} - Turn: ${turnLabel}`, offsetX, offsetY - 20);

        // Grid & Pieces
        const legalMoves = this.selected ? this.getLegalMoves(this.board, this.selected.x, this.selected.y) : [];
        const pieceMap: Record<string, string> = {
            K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
            k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟︎"
        };
        const kingInCheck = this.inCheck(this.board, "w") ? "w" : (this.inCheck(this.board, "b") ? "b" : null);

        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const isDark = (x + y) % 2 === 1;
                ctx.fillStyle = isDark ? "#222" : "#333";
                const cx = offsetX + x * cellSize;
                const cy = offsetY + y * cellSize;
                ctx.fillRect(cx, cy, cellSize, cellSize);

                // Highlight Legal Moves
                if (legalMoves.some(m => m.x === x && m.y === y)) {
                    ctx.fillStyle = "rgba(100, 255, 100, 0.2)";
                    ctx.fillRect(cx, cy, cellSize, cellSize);
                }

                // Highlight Selected
                if (this.selected && this.selected.x === x && this.selected.y === y) {
                    ctx.strokeStyle = accent;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cx + 1, cy + 1, cellSize - 2, cellSize - 2);
                }

                // Highlight Cursor
                if (this.cursor.x === x && this.cursor.y === y) {
                    ctx.strokeStyle = "#fff";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cx + 3, cy + 3, cellSize - 6, cellSize - 6);
                }

                // Highlight King Check
                const piece = this.board[y][x];
                if (piece && piece.toLowerCase() === "k" && this.getColor(piece) === kingInCheck) {
                    ctx.fillStyle = "rgba(255, 50, 50, 0.5)";
                    ctx.fillRect(cx, cy, cellSize, cellSize);
                }

                // Draw Piece
                if (piece) {
                    const glyph = pieceMap[piece] || piece;
                    ctx.fillStyle = this.getColor(piece) === "w" ? "#eee" : "#d6735b";
                    ctx.font = `${Math.floor(cellSize * 0.7)}px monospace`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(glyph, cx + cellSize / 2, cy + cellSize / 2 + 2);
                }
            }
        }

        // Draw Status
        ctx.fillStyle = this.status?.includes("mate") ? warn : text;
        ctx.font = "14px monospace";
        ctx.textAlign = "center";

        if (this.pendingPromotion) {
            const options = ["Q", "R", "B", "N"];
            const opts = options.map((o, i) => i === this.promotionChoice ? `[${o}]` : o).join(" ");
            ctx.fillText(`Promote to: ${opts}`, width / 2, offsetY + boardH + 20);
        } else {
            ctx.fillText(this.status || "", width / 2, offsetY + boardH + 20);
        }

        ctx.fillStyle = dim;
        ctx.fillText("B: Toggle Bot | P: PvP | Caps Lock often helps", width / 2, height - 20);
    }
}
