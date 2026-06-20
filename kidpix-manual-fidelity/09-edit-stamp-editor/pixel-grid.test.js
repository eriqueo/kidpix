import { describe, it, expect, beforeEach } from "vitest";

import "./pixel-grid.js";

describe("StampEditor pixel grid", () => {
  let grid;

  beforeEach(() => {
    grid = window.KiddoPaint.StampEditor.createGrid(4, 4);
  });

  it("initializes all cells transparent", () => {
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        expect(grid.getPixel(x, y)).toBeNull();
      }
    }
  });

  it("paint writes currentColor", () => {
    grid.currentColor = "rgb(255,0,0)";
    grid.paint(2, 1);
    expect(grid.getPixel(2, 1)).toBe("rgb(255,0,0)");
  });

  it("erase clears a cell", () => {
    grid.currentColor = "rgb(0,255,0)";
    grid.paint(0, 0);
    grid.erase(0, 0);
    expect(grid.getPixel(0, 0)).toBeNull();
  });

  it("eraseMode makes paint write transparent", () => {
    grid.currentColor = "rgb(0,0,255)";
    grid.paint(1, 1);
    grid.eraseMode = true;
    grid.paint(1, 1);
    expect(grid.getPixel(1, 1)).toBeNull();
  });

  it("bounds check: out-of-range paint is a no-op and returns false", () => {
    expect(grid.paint(-1, 0)).toBe(false);
    expect(grid.paint(4, 0)).toBe(false);
    expect(grid.paint(0, 4)).toBe(false);
    expect(grid.getPixel(-1, 0)).toBeUndefined();
  });

  it("beginStroke/endStroke + undoLastStroke restores the snapshot", () => {
    grid.currentColor = "#abc";
    grid.beginStroke();
    grid.paint(0, 0);
    grid.paint(3, 3);
    grid.endStroke();
    expect(grid.getPixel(0, 0)).toBe("#abc");
    expect(grid.undoLastStroke()).toBe(true);
    expect(grid.getPixel(0, 0)).toBeNull();
    expect(grid.getPixel(3, 3)).toBeNull();
    // Single-level: a second undo is a no-op.
    expect(grid.undoLastStroke()).toBe(false);
  });

  it("toCanvas produces a sized canvas", () => {
    grid.currentColor = "rgb(10,20,30)";
    grid.paint(0, 0);
    const canvas = grid.toCanvas(64); // 64/4 = 16 px per cell
    expect(canvas.width).toBe(64);
    expect(canvas.height).toBe(64);
    expect(canvas.getContext("2d")).toBeTruthy();
  });

  it("rejects zero dimensions", () => {
    expect(() => window.KiddoPaint.StampEditor.createGrid(0, 4)).toThrow();
    expect(() => window.KiddoPaint.StampEditor.createGrid(4, 0)).toThrow();
  });
});
