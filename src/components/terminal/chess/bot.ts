/**
 * Chess bot facade: runs the engine in a Web Worker when possible and falls back to
 * running it on the main thread (deferred with setTimeout) when workers are unavailable
 * or fail. Safe to import during SSR: nothing touches `window` / `Worker` until used.
 */
import type { ChessState, Difficulty, SearchResult } from "./engine";
import type { ChessWorkerRequest, ChessWorkerResponse } from "./chess.worker";

export type ChessBot = {
  /** Resolve with the engine's search result for the side to move in `state`. */
  bestMove(state: ChessState, difficulty: Difficulty, timeMs?: number): Promise<SearchResult>;
  /** Abort pending searches (their promises reject); the bot stays usable. */
  cancel(): void;
  /** Abort pending searches and release the worker. Further calls reject. */
  dispose(): void;
};

type Pending = {
  request: ChessWorkerRequest;
  resolve: (result: SearchResult) => void;
  reject: (error: Error) => void;
  watchdog: ReturnType<typeof setTimeout> | null;
};

const DEFAULT_TIME: Record<Difficulty, number> = { easy: 300, medium: 400, hard: 1500 };

function runOnMainThread(request: ChessWorkerRequest): Promise<SearchResult> {
  return new Promise<SearchResult>((resolve, reject) => {
    // Defer so the caller's frame (e.g. the move animation) can render first.
    setTimeout(() => {
      import("./engine")
        .then(({ findBestMove }) => {
          resolve(
            findBestMove(request.state, {
              difficulty: request.difficulty,
              timeMs: request.timeMs,
            }),
          );
        })
        .catch((error: unknown) => {
          reject(error instanceof Error ? error : new Error(String(error)));
        });
    }, 0);
  });
}

export function createChessBot(): ChessBot {
  let worker: Worker | null = null;
  let workerBroken = false;
  let disposed = false;
  let nextId = 1;
  const pending = new Map<number, Pending>();

  const clearWatchdog = (entry: Pending) => {
    if (entry.watchdog !== null) {
      clearTimeout(entry.watchdog);
      entry.watchdog = null;
    }
  };

  const settleWithFallback = (entry: Pending) => {
    clearWatchdog(entry);
    runOnMainThread(entry.request).then(entry.resolve, entry.reject);
  };

  /** The worker is unusable: drop it and finish everything pending on the main thread. */
  const failWorker = () => {
    workerBroken = true;
    if (worker) {
      worker.terminate();
      worker = null;
    }
    const entries = Array.from(pending.values());
    pending.clear();
    entries.forEach(settleWithFallback);
  };

  const getWorker = (): Worker | null => {
    if (worker || workerBroken) return worker;
    if (typeof Worker === "undefined") {
      workerBroken = true;
      return null;
    }
    try {
      const w = new Worker(new URL("./chess.worker.ts", import.meta.url), { type: "module" });
      w.onmessage = (event: MessageEvent<ChessWorkerResponse>) => {
        const data = event.data;
        const entry = pending.get(data.id);
        if (!entry) return;
        pending.delete(data.id);
        if (data.result) {
          clearWatchdog(entry);
          entry.resolve(data.result);
        } else {
          settleWithFallback(entry);
        }
      };
      w.onerror = (event) => {
        event.preventDefault?.();
        failWorker();
      };
      w.onmessageerror = () => failWorker();
      worker = w;
    } catch {
      workerBroken = true;
      worker = null;
    }
    return worker;
  };

  const rejectAll = (message: string) => {
    const entries = Array.from(pending.values());
    pending.clear();
    entries.forEach((entry) => {
      clearWatchdog(entry);
      entry.reject(new Error(message));
    });
  };

  return {
    bestMove(state, difficulty, timeMs) {
      if (disposed) return Promise.reject(new Error("Chess bot disposed"));
      const request: ChessWorkerRequest = {
        id: nextId,
        // Plain JSON copy so the state can be structured-cloned / is not mutated later.
        state: {
          board: state.board.map((row) => row.slice()),
          turn: state.turn,
          castling: { ...state.castling },
          enPassant: state.enPassant ? { ...state.enPassant } : null,
          history: state.history ? state.history.slice() : undefined,
          halfmoveClock: state.halfmoveClock,
        },
        difficulty,
        timeMs,
      };
      nextId += 1;
      const w = getWorker();
      if (!w) return runOnMainThread(request);
      return new Promise<SearchResult>((resolve, reject) => {
        const entry: Pending = { request, resolve, reject, watchdog: null };
        // If the worker never answers (e.g. failed to load silently), fall back.
        const budget = timeMs ?? DEFAULT_TIME[difficulty] ?? 1500;
        entry.watchdog = setTimeout(() => {
          entry.watchdog = null;
          if (pending.has(request.id)) failWorker();
        }, budget + 5000);
        pending.set(request.id, entry);
        try {
          w.postMessage(request);
        } catch {
          failWorker();
        }
      });
    },
    cancel() {
      if (worker) {
        // Terminating is the only way to interrupt a running search; a fresh worker is
        // created on the next request.
        worker.terminate();
        worker = null;
      }
      rejectAll("Chess search cancelled");
    },
    dispose() {
      disposed = true;
      if (worker) {
        worker.terminate();
        worker = null;
      }
      rejectAll("Chess bot disposed");
    },
  };
}
