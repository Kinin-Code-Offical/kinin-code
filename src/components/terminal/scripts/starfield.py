"""Animated ASCII starfield."""

from __future__ import annotations

import argparse
import os
import random
import time


def clear() -> None:
	os.system("cls" if os.name == "nt" else "clear")


def main() -> None:
	parser = argparse.ArgumentParser(description="ASCII starfield")
	parser.add_argument("--width", type=int, default=60)
	parser.add_argument("--height", type=int, default=14)
	parser.add_argument("--frames", type=int, default=30)
	parser.add_argument("--speed", type=float, default=0.06)
	parser.add_argument("--seed", type=int, default=None)
	args = parser.parse_args()

	if args.seed is not None:
		random.seed(args.seed)

	width = max(20, args.width)
	height = max(8, args.height)
	stars = [
		{
			"x": random.uniform(0, width),
			"y": random.uniform(0, height),
			"z": random.uniform(0.4, 1.0),
		}
		for _ in range(int(width * height * 0.06))
	]

	for _ in range(max(1, args.frames)):
		buffer = [[" " for _ in range(width)] for _ in range(height)]
		for star in stars:
			x = int(star["x"])
			y = int(star["y"])
			if 0 <= x < width and 0 <= y < height:
				buffer[y][x] = "." if star["z"] < 0.6 else "*"
			star["x"] += star["z"] * 0.8
			if star["x"] >= width:
				star["x"] = 0
				star["y"] = random.uniform(0, height)
				star["z"] = random.uniform(0.4, 1.0)
		clear()
		print("\n".join("".join(row) for row in buffer))
		time.sleep(max(0.01, args.speed))


if __name__ == "__main__":
	main()
