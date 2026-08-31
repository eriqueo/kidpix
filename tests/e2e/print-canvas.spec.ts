import { expect, test } from "@playwright/test";
import { initializeKidPix } from "./shared/tool-helpers";

test.use({ viewport: { width: 820, height: 1180 } });

test("print media contains only the committed canvas on one page", async ({ page }) => {
  await initializeKidPix(page);
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#kiddopaint")!;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 100, 100);
  });

  await page.emulateMedia({ media: "print" });
  const printLayout = await page.evaluate(() => {
    const style = (selector: string) =>
      getComputedStyle(document.querySelector<HTMLElement>(selector)!);
    const canvas = document.querySelector<HTMLCanvasElement>("#kiddopaint")!;
    const rect = canvas.getBoundingClientRect();
    return {
      toolbarVisibility: style("#toolbar").visibility,
      statusVisibility: style("#statusbar").visibility,
      previewDisplay: style("#tmpCanvas").display,
      mainVisibility: style("#kiddopaint").visibility,
      mainPosition: style("#kiddopaint").position,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  expect(printLayout).toMatchObject({
    toolbarVisibility: "hidden",
    statusVisibility: "hidden",
    previewDisplay: "none",
    mainVisibility: "visible",
    mainPosition: "static",
  });
  const { rect, viewport } = printLayout;
  expect(rect.width / rect.height).toBeCloseTo(2, 2);
  expect(rect.left).toBeGreaterThanOrEqual(0);
  expect(rect.top).toBeGreaterThan(0);
  expect(rect.right).toBeLessThanOrEqual(viewport.width);
  expect(rect.bottom).toBeLessThanOrEqual(viewport.height);
  expect((rect.left + rect.right) / 2).toBeCloseTo(viewport.width / 2, 1);
  expect((rect.top + rect.bottom) / 2).toBeCloseTo(viewport.height / 2, 1);

  const pdf = await page.pdf({ printBackground: true });
  const pageObjects = pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? [];
  expect(pageObjects).toHaveLength(1);
  expect(pdf.byteLength).toBeGreaterThan(1_000);
});
