import type { Renderer, StrokeOpts, Point } from "../core/ports";

/** Renderer port implemented over a real CanvasRenderingContext2D. */
export class Canvas2DRenderer implements Renderer {
  /**
   * @param ctx        the 2D context to draw into (the scratch/tmp layer)
   * @param clearImpl  optional clear strategy. The legacy bridge passes
   *                   `() => KiddoPaint.Display.clearTmp()` so the
   *                   `allowClearTmp` invariant is preserved; standalone use
   *                   falls back to clearRect over the whole canvas.
   */
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly clearImpl?: () => void,
  ) {}

  beginPath(): void {
    this.ctx.beginPath();
  }
  closePath(): void {
    this.ctx.closePath();
  }
  clear(): void {
    if (this.clearImpl) this.clearImpl();
    else this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
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
