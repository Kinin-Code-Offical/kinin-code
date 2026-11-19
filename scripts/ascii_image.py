"""ASCII art text renderer.

Usage:
  python ascii_image.py --text "Retro Bot" --scale 2
"""

from __future__ import annotations

import argparse


FONT = {
    "A": ["  #  ", " # # ", "#####", "#   #", "#   #"],
    "B": ["#### ", "#   #", "#### ", "#   #", "#### "],
    "C": [" ####", "#    ", "#    ", "#    ", " ####"],
    "D": ["#### ", "#   #", "#   #", "#   #", "#### "],
    "E": ["#####", "#    ", "#### ", "#    ", "#####"],
    "F": ["#####", "#    ", "#### ", "#    ", "#    "],
    "G": [" ####", "#    ", "#  ##", "#   #", " ####"],
    "H": ["#   #", "#   #", "#####", "#   #", "#   #"],
    "I": ["#####", "  #  ", "  #  ", "  #  ", "#####"],
    "J": ["  ###", "   # ", "   # ", "#  # ", " ##  "],
    "K": ["#   #", "#  # ", "###  ", "#  # ", "#   #"],
    "L": ["#    ", "#    ", "#    ", "#    ", "#####"],
    "M": ["#   #", "## ##", "# # #", "#   #", "#   #"],
    "N": ["#   #", "##  #", "# # #", "#  ##", "#   #"],
    "O": [" ### ", "#   #", "#   #", "#   #", " ### "],
    "P": ["#### ", "#   #", "#### ", "#    ", "#    "],
    "Q": [" ### ", "#   #", "# # #", "#  ##", " ####"],
    "R": ["#### ", "#   #", "#### ", "#  # ", "#   #"],
    "S": [" ####", "#    ", " ### ", "    #", "#### "],
    "T": ["#####", "  #  ", "  #  ", "  #  ", "  #  "],
    "U": ["#   #", "#   #", "#   #", "#   #", " ### "],
    "V": ["#   #", "#   #", "#   #", " # # ", "  #  "],
    "W": ["#   #", "#   #", "# # #", "## ##", "#   #"],
    "X": ["#   #", " # # ", "  #  ", " # # ", "#   #"],
    "Y": ["#   #", " # # ", "  #  ", "  #  ", "  #  "],
    "Z": ["#####", "   # ", "  #  ", " #   ", "#####"],
    "0": [" ### ", "#  ##", "# # #", "##  #", " ### "],
    "1": ["  #  ", " ##  ", "  #  ", "  #  ", " ### "],
    "2": [" ### ", "#   #", "   # ", "  #  ", "#####"],
    "3": ["#### ", "    #", " ### ", "    #", "#### "],
    "4": ["#   #", "#   #", "#####", "    #", "    #"],
    "5": ["#####", "#    ", "#### ", "    #", "#### "],
    "6": [" ### ", "#    ", "#### ", "#   #", " ### "],
    "7": ["#####", "    #", "   # ", "  #  ", "  #  "],
    "8": [" ### ", "#   #", " ### ", "#   #", " ### "],
    "9": [" ### ", "#   #", " ####", "    #", " ### "],
    "-": ["     ", "     ", "#####", "     ", "     "],
    " ": ["     ", "     ", "     ", "     ", "     "],
}


def scale_rows(rows: list[str], scale: int) -> list[str]:
    if scale <= 1:
        return rows
    scaled: list[str] = []
    for row in rows:
        expanded = "".join(ch * scale for ch in row)
        scaled.extend([expanded] * scale)
    return scaled


def render_text(text: str, scale: int = 1) -> str:
    chars = [FONT.get(ch, FONT["-"]) for ch in text.upper()]
    rows = ["" for _ in range(5)]
    for glyph in chars:
        for idx, row in enumerate(glyph):
            rows[idx] += f"{row}  "
    rows = scale_rows(rows, scale)
    return "\n".join(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description="ASCII text renderer")
    parser.add_argument("--text", default="Retro Bot", help="Text to render")
    parser.add_argument("--scale", type=int, default=1, help="Scale factor")
    args = parser.parse_args()
    scale = max(1, min(5, args.scale))
    print(render_text(args.text, scale=scale))


if __name__ == "__main__":
    main()
