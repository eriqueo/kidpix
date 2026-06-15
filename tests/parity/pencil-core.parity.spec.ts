import { test, expect } from "@playwright/test";
import { drawStroke, mainCanvas } from "./parity-helpers";

/**
 * Parity gate (Phase 3): the CORE pencil (routed via `?core`) must match the
 * SAME golden baseline as the legacy pencil. Same stroke, same image.
 * Baselines are generated in CI (see tests/parity/README.md) — this is the test
 * that proves the whole hexagonal architecture on the simplest tool.
 */
test.describe("parity: core pencil vs legacy golden", () => {
  test("fixed zig-zag stroke matches the legacy pencil golden", async ({ page }) => {
    await page.goto("/?core=pencil&pincanvas");
    await page.waitForSelector("#tmpCanvas", { timeout: 10000 });

    await drawStroke(page, "pencil", [
      { x: 80, y: 80 },
      { x: 180, y: 160 },
      { x: 280, y: 80 },
      { x: 380, y: 160 },
      { x: 480, y: 80 },
    ]);

    // Compares against the legacy baseline committed by pencil.parity.spec.ts.
    await expect(mainCanvas(page)).toHaveScreenshot("pencil-zigzag.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});
