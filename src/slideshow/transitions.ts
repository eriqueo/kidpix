/**
 * Transition math + renderers.
 *
 * The *math* (alpha, wipe x, iris radius, dissolve cell ordering) is exported
 * as named pure functions so it is testable headlessly. The *renderers* call
 * into a Canvas 2D context and are only exercised in the browser / smoke test.
 *
 * `t` is always clamped to [0, 1]. Frame counts and elapsed-ms timing live in
 * the player; transitions only know the normalized progress.
 */
import { TRANSITIONS, type TransitionId } from "./types";

export type DrawableSource = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

export type TransitionFn = (
  ctx: CanvasRenderingContext2D,
  from: DrawableSource | null,
  to: DrawableSource,
  t: number,
  w: number,
  h: number,
) => void;

export function clamp01(t: number): number {
  if (Number.isNaN(t)) return 0;
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

export function fadeAlpha(t: number): number {
  return clamp01(t);
}

export function wipeX(t: number, w: number): number {
  return Math.round(clamp01(t) * w);
}

export function irisRadius(t: number, w: number, h: number): number {
  const max = Math.hypot(w, h) / 2;
  return clamp01(t) * max;
}

/**
 * Deterministic dissolve: split the screen into a fixed grid of cells, hash
 * each cell to a 0..1 rank, and reveal cells whose rank < t.
 *
 * Pure function — `gridCols`/`gridRows` are inputs so tests can pin them.
 */
export function dissolveCellOrder(cols: number, rows: number): number[] {
  const out: number[] = [];
  const total = cols * rows;
  for (let i = 0; i < total; i++) out.push(i);
  // 32-bit deterministic shuffle via multiplicative-hash key per index.
  out.sort((a, b) => hash32(a) - hash32(b));
  return out;
}

export function dissolveCellsRevealed(t: number, total: number): number {
  return Math.floor(clamp01(t) * total);
}

function hash32(n: number): number {
  let x = n | 0;
  x = (x ^ 61) ^ (x >>> 16);
  x = (x + (x << 3)) | 0;
  x = x ^ (x >>> 4);
  x = Math.imul(x, 0x27d4eb2d);
  x = x ^ (x >>> 15);
  return x >>> 0;
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  src: DrawableSource | null,
  w: number,
  h: number,
): void {
  if (!src) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    return;
  }
  ctx.drawImage(src, 0, 0, w, h);
}

export const cutTransition: TransitionFn = (ctx, from, to, t, w, h) => {
  drawCover(ctx, t > 0 ? to : from, w, h);
};

export const fadeTransition: TransitionFn = (ctx, from, to, t, w, h) => {
  drawCover(ctx, from, w, h);
  ctx.save();
  ctx.globalAlpha = fadeAlpha(t);
  drawCover(ctx, to, w, h);
  ctx.restore();
};

export const wipeTransition: TransitionFn = (ctx, from, to, t, w, h) => {
  drawCover(ctx, from, w, h);
  const x = wipeX(t, w);
  if (x <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, x, h);
  ctx.clip();
  drawCover(ctx, to, w, h);
  ctx.restore();
};

export const irisTransition: TransitionFn = (ctx, from, to, t, w, h) => {
  drawCover(ctx, from, w, h);
  const r = irisRadius(t, w, h);
  if (r <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  ctx.clip();
  drawCover(ctx, to, w, h);
  ctx.restore();
};

const DISSOLVE_COLS = 16;
const DISSOLVE_ROWS = 12;
const DISSOLVE_ORDER = dissolveCellOrder(DISSOLVE_COLS, DISSOLVE_ROWS);

export const dissolveTransition: TransitionFn = (ctx, from, to, t, w, h) => {
  drawCover(ctx, from, w, h);
  const total = DISSOLVE_COLS * DISSOLVE_ROWS;
  const reveal = dissolveCellsRevealed(t, total);
  if (reveal <= 0) return;
  const cw = w / DISSOLVE_COLS;
  const ch = h / DISSOLVE_ROWS;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < reveal; i++) {
    const idx = DISSOLVE_ORDER[i];
    const cx = idx % DISSOLVE_COLS;
    const cy = Math.floor(idx / DISSOLVE_COLS);
    ctx.rect(cx * cw, cy * ch, Math.ceil(cw) + 1, Math.ceil(ch) + 1);
  }
  ctx.clip();
  drawCover(ctx, to, w, h);
  ctx.restore();
};

export const TRANSITION_FNS: Record<TransitionId, TransitionFn> = {
  cut: cutTransition,
  fade: fadeTransition,
  wipe: wipeTransition,
  iris: irisTransition,
  dissolve: dissolveTransition,
};

export function transitionFn(id: TransitionId): TransitionFn {
  return TRANSITION_FNS[id];
}

export { TRANSITIONS };
