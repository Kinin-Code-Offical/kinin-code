"""Quote bot.

Examples:
  python quote_bot.py --count 2
"""

from __future__ import annotations

import argparse
import random


QUOTES = {
    "focus": [
        "Focus beats luck.",
        "Slow is smooth, smooth is fast.",
        "One task at a time.",
    ],
    "build": [
        "Ship it.",
        "Small steps, big wins.",
        "Make it work, make it right, make it fast.",
    ],
    "retro": [
        "Boot sequence complete.",
        "Insert disk and press any key.",
        "Pixels are forever.",
    ],
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Quote bot")
    parser.add_argument("--count", type=int, default=1, help="Number of quotes")
    parser.add_argument("--category", default="all", help="Quote category")
    parser.add_argument("--seed", type=int, default=None, help="Seed RNG")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    if args.category == "all":
        pool = [quote for items in QUOTES.values() for quote in items]
    else:
        pool = QUOTES.get(args.category, [])
    if not pool:
        available = ", ".join(sorted(QUOTES))
        raise SystemExit(f"Unknown category. Available: {available}")

    for _ in range(max(1, args.count)):
        print(random.choice(pool))


if __name__ == "__main__":
    main()
