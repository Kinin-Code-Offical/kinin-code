"""Minimal Solitaire demo (draw + move waste)."""

from __future__ import annotations

import random
from itertools import product


SUITS = ["♠", "♥", "♦", "♣"]
RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]


def rank_index(rank: str) -> int:
	return RANKS.index(rank)


def is_red(suit: str) -> bool:
	return suit in {"♥", "♦"}


def main() -> None:
	deck = [(rank, suit) for suit in SUITS for rank in RANKS]
	random.shuffle(deck)
	waste: list[tuple[str, str]] = []
	foundations = {suit: [] for suit in SUITS}
	tableau = [[] for _ in range(4)]

	for i, _ in product(range(4), range(2)):
		tableau[i].append(deck.pop())

	while True:
		print("\nFoundations:")
		for suit in SUITS:
			top = foundations[suit][-1][0] if foundations[suit] else "--"
			print(f"{suit}: {top}")
		print("Tableau:")
		for idx, pile in enumerate(tableau, 1):
			shown = " ".join(f"{r}{s}" for r, s in pile[-3:]) or "--"
			print(f"T{idx}: {shown}")
		print(f"Stock: {len(deck)}  Waste: {waste[-1] if waste else '--'}")

		cmd = input("Command (d=draw, f=foundation, tN=tableau, q=quit): ")
		cmd = cmd.strip().lower()
		if cmd == "q":
			break
		if cmd == "d":
			if deck:
				waste.append(deck.pop())
			else:
				deck = waste[::-1]
				waste = []
			continue
		if cmd == "f":
			if not waste:
				print("Waste empty.")
				continue
			rank, suit = waste[-1]
			if not foundations[suit] and rank != "A":
				print("Foundation needs an Ace.")
				continue
			if foundations[suit] and rank_index(rank) != rank_index(
				foundations[suit][-1][0]
			) + 1:
				print("Invalid foundation move.")
				continue
			foundations[suit].append(waste.pop())
			continue
		if cmd.startswith("t") and cmd[1:].isdigit():
			idx = int(cmd[1:]) - 1
			if idx not in range(len(tableau)):
				print("Bad tableau index.")
				continue
			if not waste:
				print("Waste empty.")
				continue
			rank, suit = waste[-1]
			target = tableau[idx][-1] if tableau[idx] else None
			if not target and rank != "K":
				print("Empty pile needs King.")
				continue
			if target:
				tr, ts = target
				if rank_index(rank) != rank_index(tr) - 1:
					print("Rank must descend.")
					continue
				if is_red(suit) == is_red(ts):
					print("Colors must alternate.")
					continue
			tableau[idx].append(waste.pop())
			continue

		print("Unknown command.")


if __name__ == "__main__":
	main()
