import { describe, it, expect } from "vitest";
import { floodFill, luma, type FillColor } from "./flood-fill";

const WHITE = 255;
const BLACK = 0;
const RED: FillColor = { r: 255, g: 0, b: 0, a: 255 };

function makeWhite(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = WHITE;
    data[i + 1] = WHITE;
    data[i + 2] = WHITE;
    data[i + 3] = 255;
  }
  return data;
}

function setPx(
  data: Uint8ClampedArray,
  w: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
) {
  const i = (y * w + x) * 4;
  data[i] = r;
  data[i + 1] = g;
  data[i + 2] = b;
  data[i + 3] = a;
}

function getPx(data: Uint8ClampedArray, w: number, x: number, y: number) {
  const i = (y * w + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
}

/** Draw a closed rectangle of black pixels (outline only). */
function drawRect(
  data: Uint8ClampedArray,
  w: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  for (let x = x0; x <= x1; x++) {
    setPx(data, w, x, y0, BLACK, BLACK, BLACK);
    setPx(data, w, x, y1, BLACK, BLACK, BLACK);
  }
  for (let y = y0; y <= y1; y++) {
    setPx(data, w, x0, y, BLACK, BLACK, BLACK);
    setPx(data, w, x1, y, BLACK, BLACK, BLACK);
  }
}

describe("luma", () => {
  it("treats transparent pixels as white", () => {
    expect(luma(0, 0, 0, 0)).toBe(255);
  });
  it("computes Rec.709 grayscale", () => {
    expect(luma(255, 255, 255, 255)).toBe(255);
    expect(luma(0, 0, 0, 255)).toBe(0);
  });
});

describe("floodFill — bounded by line art", () => {
  const W = 20;
  const H = 20;

  it("fills only inside a closed black rectangle", () => {
    const data = makeWhite(W, H);
    drawRect(data, W, 3, 3, 16, 16);

    // Seed inside the rectangle.
    const result = floodFill(data, W, H, 10, 10, RED);
    expect(result).not.toBeNull();
    expect(result!.touched).toBeGreaterThan(0);

    // Inside is red.
    expect(getPx(data, W, 10, 10)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    // Outline still black.
    expect(getPx(data, W, 3, 3)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
    // Outside the rectangle is untouched white.
    expect(getPx(data, W, 0, 0)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
    expect(getPx(data, W, 19, 19)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });

  it("does nothing if the seed is on a line", () => {
    const data = makeWhite(W, H);
    drawRect(data, W, 3, 3, 16, 16);
    const before = data.slice();
    const result = floodFill(data, W, H, 3, 3, RED);
    expect(result).toBeNull();
    expect(data).toEqual(before);
  });

  it("does nothing if the seed already matches the fill color", () => {
    const data = makeWhite(W, H);
    setPx(data, W, 10, 10, 255, 0, 0, 255);
    const before = data.slice();
    const result = floodFill(data, W, H, 10, 10, RED);
    expect(result).toBeNull();
    expect(data).toEqual(before);
  });

  it("is idempotent: filling the same region twice changes nothing the second time", () => {
    const data = makeWhite(W, H);
    drawRect(data, W, 3, 3, 16, 16);
    floodFill(data, W, H, 10, 10, RED);
    const afterFirst = data.slice();
    const result2 = floodFill(data, W, H, 10, 10, RED);
    expect(result2).toBeNull();
    expect(data).toEqual(afterFirst);
  });

  it("is deterministic: same input → same output", () => {
    const a = makeWhite(W, H);
    const b = makeWhite(W, H);
    drawRect(a, W, 3, 3, 16, 16);
    drawRect(b, W, 3, 3, 16, 16);
    floodFill(a, W, H, 10, 10, RED);
    floodFill(b, W, H, 10, 10, RED);
    expect(a).toEqual(b);
  });

  it("rejects out-of-bounds seeds", () => {
    const data = makeWhite(W, H);
    expect(floodFill(data, W, H, -1, 0, RED)).toBeNull();
    expect(floodFill(data, W, H, W, 0, RED)).toBeNull();
    expect(floodFill(data, W, H, 0, H, RED)).toBeNull();
  });

  it("fills both halves separately when split by a vertical line", () => {
    const data = makeWhite(W, H);
    // vertical black line at x=10 from top to bottom
    for (let y = 0; y < H; y++) setPx(data, W, 10, y, BLACK, BLACK, BLACK);

    floodFill(data, W, H, 5, 5, RED);
    // Left half: red.
    expect(getPx(data, W, 5, 5).r).toBe(255);
    // Right half: untouched.
    expect(getPx(data, W, 15, 5)).toEqual({ r: 255, g: 255, b: 255, a: 255 });

    // Now fill the right half with same color — still bounded.
    floodFill(data, W, H, 15, 5, RED);
    expect(getPx(data, W, 15, 5).r).toBe(255);
    // The black line is preserved.
    expect(getPx(data, W, 10, 5)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  });
});
