from PIL import Image, ImageDraw, ImageOps, ImageFilter
import os

BASE_DIR = os.path.dirname(__file__)
OUT_DIR = os.path.join(BASE_DIR, "..", "icons")
SRC_PATH = os.path.join(OUT_DIR, "manchester-united-devil-logo-png_seeklogo-537173.png")

NARDO_DARK = (26, 27, 26)
NARDO = (110, 113, 106)
RED = (211, 28, 43)
WHITE = (242, 241, 237)


def make_background(size):
    img = Image.new("RGB", (size, size), NARDO_DARK)
    draw = ImageDraw.Draw(img)
    for i in range(size, 0, -1):
        t = i / size
        r = int(NARDO_DARK[0] + (NARDO[0] - NARDO_DARK[0]) * (1 - t) * 0.5)
        g = int(NARDO_DARK[1] + (NARDO[1] - NARDO_DARK[1]) * (1 - t) * 0.5)
        b = int(NARDO_DARK[2] + (NARDO[2] - NARDO_DARK[2]) * (1 - t) * 0.5)
        draw.rectangle([0, size - i, size, size - i + 1], fill=(r, g, b))

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([size * 0.10, size * 0.10, size * 0.90, size * 0.90], fill=(RED[0], RED[1], RED[2], 70))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.14))
    img = Image.alpha_composite(img.convert("RGBA"), glow)
    return img.convert("RGBA")


def make_icon(size):
    bg = make_background(size)

    src = Image.open(SRC_PATH).convert("L")
    pad_frac = 0.14
    logo_size = int(size * (1 - 2 * pad_frac))
    src_resized = src.resize((logo_size, logo_size), Image.LANCZOS)

    alpha = ImageOps.invert(src_resized)
    white_layer = Image.new("RGBA", (logo_size, logo_size), (WHITE[0], WHITE[1], WHITE[2], 255))
    white_layer.putalpha(alpha)

    offset = ((size - logo_size) // 2, (size - logo_size) // 2)
    bg.alpha_composite(white_layer, offset)

    return bg.convert("RGB")


for size, name in [(180, "icon-180.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
    icon = make_icon(size)
    icon.save(os.path.join(OUT_DIR, name))
    print(f"wrote {name} ({size}x{size})")
