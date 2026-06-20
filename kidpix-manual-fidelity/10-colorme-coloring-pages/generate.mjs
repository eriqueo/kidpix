#!/usr/bin/env node
// Deterministic generator for the 10 ColorMe coloring-book pages.
//
// Stylistic-equivalent fan-original line art (no verbatim assets). Each page
// is a 1300x650 8-bit grayscale PNG, pure white background, pure black lines
// of a fixed 3-pixel weight — chosen so the flood-fill primitive's default
// luma threshold treats every authored stroke as an outline boundary.
//
// Pure Node, zero deps. Re-run with: node generate.mjs

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, crc32 } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 1300;
const H = 650;
const LINE = 3; // outline weight in px; matches flood-fill bounds

// --- canvas helpers (plain Uint8Array of grayscale samples, 1 byte/pixel) ---

function blankCanvas() {
  const buf = new Uint8Array(W * H);
  buf.fill(255);
  return buf;
}

function setPx(buf, x, y, v) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  buf[y * W + x] = v;
}

function dot(buf, x, y, r = LINE) {
  // square dot of radius ~r/2 to give every stroke uniform weight
  const half = Math.floor(r / 2);
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      setPx(buf, Math.round(x + dx), Math.round(y + dy), 0);
    }
  }
}

function line(buf, x0, y0, x1, y1) {
  // Bresenham with thickened dot per step
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    dot(buf, x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function circle(buf, cx, cy, r) {
  // Midpoint algorithm + thickened dots
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    dot(buf, cx + x, cy + y); dot(buf, cx - x, cy + y);
    dot(buf, cx + x, cy - y); dot(buf, cx - x, cy - y);
    dot(buf, cx + y, cy + x); dot(buf, cx - y, cy + x);
    dot(buf, cx + y, cy - x); dot(buf, cx - y, cy - x);
    y++;
    if (err <= 0) {
      err += 2 * y + 1;
    } else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
}

function arc(buf, cx, cy, r, a0, a1, steps = 64) {
  // Parametric arc, samples connected with `line` for line-weight uniformity.
  let prevX = null, prevY = null;
  for (let i = 0; i <= steps; i++) {
    const t = a0 + ((a1 - a0) * i) / steps;
    const x = cx + r * Math.cos(t);
    const y = cy + r * Math.sin(t);
    if (prevX !== null) line(buf, prevX, prevY, x, y);
    prevX = x; prevY = y;
  }
}

function rect(buf, x0, y0, x1, y1) {
  line(buf, x0, y0, x1, y0);
  line(buf, x1, y0, x1, y1);
  line(buf, x1, y1, x0, y1);
  line(buf, x0, y1, x0, y0);
}

function polygon(buf, points) {
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    line(buf, x0, y0, x1, y1);
  }
}

// --- the 10 pages -----------------------------------------------------------
// Each is a free-hand fan-original drawing. Composition is intentionally
// playful + simple (closed shapes, clear regions) so the flood-fill primitive
// has well-bounded areas to color.

function pageHouse(buf) {
  // Cottage with door, two windows, sun, two clouds
  // House body
  rect(buf, 480, 280, 820, 520);
  // Roof
  polygon(buf, [[460, 280], [840, 280], [650, 140]]);
  // Door
  rect(buf, 620, 380, 700, 520);
  circle(buf, 690, 450, 4);
  // Windows
  rect(buf, 520, 320, 590, 380);
  line(buf, 555, 320, 555, 380);
  line(buf, 520, 350, 590, 350);
  rect(buf, 730, 320, 800, 380);
  line(buf, 765, 320, 765, 380);
  line(buf, 730, 350, 800, 350);
  // Sun
  circle(buf, 1100, 130, 50);
  for (let k = 0; k < 12; k++) {
    const t = (k / 12) * Math.PI * 2;
    line(
      buf,
      1100 + Math.cos(t) * 65,
      130 + Math.sin(t) * 65,
      1100 + Math.cos(t) * 90,
      130 + Math.sin(t) * 90,
    );
  }
  // Clouds
  arc(buf, 230, 140, 35, Math.PI, 0);
  arc(buf, 285, 130, 45, Math.PI, 0);
  arc(buf, 345, 140, 30, Math.PI, 0);
  line(buf, 195, 140, 375, 140);
  // Ground
  line(buf, 80, 540, 1220, 540);
}

function pageFish(buf) {
  // Cartoon fish, big eye, tail, bubbles
  arc(buf, 650, 325, 200, -Math.PI * 0.8, Math.PI * 0.8);
  // Tail
  polygon(buf, [
    [850, 325],
    [1000, 200],
    [1000, 450],
  ]);
  // Eye
  circle(buf, 540, 290, 35);
  circle(buf, 540, 290, 12);
  // Mouth
  arc(buf, 490, 360, 25, -Math.PI * 0.6, Math.PI * 0.2);
  // Fin top
  polygon(buf, [
    [620, 140],
    [720, 140],
    [670, 220],
  ]);
  // Fin bottom
  polygon(buf, [
    [620, 510],
    [720, 510],
    [670, 430],
  ]);
  // Bubbles
  circle(buf, 360, 180, 25);
  circle(buf, 310, 240, 18);
  circle(buf, 270, 290, 12);
}

function pageRobot(buf) {
  // Boxy robot, antennae, big buttons
  rect(buf, 500, 200, 800, 480); // body
  rect(buf, 560, 100, 740, 200); // head
  // Antennae
  line(buf, 600, 100, 580, 50); circle(buf, 580, 45, 12);
  line(buf, 700, 100, 720, 50); circle(buf, 720, 45, 12);
  // Eyes
  circle(buf, 610, 150, 18);
  circle(buf, 690, 150, 18);
  // Mouth
  rect(buf, 600, 175, 700, 188);
  // Buttons
  circle(buf, 580, 280, 22);
  circle(buf, 650, 280, 22);
  circle(buf, 720, 280, 22);
  // Belly screen
  rect(buf, 560, 340, 740, 440);
  // Arms
  rect(buf, 410, 240, 500, 280);
  rect(buf, 800, 240, 890, 280);
  // Legs
  rect(buf, 540, 480, 620, 580);
  rect(buf, 680, 480, 760, 580);
}

function pageFlowers(buf) {
  // Three flowers in a row with stems and leaves
  const cxs = [350, 650, 950];
  for (const cx of cxs) {
    // stem
    line(buf, cx, 340, cx, 580);
    // leaf left
    arc(buf, cx - 40, 430, 50, -Math.PI / 2, Math.PI / 2);
    arc(buf, cx - 40, 430, 50, Math.PI / 2, (3 * Math.PI) / 2);
    // leaf right
    arc(buf, cx + 40, 480, 50, -Math.PI / 2, Math.PI / 2);
    arc(buf, cx + 40, 480, 50, Math.PI / 2, (3 * Math.PI) / 2);
    // center
    circle(buf, cx, 280, 40);
    // 6 petals
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2;
      const px = cx + Math.cos(t) * 80;
      const py = 280 + Math.sin(t) * 80;
      circle(buf, px, py, 35);
    }
  }
  // Ground
  line(buf, 80, 580, 1220, 580);
}

function pageCar(buf) {
  // Side-view car
  // Body main
  polygon(buf, [
    [200, 420],
    [350, 280],
    [900, 280],
    [1050, 420],
  ]);
  // Bottom of body
  line(buf, 200, 420, 1050, 420);
  // Windows partition
  line(buf, 625, 280, 625, 420);
  // Wheels
  circle(buf, 350, 440, 70);
  circle(buf, 350, 440, 30);
  circle(buf, 900, 440, 70);
  circle(buf, 900, 440, 30);
  // Road
  line(buf, 80, 530, 1220, 530);
  // Sun
  circle(buf, 1130, 130, 45);
  // Cloud
  arc(buf, 250, 130, 30, Math.PI, 0);
  arc(buf, 305, 120, 40, Math.PI, 0);
  arc(buf, 360, 130, 28, Math.PI, 0);
  line(buf, 220, 130, 388, 130);
}

function pageButterfly(buf) {
  // Symmetric butterfly with patterned wings
  const cx = 650, cy = 325;
  // Body
  rect(buf, cx - 12, cy - 120, cx + 12, cy + 120);
  // Antennae
  arc(buf, cx - 30, cy - 150, 40, 0, Math.PI / 2);
  arc(buf, cx + 30, cy - 150, 40, Math.PI / 2, Math.PI);
  // Upper wings
  arc(buf, cx - 180, cy - 80, 180, -Math.PI / 2, Math.PI / 2);
  arc(buf, cx + 180, cy - 80, 180, Math.PI / 2, (3 * Math.PI) / 2);
  // Lower wings
  arc(buf, cx - 130, cy + 100, 130, -Math.PI / 2, Math.PI / 2);
  arc(buf, cx + 130, cy + 100, 130, Math.PI / 2, (3 * Math.PI) / 2);
  // Decorative circles
  circle(buf, cx - 200, cy - 80, 30);
  circle(buf, cx + 200, cy - 80, 30);
  circle(buf, cx - 150, cy + 100, 22);
  circle(buf, cx + 150, cy + 100, 22);
}

function pageBoat(buf) {
  // Sailboat on waves with sun
  // Hull
  polygon(buf, [
    [400, 460],
    [900, 460],
    [820, 540],
    [480, 540],
  ]);
  // Mast
  line(buf, 650, 460, 650, 160);
  // Sail
  polygon(buf, [
    [650, 180],
    [650, 440],
    [840, 440],
  ]);
  polygon(buf, [
    [650, 180],
    [650, 440],
    [470, 440],
  ]);
  // Waves
  for (let x = 80; x <= 1220; x += 80) {
    arc(buf, x + 40, 580, 40, Math.PI, 0);
  }
  // Sun
  circle(buf, 1130, 130, 50);
  // Cloud
  arc(buf, 260, 130, 35, Math.PI, 0);
  arc(buf, 320, 120, 45, Math.PI, 0);
  line(buf, 225, 130, 365, 130);
}

function pageDinosaur(buf) {
  // Round friendly dinosaur silhouette built from arcs
  // Body
  arc(buf, 700, 380, 220, Math.PI, 2 * Math.PI);
  line(buf, 480, 380, 920, 380);
  // Neck up to head
  arc(buf, 480, 240, 140, 0, Math.PI / 2);
  // Head
  circle(buf, 380, 200, 70);
  // Eye
  circle(buf, 360, 180, 10);
  // Tail
  polygon(buf, [
    [920, 380],
    [1100, 320],
    [1080, 380],
  ]);
  // Legs
  rect(buf, 560, 380, 620, 500);
  rect(buf, 760, 380, 820, 500);
  // Back plates
  for (let i = 0; i < 4; i++) {
    const x = 560 + i * 90;
    polygon(buf, [
      [x, 220],
      [x + 30, 180],
      [x + 60, 220],
    ]);
  }
}

function pageBalloons(buf) {
  // Five balloons on strings
  const balloons = [
    { cx: 300, cy: 220, r: 70 },
    { cx: 480, cy: 170, r: 80 },
    { cx: 670, cy: 230, r: 75 },
    { cx: 870, cy: 180, r: 85 },
    { cx: 1050, cy: 240, r: 70 },
  ];
  for (const b of balloons) {
    circle(buf, b.cx, b.cy, b.r);
    // tie triangle
    polygon(buf, [
      [b.cx - 8, b.cy + b.r],
      [b.cx + 8, b.cy + b.r],
      [b.cx, b.cy + b.r + 14],
    ]);
    // string
    let x = b.cx;
    let y = b.cy + b.r + 14;
    for (let i = 0; i < 30; i++) {
      const nx = x + Math.sin(i / 3) * 6;
      const ny = y + 10;
      line(buf, x, y, nx, ny);
      x = nx; y = ny;
    }
  }
  // Ground
  line(buf, 80, 590, 1220, 590);
}

function pageCat(buf) {
  // Round cat face with ears, eyes, whiskers, and a body curl
  const cx = 650, cy = 280;
  // Head
  circle(buf, cx, cy, 160);
  // Ears
  polygon(buf, [[cx - 160, cy - 100], [cx - 100, cy - 220], [cx - 60, cy - 130]]);
  polygon(buf, [[cx + 160, cy - 100], [cx + 100, cy - 220], [cx + 60, cy - 130]]);
  // Eyes
  arc(buf, cx - 60, cy - 20, 30, 0, Math.PI);
  arc(buf, cx + 60, cy - 20, 30, 0, Math.PI);
  circle(buf, cx - 60, cy - 10, 10);
  circle(buf, cx + 60, cy - 10, 10);
  // Nose
  polygon(buf, [[cx - 10, cy + 30], [cx + 10, cy + 30], [cx, cy + 45]]);
  // Mouth
  arc(buf, cx - 20, cy + 50, 20, 0, Math.PI);
  arc(buf, cx + 20, cy + 50, 20, 0, Math.PI);
  // Whiskers
  line(buf, cx - 30, cy + 40, cx - 150, cy + 30);
  line(buf, cx - 30, cy + 50, cx - 150, cy + 50);
  line(buf, cx - 30, cy + 60, cx - 150, cy + 70);
  line(buf, cx + 30, cy + 40, cx + 150, cy + 30);
  line(buf, cx + 30, cy + 50, cx + 150, cy + 50);
  line(buf, cx + 30, cy + 60, cx + 150, cy + 70);
  // Body curl
  arc(buf, cx, cy + 280, 200, Math.PI, 2 * Math.PI);
  line(buf, cx - 200, cy + 280, cx + 200, cy + 280);
  // Tail
  arc(buf, cx + 220, cy + 250, 60, -Math.PI / 2, Math.PI);
}

const PAGES = [
  { slug: "01-cozy-house", title: "Cozy House", draw: pageHouse },
  { slug: "02-friendly-fish", title: "Friendly Fish", draw: pageFish },
  { slug: "03-happy-robot", title: "Happy Robot", draw: pageRobot },
  { slug: "04-three-flowers", title: "Three Flowers", draw: pageFlowers },
  { slug: "05-sunny-car", title: "Sunny Car", draw: pageCar },
  { slug: "06-big-butterfly", title: "Big Butterfly", draw: pageButterfly },
  { slug: "07-little-sailboat", title: "Little Sailboat", draw: pageBoat },
  { slug: "08-dino-stomp", title: "Dino Stomp", draw: pageDinosaur },
  { slug: "09-balloon-bunch", title: "Balloon Bunch", draw: pageBalloons },
  { slug: "10-curly-cat", title: "Curly Cat", draw: pageCat },
];

// --- PNG encoder (grayscale, 8-bit) ----------------------------------------

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeBuf, data]));
  return Buffer.concat([u32be(data.length), typeBuf, data, u32be(crc)]);
}

function encodePNG(gray, w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 0;  // grayscale
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk("IHDR", ihdrData);

  // Raw image data: one filter byte (0 = None) per scanline, then `w` samples.
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    for (let x = 0; x < w; x++) {
      raw[y * (w + 1) + 1 + x] = gray[y * w + x];
    }
  }
  const idat = chunk("IDAT", deflateSync(raw, { level: 9 }));
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// --- driver ----------------------------------------------------------------

const manifest = {
  description:
    "ColorMe coloring-book pages — stylistic-equivalent fan-original line art.",
  width: W,
  height: H,
  lineWeight: LINE,
  pages: [],
};

for (const p of PAGES) {
  const buf = blankCanvas();
  p.draw(buf);
  const png = encodePNG(buf, W, H);
  const file = `${p.slug}.png`;
  writeFileSync(join(HERE, file), png);
  manifest.pages.push({ file, title: p.title });
}

writeFileSync(
  join(HERE, "pages.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);

console.log(`Wrote ${PAGES.length} pages + manifest to ${HERE}`);
