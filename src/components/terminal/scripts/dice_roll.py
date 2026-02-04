"""Dice roller with stats.

Examples:
  python dice_roll.py --sides 20 --count 3
"""

from __future__ import annotations

import argparse
import random
from collections import Counter


def main() -> None:
	parser = argparse.ArgumentParser(description="Dice roller")
	parser.add_argument("--sides", type=int, default=6, help="Sides per die")
	parser.add_argument("--count", type=int, default=1, help="Number of rolls")
	parser.add_argument("--seed", type=int, default=None, help="Seed RNG")
	args = parser.parse_args()

	sides = max(2, args.sides)
	count = max(1, args.count)
	if args.seed is not None:
		random.seed(args.seed)

	rolls = [random.randint(1, sides) for _ in range(count)]
	total = sum(rolls)
	print(f"Rolls: {', '.join(map(str, rolls))}")
	print(f"Total: {total}  Avg: {total / count:.2f}")

	histogram = Counter(rolls)
	print("Histogram:")
	for face in range(1, sides + 1):
		bar = "#" * histogram.get(face, 0)
		print(f"{face:>2}: {bar}")


if __name__ == "__main__":
	main()
