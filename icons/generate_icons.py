"""One-off script to generate PWA icon PNGs. Not used at runtime."""
from PIL import Image, ImageDraw, ImageFont

BLACK = (0, 0, 0, 255)
WHITE = (255, 255, 255, 255)
FONT_PATH = r"C:\Windows\Fonts\arialbd.ttf"


def draw_icon(size, safe_ratio=1.0):
    """safe_ratio < 1 shrinks the glyph to stay inside a maskable safe zone."""
    img = Image.new("RGBA", (size, size), BLACK)
    draw = ImageDraw.Draw(img)
    font_size = int(size * 0.66 * safe_ratio)
    font = ImageFont.truetype(FONT_PATH, font_size)
    text = "B"
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - w) / 2 - bbox[0]
    y = (size - h) / 2 - bbox[1]
    draw.text((x, y), text, font=font, fill=WHITE)
    return img


# Standard "any" icons: glyph fills most of the canvas.
draw_icon(512).save("icon-512.png")
draw_icon(192).save("icon-192.png")

# Maskable icon: keep glyph inside the ~80% safe-zone circle.
draw_icon(512, safe_ratio=0.72).save("icon-maskable-512.png")

# Apple touch icon: solid background, iOS applies its own rounding/mask.
draw_icon(180).save("apple-touch-icon.png")

# Favicons.
fav32 = draw_icon(32)
fav16 = draw_icon(16)
fav32.save("favicon-32.png")
fav16.save("favicon-16.png")
fav32.save("../favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

print("done")
