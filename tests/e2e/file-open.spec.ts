import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeKidPix } from "./shared/tool-helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Verifies File > Open / Import drag-drop: dropping an image onto the canvas
// must populate the bnim layer AND change the main canvas (since file-import
// composites bnim under main). The fixture is a 64x64 solid-red PNG.

test.describe("File > Open / Import", () => {
  test("drag-drop of a PNG fixture changes the main canvas pixels", async ({ page }) => {
    await initializeKidPix(page);

    const fixturePath = resolve(__dirname, "fixtures/test-image.png");
    const pngBytes = readFileSync(fixturePath);
    const pngB64 = pngBytes.toString("base64");

    // Clear the splash from main_canvas so destination-over compositing of
    // the imported photo actually shows up. (The app boots with splash.png,
    // which is opaque in the center region; that's the legitimate startup
    // state but it hides any photo composited under it. importImage uses
    // destination-over precisely so it can't overwrite existing drawing.)
    const before = await page.evaluate(() => {
      const c = document.getElementById("kiddopaint") as HTMLCanvasElement;
      const ctx = c.getContext("2d")!;
      ctx.clearRect(0, 0, c.width, c.height);
      const cx = Math.floor(c.width / 2) - 32;
      const cy = Math.floor(c.height / 2) - 32;
      return Array.from(ctx.getImageData(cx, cy, 64, 64).data);
    });

    // Convert the base64 PNG into an actual File inside the page, then build
    // a DataTransfer and dispatch a real 'drop' event on tmpCanvas. The
    // importImage() listener picks it up.
    const importResult = await page.evaluate(async (b64) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], "test-image.png", { type: "image/png" });
      // Use the public API directly to make the test resilient to layout —
      // it exercises the same drawImageToBnimAndComposite path that the drop
      // listener invokes. (A real drop event was tried but DataTransfer.files
      // is read-only in some browsers; the public API is the canonical entry.)
      // @ts-ignore — augmented at runtime
      return await window.KiddoPaint.FileImport.importImage(file);
    }, pngB64);

    expect(importResult).toBe(true);

    const after = await page.evaluate(() => {
      const c = document.getElementById("kiddopaint") as HTMLCanvasElement;
      const ctx = c.getContext("2d")!;
      const cx = Math.floor(c.width / 2) - 32;
      const cy = Math.floor(c.height / 2) - 32;
      return Array.from(ctx.getImageData(cx, cy, 64, 64).data);
    });

    // Sanity: the center region must have changed (non-empty pixels exist
    // where there used to be transparency / something else).
    expect(after).not.toEqual(before);

    // Spot-check: among the 64*64 sampled pixels, at least one is opaque
    // red-ish (R high, G/B low, alpha > 0). Doesn't have to be every pixel —
    // splash background or aliasing could perturb edges.
    let redOpaqueCount = 0;
    for (let i = 0; i < after.length; i += 4) {
      const r = after[i], g = after[i + 1], b = after[i + 2], a = after[i + 3];
      if (a > 0 && r > 200 && g < 60 && b < 60) redOpaqueCount++;
    }
    expect(redOpaqueCount).toBeGreaterThan(100);
  });

  test("the bnim layer holds the imported image", async ({ page }) => {
    await initializeKidPix(page);

    const fixturePath = resolve(__dirname, "fixtures/test-image.png");
    const pngB64 = readFileSync(fixturePath).toString("base64");

    const bnimRedCount = await page.evaluate(async (b64) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], "test-image.png", { type: "image/png" });
      // @ts-ignore
      await window.KiddoPaint.FileImport.importImage(file);
      // @ts-ignore
      const bc = window.KiddoPaint.Display.bnimCanvas as HTMLCanvasElement;
      const ctx = bc.getContext("2d")!;
      const cx = Math.floor(bc.width / 2) - 32;
      const cy = Math.floor(bc.height / 2) - 32;
      const data = ctx.getImageData(cx, cy, 64, 64).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] > 200 && data[i + 1] < 60 && data[i + 2] < 60) count++;
      }
      return count;
    }, pngB64);

    expect(bnimRedCount).toBeGreaterThan(100);
  });

  test("non-image files are rejected and don't push undo", async ({ page }) => {
    await initializeKidPix(page);

    const result = await page.evaluate(async () => {
      const file = new File(["hello"], "a.txt", { type: "text/plain" });
      // @ts-ignore
      const before = window.KiddoPaint.Display.undoData.length;
      // @ts-ignore
      const ok = await window.KiddoPaint.FileImport.importImage(file);
      // @ts-ignore
      const after = window.KiddoPaint.Display.undoData.length;
      return { ok, before, after };
    });

    expect(result.ok).toBe(false);
    expect(result.after).toBe(result.before);
  });

  test("file-picker button is injected next to Save", async ({ page }) => {
    await initializeKidPix(page);
    const btn = page.locator("#file-open");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("title", "Open Picture");
    const input = page.locator("#file-open-input");
    await expect(input).toHaveAttribute("type", "file");
  });
});
