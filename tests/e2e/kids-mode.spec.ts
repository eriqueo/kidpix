import { test, expect } from "@playwright/test";

/**
 * Small Kids Mode E2E:
 *  - ?kidsMode=1 hides the tool-options submenu and the top frame chrome via
 *    the `body.kids-mode` CSS class.
 *  - Drawing on the canvas still works with the active tool selected.
 */

test.describe("Small Kids Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.removeItem("kiddopaint.settings.kidsMode");
      } catch (_e) {
        /* ignore */
      }
    });
  });

  test("?kidsMode=1 hides chrome and submenu but leaves canvas/tools reachable", async ({
    page,
  }) => {
    await page.goto("/?kidsMode=1");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("#tmpCanvas", { timeout: 10000 });

    // Body gets the kids-mode class.
    await expect(page.locator("body")).toHaveClass(/kids-mode/);

    // Tool-options submenu, titlebar chrome, frame toggle are display:none.
    await expect(page.locator("#subtoolbars")).toHaveCSS("display", "none");
    await expect(page.locator("#titlebar")).toHaveCSS("display", "none");
    await expect(page.locator("#frame-toggle")).toHaveCSS("display", "none");

    // Canvas and the keep-list tools remain reachable.
    await expect(page.locator("#kiddopaint")).toBeVisible();
    await expect(page.locator("#save")).toBeVisible();
    await expect(page.locator("#undo")).toBeVisible();

    // Drawing still works. Pencil is the default tool; draw on the canvas
    // via the dynamically-created #tmpCanvas interaction layer and check
    // that the main canvas pixel under the stroke is no longer transparent.
    await page.click("#pencil");
    const target = page.locator("#tmpCanvas");
    const box = await target.boundingBox();
    if (!box) throw new Error("tmpCanvas has no bounding box");
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 30, cy + 30, { steps: 6 });
    await page.mouse.move(cx + 60, cy + 60, { steps: 6 });
    await page.mouse.up();

    // Sample several pixels along the stroke from the main canvas backing
    // store. At least one should be non-transparent if drawing happened.
    const anyInk = await page.evaluate(() => {
      const c = document.getElementById("kiddopaint") as HTMLCanvasElement;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      const samples = [
        [Math.floor(c.width / 2), Math.floor(c.height / 2)],
        [Math.floor(c.width / 2) + 15, Math.floor(c.height / 2) + 15],
        [Math.floor(c.width / 2) + 30, Math.floor(c.height / 2) + 30],
      ];
      for (const [x, y] of samples) {
        const px = ctx.getImageData(x, y, 1, 1).data;
        if (px[3] !== 0) return true;
      }
      return false;
    });
    expect(anyInk).toBe(true);
  });

  test("without the flag, chrome is visible and submenu container shows", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("#tmpCanvas", { timeout: 10000 });
    await expect(page.locator("body")).not.toHaveClass(/kids-mode/);
    await expect(page.locator("#titlebar")).toBeVisible();
    await expect(page.locator("#subtoolbars")).not.toHaveCSS("display", "none");
  });
});
