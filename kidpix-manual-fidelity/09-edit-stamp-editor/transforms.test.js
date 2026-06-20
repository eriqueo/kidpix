import { describe, it, expect, beforeEach } from "vitest";

import "./pixel-grid.js";
import "./transforms.js";

const SE = () => window.KiddoPaint.StampEditor;
const T = () => window.KiddoPaint.StampEditor.Transforms;

function paint(grid, points, color) {
  grid.currentColor = color;
  for (const [x, y] of points) grid.paint(x, y);
}

describe("StampEditor transforms", () => {
  let grid;

  beforeEach(() => {
    grid = SE().createGrid(4, 4);
  });

  it("mirrorH swaps left/right columns", () => {
    paint(grid, [[0, 1]], "#f00");
    T().mirrorH(grid);
    expect(grid.getPixel(3, 1)).toBe("#f00");
    expect(grid.getPixel(0, 1)).toBeNull();
  });

  it("mirrorV swaps top/bottom rows", () => {
    paint(grid, [[2, 0]], "#0f0");
    T().mirrorV(grid);
    expect(grid.getPixel(2, 3)).toBe("#0f0");
    expect(grid.getPixel(2, 0)).toBeNull();
  });

  it("rotateCW: top-left → top-right after one tap on a square grid", () => {
    paint(grid, [[0, 0]], "#00f");
    T().rotateCW(grid);
    expect(grid.getPixel(3, 0)).toBe("#00f");
    expect(grid.getPixel(0, 0)).toBeNull();
  });

  it("rotateCW × 4 is identity on a square grid", () => {
    paint(grid, [
      [0, 0],
      [1, 2],
      [3, 3],
    ], "#abc");
    const before = grid.snapshot();
    T().rotateCW(grid);
    T().rotateCW(grid);
    T().rotateCW(grid);
    T().rotateCW(grid);
    expect(grid.pixels).toEqual(before);
  });

  it("rotateCW throws on a non-square grid (SPEC: square only)", () => {
    const rect = SE().createGrid(4, 3);
    expect(() => T().rotateCW(rect)).toThrow();
  });

  it("clear wipes every cell to null", () => {
    paint(grid, [
      [0, 0],
      [3, 3],
    ], "#fff");
    T().clear(grid);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) expect(grid.getPixel(x, y)).toBeNull();
  });

  it("mirrorH twice is identity", () => {
    paint(grid, [
      [0, 0],
      [1, 2],
    ], "#fff");
    const before = grid.snapshot();
    T().mirrorH(grid);
    T().mirrorH(grid);
    expect(grid.pixels).toEqual(before);
  });

  it("transforms compose with beginStroke/endStroke for undo", () => {
    paint(grid, [[0, 0]], "#fff");
    grid.beginStroke();
    T().mirrorH(grid);
    grid.endStroke();
    expect(grid.getPixel(3, 0)).toBe("#fff");
    grid.undoLastStroke();
    expect(grid.getPixel(0, 0)).toBe("#fff");
    expect(grid.getPixel(3, 0)).toBeNull();
  });
});
