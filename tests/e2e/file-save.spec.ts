import { test, expect } from "@playwright/test";

// File menu basics — Save composites the five canvas layers and produces a PNG
// download named kidpix-YYYY-MM-DD-HHMMSS.png. Print routes through window.print().
test.describe("File menu", () => {
  test("clicking Save triggers a .png download", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // KiddoPaint.FileExport must be wired up before the Save handler can use it.
    await page.waitForFunction(
      () =>
        !!(
          (window as any).KiddoPaint &&
          (window as any).KiddoPaint.FileExport &&
          (window as any).KiddoPaint.FileExport.exportPNG
        ),
    );

    const downloadPromise = page.waitForEvent("download", { timeout: 10_000 });
    await page.locator("#save").click();
    const download = await downloadPromise;

    // Default filename format: kidpix-YYYY-MM-DD-HHMMSS.png.
    expect(download.suggestedFilename()).toMatch(
      /^kidpix-\d{4}-\d{2}-\d{2}-\d{6}\.png$/,
    );
  });

  test("Print button is present and triggers window.print()", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const printBtn = page.locator("#print");
    await expect(printBtn).toBeVisible();

    // Replace window.print with a spy so the test doesn't actually open a
    // print dialog (which would hang headless Chromium).
    await page.evaluate(() => {
      (window as any).__printCalls = 0;
      window.print = () => {
        (window as any).__printCalls += 1;
      };
    });

    await printBtn.click();
    const calls = await page.evaluate(() => (window as any).__printCalls);
    expect(calls).toBeGreaterThanOrEqual(1);
  });
});
