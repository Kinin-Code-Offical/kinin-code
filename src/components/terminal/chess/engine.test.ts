import { describe, expect, it } from "vitest";
import { createChessBot } from "./bot";
import {
  applyMove,
  findBestMove,
  fromFen,
  getGameStatus,
  legalMoves,
  moveFromUci,
  moveToUci,
  perft,
  positionKey,
  toFen,
  type ChessState,
  type Difficulty,
  type EngineMove,
} from "./engine";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const KIWIPETE = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";

const uciList = (state: ChessState) => legalMoves(state).map(moveToUci);

const play = (state: ChessState, ...ucis: string[]) =>
  ucis.reduce((s, uci) => {
    const move = moveFromUci(uci);
    if (!move) throw new Error(`bad uci ${uci}`);
    return applyMove(s, move);
  }, state);

const isMate = (state: ChessState) => getGameStatus(state).status === "checkmate";

/** True if every reply to `move` allows a mate in one. */
const forcesMateInTwo = (state: ChessState, move: EngineMove) => {
  const afterMove = applyMove(state, move);
  const replies = legalMoves(afterMove);
  if (replies.length === 0) return isMate(afterMove);
  return replies.every((reply) => {
    const afterReply = applyMove(afterMove, reply);
    return legalMoves(afterReply).some((m) => isMate(applyMove(afterReply, m)));
  });
};

describe("perft", () => {
  it("start position depths 1-3", () => {
    const state = fromFen(START_FEN);
    expect(perft(state, 1)).toBe(20);
    expect(perft(state, 2)).toBe(400);
    expect(perft(state, 3)).toBe(8902);
  });

  it("start position depth 4", () => {
    expect(perft(fromFen(START_FEN), 4)).toBe(197281);
  });

  it("Kiwipete depths 1-3", () => {
    const state = fromFen(KIWIPETE);
    expect(perft(state, 1)).toBe(48);
    expect(perft(state, 2)).toBe(2039);
    expect(perft(state, 3)).toBe(97862);
  });

  it("en-passant / pin heavy endgame (CPW position 3) depth 4", () => {
    expect(perft(fromFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), 4)).toBe(43238);
  });

  it("promotion heavy positions (CPW positions 4 and 5) depth 3", () => {
    expect(
      perft(fromFen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1"), 3),
    ).toBe(9467);
    expect(perft(fromFen("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8"), 3)).toBe(
      62379,
    );
  });
});

describe("legalMoves", () => {
  it("forbids castling through an attacked square", () => {
    // Black rook on f8 covers f1: no O-O, O-O-O still fine.
    const moves = uciList(fromFen("r3kr2/8/8/8/8/8/8/R3K2R w KQq - 0 1"));
    expect(moves).not.toContain("e1g1");
    expect(moves).toContain("e1c1");
  });

  it("forbids castling into check and out of check", () => {
    expect(uciList(fromFen("4k1r1/8/8/8/8/8/8/R3K2R w KQ - 0 1"))).not.toContain("e1g1");
    const inCheck = uciList(fromFen("4k3/4r3/8/8/8/8/8/R3K2R w KQ - 0 1"));
    expect(inCheck).not.toContain("e1g1");
    expect(inCheck).not.toContain("e1c1");
  });

  it("allows queen-side castling when only b1 is attacked, not when blocked", () => {
    const moves = uciList(fromFen("1r2k3/8/8/8/8/8/8/R3K2R w KQ - 0 1"));
    expect(moves).toContain("e1c1");
    expect(moves).toContain("e1g1");
    expect(uciList(fromFen("4k3/8/8/8/8/8/8/RN2K2R w KQ - 0 1"))).not.toContain("e1c1");
  });

  it("moves the rook and drops rights when castling", () => {
    const next = play(fromFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"), "e1g1");
    expect(next.board[7][6]).toBe("K");
    expect(next.board[7][5]).toBe("R");
    expect(next.board[7][7]).toBe("");
    expect(next.castling).toEqual({ wK: false, wQ: false, bK: true, bQ: true });
  });

  it("handles en passant", () => {
    const state = fromFen("4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1");
    expect(uciList(state)).toContain("e5d6");
    const next = play(state, "e5d6");
    expect(next.board[2][3]).toBe("P"); // d6
    expect(next.board[3][3]).toBe(""); // captured pawn on d5 removed
    expect(next.board[3][4]).toBe(""); // e5 vacated
    // Without the en-passant square the capture is not available.
    expect(uciList(fromFen("4k3/8/8/3pP3/8/8/8/4K3 w - - 0 1"))).not.toContain("e5d6");
  });

  it("rejects en passant that exposes the king along the rank", () => {
    const moves = uciList(fromFen("8/8/8/K2pP2r/8/8/8/4k3 w - d6 0 1"));
    expect(moves).not.toContain("e5d6");
    expect(moves).toContain("e5e6");
  });

  it("generates all four promotions, including captures and for Black", () => {
    const quiet = uciList(fromFen("8/P6k/8/8/8/8/8/K7 w - - 0 1")).filter((m) =>
      m.startsWith("a7"),
    );
    expect(quiet.sort()).toEqual(["a7a8b", "a7a8n", "a7a8q", "a7a8r"]);

    const capture = uciList(fromFen("1r5k/P7/8/8/8/8/8/K7 w - - 0 1")).filter((m) =>
      m.startsWith("a7"),
    );
    expect(capture.sort()).toEqual([
      "a7a8b",
      "a7a8n",
      "a7a8q",
      "a7a8r",
      "a7b8b",
      "a7b8n",
      "a7b8q",
      "a7b8r",
    ]);

    const black = uciList(fromFen("k7/8/8/8/8/8/p6K/8 b - - 0 1")).filter((m) =>
      m.startsWith("a2"),
    );
    expect(black.sort()).toEqual(["a2a1b", "a2a1n", "a2a1q", "a2a1r"]);

    const promoted = play(fromFen("8/P6k/8/8/8/8/8/K7 w - - 0 1"), "a7a8n");
    expect(promoted.board[0][0]).toBe("N");
  });

  it("reads the game's board format (row 0 = rank 8)", () => {
    const state: ChessState = {
      board: [
        ["r", "n", "b", "q", "k", "b", "n", "r"],
        ["p", "p", "p", "p", "p", "p", "p", "p"],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["P", "P", "P", "P", "P", "P", "P", "P"],
        ["R", "N", "B", "Q", "K", "B", "N", "R"],
      ],
      turn: "w",
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      enPassant: null,
    };
    const moves = legalMoves(state);
    expect(moves).toHaveLength(20);
    expect(moves).toContainEqual({ from: { x: 4, y: 6 }, to: { x: 4, y: 4 } });
    expect(positionKey(state)).toBe(positionKey(fromFen(START_FEN)));
  });
});

describe("positions, keys and game status", () => {
  it("formats position keys as the first four FEN fields", () => {
    expect(positionKey(fromFen(START_FEN))).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
    );
    // 1.e4: no black pawn can capture en passant, so the square is dropped from the key.
    const afterE4 = play(fromFen(START_FEN), "e2e4");
    expect(afterE4.enPassant).toEqual({ x: 4, y: 5 });
    expect(positionKey(afterE4)).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -");
    expect(toFen(fromFen(KIWIPETE))).toBe(KIWIPETE);
  });

  it("detects checkmate, stalemate, threefold repetition and bare kings", () => {
    expect(getGameStatus(fromFen("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1")).status).toBe("checkmate");
    expect(getGameStatus(fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).status).toBe("stalemate");
    expect(getGameStatus(fromFen("8/8/4k3/8/8/2K5/8/8 w - - 0 1")).status).toBe(
      "insufficient-material",
    );

    let state = fromFen(START_FEN);
    for (let i = 0; i < 2; i += 1) {
      state = play(state, "g1f3", "g8f6", "f3g1", "f6g8");
    }
    expect(state.history).toHaveLength(8);
    expect(getGameStatus(state).status).toBe("threefold");
  });

  it("returns no move when there is nothing to play", () => {
    const mated = findBestMove(fromFen("R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1"), {
      difficulty: "hard",
    });
    expect(mated.move).toBeNull();
    expect(mated.mate).toBe(0);
    const stalemate = findBestMove(fromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), {
      difficulty: "hard",
    });
    expect(stalemate.move).toBeNull();
    expect(stalemate.score).toBe(0);
  });
});

describe("findBestMove", () => {
  const difficulties: Difficulty[] = ["easy", "medium", "hard"];

  it("finds a mate in one", () => {
    const state = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    for (const difficulty of difficulties) {
      const result = findBestMove(state, { difficulty });
      expect(result.move && moveToUci(result.move)).toBe("a1a8");
      expect(result.mate).toBe(1);
    }
  });

  it("finds a mate in two", () => {
    const state = fromFen("r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 1");
    // Sanity: there is no mate in one here.
    expect(legalMoves(state).some((m) => isMate(applyMove(state, m)))).toBe(false);
    for (const difficulty of ["medium", "hard"] as const) {
      const result = findBestMove(state, { difficulty });
      expect(result.mate).toBe(2);
      expect(result.move).not.toBeNull();
      expect(forcesMateInTwo(state, result.move as EngineMove)).toBe(true);
    }
  });

  it("captures a hanging queen at every difficulty", () => {
    const state = fromFen("4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1");
    for (const difficulty of difficulties) {
      const runs = difficulty === "easy" ? 12 : 1;
      for (let i = 0; i < runs; i += 1) {
        const result = findBestMove(state, { difficulty, timeMs: 300 });
        expect(result.move && moveToUci(result.move)).toBe("d2d5");
      }
    }
  });

  it("does not leave its own queen en prise", () => {
    // 1.e4 e5 2.d4 exd4 3.Qxd4 Nc6: the queen on d4 is attacked by the knight.
    const state = fromFen("r1bqkbnr/pppp1ppp/2n5/8/3QP3/8/PPP2PPP/RNB1KBNR w KQkq - 1 4");
    for (const difficulty of difficulties) {
      const runs = difficulty === "easy" ? 8 : 1;
      for (let i = 0; i < runs; i += 1) {
        const result = findBestMove(state, { difficulty, timeMs: 400 });
        expect(result.move).not.toBeNull();
        const next = applyMove(state, result.move as EngineMove);
        // Find the white queen and make sure no black piece can take it
        // (an even queen trade is tolerated for "easy").
        let queen: { x: number; y: number } | null = null;
        next.board.forEach((row, y) =>
          row.forEach((p, x) => {
            if (p === "Q") queen = { x, y };
          }),
        );
        expect(queen).not.toBeNull();
        const q = queen as unknown as { x: number; y: number };
        const takers = legalMoves(next).filter(
          (m) =>
            m.to.x === q.x &&
            m.to.y === q.y &&
            (difficulty !== "easy" || next.board[m.from.y][m.from.x] !== "q"),
        );
        expect(takers).toEqual([]);
      }
    }
  });

  it("does not throw away a win by repeating a position", () => {
    const state = fromFen("8/8/8/4k3/8/8/8/4K2Q w - - 0 1");
    const first = findBestMove(state, { difficulty: "hard", timeMs: 300 });
    expect(first.move).not.toBeNull();
    const firstMove = first.move as EngineMove;
    const repeated: ChessState = {
      ...state,
      history: [positionKey(applyMove(state, firstMove))],
    };
    const second = findBestMove(repeated, { difficulty: "hard", timeMs: 300 });
    expect(second.move).not.toBeNull();
    expect(moveToUci(second.move as EngineMove)).not.toBe(moveToUci(firstMove));
    expect(second.score).toBeGreaterThan(300);
  });

  it("returns legal moves, respects the time budget and reports search stats", () => {
    const state = fromFen(KIWIPETE);
    const legal = uciList(state);
    const started = Date.now();
    const result = findBestMove(state, { difficulty: "hard", timeMs: 250 });
    expect(Date.now() - started).toBeLessThan(1500);
    expect(result.move).not.toBeNull();
    expect(legal).toContain(moveToUci(result.move as EngineMove));
    expect(result.depth).toBeGreaterThanOrEqual(3);
    expect(result.nodes).toBeGreaterThan(0);
    expect(result.pv.length).toBeGreaterThan(0);
    expect(moveToUci(result.pv[0])).toBe(moveToUci(result.move as EngineMove));
  });

  it("caps depth per difficulty", () => {
    const state = fromFen(START_FEN);
    expect(findBestMove(state, { difficulty: "easy" }).depth).toBeLessThanOrEqual(2);
    expect(findBestMove(state, { difficulty: "medium" }).depth).toBeLessThanOrEqual(4);
  });
});

describe("createChessBot", () => {
  it("falls back to the main thread when Worker is unavailable", async () => {
    const bot = createChessBot();
    const state = fromFen("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1");
    const result = await bot.bestMove(state, "medium");
    expect(result.move && moveToUci(result.move)).toBe("a1a8");
    bot.dispose();
    await expect(bot.bestMove(state, "medium")).rejects.toThrow();
  });
});
