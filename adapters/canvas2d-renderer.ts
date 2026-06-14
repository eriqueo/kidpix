import type { Renderer, StrokeOpts, Point } from "../core/ports";

/** Renderer port implemented over a real CanvasRenderingContext2D. */
export class Canvas2DRenderer implements Renderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  beginPath(): void {
    this.ctx.beginPath();
  }
  closePath(): void {
    this.ctx.closePath();
  }
  setStroke(o: StrokeOpts): void {
    this.ctx.strokeStyle = o.strokeStyle;
    this.ctx.lineWidth = o.width;
    if (o.cap) this.ctx.lineCap = o.cap;
    if (o.join) this.ctx.lineJoin = o.join;
  }
  moveTo(p: Point): void {
    this.ctx.moveTo(p.x, p.y);
  }
  lineTo(p: Point): void {
    this.ctx.lineTo(p.x, p.y);
  }
  stroke(): void {
    this.ctx.stroke();
  }
  get raw(): CanvasRenderingContext2D {
    return this.ctx;
  }
}
