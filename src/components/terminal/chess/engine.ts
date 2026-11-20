/**
 * Self-contained chess engine for the terminal chess mini-game.
 *
 * - 0x88 board held in typed arrays, incremental make/unmake (no per-node allocation).
 * - Iterative-deepening negamax alpha-beta (PVS) with a time limit, quiescence search,
 *   transposition table keyed by 64-bit Zobrist hashing (two 32-bit halves),
 *   MVV-LVA capture ordering, killer moves, history heuristic, check extension,
 *   null-move pruning, late-move reductions and light futility pruning.
 * - Tapered PeSTO evaluation plus bishop pair, pawn structure, passed pawns,
 *   mobility, rook files, king safety and an endgame mop-up term.
 *
 * Pure TypeScript: no DOM, no React. Safe to run in a Web Worker or on the main thread.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Color = "w" | "b";

export type CastlingRights = { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };

export type BoardSquare = { x: number; y: number };

export type ChessState = {
  /** 8x8, board[0] = rank 8 (Black's back rank), board[7] = rank 1. "" = empty. */
  board: string[][];
  turn: Color;
  castling: CastlingRights;
  /** Square the pawn skipped over (FEN convention), or null. */
  enPassant: BoardSquare | null;
  /** positionKey() of every earlier position of the game, oldest first (current position excluded). */
  history?: string[];
  /** Optional halfmove clock (plies since last capture / pawn move) for the 50-move rule. */
  halfmoveClock?: number;
};

export type PromotionPiece = "q" | "r" | "b" | "n";

export type EngineMove = {
  from: BoardSquare;
  to: BoardSquare;
  /** Set only for promotions; always lowercase regardless of color. */
  promotion?: PromotionPiece;
};

export type Difficulty = "easy" | "medium" | "hard";

export type SearchOptions = {
  difficulty: Difficulty;
  /** Time budget in ms. Defaults: easy 300, medium 400, hard 1500. */
  timeMs?: number;
  /** Optional depth cap (overrides the difficulty default). */
  maxDepth?: number;
};

export type SearchResult = {
  /** Best move, or null when the side to move has no legal move (checkmate / stalemate). */
  move: EngineMove | null;
  /** Centipawns from the side to move's point of view. Mate scores are +-(30000 - plies). */
  score: number;
  /** Deepest fully completed iteration. */
  depth: number;
  nodes: number;
  /** Moves to mate: >0 side to move mates, <0 side to move gets mated, 0 already mated, null otherwise. */
  mate: number | null;
  /** Principal variation starting with `move`. */
  pv: EngineMove[];
  elapsedMs: number;
};

export type GameStatus =
  | "ongoing"
  | "checkmate"
  | "stalemate"
  | "threefold"
  | "fifty-move"
  | "insufficient-material";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAWN = 1;
const KNIGHT = 2;
const BISHOP = 3;
const ROOK = 4;
const QUEEN = 5;
const KING = 6;

const WHITE = 0;
const BLACK = 1;

const W_PAWN = PAWN;
const W_KNIGHT = KNIGHT;
const W_BISHOP = BISHOP;
const W_ROOK = ROOK;
const W_QUEEN = QUEEN;
const W_KING = KING;
const B_PAWN = PAWN | 8;
const B_KNIGHT = KNIGHT | 8;
const B_BISHOP = BISHOP | 8;
const B_ROOK = ROOK | 8;
const B_QUEEN = QUEEN | 8;
const B_KING = KING | 8;

/** Off-board marker (127 & 0x88 !== 0). */
const NO_SQ = 127;

const MAX_PLY = 128;
const MAX_MOVES = 256;
const MAX_HISTORY = 512;
const STACK_SIZE = MAX_HISTORY + MAX_PLY + 64;

export const MATE_SCORE = 30000;
const MATE = MATE_SCORE;
const INF = 31000;
const MATE_BOUND = MATE - 2 * MAX_PLY;

// Move encoding: from (7 bits) | to (7 bits) << 7 | promotion type (3 bits) << 14 | flags.
const PROMO_MASK = 7 << 14;
const FLAG_CAPTURE = 1 << 17;
const FLAG_EP = 1 << 18;
const FLAG_CASTLE = 1 << 19;
const FLAG_DOUBLE = 1 << 20;

const CASTLE_WK = 1;
const CASTLE_WQ = 2;
const CASTLE_BK = 4;
const CASTLE_BQ = 8;

const KNIGHT_OFFSETS = [33, 31, 18, 14, -33, -31, -18, -14];
const BISHOP_DIRS = [17, 15, -17, -15];
const ROOK_DIRS = [16, -16, 1, -1];
const KING_DIRS = [17, 16, 15, 1, -1, -15, -16, -17];

const TT_EXACT = 1;
const TT_LOWER = 2;
const TT_UPPER = 3;
const TT_BITS = 19;
const TT_SIZE = 1 << TT_BITS;
const TT_MASK = TT_SIZE - 1;

const SEE_VALUE = [0, 100, 320, 330, 500, 950, 20000];
const PHASE_INC = [0, 0, 1, 1, 2, 4, 0];
const FUTILITY_MARGIN = [0, 150, 300];
const HISTORY_MAX = 1_000_000;

const PIECE_FROM_CHAR: Record<string, number> = {
  P: W_PAWN,
  N: W_KNIGHT,
  B: W_BISHOP,
  R: W_ROOK,
  Q: W_QUEEN,
  K: W_KING,
  p: B_PAWN,
  n: B_KNIGHT,
  b: B_BISHOP,
  r: B_ROOK,
  q: B_QUEEN,
  k: B_KING,
};
const CHAR_FROM_PIECE = [
  "",
  "P",
  "N",
  "B",
  "R",
  "Q",
  "K",
  "",
  "",
  "p",
  "n",
  "b",
  "r",
  "q",
  "k",
  "",
];
const PROMO_CHAR: PromotionPiece[] = ["q", "q", "n", "b", "r", "q", "q", "q"];
const PROMO_FROM_CHAR: Record<PromotionPiece, number> = { n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN };

/** 0..63 -> 0x88 square (a1 = 0). */
const SQ64 = new Int32Array(64);
for (let i = 0; i < 64; i += 1) {
  SQ64[i] = ((i >> 3) << 4) | (i & 7);
}

/** Castling rights kept after a move touches a square. */
const CASTLE_MASK = new Uint8Array(128).fill(15);
CASTLE_MASK[0] = 15 & ~CASTLE_WQ;
CASTLE_MASK[7] = 15 & ~CASTLE_WK;
CASTLE_MASK[4] = 15 & ~(CASTLE_WK | CASTLE_WQ);
CASTLE_MASK[0x70] = 15 & ~CASTLE_BQ;
CASTLE_MASK[0x77] = 15 & ~CASTLE_BK;
CASTLE_MASK[0x74] = 15 & ~(CASTLE_BK | CASTLE_BQ);

/** Chebyshev distance / king-zone membership, indexed by (a - b + 119). */
const DIST = new Int8Array(240);
const KING_ZONE = new Uint8Array(240);
for (let a = 0; a < 64; a += 1) {
  for (let b = 0; b < 64; b += 1) {
    const sa = SQ64[a];
    const sb = SQ64[b];
    const df = Math.abs((sa & 7) - (sb & 7));
    const dr = Math.abs((sa >> 4) - (sb >> 4));
    const d = Math.max(df, dr);
    DIST[sa - sb + 119] = d;
    KING_ZONE[sa - sb + 119] = d <= 1 ? 1 : 0;
  }
}
/** Manhattan distance of a square from the four centre squares. */
const CENTER_MANHATTAN = new Int8Array(128);
for (let i = 0; i < 64; i += 1) {
  const sq = SQ64[i];
  const f = sq & 7;
  const r = sq >> 4;
  CENTER_MANHATTAN[sq] = Math.max(3 - f, f - 4) + Math.max(3 - r, r - 4);
}

// ---------------------------------------------------------------------------
// PeSTO piece-square tables (a8 = index 0, White's point of view)
// ---------------------------------------------------------------------------

const MG_VALUE = [0, 82, 337, 365, 477, 1025, 0];
const EG_VALUE = [0, 94, 281, 297, 512, 936, 0];

// prettier-ignore
const MG_PAWN = [
    0,   0,   0,   0,   0,   0,  0,   0,
   98, 134,  61,  95,  68, 126, 34, -11,
   -6,   7,  26,  31,  65,  56, 25, -20,
  -14,  13,   6,  21,  23,  12, 17, -23,
  -27,  -2,  -5,  12,  17,   6, 10, -25,
  -26,  -4,  -4, -10,   3,   3, 33, -12,
  -35,  -1, -20, -23, -15,  24, 38, -22,
    0,   0,   0,   0,   0,   0,  0,   0,
];
// prettier-ignore
const EG_PAWN = [
    0,   0,   0,   0,   0,   0,   0,   0,
  178, 173, 158, 134, 147, 132, 165, 187,
   94, 100,  85,  67,  56,  53,  82,  84,
   32,  24,  13,   5,  -2,   4,  17,  17,
   13,   9,  -3,  -7,  -7,  -8,   3,  -1,
    4,   7,  -6,   1,   0,  -5,  -1,  -8,
   13,   8,   8,  10,  13,   0,   2,  -7,
    0,   0,   0,   0,   0,   0,   0,   0,
];
// prettier-ignore
const MG_KNIGHT = [
  -167, -89, -34, -49,  61, -97, -15, -107,
   -73, -41,  72,  36,  23,  62,   7,  -17,
   -47,  60,  37,  65,  84, 129,  73,   44,
    -9,  17,  19,  53,  37,  69,  18,   22,
   -13,   4,  16,  13,  28,  19,  21,   -8,
   -23,  -9,  12,  10,  19,  17,  25,  -16,
   -29, -53, -12,  -3,  -1,  18, -14,  -19,
  -105, -21, -58, -33, -17, -28, -19,  -23,
];
// prettier-ignore
const EG_KNIGHT = [
  -58, -38, -13, -28, -31, -27, -63, -99,
  -25,  -8, -25,  -2,  -9, -25, -24, -52,
  -24, -20,  10,   9,  -1,  -9, -19, -41,
  -17,   3,  22,  22,  22,  11,   8, -18,
  -18,  -6,  16,  25,  16,  17,   4, -18,
  -23,  -3,  -1,  15,  10,  -3, -20, -22,
  -42, -20, -10,  -5,  -2, -20, -23, -44,
  -29, -51, -23, -15, -22, -18, -50, -64,
];
// prettier-ignore
const MG_BISHOP = [
  -29,   4, -82, -37, -25, -42,   7,  -8,
  -26,  16, -18, -13,  30,  59,  18, -47,
  -16,  37,  43,  40,  35,  50,  37,  -2,
   -4,   5,  19,  50,  37,  37,   7,  -2,
   -6,  13,  13,  26,  34,  12,  10,   4,
    0,  15,  15,  15,  14,  27,  18,  10,
    4,  15,  16,   0,   7,  21,  33,   1,
  -33,  -3, -14, -21, -13, -12, -39, -21,
];
// prettier-ignore
const EG_BISHOP = [
  -14, -21, -11,  -8,  -7,  -9, -17, -24,
   -8,  -4,   7, -12,  -3, -13,  -4, -14,
    2,  -8,   0,  -1,  -2,   6,   0,   4,
   -3,   9,  12,   9,  14,  10,   3,   2,
   -6,   3,  13,  19,   7,  10,  -3,  -9,
  -12,  -3,   8,  10,  13,   3,  -7, -15,
  -14, -18,  -7,  -1,   4,  -9, -15, -27,
  -23,  -9, -23,  -5,  -9, -16,  -5, -17,
];
// prettier-ignore
const MG_ROOK = [
   32,  42,  32,  51,  63,   9,  31,  43,
   27,  32,  58,  62,  80,  67,  26,  44,
   -5,  19,  26,  36,  17,  45,  61,  16,
  -24, -11,   7,  26,  24,  35,  -8, -20,
  -36, -26, -12,  -1,   9,  -7,   6, -23,
  -45, -25, -16, -17,   3,   0,  -5, -33,
  -44, -16, -20,  -9,  -1,  11,  -6, -71,
  -19, -13,   1,  17,  16,   7, -37, -26,
];
// prettier-ignore
const EG_ROOK = [
  13, 10, 18, 15, 12,  12,   8,   5,
  11, 13, 13, 11, -3,   3,   8,   3,
   7,  7,  7,  5,  4,  -3,  -5,  -3,
   4,  3, 13,  1,  2,   1,  -1,   2,
   3,  5,  8,  4, -5,  -6,  -8, -11,
  -4,  0, -5, -1, -7, -12,  -8, -16,
  -6, -6,  0,  2, -9,  -9, -11,  -3,
  -9,  2,  3, -1, -5, -13,   4, -20,
];
// prettier-ignore
const MG_QUEEN = [
  -28,   0,  29,  12,  59,  44,  43,  45,
  -24, -39,  -5,   1, -16,  57,  28,  54,
  -13, -17,   7,   8,  29,  56,  47,  57,
  -27, -27, -16, -16,  -1,  17,  -2,   1,
   -9, -26,  -9, -10,  -2,  -4,   3,  -3,
  -14,   2, -11,  -2,  -5,   2,  14,   5,
  -35,  -8,  11,   2,   8,  15,  -3,   1,
   -1, -18,  -9,  10, -15, -25, -31, -50,
];
// prettier-ignore
const EG_QUEEN = [
   -9,  22,  22,  27,  27,  19,  10,  20,
  -17,  20,  32,  41,  58,  25,  30,   0,
  -20,   6,   9,  49,  47,  35,  19,   9,
    3,  22,  24,  45,  57,  40,  57,  36,
  -18,  28,  19,  47,  31,  34,  39,  23,
  -16, -27,  15,   6,   9,  17,  10,   5,
  -22, -23, -30, -16, -16, -23, -36, -32,
  -33, -28, -22, -43,  -5, -32, -20, -41,
];
// prettier-ignore
const MG_KING = [
  -65,  23,  16, -15, -56, -34,   2,  13,
   29,  -1, -20,  -7,  -8,  -4, -38, -29,
   -9,  24,   2, -16, -20,   6,  22, -22,
  -17, -20, -12, -27, -30, -25, -14, -36,
  -49,  -1, -27, -39, -46, -44, -33, -51,
  -14, -14, -22, -46, -44, -30, -15, -27,
    1,   7,  -8, -64, -43, -16,   9,   8,
  -15,  36,  12, -54,   8, -28,  24,  14,
];
// prettier-ignore
const EG_KING = [
  -74, -35, -18, -18, -11,  15,   4, -17,
  -12,  17,  14,  17,  17,  38,  23,  11,
   10,  17,  23,  15,  20,  45,  44,  13,
   -8,  22,  24,  27,  26,  33,  26,   3,
  -18,  -4,  21,  24,  27,  23,   9, -11,
  -19,  -3,  11,  21,  23,  16,   7,  -9,
  -27, -11,   4,  13,  14,   4,  -5, -17,
  -53, -34, -21, -11, -28, -14, -24, -43,
];

const MG_TABLES = [[], MG_PAWN, MG_KNIGHT, MG_BISHOP, MG_ROOK, MG_QUEEN, MG_KING];
const EG_TABLES = [[], EG_PAWN, EG_KNIGHT, EG_BISHOP, EG_ROOK, EG_QUEEN, EG_KING];

/** Signed (White positive) material + PST, indexed by piece * 128 + square. */
const MG_PST = new Int32Array(16 * 128);
const EG_PST = new Int32Array(16 * 128);
for (let type = PAWN; type <= KING; type += 1) {
  for (let i = 0; i < 64; i += 1) {
    const sq = SQ64[i];
    const rank = sq >> 4;
    const file = sq & 7;
    const wIdx = (7 - rank) * 8 + file;
    const bIdx = rank * 8 + file;
    MG_PST[type * 128 + sq] = MG_VALUE[type] + MG_TABLES[type][wIdx];
    EG_PST[type * 128 + sq] = EG_VALUE[type] + EG_TABLES[type][wIdx];
    MG_PST[(type | 8) * 128 + sq] = -(MG_VALUE[type] + MG_TABLES[type][bIdx]);
    EG_PST[(type | 8) * 128 + sq] = -(EG_VALUE[type] + EG_TABLES[type][bIdx]);
  }
}

// Evaluation weights.
const PASSED_MG = [0, 0, 5, 10, 20, 35, 50, 0];
const PASSED_EG = [0, 5, 10, 20, 35, 55, 80, 0];
const MOB_BASE = [0, 0, 4, 7, 7, 14, 0];
const MOB_MG = [0, 0, 4, 5, 2, 1, 0];
const MOB_EG = [0, 0, 4, 5, 4, 2, 0];
const ATTACK_WEIGHT = [0, 0, 2, 2, 3, 5, 0];
const BISHOP_PAIR_MG = 30;
const BISHOP_PAIR_EG = 50;
const TEMPO = 10;

// ---------------------------------------------------------------------------
// Zobrist keys (deterministic xorshift32)
// ---------------------------------------------------------------------------

let rngState = 0x2f6b9e1d;
function nextRandom(): number {
  let x = rngState;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  rngState = x | 0;
  return rngState;
}

const Z_PIECE_LO = new Int32Array(16 * 128);
const Z_PIECE_HI = new Int32Array(16 * 128);
const Z_CASTLE_LO = new Int32Array(16);
const Z_CASTLE_HI = new Int32Array(16);
const Z_EP_LO = new Int32Array(8);
const Z_EP_HI = new Int32Array(8);
for (let i = 0; i < 16 * 128; i += 1) {
  Z_PIECE_LO[i] = nextRandom();
  Z_PIECE_HI[i] = nextRandom();
}
for (let i = 0; i < 16; i += 1) {
  Z_CASTLE_LO[i] = nextRandom();
  Z_CASTLE_HI[i] = nextRandom();
}
for (let i = 0; i < 8; i += 1) {
  Z_EP_LO[i] = nextRandom();
  Z_EP_HI[i] = nextRandom();
}
const Z_SIDE_LO = nextRandom();
const Z_SIDE_HI = nextRandom();

// ---------------------------------------------------------------------------
// Engine state (module-level; the engine is single-threaded and non-reentrant)
// ---------------------------------------------------------------------------

const board = new Int8Array(128);
const kingSq = new Int32Array(2);
const pieceCount = new Int32Array(16);
let side = WHITE;
let castle = 0;
let ep = NO_SQ;
let halfmove = 0;
let hashLo = 0;
let hashHi = 0;
let mgScore = 0;
let egScore = 0;
let phase = 0;
let sp = 0;

// Undo stack (also holds the hashes of earlier game positions for repetition detection).
const uMove = new Int32Array(STACK_SIZE);
const uCaptured = new Int8Array(STACK_SIZE);
const uCastle = new Uint8Array(STACK_SIZE);
const uEp = new Uint8Array(STACK_SIZE);
const uHalf = new Int32Array(STACK_SIZE);
const uHashLo = new Int32Array(STACK_SIZE);
const uHashHi = new Int32Array(STACK_SIZE);
const uMg = new Int32Array(STACK_SIZE);
const uEg = new Int32Array(STACK_SIZE);
const uPhase = new Int32Array(STACK_SIZE);

const MOVE_BUF = new Int32Array(MAX_PLY * MAX_MOVES);
const SCORE_BUF = new Int32Array(MAX_PLY * MAX_MOVES);
const KILLER1 = new Int32Array(MAX_PLY);
const KILLER2 = new Int32Array(MAX_PLY);
const HISTORY = new Int32Array(16 * 128);

// Transposition table, allocated lazily on the first search.
let ttKey = new Int32Array(0);
let ttMove = new Int32Array(0);
let ttScore = new Int16Array(0);
let ttDepth = new Int8Array(0);
let ttFlag = new Uint8Array(0);
let ttNoiseTag = 0;

// Search control.
let nodes = 0;
let stopped = false;
let deadline = 0;
let rootBestMove = 0;
let rootBestScore = 0;
let evalNoise = 0;
let noiseSeed = 0;

// Evaluation scratch.
const wPawnCnt = new Int8Array(8);
const bPawnCnt = new Int8Array(8);
const wPawnMinRank = new Int8Array(8);
const bPawnMaxRank = new Int8Array(8);
const pawnList = new Int32Array(64);
const pieceList = new Int32Array(64);

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function ensureTT(): void {
  if (ttKey.length === TT_SIZE) {
    return;
  }
  ttKey = new Int32Array(TT_SIZE);
  ttMove = new Int32Array(TT_SIZE);
  ttScore = new Int16Array(TT_SIZE);
  ttDepth = new Int8Array(TT_SIZE);
  ttFlag = new Uint8Array(TT_SIZE);
}

function clearTT(): void {
  ttFlag.fill(0);
  ttMove.fill(0);
}

// ---------------------------------------------------------------------------
// Board <-> ChessState conversion
// ---------------------------------------------------------------------------

type Internal = {
  b: Int8Array;
  side: number;
  castle: number;
  ep: number;
  half: number;
};

function toInternal(state: ChessState): Internal {
  const b = new Int8Array(128);
  for (let y = 0; y < 8; y += 1) {
    const row = state.board[y];
    for (let x = 0; x < 8; x += 1) {
      const ch = row ? row[x] : "";
      const code = ch ? PIECE_FROM_CHAR[ch] : undefined;
      b[((7 - y) << 4) | x] = code ?? 0;
    }
  }
  const stm = state.turn === "b" ? BLACK : WHITE;
  const c = state.castling;
  let castleBits = 0;
  if (c) {
    if (c.wK && b[4] === W_KING && b[7] === W_ROOK) castleBits |= CASTLE_WK;
    if (c.wQ && b[4] === W_KING && b[0] === W_ROOK) castleBits |= CASTLE_WQ;
    if (c.bK && b[0x74] === B_KING && b[0x77] === B_ROOK) castleBits |= CASTLE_BK;
    if (c.bQ && b[0x74] === B_KING && b[0x70] === B_ROOK) castleBits |= CASTLE_BQ;
  }
  let epSq = NO_SQ;
  const e = state.enPassant;
  if (e && e.x >= 0 && e.x < 8 && e.y >= 0 && e.y < 8) {
    const sq = ((7 - e.y) << 4) | e.x;
    epSq = normalizeEp(b, stm, sq);
  }
  const half = Math.max(0, Math.floor(state.halfmoveClock ?? 0));
  return { b, side: stm, castle: castleBits, ep: epSq, half };
}

/** Keep an en-passant square only when the side to move could (pseudo-legally) capture on it. */
function normalizeEp(b: Int8Array, stm: number, sq: number): number {
  if (sq & 0x88 || b[sq] !== 0) return NO_SQ;
  const rank = sq >> 4;
  if (stm === WHITE) {
    if (rank !== 5 || b[sq - 16] !== B_PAWN) return NO_SQ;
    const l = sq - 17;
    const r = sq - 15;
    if ((!(l & 0x88) && b[l] === W_PAWN) || (!(r & 0x88) && b[r] === W_PAWN)) return sq;
    return NO_SQ;
  }
  if (rank !== 2 || b[sq + 16] !== W_PAWN) return NO_SQ;
  const l = sq + 15;
  const r = sq + 17;
  if ((!(l & 0x88) && b[l] === B_PAWN) || (!(r & 0x88) && b[r] === B_PAWN)) return sq;
  return NO_SQ;
}

function hashOf(b: Int8Array, stm: number, castleBits: number, epSq: number): [number, number] {
  let lo = 0;
  let hi = 0;
  for (let i = 0; i < 64; i += 1) {
    const sq = SQ64[i];
    const p = b[sq];
    if (p !== 0) {
      lo ^= Z_PIECE_LO[p * 128 + sq];
      hi ^= Z_PIECE_HI[p * 128 + sq];
    }
  }
  lo ^= Z_CASTLE_LO[castleBits];
  hi ^= Z_CASTLE_HI[castleBits];
  if (epSq !== NO_SQ) {
    lo ^= Z_EP_LO[epSq & 7];
    hi ^= Z_EP_HI[epSq & 7];
  }
  if (stm === BLACK) {
    lo ^= Z_SIDE_LO;
    hi ^= Z_SIDE_HI;
  }
  return [lo, hi];
}

/** Pawn placement + piece counts: positions with a different signature can never repeat. */
function signatureOf(b: Int8Array): string {
  const counts = new Int32Array(16);
  let pawns = "";
  for (let i = 0; i < 64; i += 1) {
    const p = b[SQ64[i]];
    counts[p] += 1;
    if (p === W_PAWN || p === B_PAWN) pawns += `${p}:${i},`;
  }
  return `${pawns}|${Array.from(counts).join(",")}`;
}

function squareName(sq: number): string {
  return `${"abcdefgh"[sq & 7]}${(sq >> 4) + 1}`;
}

function keyOf(int: Internal): string {
  const rows: string[] = [];
  for (let rank = 7; rank >= 0; rank -= 1) {
    let row = "";
    let empty = 0;
    for (let file = 0; file < 8; file += 1) {
      const p = int.b[(rank << 4) | file];
      if (p === 0) {
        empty += 1;
      } else {
        if (empty) row += String(empty);
        empty = 0;
        row += CHAR_FROM_PIECE[p];
      }
    }
    if (empty) row += String(empty);
    rows.push(row);
  }
  let c = "";
  if (int.castle & CASTLE_WK) c += "K";
  if (int.castle & CASTLE_WQ) c += "Q";
  if (int.castle & CASTLE_BK) c += "k";
  if (int.castle & CASTLE_BQ) c += "q";
  return `${rows.join("/")} ${int.side === WHITE ? "w" : "b"} ${c || "-"} ${
    int.ep === NO_SQ ? "-" : squareName(int.ep)
  }`;
}

/** Load a position into the engine globals. History keys are hashed for repetition detection. */
function loadInternal(int: Internal, history?: string[]): void {
  board.set(int.b);
  side = int.side;
  castle = int.castle;
  ep = int.ep;
  halfmove = int.half;
  kingSq[0] = NO_SQ;
  kingSq[1] = NO_SQ;
  pieceCount.fill(0);
  mgScore = 0;
  egScore = 0;
  phase = 0;
  for (let i = 0; i < 64; i += 1) {
    const sq = SQ64[i];
    const p = board[sq];
    if (p === 0) continue;
    pieceCount[p] += 1;
    mgScore += MG_PST[p * 128 + sq];
    egScore += EG_PST[p * 128 + sq];
    phase += PHASE_INC[p & 7];
    if (p === W_KING) kingSq[WHITE] = sq;
    else if (p === B_KING) kingSq[BLACK] = sq;
  }
  const [lo, hi] = hashOf(board, side, castle, ep);
  hashLo = lo;
  hashHi = hi;
  sp = 0;

  if (history && history.length) {
    // Only the trailing run of positions with the same pawn structure and material can repeat.
    const sig = signatureOf(int.b);
    const reversible: Array<[number, number]> = [];
    for (let i = history.length - 1; i >= 0 && reversible.length < MAX_HISTORY; i -= 1) {
      let parsed: Internal;
      try {
        parsed = toInternal(fromFen(history[i]));
      } catch {
        break;
      }
      if (signatureOf(parsed.b) !== sig) break;
      reversible.push(hashOf(parsed.b, parsed.side, parsed.castle, parsed.ep));
    }
    reversible.reverse();
    for (let i = 0; i < reversible.length; i += 1) {
      uHashLo[i] = reversible[i][0];
      uHashHi[i] = reversible[i][1];
      uMove[i] = 0;
    }
    sp = reversible.length;
    if (halfmove < sp) halfmove = sp;
  }
}

function setup(state: ChessState, withHistory: boolean): void {
  loadInternal(toInternal(state), withHistory ? state.history : undefined);
}

// ---------------------------------------------------------------------------
// Attack detection & move generation
// ---------------------------------------------------------------------------

function isAttacked(sq: number, by: number): boolean {
  if (sq & 0x88) return false;
  let t: number;
  if (by === WHITE) {
    t = sq - 15;
    if (!(t & 0x88) && board[t] === W_PAWN) return true;
    t = sq - 17;
    if (!(t & 0x88) && board[t] === W_PAWN) return true;
  } else {
    t = sq + 15;
    if (!(t & 0x88) && board[t] === B_PAWN) return true;
    t = sq + 17;
    if (!(t & 0x88) && board[t] === B_PAWN) return true;
  }
  const bits = by << 3;
  const knight = KNIGHT | bits;
  const king = KING | bits;
  const bishop = BISHOP | bits;
  const rook = ROOK | bits;
  const queen = QUEEN | bits;
  for (let i = 0; i < 8; i += 1) {
    t = sq + KNIGHT_OFFSETS[i];
    if (!(t & 0x88) && board[t] === knight) return true;
  }
  for (let i = 0; i < 8; i += 1) {
    t = sq + KING_DIRS[i];
    if (!(t & 0x88) && board[t] === king) return true;
  }
  for (let i = 0; i < 4; i += 1) {
    const d = BISHOP_DIRS[i];
    t = sq + d;
    while (!(t & 0x88)) {
      const p = board[t];
      if (p !== 0) {
        if (p === bishop || p === queen) return true;
        break;
      }
      t += d;
    }
  }
  for (let i = 0; i < 4; i += 1) {
    const d = ROOK_DIRS[i];
    t = sq + d;
    while (!(t & 0x88)) {
      const p = board[t];
      if (p !== 0) {
        if (p === rook || p === queen) return true;
        break;
      }
      t += d;
    }
  }
  return false;
}

function inCheckNow(): boolean {
  return isAttacked(kingSq[side], side ^ 1);
}

function addPromotions(n: number, from: number, to: number, flags: number, all: boolean): number {
  const base = from | (to << 7) | flags;
  MOVE_BUF[n] = base | (QUEEN << 14);
  n += 1;
  if (all) {
    MOVE_BUF[n] = base | (ROOK << 14);
    MOVE_BUF[n + 1] = base | (BISHOP << 14);
    MOVE_BUF[n + 2] = base | (KNIGHT << 14);
    n += 3;
  }
  return n;
}

/**
 * Generate pseudo-legal moves into MOVE_BUF[base..]. With `quiets` false only captures
 * and queen promotions are produced (for quiescence search). Returns the move count.
 */
function generate(base: number, quiets: boolean): number {
  let n = base;
  const us = side;
  const them = us ^ 1;
  const pawnDir = us === WHITE ? 16 : -16;
  const promoRank = us === WHITE ? 6 : 1;
  const startRank = us === WHITE ? 1 : 6;
  for (let i = 0; i < 64; i += 1) {
    const from = SQ64[i];
    const p = board[from];
    if (p === 0 || p >> 3 !== us) continue;
    const type = p & 7;
    if (type === PAWN) {
      const rank = from >> 4;
      const to = from + pawnDir;
      if (!(to & 0x88) && board[to] === 0) {
        if (rank === promoRank) {
          n = addPromotions(n, from, to, 0, quiets);
        } else if (quiets) {
          MOVE_BUF[n] = from | (to << 7);
          n += 1;
          if (rank === startRank) {
            const to2 = to + pawnDir;
            if (board[to2] === 0) {
              MOVE_BUF[n] = from | (to2 << 7) | FLAG_DOUBLE;
              n += 1;
            }
          }
        }
      }
      for (let k = -1; k <= 1; k += 2) {
        const t = from + pawnDir + k;
        if (t & 0x88) continue;
        const q = board[t];
        if (q !== 0) {
          if (q >> 3 === them) {
            if (rank === promoRank) {
              n = addPromotions(n, from, t, FLAG_CAPTURE, quiets);
            } else {
              MOVE_BUF[n] = from | (t << 7) | FLAG_CAPTURE;
              n += 1;
            }
          }
        } else if (t === ep) {
          MOVE_BUF[n] = from | (t << 7) | FLAG_CAPTURE | FLAG_EP;
          n += 1;
        }
      }
    } else if (type === KNIGHT || type === KING) {
      const offs = type === KNIGHT ? KNIGHT_OFFSETS : KING_DIRS;
      for (let k = 0; k < 8; k += 1) {
        const t = from + offs[k];
        if (t & 0x88) continue;
        const q = board[t];
        if (q === 0) {
          if (quiets) {
            MOVE_BUF[n] = from | (t << 7);
            n += 1;
          }
        } else if (q >> 3 === them) {
          MOVE_BUF[n] = from | (t << 7) | FLAG_CAPTURE;
          n += 1;
        }
      }
    } else {
      const dirs = type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : KING_DIRS;
      const nd = dirs.length;
      for (let k = 0; k < nd; k += 1) {
        const d = dirs[k];
        let t = from + d;
        while (!(t & 0x88)) {
          const q = board[t];
          if (q === 0) {
            if (quiets) {
              MOVE_BUF[n] = from | (t << 7);
              n += 1;
            }
          } else {
            if (q >> 3 === them) {
              MOVE_BUF[n] = from | (t << 7) | FLAG_CAPTURE;
              n += 1;
            }
            break;
          }
          t += d;
        }
      }
    }
  }
  if (quiets && castle) {
    if (us === WHITE) {
      if (
        castle & CASTLE_WK &&
        board[5] === 0 &&
        board[6] === 0 &&
        !isAttacked(4, BLACK) &&
        !isAttacked(5, BLACK)
      ) {
        MOVE_BUF[n] = 4 | (6 << 7) | FLAG_CASTLE;
        n += 1;
      }
      if (
        castle & CASTLE_WQ &&
        board[3] === 0 &&
        board[2] === 0 &&
        board[1] === 0 &&
        !isAttacked(4, BLACK) &&
        !isAttacked(3, BLACK)
      ) {
        MOVE_BUF[n] = 4 | (2 << 7) | FLAG_CASTLE;
        n += 1;
      }
    } else {
      if (
        castle & CASTLE_BK &&
        board[0x75] === 0 &&
        board[0x76] === 0 &&
        !isAttacked(0x74, WHITE) &&
        !isAttacked(0x75, WHITE)
      ) {
        MOVE_BUF[n] = 0x74 | (0x76 << 7) | FLAG_CASTLE;
        n += 1;
      }
      if (
        castle & CASTLE_BQ &&
        board[0x73] === 0 &&
        board[0x72] === 0 &&
        board[0x71] === 0 &&
        !isAttacked(0x74, WHITE) &&
        !isAttacked(0x73, WHITE)
      ) {
        MOVE_BUF[n] = 0x74 | (0x72 << 7) | FLAG_CASTLE;
        n += 1;
      }
    }
  }
  return n - base;
}

// ---------------------------------------------------------------------------
// Make / unmake
// ---------------------------------------------------------------------------

function removePiece(sq: number): void {
  const p = board[sq];
  const k = p * 128 + sq;
  hashLo ^= Z_PIECE_LO[k];
  hashHi ^= Z_PIECE_HI[k];
  mgScore -= MG_PST[k];
  egScore -= EG_PST[k];
  phase -= PHASE_INC[p & 7];
  pieceCount[p] -= 1;
  board[sq] = 0;
}

function addPiece(sq: number, p: number): void {
  const k = p * 128 + sq;
  hashLo ^= Z_PIECE_LO[k];
  hashHi ^= Z_PIECE_HI[k];
  mgScore += MG_PST[k];
  egScore += EG_PST[k];
  phase += PHASE_INC[p & 7];
  pieceCount[p] += 1;
  board[sq] = p;
}

function saveUndo(m: number): number {
  const s = sp;
  uMove[s] = m;
  uCastle[s] = castle;
  uEp[s] = ep;
  uHalf[s] = halfmove;
  uHashLo[s] = hashLo;
  uHashHi[s] = hashHi;
  uMg[s] = mgScore;
  uEg[s] = egScore;
  uPhase[s] = phase;
  return s;
}

/** Make a pseudo-legal move. Returns false (and leaves the position untouched) if it is illegal. */
function makeMove(m: number): boolean {
  const from = m & 127;
  const to = (m >> 7) & 127;
  const us = side;
  const them = us ^ 1;
  const p = board[from];
  const s = saveUndo(m);

  if (ep !== NO_SQ) {
    hashLo ^= Z_EP_LO[ep & 7];
    hashHi ^= Z_EP_HI[ep & 7];
    ep = NO_SQ;
  }
  halfmove += 1;

  let captured = 0;
  if (m & FLAG_EP) {
    const cs = us === WHITE ? to - 16 : to + 16;
    captured = board[cs];
    removePiece(cs);
    halfmove = 0;
  } else {
    captured = board[to];
    if (captured !== 0) {
      removePiece(to);
      halfmove = 0;
    }
  }
  uCaptured[s] = captured;

  const promo = (m >> 14) & 7;
  removePiece(from);
  addPiece(to, promo !== 0 ? promo | (us << 3) : p);

  const type = p & 7;
  if (type === PAWN) {
    halfmove = 0;
    if (m & FLAG_DOUBLE) {
      const enemyPawn = PAWN | (them << 3);
      const l = to - 1;
      const r = to + 1;
      if ((!(l & 0x88) && board[l] === enemyPawn) || (!(r & 0x88) && board[r] === enemyPawn)) {
        ep = (from + to) >> 1;
        hashLo ^= Z_EP_LO[ep & 7];
        hashHi ^= Z_EP_HI[ep & 7];
      }
    }
  } else if (type === KING) {
    kingSq[us] = to;
    if (m & FLAG_CASTLE) {
      const rook = ROOK | (us << 3);
      if (to > from) {
        removePiece(from + 3);
        addPiece(from + 1, rook);
      } else {
        removePiece(from - 4);
        addPiece(from - 1, rook);
      }
    }
  }

  const nc = castle & CASTLE_MASK[from] & CASTLE_MASK[to];
  if (nc !== castle) {
    hashLo ^= Z_CASTLE_LO[castle] ^ Z_CASTLE_LO[nc];
    hashHi ^= Z_CASTLE_HI[castle] ^ Z_CASTLE_HI[nc];
    castle = nc;
  }

  side = them;
  hashLo ^= Z_SIDE_LO;
  hashHi ^= Z_SIDE_HI;
  sp = s + 1;

  if (isAttacked(kingSq[us], them)) {
    unmakeMove();
    return false;
  }
  return true;
}

function unmakeMove(): void {
  sp -= 1;
  const s = sp;
  const m = uMove[s];
  const from = m & 127;
  const to = (m >> 7) & 127;
  side ^= 1;
  const us = side;
  let p = board[to];
  if ((m >> 14) & 7) {
    pieceCount[p] -= 1;
    p = PAWN | (us << 3);
    pieceCount[p] += 1;
  }
  board[from] = p;
  board[to] = 0;
  if ((p & 7) === KING) {
    kingSq[us] = from;
    if (m & FLAG_CASTLE) {
      if (to > from) {
        board[from + 3] = board[from + 1];
        board[from + 1] = 0;
      } else {
        board[from - 4] = board[from - 1];
        board[from - 1] = 0;
      }
    }
  }
  const cap = uCaptured[s];
  if (cap !== 0) {
    if (m & FLAG_EP) {
      board[us === WHITE ? to - 16 : to + 16] = cap;
    } else {
      board[to] = cap;
    }
    pieceCount[cap] += 1;
  }
  castle = uCastle[s];
  ep = uEp[s];
  halfmove = uHalf[s];
  hashLo = uHashLo[s];
  hashHi = uHashHi[s];
  mgScore = uMg[s];
  egScore = uEg[s];
  phase = uPhase[s];
}

function makeNullMove(): void {
  const s = saveUndo(0);
  uCaptured[s] = 0;
  if (ep !== NO_SQ) {
    hashLo ^= Z_EP_LO[ep & 7];
    hashHi ^= Z_EP_HI[ep & 7];
    ep = NO_SQ;
  }
  // Positions before a null move can never legitimately repeat inside its subtree.
  halfmove = 0;
  side ^= 1;
  hashLo ^= Z_SIDE_LO;
  hashHi ^= Z_SIDE_HI;
  sp = s + 1;
}

function unmakeNullMove(): void {
  sp -= 1;
  const s = sp;
  side ^= 1;
  ep = uEp[s];
  halfmove = uHalf[s];
  hashLo = uHashLo[s];
  hashHi = uHashHi[s];
}

// ---------------------------------------------------------------------------
// Draw detection
// ---------------------------------------------------------------------------

function isRepetition(): boolean {
  const limit = sp - halfmove > 0 ? sp - halfmove : 0;
  for (let i = sp - 2; i >= limit; i -= 1) {
    if (uHashLo[i] === hashLo && uHashHi[i] === hashHi) return true;
  }
  return false;
}

function isInsufficientMaterial(): boolean {
  if (
    pieceCount[W_PAWN] ||
    pieceCount[B_PAWN] ||
    pieceCount[W_ROOK] ||
    pieceCount[B_ROOK] ||
    pieceCount[W_QUEEN] ||
    pieceCount[B_QUEEN]
  ) {
    return false;
  }
  const minors =
    pieceCount[W_KNIGHT] + pieceCount[W_BISHOP] + pieceCount[B_KNIGHT] + pieceCount[B_BISHOP];
  return minors <= 1;
}

function hasNonPawnMaterial(color: number): boolean {
  const bits = color << 3;
  return (
    pieceCount[KNIGHT | bits] + pieceCount[BISHOP | bits] + pieceCount[ROOK | bits] + pieceCount[QUEEN | bits] >
    0
  );
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

function attackedByPawn(t: number, pawnColor: number): boolean {
  if (pawnColor === BLACK) {
    const a = t + 15;
    const b = t + 17;
    return (!(a & 0x88) && board[a] === B_PAWN) || (!(b & 0x88) && board[b] === B_PAWN);
  }
  const a = t - 15;
  const b = t - 17;
  return (!(a & 0x88) && board[a] === W_PAWN) || (!(b & 0x88) && board[b] === W_PAWN);
}

function pawnShield(color: number): number {
  const k = kingSq[color];
  if (k & 0x88) return 0;
  const kf = k & 7;
  const kr = k >> 4;
  const homeRank = color === WHITE ? kr : 7 - kr;
  if (homeRank > 1 || kf === 3 || kf === 4) return 0;
  const ownPawn = color === WHITE ? W_PAWN : B_PAWN;
  const dir = color === WHITE ? 16 : -16;
  const fileCnt = color === WHITE ? wPawnCnt : bPawnCnt;
  let s = 0;
  const f0 = kf > 0 ? kf - 1 : 0;
  const f1 = kf < 7 ? kf + 1 : 7;
  for (let f = f0; f <= f1; f += 1) {
    const s1 = (kr << 4) + f + dir;
    if (board[s1] === ownPawn) continue;
    const s2 = s1 + dir;
    if (!(s2 & 0x88) && board[s2] === ownPawn) {
      s -= 10;
      continue;
    }
    s -= 25;
    if (fileCnt[f] === 0) s -= 10;
  }
  const enemyQueen = color === WHITE ? B_QUEEN : W_QUEEN;
  return pieceCount[enemyQueen] ? s : s >> 1;
}

/** Static evaluation from the side to move's point of view (centipawns). */
function evaluate(): number {
  let mg = mgScore;
  let eg = egScore;

  if (pieceCount[W_BISHOP] >= 2) {
    mg += BISHOP_PAIR_MG;
    eg += BISHOP_PAIR_EG;
  }
  if (pieceCount[B_BISHOP] >= 2) {
    mg -= BISHOP_PAIR_MG;
    eg -= BISHOP_PAIR_EG;
  }

  for (let f = 0; f < 8; f += 1) {
    wPawnCnt[f] = 0;
    bPawnCnt[f] = 0;
    wPawnMinRank[f] = 8;
    bPawnMaxRank[f] = -1;
  }
  let nPawns = 0;
  let nPieces = 0;
  for (let i = 0; i < 64; i += 1) {
    const sq = SQ64[i];
    const p = board[sq];
    if (p === 0) continue;
    if (p === W_PAWN) {
      const f = sq & 7;
      const r = sq >> 4;
      wPawnCnt[f] += 1;
      if (r < wPawnMinRank[f]) wPawnMinRank[f] = r;
      pawnList[nPawns] = sq;
      nPawns += 1;
    } else if (p === B_PAWN) {
      const f = sq & 7;
      const r = sq >> 4;
      bPawnCnt[f] += 1;
      if (r > bPawnMaxRank[f]) bPawnMaxRank[f] = r;
      pawnList[nPawns] = sq;
      nPawns += 1;
    } else if (p !== W_KING && p !== B_KING) {
      pieceList[nPieces] = sq;
      nPieces += 1;
    }
  }

  const wk = kingSq[WHITE];
  const bk = kingSq[BLACK];
  const kingsOnBoard = !(wk & 0x88) && !(bk & 0x88);

  // Pawn structure and passed pawns.
  for (let i = 0; i < nPawns; i += 1) {
    const sq = pawnList[i];
    const f = sq & 7;
    const r = sq >> 4;
    if (board[sq] === W_PAWN) {
      if ((f === 0 || wPawnCnt[f - 1] === 0) && (f === 7 || wPawnCnt[f + 1] === 0)) {
        mg -= 10;
        eg -= 15;
      }
      if (
        bPawnMaxRank[f] <= r &&
        (f === 0 || bPawnMaxRank[f - 1] <= r) &&
        (f === 7 || bPawnMaxRank[f + 1] <= r)
      ) {
        mg += PASSED_MG[r];
        eg += PASSED_EG[r];
        const stop = sq + 16;
        if (kingsOnBoard && r >= 3 && !(stop & 0x88)) {
          eg += ((DIST[bk - stop + 119] * 4 - DIST[wk - stop + 119] * 2) * (r - 2)) >> 1;
        }
      }
    } else {
      const rr = 7 - r;
      if ((f === 0 || bPawnCnt[f - 1] === 0) && (f === 7 || bPawnCnt[f + 1] === 0)) {
        mg += 10;
        eg += 15;
      }
      if (
        wPawnMinRank[f] >= r &&
        (f === 0 || wPawnMinRank[f - 1] >= r) &&
        (f === 7 || wPawnMinRank[f + 1] >= r)
      ) {
        mg -= PASSED_MG[rr];
        eg -= PASSED_EG[rr];
        const stop = sq - 16;
        if (kingsOnBoard && rr >= 3 && !(stop & 0x88)) {
          eg -= ((DIST[wk - stop + 119] * 4 - DIST[bk - stop + 119] * 2) * (rr - 2)) >> 1;
        }
      }
    }
  }
  for (let f = 0; f < 8; f += 1) {
    if (wPawnCnt[f] > 1) {
      mg -= 10 * (wPawnCnt[f] - 1);
      eg -= 20 * (wPawnCnt[f] - 1);
    }
    if (bPawnCnt[f] > 1) {
      mg += 10 * (bPawnCnt[f] - 1);
      eg += 20 * (bPawnCnt[f] - 1);
    }
  }

  // Mobility, rook files, king-zone attacks.
  let wAttackers = 0;
  let wUnits = 0;
  let bAttackers = 0;
  let bUnits = 0;
  for (let i = 0; i < nPieces; i += 1) {
    const sq = pieceList[i];
    const p = board[sq];
    const type = p & 7;
    const color = p >> 3;
    const enemyK = color === WHITE ? bk : wk;
    const enemyPawnColor = color ^ 1;
    const zoneValid = !(enemyK & 0x88);
    let mob = 0;
    let zone = 0;
    if (type === KNIGHT) {
      for (let k = 0; k < 8; k += 1) {
        const t = sq + KNIGHT_OFFSETS[k];
        if (t & 0x88) continue;
        const q = board[t];
        if (q !== 0 && q >> 3 === color) continue;
        if (zoneValid && KING_ZONE[t - enemyK + 119]) zone += 1;
        if (!attackedByPawn(t, enemyPawnColor)) mob += 1;
      }
    } else {
      const dirs = type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : KING_DIRS;
      const nd = dirs.length;
      for (let k = 0; k < nd; k += 1) {
        const d = dirs[k];
        let t = sq + d;
        while (!(t & 0x88)) {
          const q = board[t];
          if (zoneValid && KING_ZONE[t - enemyK + 119]) zone += 1;
          if (q === 0) {
            if (!attackedByPawn(t, enemyPawnColor)) mob += 1;
          } else {
            if (q >> 3 !== color) mob += 1;
            break;
          }
          t += d;
        }
      }
    }
    const mgMob = (mob - MOB_BASE[type]) * MOB_MG[type];
    const egMob = (mob - MOB_BASE[type]) * MOB_EG[type];
    if (color === WHITE) {
      mg += mgMob;
      eg += egMob;
      if (zone) {
        wAttackers += 1;
        wUnits += zone * ATTACK_WEIGHT[type];
      }
    } else {
      mg -= mgMob;
      eg -= egMob;
      if (zone) {
        bAttackers += 1;
        bUnits += zone * ATTACK_WEIGHT[type];
      }
    }
    if (type === ROOK) {
      const f = sq & 7;
      const own = color === WHITE ? wPawnCnt[f] : bPawnCnt[f];
      const opp = color === WHITE ? bPawnCnt[f] : wPawnCnt[f];
      if (own === 0) {
        const bm = opp === 0 ? 25 : 12;
        const be = opp === 0 ? 10 : 5;
        if (color === WHITE) {
          mg += bm;
          eg += be;
        } else {
          mg -= bm;
          eg -= be;
        }
      }
    }
  }

  // King safety (middlegame only).
  if (wAttackers >= 2) mg += Math.min(400, (wUnits * wUnits) >> 2);
  if (bAttackers >= 2) mg -= Math.min(400, (bUnits * bUnits) >> 2);
  mg += pawnShield(WHITE) - pawnShield(BLACK);

  const ph = phase > 24 ? 24 : phase;
  let score = ((mg * ph + eg * (24 - ph)) / 24) | 0;

  // Endgame scaling and mop-up.
  const wNpm =
    pieceCount[W_KNIGHT] * 320 +
    pieceCount[W_BISHOP] * 330 +
    pieceCount[W_ROOK] * 500 +
    pieceCount[W_QUEEN] * 950;
  const bNpm =
    pieceCount[B_KNIGHT] * 320 +
    pieceCount[B_BISHOP] * 330 +
    pieceCount[B_ROOK] * 500 +
    pieceCount[B_QUEEN] * 950;
  if (score > 0 && pieceCount[W_PAWN] === 0 && wNpm - bNpm <= 330) {
    score = wNpm < 500 ? score >> 4 : score >> 2;
  } else if (score < 0 && pieceCount[B_PAWN] === 0 && bNpm - wNpm <= 330) {
    score = -(bNpm < 500 ? -score >> 4 : -score >> 2);
  }
  if (kingsOnBoard) {
    if (bNpm === 0 && pieceCount[B_PAWN] === 0 && wNpm >= 500) {
      score += 10 * CENTER_MANHATTAN[bk] + 4 * (14 - manhattan(wk, bk));
    } else if (wNpm === 0 && pieceCount[W_PAWN] === 0 && bNpm >= 500) {
      score -= 10 * CENTER_MANHATTAN[wk] + 4 * (14 - manhattan(wk, bk));
    }
  }

  let result = (side === WHITE ? score : -score) + TEMPO;
  if (evalNoise !== 0) {
    let h = (hashLo ^ noiseSeed) | 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h ^= h >>> 16;
    result += ((h >>> 0) % (2 * evalNoise + 1)) - evalNoise;
  }
  return result;
}

function manhattan(a: number, b: number): number {
  return Math.abs((a & 7) - (b & 7)) + Math.abs((a >> 4) - (b >> 4));
}

// ---------------------------------------------------------------------------
// Move ordering
// ---------------------------------------------------------------------------

function scoreMoves(base: number, count: number, hashMove: number, ply: number): void {
  const k1 = KILLER1[ply];
  const k2 = KILLER2[ply];
  const them = side ^ 1;
  const end = base + count;
  for (let i = base; i < end; i += 1) {
    const m = MOVE_BUF[i];
    let s: number;
    const promo = (m >> 14) & 7;
    if (m === hashMove) {
      s = 4_000_000;
    } else if (m & FLAG_CAPTURE) {
      const from = m & 127;
      const to = (m >> 7) & 127;
      const attacker = board[from] & 7;
      const victim = m & FLAG_EP ? PAWN : board[to] & 7;
      s = 2_000_000 + victim * 100 - attacker;
      if (promo === QUEEN) {
        s += 1000;
      } else if (promo !== 0) {
        s = -3_000_000 + promo;
      } else if (SEE_VALUE[attacker] > SEE_VALUE[victim] + 50 && isAttacked(to, them)) {
        // Probably loses material: try after the quiet moves.
        s = -1_000_000 + victim * 100 - attacker;
      }
    } else if (promo !== 0) {
      s = promo === QUEEN ? 1_900_000 : -3_000_000 + promo;
    } else if (m === k1) {
      s = 1_500_000;
    } else if (m === k2) {
      s = 1_400_000;
    } else {
      s = HISTORY[board[m & 127] * 128 + ((m >> 7) & 127)];
    }
    SCORE_BUF[i] = s;
  }
}

function pickNext(i: number, end: number): void {
  let best = i;
  let bestScore = SCORE_BUF[i];
  for (let j = i + 1; j < end; j += 1) {
    if (SCORE_BUF[j] > bestScore) {
      bestScore = SCORE_BUF[j];
      best = j;
    }
  }
  if (best !== i) {
    const m = MOVE_BUF[i];
    MOVE_BUF[i] = MOVE_BUF[best];
    MOVE_BUF[best] = m;
    SCORE_BUF[best] = SCORE_BUF[i];
    SCORE_BUF[i] = bestScore;
  }
}

function ageHistory(): void {
  for (let i = 0; i < HISTORY.length; i += 1) {
    HISTORY[i] >>= 1;
  }
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

function checkTime(): void {
  if (now() >= deadline) stopped = true;
}

function scoreToTT(score: number, ply: number): number {
  if (score >= MATE_BOUND) return score + ply;
  if (score <= -MATE_BOUND) return score - ply;
  return score;
}

function scoreFromTT(score: number, ply: number): number {
  if (score >= MATE_BOUND) return score - ply;
  if (score <= -MATE_BOUND) return score + ply;
  return score;
}

function qsearch(alpha: number, beta: number, ply: number): number {
  nodes += 1;
  if ((nodes & 1023) === 0) checkTime();
  if (stopped) return 0;
  if (ply >= MAX_PLY - 2) return evaluate();

  const inCheck = inCheckNow();
  let best: number;
  let standPat = 0;
  if (inCheck) {
    best = -MATE + ply;
  } else {
    standPat = evaluate();
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;
    best = standPat;
  }

  const base = ply * MAX_MOVES;
  const count = generate(base, inCheck);
  scoreMoves(base, count, 0, ply);
  const end = base + count;
  for (let i = base; i < end; i += 1) {
    pickNext(i, end);
    const m = MOVE_BUF[i];
    if (!inCheck && (m & PROMO_MASK) === 0) {
      // Skip captures that are losing or cannot raise the score enough (delta pruning).
      if (SCORE_BUF[i] < 0) continue;
      const victim = m & FLAG_EP ? PAWN : board[(m >> 7) & 127] & 7;
      if (standPat + SEE_VALUE[victim] + 200 <= alpha) continue;
    }
    if (!makeMove(m)) continue;
    const score = -qsearch(-beta, -alpha, ply + 1);
    unmakeMove();
    if (stopped) return 0;
    if (score > best) {
      best = score;
      if (score > alpha) {
        alpha = score;
        if (score >= beta) break;
      }
    }
  }
  return best;
}

function search(depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
  if (stopped) return 0;
  const pvNode = beta - alpha > 1;

  if (ply > 0) {
    if (halfmove >= 100 || isRepetition() || isInsufficientMaterial()) return 0;
    // Mate distance pruning.
    const matedScore = -MATE + ply;
    if (alpha < matedScore) alpha = matedScore;
    const mateScore = MATE - ply - 1;
    if (beta > mateScore) beta = mateScore;
    if (alpha >= beta) return alpha;
    if (ply >= MAX_PLY - 2) return evaluate();
  }

  const inCheck = inCheckNow();
  if (inCheck) depth += 1;
  if (depth <= 0) return qsearch(alpha, beta, ply);

  nodes += 1;
  if ((nodes & 1023) === 0) checkTime();
  if (stopped) return 0;

  // Transposition table probe.
  let hashMove = 0;
  const idx = hashLo & TT_MASK;
  if (ttFlag[idx] !== 0 && ttKey[idx] === hashHi) {
    hashMove = ttMove[idx];
    if (!pvNode && ttDepth[idx] >= depth) {
      const ts = scoreFromTT(ttScore[idx], ply);
      const f = ttFlag[idx];
      if (f === TT_EXACT || (f === TT_LOWER && ts >= beta) || (f === TT_UPPER && ts <= alpha)) {
        return ts;
      }
    }
  }

  const staticEval = inCheck ? -INF : evaluate();

  if (!pvNode && !inCheck && ply > 0) {
    // Reverse futility pruning.
    if (depth <= 3 && beta < MATE_BOUND && staticEval - 90 * depth >= beta) {
      return staticEval;
    }
    // Null-move pruning.
    if (allowNull && depth >= 3 && staticEval >= beta && hasNonPawnMaterial(side)) {
      const r = depth >= 7 ? 3 : 2;
      makeNullMove();
      const v = -search(depth - 1 - r, -beta, -beta + 1, ply + 1, false);
      unmakeNullMove();
      if (stopped) return 0;
      if (v >= beta) return v >= MATE_BOUND ? beta : v;
    }
  }

  const base = ply * MAX_MOVES;
  const count = generate(base, true);
  scoreMoves(base, count, hashMove, ply);
  const end = base + count;
  const k1 = KILLER1[ply];
  const k2 = KILLER2[ply];
  const canFutility =
    !pvNode &&
    !inCheck &&
    depth <= 2 &&
    alpha > -MATE_BOUND &&
    alpha < MATE_BOUND &&
    staticEval + FUTILITY_MARGIN[depth] <= alpha;
  const origAlpha = alpha;
  let legal = 0;
  let bestScore = -INF;
  let bestMove = 0;

  for (let i = base; i < end; i += 1) {
    pickNext(i, end);
    const m = MOVE_BUF[i];
    const piece = board[m & 127];
    if (!makeMove(m)) continue;
    legal += 1;
    const givesCheck = inCheckNow();
    const quiet = (m & (FLAG_CAPTURE | PROMO_MASK)) === 0;
    if (canFutility && quiet && !givesCheck && legal > 1) {
      unmakeMove();
      continue;
    }

    let score: number;
    if (legal === 1) {
      score = -search(depth - 1, -beta, -alpha, ply + 1, true);
    } else {
      let r = 0;
      if (depth >= 3 && quiet && !inCheck && !givesCheck && legal > 3 && m !== k1 && m !== k2) {
        r = legal > 6 && depth >= 5 ? 2 : 1;
        if (pvNode && r > 1) r = 1;
      }
      score = -search(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
      if (score > alpha && r > 0) {
        score = -search(depth - 1, -alpha - 1, -alpha, ply + 1, true);
      }
      if (score > alpha && score < beta) {
        score = -search(depth - 1, -beta, -alpha, ply + 1, true);
      }
    }
    unmakeMove();
    if (stopped) return 0;

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
      if (score > alpha) {
        alpha = score;
        if (ply === 0) {
          rootBestMove = m;
          rootBestScore = score;
        }
        if (score >= beta) {
          if (quiet) {
            if (KILLER1[ply] !== m) {
              KILLER2[ply] = KILLER1[ply];
              KILLER1[ply] = m;
            }
            const hi = piece * 128 + ((m >> 7) & 127);
            HISTORY[hi] += depth * depth;
            if (HISTORY[hi] > HISTORY_MAX) ageHistory();
          }
          break;
        }
      }
    }
  }

  if (legal === 0) return inCheck ? -MATE + ply : 0;

  const flag = bestScore >= beta ? TT_LOWER : bestScore > origAlpha ? TT_EXACT : TT_UPPER;
  ttKey[idx] = hashHi;
  ttMove[idx] = flag === TT_UPPER ? hashMove : bestMove;
  ttScore[idx] = scoreToTT(bestScore, ply);
  ttDepth[idx] = depth > 127 ? 127 : depth;
  ttFlag[idx] = flag;
  return bestScore;
}

// ---------------------------------------------------------------------------
// Helpers for the public API
// ---------------------------------------------------------------------------

function toEngineMove(m: number): EngineMove {
  const from = m & 127;
  const to = (m >> 7) & 127;
  const mv: EngineMove = {
    from: { x: from & 7, y: 7 - (from >> 4) },
    to: { x: to & 7, y: 7 - (to >> 4) },
  };
  const promo = (m >> 14) & 7;
  if (promo !== 0) mv.promotion = PROMO_CHAR[promo];
  return mv;
}

/** Legal moves of the currently loaded position, as internal move codes (uses ply slot `ply`). */
function legalInternal(ply: number): number[] {
  const base = ply * MAX_MOVES;
  const count = generate(base, true);
  const out: number[] = [];
  for (let i = base; i < base + count; i += 1) {
    const m = MOVE_BUF[i];
    if (makeMove(m)) {
      unmakeMove();
      out.push(m);
    }
  }
  return out;
}

function findInternalMove(move: EngineMove): number {
  const legal = legalInternal(0);
  const from = ((7 - move.from.y) << 4) | move.from.x;
  const to = ((7 - move.to.y) << 4) | move.to.x;
  const wantPromo = move.promotion ? PROMO_FROM_CHAR[move.promotion] : QUEEN;
  for (const m of legal) {
    if ((m & 127) !== from || ((m >> 7) & 127) !== to) continue;
    const promo = (m >> 14) & 7;
    if (promo !== 0 && promo !== wantPromo) continue;
    return m;
  }
  return 0;
}

function mateFromScore(score: number): number | null {
  if (score >= MATE_BOUND) return Math.ceil((MATE - score) / 2);
  if (score <= -MATE_BOUND) return -Math.ceil((MATE + score) / 2);
  return null;
}

function extractPv(first: number, maxLen: number): number[] {
  const pv: number[] = [];
  if (!first || !makeMove(first)) return pv;
  pv.push(first);
  const seen = new Set<string>([`${hashLo}:${hashHi}`]);
  while (pv.length < maxLen) {
    const idx = hashLo & TT_MASK;
    if (ttFlag[idx] === 0 || ttKey[idx] !== hashHi) break;
    const m = ttMove[idx];
    if (!m) break;
    const base = pv.length * MAX_MOVES;
    const count = generate(base, true);
    let found = false;
    for (let i = base; i < base + count; i += 1) {
      if (MOVE_BUF[i] === m) {
        found = true;
        break;
      }
    }
    if (!found || !makeMove(m)) break;
    pv.push(m);
    const key = `${hashLo}:${hashHi}`;
    if (seen.has(key)) break;
    seen.add(key);
  }
  for (let i = 0; i < pv.length; i += 1) unmakeMove();
  return pv;
}

type DifficultySettings = {
  timeMs: number;
  maxDepth: number;
  evalNoise: number;
};

export const DIFFICULTY_SETTINGS: Readonly<Record<Difficulty, Readonly<DifficultySettings>>> = {
  easy: { timeMs: 300, maxDepth: 2, evalNoise: 0 },
  medium: { timeMs: 400, maxDepth: 4, evalNoise: 8 },
  hard: { timeMs: 1500, maxDepth: 64, evalNoise: 0 },
};

/** Easy mode: score every root move exactly at a shallow depth and pick a "human" one. */
function pickEasyMove(rootMoves: number[], depth: number): { move: number; score: number } {
  const scored: Array<{ move: number; score: number }> = [];
  for (const m of rootMoves) {
    if (!makeMove(m)) continue;
    const s = -search(depth - 1, -INF, INF, 1, true);
    unmakeMove();
    if (stopped) break;
    scored.push({ move: m, score: s });
  }
  if (!scored.length) return { move: rootMoves[0], score: 0 };
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (best.score >= MATE_BOUND) return best;
  // Occasionally pick any reasonable move; otherwise the best after random noise.
  if (Math.random() < 0.12) {
    const pool = scored.filter((s) => s.score >= best.score - 220);
    return pool[Math.floor(Math.random() * pool.length)];
  }
  let chosen = best;
  let chosenValue = -Infinity;
  for (const s of scored) {
    if (s.score < best.score - 150) break;
    const v = s.score + (Math.random() * 2 - 1) * 55;
    if (v > chosenValue) {
      chosenValue = v;
      chosen = s;
    }
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search the position and return the engine's move for the side to move.
 * Synchronous; runs for at most about `timeMs` (it always completes depth 1 first).
 */
export function findBestMove(state: ChessState, opts: SearchOptions): SearchResult {
  const start = now();
  const settings = DIFFICULTY_SETTINGS[opts?.difficulty] ?? DIFFICULTY_SETTINGS.medium;
  const difficulty: Difficulty = DIFFICULTY_SETTINGS[opts?.difficulty] ? opts.difficulty : "medium";
  const timeMs = Math.max(1, opts?.timeMs ?? settings.timeMs);
  let maxDepth = Math.floor(opts?.maxDepth ?? settings.maxDepth);
  if (!(maxDepth >= 1)) maxDepth = 1;
  if (maxDepth > MAX_PLY - 16) maxDepth = MAX_PLY - 16;

  setup(state, true);
  ensureTT();
  const noiseTag = settings.evalNoise === 0 ? 0 : 1;
  if (noiseTag !== 0 || ttNoiseTag !== 0) clearTT();
  ttNoiseTag = noiseTag;
  evalNoise = settings.evalNoise;
  noiseSeed = (Math.random() * 0x7fffffff) | 0;
  KILLER1.fill(0);
  KILLER2.fill(0);
  ageHistory();
  nodes = 0;
  stopped = false;
  deadline = start + timeMs;

  const rootMoves = legalInternal(0);
  const finish = (move: number, score: number, depth: number): SearchResult => {
    const pv = move ? extractPv(move, Math.max(1, depth)).map(toEngineMove) : [];
    evalNoise = 0;
    return {
      move: move ? toEngineMove(move) : null,
      score,
      depth,
      nodes,
      mate: mateFromScore(score),
      pv,
      elapsedMs: Math.round(now() - start),
    };
  };

  if (rootMoves.length === 0) {
    evalNoise = 0;
    const mated = inCheckNow();
    return {
      move: null,
      score: mated ? -MATE : 0,
      depth: 0,
      nodes: 0,
      mate: mated ? 0 : null,
      pv: [],
      elapsedMs: Math.round(now() - start),
    };
  }

  if (difficulty === "easy") {
    const depth = Math.min(maxDepth, Math.random() < 0.35 ? 1 : 2);
    const picked = pickEasyMove(rootMoves, depth);
    return finish(picked.move, picked.score, depth);
  }

  let budget = timeMs;
  if (rootMoves.length === 1) {
    // Forced move: just get a quick score for it.
    budget = Math.min(timeMs, 30);
    maxDepth = Math.min(maxDepth, 6);
  }

  let bestMove = rootMoves[0];
  let bestScore = 0;
  let completedDepth = 0;
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    // Depth 1 always completes so there is a searched move even with a tiny budget.
    deadline = depth === 1 ? Infinity : start + budget;
    rootBestMove = 0;
    rootBestScore = -INF;
    const score = search(depth, -INF, INF, 0, true);
    if (stopped) {
      if (rootBestMove) {
        bestMove = rootBestMove;
        bestScore = rootBestScore;
      }
      break;
    }
    if (rootBestMove) bestMove = rootBestMove;
    bestScore = score;
    completedDepth = depth;
    const matePlies = Math.abs(score) >= MATE_BOUND ? MATE - Math.abs(score) : -1;
    if (matePlies >= 0 && depth >= matePlies + 2) break;
    // Not enough time left to finish another iteration.
    if (now() - start >= budget * 0.55) break;
  }
  return finish(bestMove, bestScore, completedDepth);
}

/** All legal moves for the side to move. Promotions appear four times (q, r, b, n). */
export function legalMoves(state: ChessState): EngineMove[] {
  setup(state, false);
  return legalInternal(0).map(toEngineMove);
}

/** Count leaf nodes of the legal move tree (move-generator validation). */
export function perft(state: ChessState, depth: number): number {
  setup(state, false);
  return perftRec(depth, 0);
}

function perftRec(depth: number, ply: number): number {
  if (depth <= 0) return 1;
  const base = ply * MAX_MOVES;
  const count = generate(base, true);
  let total = 0;
  for (let i = base; i < base + count; i += 1) {
    if (!makeMove(MOVE_BUF[i])) continue;
    total += depth === 1 ? 1 : perftRec(depth - 1, ply + 1);
    unmakeMove();
  }
  return total;
}

/**
 * Repetition key of a position: the first four FEN fields
 * (placement, side to move, castling rights, en-passant square), e.g.
 * "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -".
 * Castling rights are dropped when the king/rook are not on their home squares and the
 * en-passant square is kept only if a pawn could actually capture there, so equal
 * positions always produce equal keys.
 */
export function positionKey(state: ChessState): string {
  return keyOf(toInternal(state));
}

/** Parse a FEN string. Missing trailing fields default to "w - - 0 1". */
export function fromFen(fen: string): ChessState {
  const parts = fen.trim().split(/\s+/);
  const rows = (parts[0] ?? "").split("/");
  if (rows.length !== 8) throw new Error(`Invalid FEN: ${fen}`);
  const boardOut: string[][] = [];
  for (const rowStr of rows) {
    const row: string[] = [];
    for (const ch of rowStr) {
      if (ch >= "1" && ch <= "8") {
        for (let k = 0; k < Number(ch); k += 1) row.push("");
      } else if (PIECE_FROM_CHAR[ch] !== undefined) {
        row.push(ch);
      } else {
        throw new Error(`Invalid FEN: ${fen}`);
      }
    }
    if (row.length !== 8) throw new Error(`Invalid FEN: ${fen}`);
    boardOut.push(row);
  }
  const turn: Color = parts[1] === "b" ? "b" : "w";
  const c = parts[2] ?? "-";
  const castling: CastlingRights = {
    wK: c.includes("K"),
    wQ: c.includes("Q"),
    bK: c.includes("k"),
    bQ: c.includes("q"),
  };
  let enPassant: BoardSquare | null = null;
  const e = parts[3] ?? "-";
  if (/^[a-h][1-8]$/.test(e)) {
    enPassant = { x: e.charCodeAt(0) - 97, y: 8 - Number(e[1]) };
  }
  const halfmoveClock = parts[4] !== undefined ? Number(parts[4]) || 0 : 0;
  return { board: boardOut, turn, castling, enPassant, halfmoveClock, history: [] };
}

/** Serialize a state as FEN (fullmove number is always 1; halfmove clock from the state). */
export function toFen(state: ChessState): string {
  return `${positionKey(state)} ${Math.max(0, state.halfmoveClock ?? 0)} 1`;
}

/** Whether the side to move is in check. */
export function isInCheck(state: ChessState): boolean {
  setup(state, false);
  return inCheckNow();
}

/**
 * Play a legal move and return the next state (board copied; history and halfmove clock
 * extended). A pawn reaching the last rank promotes to `move.promotion` or a queen.
 * Throws if the move is illegal.
 */
export function applyMove(state: ChessState, move: EngineMove): ChessState {
  setup(state, false);
  const m = findInternalMove(move);
  if (!m) throw new Error("Illegal move");
  const resetsClock = (m & FLAG_CAPTURE) !== 0 || (board[m & 127] & 7) === PAWN;
  makeMove(m);
  const boardOut: string[][] = [];
  for (let y = 0; y < 8; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < 8; x += 1) row.push(CHAR_FROM_PIECE[board[((7 - y) << 4) | x]]);
    boardOut.push(row);
  }
  const from = m & 127;
  const to = (m >> 7) & 127;
  let enPassant: BoardSquare | null = null;
  if (m & FLAG_DOUBLE) {
    const mid = (from + to) >> 1;
    enPassant = { x: mid & 7, y: 7 - (mid >> 4) };
  }
  return {
    board: boardOut,
    turn: side === WHITE ? "w" : "b",
    castling: {
      wK: (castle & CASTLE_WK) !== 0,
      wQ: (castle & CASTLE_WQ) !== 0,
      bK: (castle & CASTLE_BK) !== 0,
      bQ: (castle & CASTLE_BQ) !== 0,
    },
    enPassant,
    history: [...(state.history ?? []), positionKey(state)],
    halfmoveClock: resetsClock ? 0 : Math.max(0, state.halfmoveClock ?? 0) + 1,
  };
}

/**
 * Game-over detection: checkmate, stalemate, threefold repetition (using `history`),
 * the 50-move rule (using `halfmoveClock`) and insufficient material.
 */
export function getGameStatus(state: ChessState): { status: GameStatus; inCheck: boolean } {
  const int = toInternal(state);
  loadInternal(int);
  const check = inCheckNow();
  if (legalInternal(0).length === 0) {
    return { status: check ? "checkmate" : "stalemate", inCheck: check };
  }
  if (isInsufficientMaterial() || sameColoredBishopsOnly()) {
    return { status: "insufficient-material", inCheck: check };
  }
  if ((state.halfmoveClock ?? 0) >= 100) {
    return { status: "fifty-move", inCheck: check };
  }
  const key = keyOf(int);
  const history = state.history ?? [];
  let end = history.length;
  if (end > 0 && history[end - 1] === key) end -= 1; // tolerate the current position being included
  let count = 1;
  for (let i = 0; i < end; i += 1) {
    if (history[i] === key) count += 1;
  }
  if (count >= 3) return { status: "threefold", inCheck: check };
  return { status: "ongoing", inCheck: check };
}

function sameColoredBishopsOnly(): boolean {
  for (let i = 0; i < 64; i += 1) {
    const p = board[SQ64[i]] & 7;
    if (p !== 0 && p !== KING && p !== BISHOP) return false;
  }
  let light = 0;
  let dark = 0;
  for (let i = 0; i < 64; i += 1) {
    const sq = SQ64[i];
    if ((board[sq] & 7) !== BISHOP) continue;
    if (((sq >> 4) + (sq & 7)) & 1) light += 1;
    else dark += 1;
  }
  return light === 0 || dark === 0;
}

/** UCI-style move text, e.g. "e2e4" or "e7e8q". */
export function moveToUci(move: EngineMove): string {
  const sq = (s: BoardSquare) => `${"abcdefgh"[s.x]}${8 - s.y}`;
  return `${sq(move.from)}${sq(move.to)}${move.promotion ?? ""}`;
}

/** Parse "e2e4" / "e7e8q" into an EngineMove (no legality check). */
export function moveFromUci(uci: string): EngineMove | null {
  const m = /^([a-h])([1-8])([a-h])([1-8])([qrbn])?$/.exec(uci.trim().toLowerCase());
  if (!m) return null;
  const move: EngineMove = {
    from: { x: m[1].charCodeAt(0) - 97, y: 8 - Number(m[2]) },
    to: { x: m[3].charCodeAt(0) - 97, y: 8 - Number(m[4]) },
  };
  if (m[5]) move.promotion = m[5] as PromotionPiece;
  return move;
}
