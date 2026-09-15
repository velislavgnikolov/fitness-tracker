from PIL import Image, ImageDraw
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")
os.makedirs(OUT_DIR, exist_ok=True)

NARDO_DARK = (26, 27, 26)
NARDO = (110, 113, 106)
NARDO_LIGHT = (150, 152, 145)
RED = (211, 28, 43)
RED_LIGHT = (239, 68, 68)
WHITE = (242, 241, 237)


def make_icon(size):
    img = Image.new("RGB", (size, size), NARDO_DARK)
    draw = ImageDraw.Draw(img)

    # radial-ish gradient background using concentric rounded rects (matte gray sheen)
    for i in range(size, 0, -1):
        t = i / size
        r = int(NARDO_DARK[0] + (NARDO[0] - NARDO_DARK[0]) * (1 - t) * 0.5)
        g = int(NARDO_DARK[1] + (NARDO[1] - NARDO_DARK[1]) * (1 - t) * 0.5)
        b = int(NARDO_DARK[2] + (NARDO[2] - NARDO_DARK[2]) * (1 - t) * 0.5)
        draw.rectangle([0, size - i, size, size - i + 1], fill=(r, g, b))

    # red diagonal glow accent bottom-right
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(
        [size * 0.45, size * 0.45, size * 1.15, size * 1.15],
        fill=(RED[0], RED[1], RED[2], 90),
    )
    glow = glow.filter(__import__("PIL.ImageFilter", fromlist=["ImageFilter"]).GaussianBlur(size * 0.12))
    img = Image.alpha_composite(img.convert("RGBA"), glow)
    draw = ImageDraw.Draw(img)

    # dumbbell mark: bar + two plates each side, centered, white
    cx, cy = size / 2, size / 2
    bar_h = size * 0.075
    bar_w = size * 0.46
    draw.rounded_rectangle(
        [cx - bar_w / 2, cy - bar_h / 2, cx + bar_w / 2, cy + bar_h / 2],
        radius=bar_h / 2,
        fill=WHITE,
    )

    plate_w = size * 0.09
    plate_h_outer = size * 0.34
    plate_h_inner = size * 0.24
    for side in (-1, 1):
        px = cx + side * (bar_w / 2)
        draw.rounded_rectangle(
            [px - plate_w * 1.15, cy - plate_h_outer / 2, px + plate_w * 0.15, cy + plate_h_outer / 2],
            radius=plate_w * 0.4,
            fill=WHITE,
        )
        px2 = cx + side * (bar_w / 2 + plate_w * 1.6)
        draw.rounded_rectangle(
            [px2 - plate_w * 0.75, cy - plate_h_inner / 2, px2 + plate_w * 0.75, cy + plate_h_inner / 2],
            radius=plate_w * 0.4,
            fill=RED_LIGHT,
        )

    return img.convert("RGB")


for size, name in [(180, "icon-180.png"), (192, "icon-192.png"), (512, "icon-512.png")]:
    icon = make_icon(size)
    icon.save(os.path.join(OUT_DIR, name))
    print(f"wrote {name} ({size}x{size})")
