"""Media demo helper.

Prints sample commands and can pick a random entry.
"""

from __future__ import annotations

import argparse
import random


MEDIA = {
	"image": ["nebula.txt", "grid.txt", "city.txt", "arcade.txt"],
	"video": ["loop.vid", "loop2.vid", "loop3.vid", "loop4.vid", "loop5.vid"],
	"mp3": [
		"synth.mp3",
		"synth2.mp3",
		"synth3.mp3",
		"neon_drive.mp3",
		"circuit_beat.mp3",
		"glow_shift.mp3",
	],
}


def main() -> None:
	parser = argparse.ArgumentParser(description="Media demo helper")
	parser.add_argument("--random", action="store_true", help="Pick random")
	args = parser.parse_args()

	if args.random:
		category = random.choice(list(MEDIA))
		item = random.choice(MEDIA[category])
		print(f"Try: {category} ~/media/{item}")
		return

	for key, values in MEDIA.items():
		for item in values:
			print(f"Try: {key} ~/media/{item}")


if __name__ == "__main__":
	main()
