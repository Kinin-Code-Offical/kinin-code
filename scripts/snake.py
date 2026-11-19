"""Turn-based Snake game."""

from __future__ import annotations

import random
import sys


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


def draw(board: list[list[str]]) -> None:
	print("\n".join("".join(row) for row in board))


def main() -> None:
	width = max(10, parse_size_arg("--width", 16))
	height = max(8, parse_size_arg("--height", 12))
	snake = [(width // 2, height // 2)]
	direction = (1, 0)
	food = (random.randint(1, width - 2), random.randint(1, height - 2))
	score = 0

	while True:
		board = [[" " for _ in range(width)] for _ in range(height)]
		for x in range(width):
			board[0][x] = "#"
			board[height - 1][x] = "#"
		for y in range(height):
			board[y][0] = "#"
			board[y][width - 1] = "#"

		for x, y in snake:
			board[y][x] = "o"
		head_x, head_y = snake[-1]
		board[head_y][head_x] = "@"
		fx, fy = food
		board[fy][fx] = "*"

		draw(board)
		print(f"Score: {score}")
		move = input("Move (WASD, Q=quit): ").strip().lower()
		if move == "q":
			break
		if move == "w":
			direction = (0, -1)
		elif move == "s":
			direction = (0, 1)
		elif move == "a":
			direction = (-1, 0)
		elif move == "d":
			direction = (1, 0)

		nx = head_x + direction[0]
		ny = head_y + direction[1]
		if board[ny][nx] == "#" or (nx, ny) in snake:
			print("Game over!")
			break

		snake.append((nx, ny))
		if (nx, ny) == food:
			score += 1
			food = (
				random.randint(1, width - 2),
				random.randint(1, height - 2),
			)
		else:
			snake.pop(0)


if __name__ == "__main__":
	main()
