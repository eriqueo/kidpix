import { describe, it, expect, vi } from "vitest";
import { createPencil } from "./pencil";
import type { ToolContext, Point } from "../ports";

/**
 * Headless test of the core pencil — the whole point of the hexagon: a tool
 * runs and is asserted with ZERO DOM/canvas, via fake ports. (Pixel-parity vs
 * the legacy pencil is a separate CI screenshot test in tests/parity/.)
 */
function fakeCtx() {
  const calls: string[] = [];
  const renderer = {
    beginPath: vi.fn(() => calls.push("beginPath")),
    closePath: vi.fn(() => calls.push("closePath")),
    setStroke: vi.fn((o) => calls.push(`setStroke:${o.width}:${o.cap}:${o.join}`)),
    moveTo: vi.fn((p: Point) => calls.push(`moveTo:${p.x},${p.y}`)),
    lineTo: vi.fn((p: Point) => calls.push(`lineTo:${p.x},${p.y}`)),
    stroke: vi.fn(() => calls.push("stroke")),
    clear: vi.fn(() => calls.push("clear")),
  };
  const ctx: ToolContext = {
    renderer,
    sound: { play: vi.fn((id: string) => calls.push(`sound:${id}`)) },
    state: {
      color: "#ff0000",
      altColor: "#000000",
      scaling: 2,
      multiplier: 1,
      modified: false,
      texture: (c) => c, // identity texture → strokeStyle === color
    },
    rng: () => 0.5,
    commit: vi.fn(() => calls.push("commit")),
  };
  return { ctx, renderer, calls };
}

describe("core pencil", () => {
  it("draws nothing on move before pointer-down", () => {
    const { ctx, renderer } = fakeCtx();
    createPencil().onPointerMove?.({ x: 10, y: 10 }, ctx);
    expect(renderer.stroke).not.toHaveBeenCalled();
  });

  it("strokes from last point to current with width = size * scaling", () => {
    const { ctx, renderer } = fakeCtx();
    const pencil = createPencil(7); // size 7, scaling 2 => width 14
    pencil.onPointerDown?.({ x: 0, y: 0 }, ctx);
    pencil.onPointerMove?.({ x: 5, y: 9 }, ctx);

    expect(renderer.setStroke).toHaveBeenCalledWith(
      expect.objectContaining({ width: 14, cap: "round", join: "round", strokeStyle: "#ff0000" }),
    );
    expect(renderer.moveTo).toHaveBeenCalledWith({ x: 0, y: 0 });
    expect(renderer.lineTo).toHaveBeenCalledWith({ x: 5, y: 9 });
    expect(renderer.stroke).toHaveBeenCalledTimes(1);
  });

  it("plays the pencil sound on each drawn segment", () => {
    const { ctx } = fakeCtx();
    const pencil = createPencil();
    pencil.onPointerDown?.({ x: 0, y: 0 }, ctx);
    pencil.onPointerMove?.({ x: 1, y: 1 }, ctx);
    expect(ctx.sound.play).toHaveBeenCalledWith("pencil");
  });

  it("on pointer-up draws the final segment, closes path, and commits", () => {
    const { ctx, renderer, calls } = fakeCtx();
    const pencil = createPencil();
    pencil.onPointerDown?.({ x: 0, y: 0 }, ctx);
    pencil.onPointerUp?.({ x: 3, y: 3 }, ctx);

    expect(renderer.stroke).toHaveBeenCalledTimes(1); // the final segment
    expect(renderer.closePath).toHaveBeenCalledTimes(1);
    expect(ctx.commit).toHaveBeenCalledTimes(1);
    expect(calls.indexOf("closePath")).toBeGreaterThan(calls.indexOf("stroke"));
    expect(calls.indexOf("commit")).toBeGreaterThan(calls.indexOf("closePath"));
  });

  it("ignores pointer-up if no stroke was in progress", () => {
    const { ctx, renderer } = fakeCtx();
    createPencil().onPointerUp?.({ x: 3, y: 3 }, ctx);
    expect(renderer.stroke).not.toHaveBeenCalled();
    expect(ctx.commit).not.toHaveBeenCalled();
  });
});
