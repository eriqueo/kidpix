#!/usr/bin/env python3
"""Generate kid-safe line-art coloring pages as PNGs using only Python stdlib.

Output: src/assets/colorme/*.png — 1300x650 black-on-transparent line art.
Re-runnable; overwrites existing files.
"""
import math
import os
import struct
import zlib

W, H = 1300, 650
LINE = 0xFF  # black alpha for line pixels (RGBA: 0,0,0,255)


def new_buf():
    # RGBA, fully transparent (alpha = 0)
    return bytearray(W * H * 4)


def setpx(buf, x, y, thickness=3):
    r = thickness // 2
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            xi, yi = int(x) + dx, int(y) + dy
            if 0 <= xi < W and 0 <= yi < H:
                i = (yi * W + xi) * 4
                buf[i] = 0
                buf[i + 1] = 0
                buf[i + 2] = 0
                buf[i + 3] = 0xFF


def line(buf, x0, y0, x1, y1, thickness=3):
    # Bresenham
    x0, y0, x1, y1 = int(x0), int(y0), int(x1), int(y1)
    dx = abs(x1 - x0)
    sx = 1 if x0 < x1 else -1
    dy = -abs(y1 - y0)
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        setpx(buf, x0, y0, thickness)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def circle(buf, cx, cy, r, thickness=3):
    # Midpoint circle, then thicken
    steps = max(8, int(2 * math.pi * r))
    prev = None
    for i in range(steps + 1):
        a = (i / steps) * 2 * math.pi
        x = cx + r * math.cos(a)
        y = cy + r * math.sin(a)
        if prev is not None:
            line(buf, prev[0], prev[1], x, y, thickness)
        prev = (x, y)


def arc(buf, cx, cy, r, a0, a1, thickness=3):
    steps = max(8, int(abs(a1 - a0) * r))
    prev = None
    for i in range(steps + 1):
        t = i / steps
        a = a0 + t * (a1 - a0)
        x = cx + r * math.cos(a)
        y = cy + r * math.sin(a)
        if prev is not None:
            line(buf, prev[0], prev[1], x, y, thickness)
        prev = (x, y)


def write_png(path, buf):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0)  # 8-bit RGBA
    raw = bytearray()
    stride = W * 4
    for y in range(H):
        raw.append(0)  # filter type: None
        raw.extend(buf[y * stride : (y + 1) * stride])
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))


# ------------ scenes ------------

def smiley():
    b = new_buf()
    cx, cy = W // 2, H // 2
    circle(b, cx, cy, 240, 5)  # face
    circle(b, cx - 80, cy - 60, 22, 4)  # left eye
    circle(b, cx + 80, cy - 60, 22, 4)  # right eye
    arc(b, cx, cy + 20, 110, 0.2, math.pi - 0.2, 5)  # smile
    return b


def house():
    b = new_buf()
    # body
    line(b, 400, 500, 900, 500, 5)  # floor
    line(b, 400, 250, 400, 500, 5)
    line(b, 900, 250, 900, 500, 5)
    # roof
    line(b, 380, 260, 650, 90, 5)
    line(b, 650, 90, 920, 260, 5)
    line(b, 380, 260, 920, 260, 5)
    # door
    line(b, 580, 500, 580, 370, 5)
    line(b, 720, 500, 720, 370, 5)
    line(b, 580, 370, 720, 370, 5)
    circle(b, 700, 435, 6, 4)
    # window left
    line(b, 440, 300, 540, 300, 4)
    line(b, 540, 300, 540, 380, 4)
    line(b, 540, 380, 440, 380, 4)
    line(b, 440, 380, 440, 300, 4)
    line(b, 490, 300, 490, 380, 3)
    line(b, 440, 340, 540, 340, 3)
    # window right
    line(b, 760, 300, 860, 300, 4)
    line(b, 860, 300, 860, 380, 4)
    line(b, 860, 380, 760, 380, 4)
    line(b, 760, 380, 760, 300, 4)
    line(b, 810, 300, 810, 380, 3)
    line(b, 760, 340, 860, 340, 3)
    # sun
    circle(b, 1100, 130, 50, 5)
    for i in range(8):
        a = i * math.pi / 4
        line(
            b,
            1100 + 65 * math.cos(a),
            130 + 65 * math.sin(a),
            1100 + 95 * math.cos(a),
            130 + 95 * math.sin(a),
            4,
        )
    return b


def fish():
    b = new_buf()
    cx, cy = W // 2, H // 2
    # body (oval)
    for i in range(360):
        a = i * math.pi / 180
        x = cx + 230 * math.cos(a)
        y = cy + 130 * math.sin(a)
        x2 = cx + 230 * math.cos(a + math.pi / 180)
        y2 = cy + 130 * math.sin(a + math.pi / 180)
        line(b, x, y, x2, y2, 5)
    # tail
    line(b, cx + 220, cy - 20, cx + 360, cy - 110, 5)
    line(b, cx + 220, cy + 20, cx + 360, cy + 110, 5)
    line(b, cx + 360, cy - 110, cx + 360, cy + 110, 5)
    line(b, cx + 220, cy - 20, cx + 280, cy, 4)
    line(b, cx + 220, cy + 20, cx + 280, cy, 4)
    # eye
    circle(b, cx - 140, cy - 30, 22, 4)
    circle(b, cx - 140, cy - 30, 8, 3)
    # mouth
    arc(b, cx - 200, cy + 30, 30, -0.4, 0.4, 4)
    # fin
    line(b, cx - 30, cy - 80, cx + 60, cy - 140, 4)
    line(b, cx + 60, cy - 140, cx + 90, cy - 80, 4)
    line(b, cx - 30, cy - 80, cx + 90, cy - 80, 4)
    line(b, cx - 30, cy + 80, cx + 30, cy + 150, 4)
    line(b, cx + 30, cy + 150, cx + 80, cy + 80, 4)
    # bubbles
    circle(b, cx - 280, cy - 100, 12, 3)
    circle(b, cx - 320, cy - 160, 18, 3)
    circle(b, cx - 360, cy - 230, 10, 3)
    return b


def tree():
    b = new_buf()
    # trunk
    line(b, 620, 560, 620, 380, 6)
    line(b, 680, 560, 680, 380, 6)
    line(b, 620, 560, 680, 560, 5)
    # branches arcs
    arc(b, 650, 380, 200, math.pi + 0.2, 2 * math.pi - 0.2, 5)
    arc(b, 650, 320, 170, math.pi + 0.2, 2 * math.pi - 0.2, 5)
    arc(b, 650, 260, 140, math.pi + 0.2, 2 * math.pi - 0.2, 5)
    # apples
    circle(b, 540, 360, 18, 4)
    circle(b, 760, 360, 18, 4)
    circle(b, 600, 280, 16, 4)
    circle(b, 700, 280, 16, 4)
    circle(b, 650, 220, 14, 4)
    # ground
    line(b, 200, 560, 1100, 560, 5)
    # grass tufts
    for x in (260, 330, 800, 880, 960, 1040):
        line(b, x, 560, x - 10, 540, 3)
        line(b, x, 560, x, 535, 3)
        line(b, x, 560, x + 10, 540, 3)
    return b


def star():
    b = new_buf()
    cx, cy = W // 2, H // 2
    pts = []
    R, r = 230, 95
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    for i in range(len(pts)):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % len(pts)]
        line(b, x0, y0, x1, y1, 6)
    # smaller stars
    for (sx, sy, sR) in [(200, 150, 60), (1100, 180, 50), (200, 520, 50), (1080, 510, 60)]:
        spts = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            rad = sR if i % 2 == 0 else sR * 0.4
            spts.append((sx + rad * math.cos(a), sy + rad * math.sin(a)))
        for i in range(len(spts)):
            x0, y0 = spts[i]
            x1, y1 = spts[(i + 1) % len(spts)]
            line(b, x0, y0, x1, y1, 4)
    return b


def balloons():
    b = new_buf()
    for cx, cy, r in [(360, 250, 110), (650, 200, 130), (940, 260, 100)]:
        circle(b, cx, cy, r, 5)
        # tie
        line(b, cx - 8, cy + r, cx + 8, cy + r, 4)
        line(b, cx + 8, cy + r, cx - 8, cy + r + 14, 4)
        line(b, cx - 8, cy + r + 14, cx + 8, cy + r + 14, 4)
        # string (wavy)
        prev = (cx, cy + r + 14)
        for t in range(1, 60):
            yy = cy + r + 14 + t * 6
            xx = cx + 16 * math.sin(t / 4)
            line(b, prev[0], prev[1], xx, yy, 3)
            prev = (xx, yy)
    # ground line
    line(b, 100, 620, 1200, 620, 4)
    return b


SCENES = [
    ("smiley", smiley),
    ("house", house),
    ("fish", fish),
    ("tree", tree),
    ("star", star),
    ("balloons", balloons),
]


def main():
    out_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "src",
        "assets",
        "colorme",
    )
    os.makedirs(out_dir, exist_ok=True)
    for name, fn in SCENES:
        buf = fn()
        path = os.path.join(out_dir, f"{name}.png")
        write_png(path, buf)
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
