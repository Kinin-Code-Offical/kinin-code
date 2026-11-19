"""Turn-based Pong demo."""

from __future__ import annotations

import argparse
import random


def main() -> None:
	parser = argparse.ArgumentParser(description="Pong demo")
	parser.add_argument("--width", type=int, default=28)
	parser.add_argument("--height", type=int, default=12)
	args = parser.parse_args()

	width = max(20, args.width)
	height = max(10, args.height)
	paddle = width // 2
	ai_paddle = width // 2
	ball = [width // 2, height // 2]
	vel = [random.choice([-1, 1]), random.choice([-1, 1])]
	score = [0, 0]
	lives = 3

	while lives > 0:
		board = [[" " for _ in range(width)] for _ in range(height)]
		for x in range(width):
			board[0][x] = "-"
			board[height - 1][x] = "-"

		for x in range(paddle - 2, paddle + 3):
			board[height - 2][max(1, min(width - 2, x))] = "="
		for x in range(ai_paddle - 2, ai_paddle + 3):
			board[1][max(1, min(width - 2, x))] = "="

		board[ball[1]][ball[0]] = "o"
		print("\n".join("".join(row) for row in board))
		print(f"Score: You {score[0]} - AI {score[1]}  Lives: {lives}")
		move = input("Move (A/D, Q=quit): ").strip().lower()
		if move == "q":
			break
		if move == "a":
			paddle -= 1
		elif move == "d":
			paddle += 1
		paddle = max(2, min(width - 3, paddle))

		ai_paddle += 1 if ball[0] > ai_paddle else -1
		ai_paddle = max(2, min(width - 3, ai_paddle))

		ball[0] += vel[0]
		ball[1] += vel[1]

		if ball[0] <= 1 or ball[0] >= width - 2:
			vel[0] *= -1

		if ball[1] <= 2:
			if abs(ball[0] - ai_paddle) <= 2:
				vel[1] = 1
			else:
				score[0] += 1
				ball = [width // 2, height // 2]
				vel = [random.choice([-1, 1]), 1]

		if ball[1] >= height - 3:
			if abs(ball[0] - paddle) <= 2:
				vel[1] = -1
			else:
				lives -= 1
				score[1] += 1
				ball = [width // 2, height // 2]
				vel = [random.choice([-1, 1]), -1]

	print("Game over.")


if __name__ == "__main__":
	main()
