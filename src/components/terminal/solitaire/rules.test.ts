import { describe, expect, it } from "vitest";
import {
  canStackOnFoundation,
  canStackOnTableau,
  deal,
  emptyFoundations,
  findFoundationMove,
  findMovableRun,
  isWon,
  shuffledDeck,
  SOLITAIRE_RANKS,
  SOLITAIRE_SUITS,
  type SolitaireCard,
} from "./rules";

const up = (rank: string, suit: string): SolitaireCard => ({ rank, suit, faceUp: true });
const down = (rank: string, suit: string): SolitaireCard => ({ rank, suit, faceUp: false });

describe("solitaire deal", () => {
  it("deals 28 tableau cards (top ones face up) and leaves 24 in the stock", () => {
    const { tableau, stock } = deal(shuffledDeck(() => 0.5));
    expect(tableau.map((pile) => pile.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    tableau.forEach((pile) => {
      expect(pile[pile.length - 1].faceUp).toBe(true);
      expect(pile.slice(0, -1).every((card) => !card.faceUp)).toBe(true);
    });
    expect(stock).toHaveLength(24);
    const all = [...tableau.flat(), ...stock].map((c) => `${c.rank}${c.suit}`);
    expect(new Set(all).size).toBe(52);
  });
});

describe("solitaire moves", () => {
  it("stacks alternating colours one rank down; only kings on empty piles", () => {
    expect(canStackOnTableau(up("Q", "♥"), up("K", "♠"))).toBe(true);
    expect(canStackOnTableau(up("Q", "♠"), up("K", "♣"))).toBe(false);
    expect(canStackOnTableau(up("J", "♥"), up("K", "♠"))).toBe(false);
    expect(canStackOnTableau(up("K", "♦"), undefined)).toBe(true);
    expect(canStackOnTableau(up("Q", "♦"), undefined)).toBe(false);
    expect(canStackOnTableau(up("Q", "♥"), down("K", "♠"))).toBe(false);
  });

  it("moves a whole face-up run from the card that fits", () => {
    // 9♣ (down) | 8♥ 7♠ 6♦ face up
    const pile = [down("9", "♣"), up("8", "♥"), up("7", "♠"), up("6", "♦")];
    expect(findMovableRun(pile, up("9", "♠"))).toBe(1); // 8♥ 7♠ 6♦
    expect(findMovableRun(pile, up("8", "♦"))).toBe(2); // 7♠ 6♦
    expect(findMovableRun(pile, up("7", "♣"))).toBe(3);
    expect(findMovableRun(pile, up("5", "♣"))).toBe(-1);
  });

  it("moves a king-led run to an empty pile, but not a king already at the bottom", () => {
    expect(findMovableRun([down("2", "♣"), up("K", "♥"), up("Q", "♠")], undefined)).toBe(1);
    expect(findMovableRun([up("K", "♥"), up("Q", "♠")], undefined)).toBe(-1);
  });

  it("builds foundations from the ace up, by suit", () => {
    const foundations = emptyFoundations();
    expect(canStackOnFoundation(up("A", "♥"), foundations)).toBe(true);
    expect(canStackOnFoundation(up("2", "♥"), foundations)).toBe(false);
    foundations["♥"].push(up("A", "♥"));
    expect(canStackOnFoundation(up("2", "♥"), foundations)).toBe(true);
    expect(canStackOnFoundation(up("2", "♠"), foundations)).toBe(false);
  });

  it("finds a card for the foundation: waste first, then piles left to right", () => {
    const foundations = emptyFoundations();
    const tableau = [[up("5", "♠")], [down("3", "♦"), up("A", "♣")]];
    expect(findFoundationMove([up("A", "♥")], tableau, foundations)).toEqual({ type: "waste" });
    expect(findFoundationMove([up("4", "♥")], tableau, foundations)).toEqual({ type: "tableau", index: 1 });
    expect(findFoundationMove([], [[up("5", "♠")]], foundations)).toBeNull();
  });

  it("is won when every foundation holds all 13 cards", () => {
    const foundations = emptyFoundations();
    expect(isWon(foundations)).toBe(false);
    SOLITAIRE_SUITS.forEach((suit) => {
      foundations[suit] = SOLITAIRE_RANKS.map((rank) => up(rank, suit));
    });
    expect(isWon(foundations)).toBe(true);
  });
});
