/**
 * Web Worker running the chess engine off the main thread.
 *
 * Request:  { id: number; state: ChessState; difficulty: Difficulty; timeMs?: number }
 * Response: { id: number; result: SearchResult } or { id: number; error: string }
 */
import { findBestMove, type ChessState, type Difficulty, type SearchResult } from "./engine";

export type ChessWorkerRequest = {
  id: number;
  state: ChessState;
  difficulty: Difficulty;
  timeMs?: number;
};

export type ChessWorkerResponse =
  | { id: number; result: SearchResult; error?: undefined }
  | { id: number; error: string; result?: undefined };

// Typed locally so the file compiles against the project's DOM lib (no "webworker" lib needed).
type WorkerScope = {
  onmessage: ((event: MessageEvent<ChessWorkerRequest>) => void) | null;
  postMessage(message: ChessWorkerResponse): void;
};

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const { id, state, difficulty, timeMs } = event.data;
  try {
    const result = findBestMove(state, { difficulty, timeMs });
    scope.postMessage({ id, result });
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
