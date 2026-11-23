// Klondike solitaire rules used by the terminal's `solitaire` app. Pure
// functions over plain arrays so they can be unit-tested; the terminal owns
// the state and the drawing.

export const SOLITAIRE_RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
] as const;

export const SOLITAIRE_SUITS = ["♠", "♥", "♦", "♣"] as const;

export type SolitaireSuit = (typeof SOLITAIRE_SUITS)[number];
export type SolitaireCard = { rank: string; suit: string; faceUp: boolean };
export type Foundations = Record<string, SolitaireCard[]>;

export type SolitaireSource = { type: "waste" } | { type: "tableau"; index: number };

export function rankIndex(rank: string): number {
  return SOLITAIRE_RANKS.findIndex((item) => item === rank);
}

export function isRedSuit(suit: string): boolean {
  return suit === "♥" || suit === "♦";
}

export function cardLabel(card: SolitaireCard): string {
  return `${card.rank}${card.suit}`;
}

export function emptyFoundations(): Foundations {
  return { "♠": [], "♥": [], "♦": [], "♣": [] };
}

/** A shuffled 52-card deck (random = Math.random by default, injectable for tests). */
export function shuffledDeck(random: () => number = Math.random): SolitaireCard[] {
  const deck: SolitaireCard[] = [];
  SOLITAIRE_SUITS.forEach((suit) => {
    SOLITAIRE_RANKS.forEach((rank) => deck.push({ rank, suit, faceUp: false }));
  });
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** Deals 7 tableau piles (1..7 cards, top card face up); the rest is the stock. */
export function deal(deck: SolitaireCard[]): {
  tableau: SolitaireCard[][];
  stock: SolitaireCard[];
} {
  const cards = deck.slice();
  const tableau: SolitaireCard[][] = [];
  for (let i = 0; i < 7; i += 1) {
    const pile: SolitaireCard[] = [];
    for (let j = 0; j <= i; j += 1) {
      const card = cards.pop() as SolitaireCard;
      pile.push({ ...card, faceUp: j === i });
    }
    tableau.push(pile);
  }
  return { tableau, stock: cards.map((card) => ({ ...card, faceUp: false })) };
}

/** Can `moving` go on top of `target` in the tableau (empty pile: kings only)? */
export function canStackOnTableau(
  moving: SolitaireCard,
  target: SolitaireCard | undefined,
): boolean {
  if (!target) {
    return moving.rank === "K";
  }
  if (!target.faceUp) {
    return false;
  }
  return (
    rankIndex(target.rank) - rankIndex(moving.rank) === 1 &&
    isRedSuit(moving.suit) !== isRedSuit(target.suit)
  );
}

export function canStackOnFoundation(
  card: SolitaireCard,
  foundations: Foundations,
): boolean {
  const pile = foundations[card.suit] ?? [];
  const top = pile[pile.length - 1];
  if (!top) {
    return card.rank === "A";
  }
  return rankIndex(card.rank) === rankIndex(top.rank) + 1;
}

/** Index of the first face-up card of a pile (pile.length when none). */
export function faceUpStart(pile: SolitaireCard[]): number {
  let index = pile.length;
  while (index > 0 && pile[index - 1].faceUp) {
    index -= 1;
  }
  return index;
}

/**
 * Which card of the source pile's face-up run can move onto `target`: the
 * whole run from that card up is moved. Returns -1 when nothing fits. In a
 * Klondike run ranks fall by one, so at most one card has the needed rank;
 * for an empty target that is the run's king.
 */
export function findMovableRun(
  pile: SolitaireCard[],
  target: SolitaireCard | undefined,
): number {
  for (let index = faceUpStart(pile); index < pile.length; index += 1) {
    if (canStackOnTableau(pile[index], target)) {
      // A king already at the bottom of its pile gains nothing from moving.
      if (!target && index === 0) {
        return -1;
      }
      return index;
    }
  }
  return -1;
}

/** Turns the new top card of a tableau pile face up. */
export function revealTop(pile: SolitaireCard[]): void {
  const top = pile[pile.length - 1];
  if (top && !top.faceUp) {
    top.faceUp = true;
  }
}

export function isWon(foundations: Foundations): boolean {
  return SOLITAIRE_SUITS.every((suit) => (foundations[suit]?.length ?? 0) === 13);
}

/** First card that can go to a foundation: the waste top, then tableau tops. */
export function findFoundationMove(
  waste: SolitaireCard[],
  tableau: SolitaireCard[][],
  foundations: Foundations,
): SolitaireSource | null {
  const wasteTop = waste[waste.length - 1];
  if (wasteTop && canStackOnFoundation(wasteTop, foundations)) {
    return { type: "waste" };
  }
  for (let index = 0; index < tableau.length; index += 1) {
    const top = tableau[index][tableau[index].length - 1];
    if (top?.faceUp && canStackOnFoundation(top, foundations)) {
      return { type: "tableau", index };
    }
  }
  return null;
}
