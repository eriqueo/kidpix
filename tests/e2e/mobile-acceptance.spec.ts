import { expect, Page, test } from "@playwright/test";
import { initializeKidPix } from "./shared/tool-helpers";

const PHONE_VIEWPORTS = [
  { name: "phone portrait", width: 390, height: 844 },
  { name: "phone landscape", width: 844, height: 390 },
] as const;

const TABLET_VIEWPORTS = [
  { name: "tablet portrait", width: 820, height: 1180 },
  { name: "tablet landscape", width: 1180, height: 820 },
] as const;

test.use({ hasTouch: true });

async function openAtViewport(
  page: Page,
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await initializeKidPix(page);
}

async function mainCanvasInkPixels(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#kiddopaint")!;
    const pixels = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] !== 0) count++;
    }
    return count;
  });
}

async function dispatchTouchStroke(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#tmpCanvas")!;
    const rect = canvas.getBoundingClientRect();
    const start = {
      x: rect.left + rect.width * 0.35,
      y: rect.top + rect.height * 0.4,
    };
    const end = {
      x: rect.left + rect.width * 0.65,
      y: rect.top + rect.height * 0.6,
    };

    function send(type: "touchstart" | "touchmove" | "touchend", point: typeof start) {
      const touch = new Touch({
        identifier: 1,
        target: canvas,
        clientX: point.x,
        clientY: point.y,
      });
      canvas.dispatchEvent(
        new TouchEvent(type, {
          bubbles: true,
          cancelable: true,
          touches: type === "touchend" ? [] : [touch],
          changedTouches: [touch],
        }),
      );
    }

    send("touchstart", start);
    send("touchmove", end);
    send("touchend", end);

    const lastEvent = (window as any).KiddoPaint.Current.ev;
    return {
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      cssWidth: rect.width,
      cssHeight: rect.height,
      // Chromium rounds Touch coordinates to CSS pixels before the app sees
      // them, so derive the oracle from the delivered event, not our fractional
      // constructor input.
      expectedX: Math.round(
        (lastEvent.clientX - rect.left) * (canvas.width / rect.width),
      ),
      expectedY: Math.round(
        (lastEvent.clientY - rect.top) * (canvas.height / rect.height),
      ),
      actualX: lastEvent._x,
      actualY: lastEvent._y,
    };
  });
}

for (const viewport of [...PHONE_VIEWPORTS, ...TABLET_VIEWPORTS]) {
  test(`${viewport.name}: touch coordinates map to the fixed backing store`, async ({
    page,
  }) => {
    await openAtViewport(page, viewport);

    const result = await dispatchTouchStroke(page);

    expect(result.backingWidth).toBe(1300);
    expect(result.backingHeight).toBe(650);
    expect(result.cssWidth).toBeLessThan(result.backingWidth);
    expect(result.cssHeight).toBeLessThan(result.backingHeight);
    expect(result.actualX).toBe(result.expectedX);
    expect(result.actualY).toBe(result.expectedY);
    expect(await mainCanvasInkPixels(page)).toBeGreaterThan(0);
  });
}

for (const viewport of PHONE_VIEWPORTS) {
  test(`${viewport.name}: tool and color drawers are reachable and dismiss after a pick`, async ({
    page,
  }) => {
    await openAtViewport(page, viewport);

    const toolsToggle = page.getByRole("button", { name: "Tools" });
    const colorsToggle = page.getByRole("button", { name: "Colors" });
    await expect(toolsToggle).toBeVisible();
    await expect(colorsToggle).toBeVisible();

    await toolsToggle.tap();
    await expect(page.locator("body")).toHaveClass(/tools-drawer-open/);
    await page.locator("#pencil").tap();
    await expect(page.locator("body")).not.toHaveClass(/tools-drawer-open/);

    await colorsToggle.tap();
    await expect(page.locator("body")).toHaveClass(/colors-drawer-open/);
    await page.locator("#colorselector .color").first().tap();
    await expect(page.locator("body")).not.toHaveClass(/colors-drawer-open/);
  });

  test(`${viewport.name}: dismissing a drawer on the canvas does not paint`, async ({
    page,
  }) => {
    await openAtViewport(page, viewport);

    await page.getByRole("button", { name: "Tools" }).tap();
    await expect(page.locator("body")).toHaveClass(/tools-drawer-open/);
    const beforeDismiss = await mainCanvasInkPixels(page);

    await dispatchTouchStroke(page);

    await expect(page.locator("body")).not.toHaveClass(/tools-drawer-open/);
    expect(await mainCanvasInkPixels(page)).toBe(beforeDismiss);

    // Prove this is a red-capable seam: the same gesture paints once no drawer
    // is intercepting it.
    await dispatchTouchStroke(page);
    expect(await mainCanvasInkPixels(page)).toBeGreaterThan(beforeDismiss);
  });
}

for (const viewport of TABLET_VIEWPORTS) {
  test(`${viewport.name}: status-bar actions stay reachable`, async ({ page }) => {
    await openAtViewport(page, viewport);

    for (const id of [
      "small-kids-toggle",
      "print-btn",
      "project-btn",
      "frame-toggle",
    ]) {
      await expect(page.locator(`#${id}`)).toBeVisible();
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
  });
}
