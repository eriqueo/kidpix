import { type Page, type Locator } from "@playwright/test";
import { initializeKidPix, selectTool } from "../e2e/shared/tool-helpers";

/**
 * Parity harness helpers (Phase 0 — the migration safety net).
 *
 * A "parity" test draws a FIXED, deterministic stroke through the real input
 * path on the LEGACY engine and screenshots the composited main canvas. The
 * committed PNG is the golden baseline. When we later migrate a tool to the
 * hexagonal core, the same stroke must produce a perceptually-identical image
 * (Playwright `toHaveScreenshot` with a maxDiffPixelRatio threshold).
 *
 * Determinism rules (see FX_EXEMPT below): tools that draw with Math.random /
 * velocity are NOT pixel-parity-able and are exempted — they get "no-crash +
 * visually sane" smoke tests instead, until the core exposes a seedable Rng port.
 */

export const MAIN_CANVAS = "#kiddopaint";

/** Tools whose output is inherently stochastic — exempt from pixel parity. */
export const FX_EXEMPT = [
  "spraypaint",
  "smoke",
  "trees",
  "kaleidoscope",
  "guilloche",
  "looper",
  "maze",
  "three3d",
  "northernlights",
  "twirly",
  "leakypen",
] as const;

export function isFxExempt(toolId: string): boolean {
  return (FX_EXEMPT as readonly string[]).includes(toolId);
}

/**
 * Draw a deterministic polyline stroke through the legacy input path
 * (hover→down→hover…→up on #tmpCanvas), then let mouseup composite to main.
 */
export async function drawStroke(
  page: Page,
  toolId: string,
  points: Array<{ x: number; y: number }>,
): Promise<void> {
  await selectTool(page, toolId);
  const tmp = page.locator("#tmpCanvas");
  await tmp.hover({ position: points[0] });
  await page.mouse.down();
  for (const p of points.slice(1)) {
    await tmp.hover({ position: p });
  }
  await page.mouse.up();
}

/** The composited main canvas — what gets screenshotted for parity. */
export function mainCanvas(page: Page): Locator {
  return page.locator(MAIN_CANVAS);
}

export { initializeKidPix };
