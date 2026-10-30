"""Draws icon.svg: a 16x16 pixel speech bubble with a question mark.
Colors come from the PALETTE in jameskincaid.com's tools/build_art.py.
A 1px #15122A outline is added around the shape, like the site's icons.
Run from the repo root: python3 tools/build_icon.py
"""
import os

COLORS = {"C": "#F3E6CC", "D": "#B9A98F", "R": "#EE8059", "K": "#C9584A"}  # cream, cream_dim, coral, coral_dark
OUTLINE = "#15122A"

GRID = [
    "................",
    "..CCCCCCCCCCCC..",
    ".CCCCCRRRRCCCCC.",
    ".CCCCRKCCKRCCCC.",
    ".CCCCCCCCRKCCCC.",
    ".CCCCCCCRKCCCCC.",
    ".CCCCCCRKCCCCCD.",
    ".CCCCCCRKCCCCCD.",
    ".CCCCCCCCCCCCCD.",
    ".CCCCCCRKCCCCCD.",
    ".DCCCCCCCCCCCDD.",
    "..DDDCCDDDDDDD..",
    "....DCD.........",
    "....DD..........",
    "....D...........",
    "................",
]


def build():
    rects = []
    size = len(GRID)
    filled = {(x, y) for y, row in enumerate(GRID) for x, ch in enumerate(row) if ch != "."}
    for y in range(size):
        for x in range(size):
            if (x, y) in filled:
                rects.append((x, y, COLORS[GRID[y][x]]))
            elif any((x + dx, y + dy) in filled for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                rects.append((x, y, OUTLINE))
    body = "".join(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{c}"/>' for x, y, c in rects)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges" '
        f'role="img" aria-label="Speech bubble with a question mark">{body}</svg>\n'
    )


if __name__ == "__main__":
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root, "icon.svg"), "w") as f:
        f.write(build())
    print("Wrote icon.svg")
