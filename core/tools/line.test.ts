import { describe, it, expect, vi } from "vitest";
import { createLine } from "./line";
import type { ToolContext, Point } from "../ports";

function fakeCtx(modified = false) {
  const calls: string[] = [];
  const renderer = {
    beginPath: vi.fn(() => calls.push("beginPath")),
    closePath: vi.fn(() => calls.push("closePath")),
    setStroke: vi.fn((o) => calls.push(`setStroke:${o.width}`)),
    moveTo: vi.fn((p: Point) => calls.push(`moveTo:${p.x},${p.y}`)),
    lineTo: vi.fn((p: Point) => calls.push(`lineTo:${p.x},${p.y}`)),
    stroke: vi.fn(() => calls.push("stroke")),
    clear: vi.fn(() => calls.push("clear")),
  };
  const ctx: ToolContext = {
    renderer,
    sound: { play: vi.fn((id: string) => calls.push(`sound:${id}`)) },
    state: {
      color: "#00ff00",
      altColor: "#000000",
      scaling: 2,
      multiplier: 1,
      modified,
      texture: (c) => c,
    },
    rng: () => 0.5,
    commit: vi.fn(() => calls.push("commit")),
  };
  return { ctx, renderer, calls };
}

describe("core line", () => {
  it("plays lineStart on down and lineEnd on up", () => {
    const { ctx } = fakeCtx();
    const line = createLine();
    line.onPointerDown?.({ x: 0, y: 0 }, ctx);
    line.onPointerUp?.({ x: 10, y: 10 }, ctx);
    expect(ctx.sound.play).toHaveBeenCalledWith("lineStart");
    expect(ctx.sound.play).toHaveBeenCalledWith("lineEnd");
  });

  it("clears the scratch layer before each preview (stomp) and uses raw size", () => {
    const { ctx, renderer } = fakeCtx();
    const line = createLine(7); // width must be 7 (NOT 7*scaling)
    line.onPointerDown?.({ x: 0, y: 0 }, ctx);
    line.onPointerMove?.({ x: 20, y: 5 }, ctx);
    expect(renderer.clear).toHaveBeenCalledTimes(1);
    expect(renderer.setStroke).toHaveBeenCalledWith(
      expect.objectContaining({ width: 7 }),
    );
  });

  it("draws an unconstrained segment from start to current when not modified", () => {
    const { ctx, renderer } = fakeCtx(false);
    const line = createLine();
    line.onPointerDown?.({ x: 2, y: 3 }, ctx);
    line.onPointerMove?.({ x: 20, y: 8 }, ctx);
    expect(renderer.moveTo).toHaveBeenCalledWith({ x: 2, y: 3 });
    expect(renderer.lineTo).toHaveBeenCalledWith({ x: 20, y: 8 });
  });

  it("constrains to the longer axis when modified (shift)", () => {
    const { ctx, renderer } = fakeCtx(true);
    const line = createLine();
    line.onPointerDown?.({ x: 0, y: 0 }, ctx);
    // dx=30 > dy=4  => horizontal lock: end.y snaps to start.y
    line.onPointerMove?.({ x: 30, y: 4 }, ctx);
    expect(renderer.lineTo).toHaveBeenCalledWith({ x: 30, y: 0 });
  });

  it("does nothing on move/up before down", () => {
    const { ctx, renderer } = fakeCtx();
    const line = createLine();
    line.onPointerMove?.({ x: 5, y: 5 }, ctx);
    line.onPointerUp?.({ x: 5, y: 5 }, ctx);
    expect(renderer.stroke).not.toHaveBeenCalled();
    expect(ctx.commit).not.toHaveBeenCalled();
  });
});
