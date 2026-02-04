"""Minimal Pacman demo (turn-based)."""

from __future__ import annotations

import random
import sys
try:
	from itertools import product
except ImportError:  # pragma: no cover - fallback for minimal runtimes
	def product(*args):
		pools = [tuple(pool) for pool in args]
		result = [[]]
		for pool in pools:
			result = [x + [y] for x in result for y in pool]
		for combo in result:
			yield tuple(combo)


WALL = "#"
PELLET = "."
EMPTY = " "
PAC = "C"
GHOST = "G"


def build_map(width: int, height: int) -> list[list[str]]:
	grid = [[PELLET for _ in range(width)] for _ in range(height)]
	for x in range(width):
		grid[0][x] = WALL
		grid[height - 1][x] = WALL
	for y in range(height):
		grid[y][0] = WALL
		grid[y][width - 1] = WALL
	for y, x in product(range(2, height - 2, 3), range(2, width - 2)):
		if x % 4 == 0:
			grid[y][x] = WALL
	return grid


def parse_size_arg(name: str, default: int) -> int:
	value = default
	args = sys.argv[1:]
	for index, arg in enumerate(args):
		if arg == name and index + 1 < len(args):
			try:
				value = int(args[index + 1])
			except ValueError:
				value = default
			break
		if arg.startswith(f"{name}="):
			try:
				value = int(arg.split("=", 1)[1])
			except ValueError:
				value = default
			break
	return value


def main() -> None:
	width = max(12, parse_size_arg("--width", 20))
	height = max(10, parse_size_arg("--height", 12))
	grid = build_map(width, height)

	pac = [1, 1]
	ghost = [width - 2, height - 2]
	score = 0

	while True:
		display = [row[:] for row in grid]
		display[pac[1]][pac[0]] = PAC
		display[ghost[1]][ghost[0]] = GHOST
		print("\n".join("".join(row) for row in display))
		print(f"Score: {score}")
		move = input("Move (WASD, Q=quit): ").strip().lower()
		if move == "q":
			break
		dx, dy = 0, 0
		if move == "w":
			dy = -1
		elif move == "s":
			dy = 1
		elif move == "a":
			dx = -1
		elif move == "d":
			dx = 1

		nx, ny = pac[0] + dx, pac[1] + dy
		if grid[ny][nx] != WALL:
			pac = [nx, ny]
			if grid[ny][nx] == PELLET:
				grid[ny][nx] = EMPTY
				score += 1

		gx, gy = ghost
		choices = [(1, 0), (-1, 0), (0, 1), (0, -1)]
		random.shuffle(choices)
		for dx, dy in choices:
			nx, ny = gx + dx, gy + dy
			if grid[ny][nx] != WALL:
				ghost = [nx, ny]
				break

		if pac == ghost:
			print("Caught by ghost. Game over!")
			break
		if all(PELLET not in row for row in grid):
			print("All pellets collected. You win!")
			break


if __name__ == "__main__":
	main()
