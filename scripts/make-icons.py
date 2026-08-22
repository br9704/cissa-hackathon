"""
Generates the app and tray icons with no image library, because adding one for two
files is not worth the dependency.

The tray icon is a macOS template image: pure black with an alpha channel and nothing
else. macOS tints it for light and dark menu bars itself, and any colour in the file is
what turns the tray icon into a white blob.

The mark is a chain link, which is the honest glyph for a hash chained ledger: two rings
that only mean something because they are joined.
"""
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "apps" / "desktop" / "src-tauri" / "icons"


def write_png(path: Path, width: int, height: int, pixels) -> None:
    """pixels is a callable (x, y) -> (r, g, b, a), each 0-255."""
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0, none
        for x in range(width):
            raw.extend(pixels(x, y))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def ring_alpha(x, y, cx, cy, radius, thickness, samples=4):
    """
    Coverage of an annulus at this pixel, supersampled. Antialiasing by hand is cheap
    here and the alternative is a visibly jagged 44px glyph in the menu bar.
    """
    hit = 0
    step = 1.0 / samples
    for sy in range(samples):
        for sx in range(samples):
            px = x + (sx + 0.5) * step
            py = y + (sy + 0.5) * step
            d = ((px - cx) ** 2 + (py - cy) ** 2) ** 0.5
            if abs(d - radius) <= thickness / 2:
                hit += 1
    return int(255 * hit / (samples * samples))


def chain(size: int, ink):
    """Two overlapping rings, sized as a fraction of the canvas so it scales cleanly."""
    r = size * 0.19
    t = size * 0.085
    cy = size / 2
    left = size * 0.385
    right = size * 0.615

    def px(x, y):
        a = max(
            ring_alpha(x, y, left, cy, r, t),
            ring_alpha(x, y, right, cy, r, t),
        )
        return ink(a)

    return px


# Tray: template image. Pure black, alpha carries the shape. 44px covers @2x menu bars.
write_png(ICONS / "tray.png", 44, 44, chain(44, lambda a: (0, 0, 0, a)))

# App icon: the same mark in near black on the warm white field, so the Dock icon and
# the app agree with each other. Values match --text and --bg in tokens.css.
BG = (250, 250, 248)
INK = (22, 22, 26)


def app_px(size):
    mark = chain(size, lambda a: (0, 0, 0, a))

    def px(x, y):
        a = mark(x, y)[3] / 255
        return (
            int(INK[0] * a + BG[0] * (1 - a)),
            int(INK[1] * a + BG[1] * (1 - a)),
            int(INK[2] * a + BG[2] * (1 - a)),
            255,
        )

    return px


for s in (32, 128, 256, 512):
    name = "icon.png" if s == 512 else f"{s}x{s}.png"
    write_png(ICONS / name, s, s, app_px(s))

print("wrote", ", ".join(sorted(p.name for p in ICONS.glob("*.png"))))
