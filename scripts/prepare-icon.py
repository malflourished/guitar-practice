#!/usr/bin/env python3
"""Make black background transparent and build macOS .icns icon."""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "build" / "icon-source.png"
OUTPUT_PNG = ROOT / "build" / "icon.png"
OUTPUT_ICNS = ROOT / "build" / "icon.icns"

ICON_SIZES = [
    (16, "icon_16x16.png"),
    (32, "icon_16x16@2x.png"),
    (32, "icon_32x32.png"),
    (64, "icon_32x32@2x.png"),
    (128, "icon_128x128.png"),
    (256, "icon_128x128@2x.png"),
    (256, "icon_256x256.png"),
    (512, "icon_256x256@2x.png"),
    (512, "icon_512x512.png"),
    (1024, "icon_512x512@2x.png"),
]

BLACK_THRESHOLD = 35


def make_transparent(source: Path, dest: Path) -> None:
    img = Image.open(source).convert("RGBA")
    pixels = img.load()
    width, height = img.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if r <= BLACK_THRESHOLD and g <= BLACK_THRESHOLD and b <= BLACK_THRESHOLD:
                pixels[x, y] = (r, g, b, 0)

    square = max(width, height)
    canvas = Image.new("RGBA", (square, square), (0, 0, 0, 0))
    offset = ((square - width) // 2, (square - height) // 2)
    canvas.paste(img, offset, img)
    canvas.resize((1024, 1024), Image.Resampling.LANCZOS).save(dest)


def build_icns(source_png: Path, dest_icns: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / "AppIcon.iconset"
        iconset.mkdir()

        base = Image.open(source_png).convert("RGBA")
        for size, filename in ICON_SIZES:
            resized = base.resize((size, size), Image.Resampling.LANCZOS)
            resized.save(iconset / filename)

        subprocess.run(
            ["iconutil", "-c", "icns", str(iconset), "-o", str(dest_icns)],
            check=True,
        )


def main() -> int:
    if len(sys.argv) > 1:
        source = Path(sys.argv[1])
    elif SOURCE.exists():
        source = SOURCE
    else:
        print("Usage: prepare-icon.py [source.png]", file=sys.stderr)
        return 1

    if not source.exists():
        print(f"Source icon not found: {source}", file=sys.stderr)
        return 1

    OUTPUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    make_transparent(source, OUTPUT_PNG)
    build_icns(OUTPUT_PNG, OUTPUT_ICNS)
    print(f"Wrote {OUTPUT_PNG}")
    print(f"Wrote {OUTPUT_ICNS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
