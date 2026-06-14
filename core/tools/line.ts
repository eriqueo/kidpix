import type { Point, Tool, ToolContext } from "../ports";

/**
 * Line — the second tool through the hexagon (Phase 4), proving the pattern
 * generalizes beyond pencil. Faithful mechanical lift of js/tools/line.js:
 * a live preview that clears the scratch layer between moves (`stomp`), a
 * shift-constrain to horizontal/vertical (`state.modified`), and start/during/
 * end sounds. Width is the raw size (no scaling) — matching legacy exactly.
 *
 * Note: like legacy, it does NOT set lineCap/lineJoin, inheriting ctx defaults.
 */
export function createLine(size = 7, stomp = true): Tool {
  let isDown = false;
  let start: Point = { x: 0, y: 0 };

  function drawPreview(p: Point, ctx: ToolContext): void {
    if (stomp) ctx.renderer.clear();
    ctx.sound.play("lineDuring");

    const r = ctx.renderer;
    r.beginPath();
    r.moveTo({ x: Math.round(start.x), y: Math.round(start.y) });

    let end = p;
    if (ctx.state.modified) {
      // Constrain to whichever axis the drag is longer along.
      const dx = Math.abs(p.x - start.x);
      const dy = Math.abs(p.y - start.y);
      end = dx < dy ? { x: start.x, y: p.y } : { x: p.x, y: start.y };
    }
    r.lineTo(end);
    r.setStroke({ strokeStyle: ctx.state.texture(ctx.state.color), width: size });
    r.stroke();
    r.closePath();
  }

  return {
    meta: { id: "line", name: "Line", category: "draw" },

    onPointerDown(p, ctx) {
      isDown = true;
      start = p;
      ctx.sound.play("lineStart");
    },

    onPointerMove(p, ctx) {
      if (isDown) drawPreview(p, ctx);
    },

    onPointerUp(p, ctx) {
      if (!isDown) return;
      drawPreview(p, ctx); // finalize on the scratch layer
      isDown = false;
      ctx.commit();
      ctx.sound.play("lineEnd");
    },
  };
}
