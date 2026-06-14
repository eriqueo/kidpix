import type { Point, Tool, ToolContext } from "../ports";

/**
 * Pencil — the first tool through the hexagon (Phase 3).
 *
 * This is a faithful MECHANICAL LIFT of js/tools/pencil.js: identical behavior
 * (stroke segments with round cap/join, width = size * scaling, sound on move,
 * final segment + commit on up), but it reaches for nothing global — all I/O
 * comes through `ToolContext`. That makes it testable headless and renderer-agnostic.
 */
export function createPencil(size = 7): Tool {
  let isDown = false;
  let last: Point = { x: 0, y: 0 };

  function drawSegment(p: Point, ctx: ToolContext): void {
    ctx.sound.play("pencil");
    const r = ctx.renderer;
    r.beginPath();
    r.setStroke({
      strokeStyle: ctx.state.texture(ctx.state.color),
      width: size * ctx.state.scaling,
      cap: "round",
      join: "round",
    });
    r.moveTo(last);
    r.lineTo(p);
    r.stroke();
    last = p;
  }

  return {
    meta: { id: "pencil", name: "Pencil", category: "draw" },

    onPointerDown(p) {
      isDown = true;
      last = p;
    },

    onPointerMove(p, ctx) {
      if (isDown) drawSegment(p, ctx);
    },

    onPointerUp(p, ctx) {
      if (!isDown) return;
      drawSegment(p, ctx); // legacy draws the final segment on mouseup
      ctx.renderer.closePath();
      isDown = false;
      ctx.commit();
    },
  };
}
