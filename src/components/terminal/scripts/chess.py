"""Minimal chess (basic legal moves, no castling/en passant)."""

from __future__ import annotations

from itertools import product


FILES = "abcdefgh"
RANKS = "12345678"


def new_board() -> list[list[str]]:
	return [
		list("rnbqkbnr"),
		list("pppppppp"),
		list("........"),
		list("........"),
		list("........"),
		list("........"),
		list("PPPPPPPP"),
		list("RNBQKBNR"),
	]


def color(piece: str) -> str | None:
	if piece == ".":
		return None
	return "w" if piece.isupper() else "b"


def in_bounds(x: int, y: int) -> bool:
	return 0 <= x < 8 and 0 <= y < 8


def moves_for(board: list[list[str]], x: int, y: int) -> list[tuple[int, int]]:
	piece = board[y][x]
	c = color(piece)
	if not c:
		return []
	res: list[tuple[int, int]] = []

	def add(nx: int, ny: int) -> bool:
		if not in_bounds(nx, ny):
			return False
		target = board[ny][nx]
		if target != "." and color(target) == c:
			return False
		res.append((nx, ny))
		return target == "."

	def ray(dx: int, dy: int) -> None:
		nx, ny = x + dx, y + dy
		while in_bounds(nx, ny):
			target = board[ny][nx]
			if target != "." and color(target) == c:
				break
			res.append((nx, ny))
			if target != ".":
				break
			nx += dx
			ny += dy

	p = piece.lower()
	if p == "p":
		direction = -1 if c == "w" else 1
		start_row = 6 if c == "w" else 1
		one = y + direction
		if in_bounds(x, one) and board[one][x] == ".":
			res.append((x, one))
			two = y + 2 * direction
			if y == start_row and board[two][x] == ".":
				res.append((x, two))
		for dx in (-1, 1):
			nx, ny = x + dx, y + direction
			if in_bounds(nx, ny) and board[ny][nx] != "." and color(board[ny][nx]) != c:
				res.append((nx, ny))
		return res
	if p == "n":
		for dx, dy in [
			(1, 2),
			(2, 1),
			(-1, 2),
			(-2, 1),
			(1, -2),
			(2, -1),
			(-1, -2),
			(-2, -1),
		]:
			add(x + dx, y + dy)
		return res
	if p in {"b", "q"}:
		ray(1, 1)
		ray(1, -1)
		ray(-1, 1)
		ray(-1, -1)
	if p in {"r", "q"}:
		ray(1, 0)
		ray(-1, 0)
		ray(0, 1)
		ray(0, -1)
	if p == "k":
		for dx in (-1, 0, 1):
			for dy in (-1, 0, 1):
				if dx == 0 and dy == 0:
					continue
				add(x + dx, y + dy)
	return res


def is_in_check(board: list[list[str]], side: str) -> bool:
	king = "K" if side == "w" else "k"
	king_pos = None
	for y, x in product(range(8), range(8)):
		if board[y][x] == king:
			king_pos = (x, y)
			break
	if not king_pos:
		return False
	for y, x in product(range(8), range(8)):
		piece_color = color(board[y][x])
		if piece_color and piece_color != side and king_pos in moves_for(board, x, y):
			return True
	return False


def parse_move(move: str) -> tuple[int, int, int, int] | None:
	move = move.strip().lower().replace(" ", "")
	if len(move) != 4:
		return None
	fx, fy, tx, ty = move
	if fx not in FILES or tx not in FILES or fy not in RANKS or ty not in RANKS:
		return None
	return FILES.index(fx), 8 - int(fy), FILES.index(tx), 8 - int(ty)


def print_board(board: list[list[str]]) -> None:
	print("  a b c d e f g h")
	for y, row in enumerate(board):
		print(f"{8 - y} " + " ".join(row))
	print()


def main() -> None:
	board = new_board()
	turn = "w"
	while True:
		print_board(board)
		side = "White" if turn == "w" else "Black"
		move = input(f"{side} move (e2e4, q=quit): ").strip()
		if move.lower() in {"q", "quit", "exit"}:
			break
		parsed = parse_move(move)
		if not parsed:
			print("Invalid move format.")
			continue
		fx, fy, tx, ty = parsed
		piece = board[fy][fx]
		if piece == "." or color(piece) != turn:
			print("No piece to move.")
			continue
		legal = moves_for(board, fx, fy)
		if (tx, ty) not in legal:
			print("Illegal move.")
			continue
		clone = [row[:] for row in board]
		clone[ty][tx] = piece
		clone[fy][fx] = "."
		if piece.lower() == "p" and ty in {0, 7}:
			clone[ty][tx] = "Q" if turn == "w" else "q"
		if is_in_check(clone, turn):
			print("Move leaves king in check.")
			continue
		board = clone
		turn = "b" if turn == "w" else "w"


if __name__ == "__main__":
	main()
