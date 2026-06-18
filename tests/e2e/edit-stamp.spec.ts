import { test, expect } from "@playwright/test";
import {
  initializeKidPix,
  setupConsoleErrorMonitoring,
  assertNoConsoleErrors,
} from "./shared/tool-helpers";

test.describe("Goodies > Edit Stamp", () => {
  test.beforeEach(async ({ page }) => {
    await initializeKidPix(page);
    // Clear any persisted overrides from previous runs.
    await page.evaluate(() =>
      localStorage.removeItem("kidpix:stampOverrides"),
    );
  });

  test("launcher button exists and opens the modal", async ({ page }) => {
    const consoleErrors = setupConsoleErrorMonitoring(page);

    const launchBtn = page.locator("#edit-stamp-launch");
    await expect(launchBtn).toBeVisible();
    await expect(launchBtn).toHaveText(/Edit Stamp/);

    await launchBtn.click();

    const modal = page.locator("#edit-stamp-modal");
    await expect(modal).toBeVisible();
    await expect(modal.locator(".edit-stamp-header")).toHaveText("Edit Stamp");

    // 32×32 grid present
    const cells = page.locator(".edit-stamp-cell");
    await expect(cells).toHaveCount(32 * 32);

    // Tool buttons present
    await expect(modal.getByRole("button", { name: /Rotate/ })).toBeVisible();
    await expect(modal.getByRole("button", { name: /Flip H/ })).toBeVisible();
    await expect(modal.getByRole("button", { name: /Flip V/ })).toBeVisible();
    await expect(modal.getByRole("button", { name: /Clear/ })).toBeVisible();
    await expect(
      modal.getByRole("button", { name: /Restore Original/ }),
    ).toBeVisible();
    await expect(page.locator("#edit-stamp-save")).toBeVisible();
    await expect(page.locator("#edit-stamp-cancel")).toBeVisible();

    assertNoConsoleErrors(consoleErrors, "edit-stamp launcher");
  });

  test("toggling a pixel, saving, and re-picking yields an override sprite", async ({
    page,
  }) => {
    const consoleErrors = setupConsoleErrorMonitoring(page);

    // Open the editor on a known sprite (sheet 0, row 0, col 0 → "palm tree").
    await page.evaluate(() => {
      window.KiddoPaint.Stamps.openEditor({
        sheetFilename: "kidpix-spritesheet-0.png",
        sheetUrl: "img/stamp/kidpix-spritesheet-0.png",
        row: 0,
        col: 0,
      });
    });

    const modal = page.locator("#edit-stamp-modal");
    await expect(modal).toBeVisible();

    // Toggle a single cell programmatically (clicking the DOM cell also works,
    // but evaluating against the model is the most deterministic).
    await page.evaluate(() => {
      // Force the editor's session state to be a known-blank grid then toggle.
      // We do this by clicking the Clear button via the model API.
      const clearBtn = Array.from(
        document.querySelectorAll("#edit-stamp-modal .edit-stamp-btn"),
      ).find((b) => /Clear/.test(b.textContent || ""));
      (clearBtn as HTMLButtonElement).click();
    });

    // Click the cell at (5,5).
    const targetCell = page.locator(
      '.edit-stamp-cell[data-x="5"][data-y="5"]',
    );
    await targetCell.click();
    await expect(targetCell).toHaveClass(/on/);

    // Save.
    await page.locator("#edit-stamp-save").click();
    await expect(modal).toHaveCount(0);

    // localStorage now carries an override entry for sheet 0 / row 0 / col 0.
    const override = await page.evaluate(() => {
      const raw = localStorage.getItem("kidpix:stampOverrides");
      return raw ? JSON.parse(raw) : null;
    });
    expect(override).not.toBeNull();
    const id = "kidpix-spritesheet-0.png:0:0";
    expect(override[id]).toBeDefined();
    expect(override[id].grid.length).toBe(32 * 32);
    // The (5,5) cell is at index 5*32+5 = 165.
    expect(override[id].grid.charAt(5 * 32 + 5)).toBe("1");

    // Now exercise the override short-circuit: simulate picking the stamp by
    // invoking the wrapped extractSprite with a loaded sheet image. The
    // returned canvas should come from the override path, not the PNG.
    const verification = await page.evaluate(async () => {
      return await new Promise<{
        width: number;
        height: number;
        lastPicked: any;
      }>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const c = window.extractSprite(img, 32, 0, 0, 0);
          resolve({
            width: c.width,
            height: c.height,
            lastPicked: window.KiddoPaint.Sprite.lastPicked,
          });
        };
        img.src = "img/stamp/kidpix-spritesheet-0.png";
      });
    });
    expect(verification.width).toBe(32);
    expect(verification.height).toBe(32);
    expect(verification.lastPicked).toMatchObject({
      sheetFilename: "kidpix-spritesheet-0.png",
      row: 0,
      col: 0,
    });

    assertNoConsoleErrors(consoleErrors, "edit-stamp save + pick");
  });

  test("rotate / flip / clear / cancel work and never mutate without save", async ({
    page,
  }) => {
    const consoleErrors = setupConsoleErrorMonitoring(page);

    await page.evaluate(() => {
      window.KiddoPaint.Stamps.openEditor({
        sheetFilename: "kidpix-spritesheet-0.png",
        sheetUrl: "img/stamp/kidpix-spritesheet-0.png",
        row: 1,
        col: 2,
      });
    });

    const modal = page.locator("#edit-stamp-modal");
    await expect(modal).toBeVisible();

    // Clear, toggle one corner, rotate, verify it moved.
    await modal.getByRole("button", { name: /Clear/ }).click();
    const tl = page.locator('.edit-stamp-cell[data-x="0"][data-y="0"]');
    await tl.click();
    await expect(tl).toHaveClass(/on/);

    await modal.getByRole("button", { name: /Rotate/ }).click();
    await expect(tl).not.toHaveClass(/on/);
    const tr = page.locator('.edit-stamp-cell[data-x="31"][data-y="0"]');
    await expect(tr).toHaveClass(/on/);

    // Cancel — no override should be written for this id.
    await page.locator("#edit-stamp-cancel").click();
    await expect(modal).toHaveCount(0);

    const persisted = await page.evaluate(() =>
      localStorage.getItem("kidpix:stampOverrides"),
    );
    // Either null or an object that does not contain this id.
    if (persisted) {
      const map = JSON.parse(persisted);
      expect(map["kidpix-spritesheet-0.png:1:2"]).toBeUndefined();
    }

    assertNoConsoleErrors(consoleErrors, "edit-stamp cancel");
  });
});
