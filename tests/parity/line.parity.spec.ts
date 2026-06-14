import { test, expect } from "@playwright/test";
import { initializeKidPix, drawStroke, mainCanvas } from "./parity-helpers";

/** Golden parity baseline for the legacy line (deterministic). */
test.describe("parity: line (legacy) @golden", () => {
  test.beforeEach(async ({ page }) => {
    await initializeKidPix(page);
  });

  test("fixed diagonal matches golden", async ({ page }) => {
    await drawStroke(page, "line", [
      { x: 100, y: 100 },
      { x: 460, y: 300 },
    ]);

    await expect(mainCanvas(page)).toHaveScreenshot("line-diagonal.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});
