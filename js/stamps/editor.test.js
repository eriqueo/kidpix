import { describe, it, expect, beforeEach } from "vitest";

global.KiddoPaint = global.KiddoPaint || {};
global.KiddoPaint.Stamps = global.KiddoPaint.Stamps || {};

await import("./editor.js");

const { EditorState, makeBlankGrid, imageDataToGrid, gridToCanvas, DEFAULT_SIZE } =
  global.KiddoPaint.Stamps.Editor;

describe("Stamps.Editor.EditorState", () => {
  let state;

  beforeEach(() => {
    state = new EditorState();
  });

  it("starts as a 32x32 grid of empty cells", () => {
    expect(state.size).toBe(DEFAULT_SIZE);
    expect(state.grid.length).toBe(32 * 32);
    expect(state.grid.every((v) => v === false)).toBe(true);
  });

  it("togglePixel flips an individual cell", () => {
    state.togglePixel(5, 7);
    expect(state.get(5, 7)).toBe(true);
    state.togglePixel(5, 7);
    expect(state.get(5, 7)).toBe(false);
  });

  it("clear empties every cell", () => {
    state.togglePixel(0, 0);
    state.togglePixel(31, 31);
    state.clear();
    expect(state.grid.every((v) => v === false)).toBe(true);
  });

  it("rotateRight rotates the canvas 90° clockwise", () => {
    // Mark top-left corner; after right-rotation it should sit at top-right.
    state.set(0, 0, true);
    state.rotateRight();
    expect(state.get(31, 0)).toBe(true);
    expect(state.get(0, 0)).toBe(false);
  });

  it("four rotateRight calls return to the original layout", () => {
    state.set(3, 5, true);
    state.set(10, 12, true);
    const before = state.grid.slice();
    state.rotateRight();
    state.rotateRight();
    state.rotateRight();
    state.rotateRight();
    expect(state.grid).toEqual(before);
  });

  it("flipH mirrors horizontally", () => {
    state.set(0, 4, true);
    state.flipH();
    expect(state.get(31, 4)).toBe(true);
    expect(state.get(0, 4)).toBe(false);
  });

  it("flipV mirrors vertically", () => {
    state.set(4, 0, true);
    state.flipV();
    expect(state.get(4, 31)).toBe(true);
    expect(state.get(4, 0)).toBe(false);
  });

  it("restoreOriginal copies a snapshot back into the grid", () => {
    const original = makeBlankGrid(32);
    original[0] = true;
    original[1023] = true;
    state.togglePixel(15, 15);
    state.restoreOriginal(original);
    expect(state.get(0, 0)).toBe(true);
    expect(state.get(31, 31)).toBe(true);
    expect(state.get(15, 15)).toBe(false);
  });

  it("restoreOriginal ignores mismatched input", () => {
    state.set(2, 2, true);
    state.restoreOriginal([true, true]);
    expect(state.get(2, 2)).toBe(true);
  });

  it("toCanvas produces a 32x32 canvas", () => {
    state.set(0, 0, true);
    state.set(31, 31, true);
    const canvas = state.toCanvas();
    expect(canvas).not.toBeNull();
    expect(canvas.width).toBe(32);
    expect(canvas.height).toBe(32);
    // pixel-level verification happens in the Playwright e2e where a real
    // canvas backend is available.
  });
});

describe("Stamps.Editor.imageDataToGrid", () => {
  it("treats non-transparent non-white pixels as 'on'", () => {
    const data = new Uint8ClampedArray(32 * 32 * 4);
    // pixel (0,0): opaque black → on
    data[0] = 0;
    data[1] = 0;
    data[2] = 0;
    data[3] = 255;
    // pixel (1,0): opaque white → off (background)
    data[4] = 255;
    data[5] = 255;
    data[6] = 255;
    data[7] = 255;
    // pixel (2,0): transparent → off
    data[8] = 100;
    data[9] = 100;
    data[10] = 100;
    data[11] = 0;
    const grid = imageDataToGrid({ data }, 32);
    expect(grid[0]).toBe(true);
    expect(grid[1]).toBe(false);
    expect(grid[2]).toBe(false);
  });
});

describe("Stamps.Editor.gridToCanvas", () => {
  it("renders a scaled canvas with filled cells", () => {
    const grid = makeBlankGrid(32);
    grid[0] = true;
    const c = gridToCanvas(grid, 32, 2);
    expect(c.width).toBe(64);
    expect(c.height).toBe(64);
  });
});
