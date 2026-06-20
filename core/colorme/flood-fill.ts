/**
 * ColorMe bounded flood-fill primitive.
 *
 * Scanline 4-connected flood fill against an RGBA pixel buffer, bounded by
 * a line-art mask: any pixel whose luminance is at or below `lineLuma` is
 * treated as an outline and the fill cannot cross it. The seed pixel itself
 * must not be on a line; if it is, the fill is a no-op.
 *
 * Inputs are pure data (Uint8ClampedArray + dimensions); no DOM/canvas.
 * That keeps the primitive testable headless and lets the legacy engine,
 * a worker, or a renderer adapter all share one implementation.
 */
export type FillColor = { r: number; g: number; b: number; a: number };

export interface FloodFillOptions {
  /** Pixels with luminance <= lineLuma are treated as opaque outlines (default 80, range 0..255). */
  lineLuma?: number;
  /** Max color-distance (Chebyshev) from the seed's color that still counts as fillable. Default 8. */
  threshold?: number;
}

const DEFAULTS: Required<FloodFillOptions> = { lineLuma: 80, threshold: 8 };

/** Rec.709 luminance, integer-friendly. Treats fully transparent pixels as white. */
export function luma(r: number, g: number, b: number, a: number): number {
  if (a === 0) return 255;
  return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
}

function matches(
  data: Uint8ClampedArray,
  idx: number,
  seed: FillColor,
  fill: FillColor,
  lineLuma: number,
  threshold: number,
): boolean {
  const r = data[idx];
  const g = data[idx + 1];
  const b = data[idx + 2];
  const a = data[idx + 3];
  // Already filled: stop, otherwise the scan would loop forever once we write.
  if (r === fill.r && g === fill.g && b === fill.b && a === fill.a) return false;
  // Bounded by line art.
  if (luma(r, g, b, a) <= lineLuma) return false;
  // Within color-distance of the seed.
  if (Math.abs(r - seed.r) > threshold) return false;
  if (Math.abs(g - seed.g) > threshold) return false;
  if (Math.abs(b - seed.b) > threshold) return false;
  if (Math.abs(a - seed.a) > threshold) return false;
  return true;
}

/**
 * Fill from (sx, sy) into a new ImageData-sized buffer of changed pixels.
 * Returns null if the seed is on a line (or out of bounds) — caller can treat as no-op.
 * Mutates `data` in place with the fill color where it spread.
 */
export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sx: number,
  sy: number,
  color: FillColor,
  opts: FloodFillOptions = {},
): { touched: number } | null {
  const { lineLuma, threshold } = { ...DEFAULTS, ...opts };
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null;

  const seedIdx = (sy * width + sx) * 4;
  const seed: FillColor = {
    r: data[seedIdx],
    g: data[seedIdx + 1],
    b: data[seedIdx + 2],
    a: data[seedIdx + 3],
  };

  // Seed sits on a line, or seed already equals fill color: nothing to do.
  if (luma(seed.r, seed.g, seed.b, seed.a) <= lineLuma) return null;
  if (
    seed.r === color.r &&
    seed.g === color.g &&
    seed.b === color.b &&
    seed.a === color.a
  )
    return null;

  let touched = 0;
  const stack: number[] = [sx, sy];

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;

    // Walk up to find the top of this vertical run.
    let yy = y;
    let idx = (yy * width + x) * 4;
    while (yy >= 0 && matches(data, idx, seed, color, lineLuma, threshold)) {
      yy--;
      idx -= width * 4;
    }
    yy++;
    idx += width * 4;

    let reachedLeft = false;
    let reachedRight = false;

    // Walk down the run, painting and pushing left/right neighbors.
    while (yy < height && matches(data, idx, seed, color, lineLuma, threshold)) {
      data[idx] = color.r;
      data[idx + 1] = color.g;
      data[idx + 2] = color.b;
      data[idx + 3] = color.a;
      touched++;

      if (x > 0) {
        const leftIdx = idx - 4;
        if (matches(data, leftIdx, seed, color, lineLuma, threshold)) {
          if (!reachedLeft) {
            stack.push(x - 1, yy);
            reachedLeft = true;
          }
        } else {
          reachedLeft = false;
        }
      }
      if (x < width - 1) {
        const rightIdx = idx + 4;
        if (matches(data, rightIdx, seed, color, lineLuma, threshold)) {
          if (!reachedRight) {
            stack.push(x + 1, yy);
            reachedRight = true;
          }
        } else {
          reachedRight = false;
        }
      }

      yy++;
      idx += width * 4;
    }
  }

  return { touched };
}
