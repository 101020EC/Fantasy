"""Render the Fanta "F" mark to the PNG icons in public/.

The same rectangles as components/Logo.tsx (F_RECTS, 512 box). Home-screen
icons are full-bleed purple squares — iOS and Android round the corners
themselves — with the F scaled into the maskable safe zone. Needs Pillow.

    python3 scripts/render-icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

ACCENT = (0x38, 0x00, 0x3C, 255)
F_RECTS = [(156, 120, 76, 272), (156, 120, 208, 72), (156, 226, 164, 66)]
PUBLIC = Path(__file__).resolve().parent.parent / "public"
SS = 4  # supersample, then downscale for clean edges


def render(size: int, scale: float, rounded: bool) -> Image.Image:
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = int(big * 120 / 512) if rounded else 0
    d.rounded_rectangle([0, 0, big - 1, big - 1], radius=radius, fill=ACCENT)
    # Scale the F about the centre so it sits inside the safe zone.
    k = big / 512 * scale
    off = big / 2 - 256 * k
    for x, y, w, h in F_RECTS:
        d.rounded_rectangle(
            [off + x * k, off + y * k, off + (x + w) * k, off + (y + h) * k],
            radius=6 * k,
            fill=(255, 255, 255, 255),
        )
    return img.resize((size, size), Image.LANCZOS)


# Full-bleed for home screens (the OS masks the corners); F at 82% for the safe zone.
render(192, 0.82, False).save(PUBLIC / "icon-192.png")
render(512, 0.82, False).save(PUBLIC / "icon-512.png")
render(180, 0.82, False).convert("RGB").save(PUBLIC / "apple-touch-icon.png")
# Browser tab: the rounded mark as drawn in the app.
render(64, 1.0, True).save(PUBLIC / "favicon-64.png")
print("rendered icons into", PUBLIC)
