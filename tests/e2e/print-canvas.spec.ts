import { expect, test } from "@playwright/test";
import { initializeKidPix } from "./shared/tool-helpers";

test("print media contains only the committed canvas on one page", async ({ page }) => {
  await initializeKidPix(page);
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#kiddopaint")!;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 100, 100);
  });

  await page.emulateMedia({ media: "print" });
  const styles = await page.evaluate(() => {
    const style = (selector: string) =>
      getComputedStyle(document.querySelector<HTMLElement>(selector)!);
    return {
      toolbarVisibility: style("#toolbar").visibility,
      statusVisibility: style("#statusbar").visibility,
      previewDisplay: style("#tmpCanvas").display,
      mainVisibility: style("#kiddopaint").visibility,
      mainPosition: style("#kiddopaint").position,
    };
  });
  expect(styles).toEqual({
    toolbarVisibility: "hidden",
    statusVisibility: "hidden",
    previewDisplay: "none",
    mainVisibility: "visible",
    mainPosition: "fixed",
  });

  const pdf = await page.pdf({ printBackground: true });
  const pageObjects = pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? [];
  expect(pageObjects).toHaveLength(1);
  expect(pdf.byteLength).toBeGreaterThan(1_000);
});
