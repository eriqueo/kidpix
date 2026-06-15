import { test, expect } from "@playwright/test";
import {
  initializeKidPix,
  drawStroke,
  mainCanvas,
} from "./parity-helpers";

/**
 * Golden parity baseline for the pencil (deterministic — no RNG).
 *
 * This is the reference the future `core` pencil (Phase 3) must match. The
 * baseline PNG is generated with `yarn test:parity:update` and committed.
 */
test.describe("parity: pencil (legacy) @golden", () => {
  test.beforeEach(async ({ page }) => {
    await initializeKidPix(page, { pin: true });
  });

  test("fixed zig-zag stroke matches golden", async ({ page }) => {
    await drawStroke(page, "pencil", [
      { x: 80, y: 80 },
      { x: 180, y: 160 },
      { x: 280, y: 80 },
      { x: 380, y: 160 },
      { x: 480, y: 80 },
    ]);

    await expect(mainCanvas(page)).toHaveScreenshot("pencil-zigzag.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});
