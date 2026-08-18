#!/usr/bin/env python3
"""
Renders burned-in subtitles as transparent PNGs plus an FFmpeg concat list.

This exists because the FFmpeg build on macOS (Homebrew bottle) ships without
libass and libfreetype, so neither the `subtitles` filter nor `drawtext` is
available. Drawing the frames here and overlaying one alpha track sidesteps
that without asking anyone to compile FFmpeg from source.

Usage:
    render-subtitles.py <timeline.json> <outdir> <width> <height> <total_seconds>

`timeline.json` is a list of {start, end, text} in FINAL video seconds — the
caller has already accounted for the intro insert. Gaps are filled with a fully
transparent frame so the overlay track runs the whole video.

Writes: sub-NNN.png, blank.png, and concat.txt (ready for -f concat).
"""

import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit(
        "Falta Pillow. Instalalo con:  python3 -m pip install --user Pillow"
    )

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Black.ttf",
    "/Library/Fonts/Arial Bold.ttf",
]


def pick_font(size: int) -> ImageFont.FreeTypeFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def wrap(text: str, font, draw, max_width: int, stroke: int) -> list[str]:
    """Greedy word wrap against the real rendered width, not a char count."""
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        x0, _, x1, _ = draw.textbbox((0, 0), candidate, font=font, stroke_width=stroke)
        if x1 - x0 <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def main() -> None:
    timeline_path, outdir, width, height, total = sys.argv[1:6]
    width, height, total = int(width), int(height), float(total)
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)

    entries = json.loads(Path(timeline_path).read_text())

    # Scaled to the frame so vertical and horizontal both read well.
    font_size = round(height * 0.038)
    stroke = max(6, round(font_size * 0.16))
    max_text_width = round(width * 0.86)
    # Sits above centre: clear of TikTok's UI at the bottom and of the
    # top status bar.
    baseline_y = round(height * 0.40)

    font = pick_font(font_size)

    blank = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    blank.save(out / "blank.png")

    measure = ImageDraw.Draw(blank)
    concat: list[tuple[str, float]] = []
    cursor = 0.0

    for i, entry in enumerate(entries):
        start = max(0.0, float(entry["start"]))
        end = max(start, float(entry["end"]))
        text = str(entry["text"]).strip()
        if not text or end - start < 0.05:
            continue

        # Transparent filler for any silence before this line.
        if start - cursor > 0.02:
            concat.append(("blank.png", start - cursor))

        img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        lines = wrap(text, font, measure, max_text_width, stroke)

        line_height = round(font_size * 1.22)
        block_top = baseline_y - (len(lines) - 1) * line_height // 2

        for n, line in enumerate(lines):
            x0, _, x1, _ = draw.textbbox((0, 0), line, font=font, stroke_width=stroke)
            x = (width - (x1 - x0)) / 2 - x0
            # Heavy black stroke is what keeps it legible over busy footage.
            draw.text(
                (x, block_top + n * line_height),
                line,
                font=font,
                fill=(255, 255, 255, 255),
                stroke_width=stroke,
                stroke_fill=(0, 0, 0, 255),
            )

        name = f"sub-{i:04d}.png"
        img.save(out / name)
        concat.append((name, end - start))
        cursor = end

    if total - cursor > 0.02:
        concat.append(("blank.png", total - cursor))

    lines_out: list[str] = []
    for name, duration in concat:
        lines_out.append(f"file '{name}'")
        lines_out.append(f"duration {duration:.3f}")
    # The concat demuxer ignores the final entry's duration unless the last
    # file is repeated.
    if concat:
        lines_out.append(f"file '{concat[-1][0]}'")

    (out / "concat.txt").write_text("\n".join(lines_out) + "\n")
    print(f"{len([c for c in concat if c[0] != 'blank.png'])} subtítulos renderizados")


if __name__ == "__main__":
    main()
