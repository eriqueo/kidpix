import { test, expect } from "@playwright/test";
import { drawStroke, mainCanvas } from "./parity-helpers";

/**
 * Parity gate (Phase 4): the CORE line (routed via `?core=line`) must match the
 * legacy line golden. Generated in CI (see tests/parity/README.md).
 */
test.describe("parity: core line vs legacy golden", () => {
  test("fixed diagonal matches the legacy line golden", async ({ page }) => {
    await page.goto("/?core=line&pincanvas");
    await page.waitForSelector("#tmpCanvas", { timeout: 10000 });

    await drawStroke(page, "line", [
      { x: 100, y: 100 },
      { x: 460, y: 300 },
    ]);

    await expect(mainCanvas(page)).toHaveScreenshot("line-diagonal.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});
