#!/usr/bin/env python3
"""Build the Weathered Peak frame atlas from its approved cap and generated side tile."""
from pathlib import Path
from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
GUTTER = 8
ATLAS_SIZE = (2048, 1024)
CELL_WIDTH = 1024
TOP_SIZE = (CELL_WIDTH - 2 * GUTTER, CELL_WIDTH - 2 * GUTTER)
SIDE_SIZE = (CELL_WIDTH - 2 * GUTTER, 447)


def paste_with_gutter(atlas: Image.Image, image: Image.Image, x: int, y: int) -> None:
    """Paste an image and extend its edge texels to limit atlas mip bleed."""
    width, height = image.size
    atlas.paste(image, (x, y))
    for amount in range(1, GUTTER + 1):
        atlas.paste(image.crop((0, 0, width, 1)).resize((width, amount)), (x, y - amount))
        atlas.paste(image.crop((0, height - 1, width, height)).resize((width, amount)), (x, y + height - 1))
        atlas.paste(image.crop((0, 0, 1, height)).resize((amount, height)), (x - amount, y))
        atlas.paste(image.crop((width - 1, 0, width, height)).resize((amount, height)), (x + width - 1, y))
        for dx, dy, px, py in [
            (-amount, -amount, 0, 0),
            (width, -amount, width - 1, 0),
            (-amount, height, 0, height - 1),
            (width, height, width - 1, height - 1),
        ]:
            atlas.paste(image.getpixel((px, py)), (x + dx, y + dy, x + dx + amount, y + dy + amount))


cap = Image.open(ASSETS / "weathered-peak-border.png").convert("RGBA")
cap.load()
side = Image.open(ASSETS / "weathered-peak-side.png").convert("RGB")
side.load()
cap = cap.resize(TOP_SIZE, Image.Resampling.LANCZOS)
side = side.resize(SIDE_SIZE, Image.Resampling.LANCZOS)

atlas = Image.new("RGBA", ATLAS_SIZE, (0, 0, 0, 0))
paste_with_gutter(atlas, cap, GUTTER, GUTTER)
side_x = CELL_WIDTH + GUTTER
side_y = (ATLAS_SIZE[1] - SIDE_SIZE[1]) // 2
paste_with_gutter(atlas, side.convert("RGBA"), side_x, side_y)

# A 256-color palette with dithering keeps the 2K atlas compact for mobile downloads.
atlas = atlas.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG).convert("RGBA")
output = ASSETS / "weathered-peak-border-atlas.png"
atlas.save(output, format="PNG", optimize=True, compress_level=9)
check = Image.open(output)
check.load()
assert check.size == ATLAS_SIZE and check.mode == "RGBA"
assert check.getpixel((GUTTER + 20, GUTTER + 20))[3] >= 250
assert check.getpixel((GUTTER + TOP_SIZE[0] // 2, GUTTER + TOP_SIZE[1] // 2))[3] == 0
assert check.getpixel((side_x + 20, side_y + SIDE_SIZE[1] // 2))[3] >= 250
print(f"Wrote {output} ({output.stat().st_size:,} bytes), validated RGBA atlas")
