import { describe, it, expect } from "vitest";
import {
  clamp01,
  dissolveCellOrder,
  dissolveCellsRevealed,
  fadeAlpha,
  irisRadius,
  wipeX,
} from "./transitions";

describe("transition math", () => {
  it("clamp01 clamps to [0,1] and replaces NaN with 0", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(1.7)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
  });

  it("fadeAlpha is identity on [0,1]", () => {
    expect(fadeAlpha(0)).toBe(0);
    expect(fadeAlpha(0.5)).toBe(0.5);
    expect(fadeAlpha(2)).toBe(1);
  });

  it("wipeX scales linearly with width and snaps to integer pixels", () => {
    expect(wipeX(0, 400)).toBe(0);
    expect(wipeX(0.5, 400)).toBe(200);
    expect(wipeX(1, 400)).toBe(400);
    expect(Number.isInteger(wipeX(0.333, 400))).toBe(true);
  });

  it("irisRadius reaches half-diagonal at t=1", () => {
    const w = 800;
    const h = 600;
    expect(irisRadius(0, w, h)).toBe(0);
    expect(irisRadius(1, w, h)).toBeCloseTo(Math.hypot(w, h) / 2);
    expect(irisRadius(0.5, w, h)).toBeCloseTo(Math.hypot(w, h) / 4);
  });

  it("dissolveCellOrder is a permutation of [0, n)", () => {
    const cols = 8;
    const rows = 6;
    const order = dissolveCellOrder(cols, rows);
    expect(order).toHaveLength(cols * rows);
    expect(new Set(order).size).toBe(cols * rows);
    expect(Math.min(...order)).toBe(0);
    expect(Math.max(...order)).toBe(cols * rows - 1);
  });

  it("dissolveCellOrder is deterministic", () => {
    const a = dissolveCellOrder(8, 6);
    const b = dissolveCellOrder(8, 6);
    expect(a).toEqual(b);
  });

  it("dissolveCellsRevealed scales 0..total", () => {
    expect(dissolveCellsRevealed(0, 100)).toBe(0);
    expect(dissolveCellsRevealed(0.5, 100)).toBe(50);
    expect(dissolveCellsRevealed(1, 100)).toBe(100);
    expect(dissolveCellsRevealed(-0.5, 100)).toBe(0);
  });
});
