import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { initializeKidPix } from "./shared/tool-helpers";

test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });

async function paintRedFixture(page: Parameters<typeof initializeKidPix>[0]) {
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#kiddopaint")!;
    const context = canvas.getContext("2d")!;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ff0000";
    context.fillRect(20, 20, 12, 12);
  });
}

async function pixelAt(
  page: Parameters<typeof initializeKidPix>[0],
  x: number,
  y: number,
) {
  return page.evaluate(
    ({ x, y }) => {
      const canvas = document.querySelector<HTMLCanvasElement>("#kiddopaint")!;
      return Array.from(canvas.getContext("2d")!.getImageData(x, y, 1, 1).data);
    },
    { x, y },
  );
}

async function clearMain(page: Parameters<typeof initializeKidPix>[0]) {
  await page.evaluate(() => {
    const display = (window as any).KiddoPaint.Display;
    display.clearMain();
  });
}

async function redPixelCount(page: Parameters<typeof initializeKidPix>[0]) {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#kiddopaint")!;
    const pixels = canvas
      .getContext("2d")!
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] > 200 && pixels[i + 1] < 20 && pixels[i + 2] < 20) count++;
    }
    return count;
  });
}

async function drawTouchStroke(page: Parameters<typeof initializeKidPix>[0]) {
  return page.evaluate(() => {
    const before = (window as any).KiddoPaint.Display.undoData.length;
    const canvas = document.querySelector<HTMLCanvasElement>("#tmpCanvas")!;
    const rect = canvas.getBoundingClientRect();
    const points = [
      { x: rect.left + rect.width * 0.45, y: rect.top + rect.height * 0.45 },
      { x: rect.left + rect.width * 0.55, y: rect.top + rect.height * 0.55 },
    ];
    function send(type: string, point: (typeof points)[number]) {
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
    send("touchstart", points[0]);
    send("touchmove", points[1]);
    send("touchend", points[1]);
    return {
      before,
      after: (window as any).KiddoPaint.Display.undoData.length,
    };
  });
}

test("iPad-sized Save and Open round-trip an editable .kidpix project", async ({
  page,
}) => {
  await initializeKidPix(page);
  await paintRedFixture(page);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#save").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^kidpix-.*\.kidpix$/);
  const savedPath = await download.path();
  expect(savedPath).not.toBeNull();
  const projectBuffer = await readFile(savedPath!);

  await clearMain(page);
  expect(await pixelAt(page, 24, 24)).toEqual([0, 0, 0, 0]);

  await page.locator("#open-picture-input").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "application/json",
    buffer: projectBuffer,
  });
  await expect.poll(() => pixelAt(page, 24, 24)).toEqual([255, 0, 0, 255]);

  const undoDepth = await drawTouchStroke(page);
  expect(undoDepth.after).toBeGreaterThan(undoDepth.before);
});

test("Export PNG stays explicit and its result can be opened as a picture", async ({
  page,
}) => {
  await initializeKidPix(page);
  await paintRedFixture(page);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^kidpix-.*\.png$/);
  const savedPath = await download.path();
  expect(savedPath).not.toBeNull();
  const pngBuffer = await readFile(savedPath!);

  await clearMain(page);
  await page.locator("#open-picture-input").setInputFiles({
    name: download.suggestedFilename(),
    mimeType: "image/png",
    buffer: pngBuffer,
  });
  await expect.poll(() => redPixelCount(page)).toBeGreaterThan(0);
});

test("iPad-capable browsers share the .kidpix File through the native sheet", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data: ShareData) =>
        data.files?.length === 1 && data.files[0].type === "application/json",
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: ShareData) => {
        const file = data.files![0];
        (window as any).__sharedProject = {
          name: file.name,
          size: file.size,
          type: file.type,
        };
        return Promise.resolve();
      },
    });
  });
  await initializeKidPix(page);
  await paintRedFixture(page);

  await page.locator("#save").click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__sharedProject))
    .toMatchObject({ type: "application/json" });
  const shared = await page.evaluate(() => (window as any).__sharedProject);
  expect(shared.name).toMatch(/^kidpix-.*\.kidpix$/);
  expect(shared.size).toBeGreaterThan(0);
});

test("Open File leaves the native picker unfiltered so iPadOS can select .kidpix", async ({
  page,
}) => {
  await initializeKidPix(page);
  await expect(page.locator("#open-picture-input")).not.toHaveAttribute("accept");
});

test("iPad PNG export invokes native share during the user gesture", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: (data: ShareData) => {
        (window as any).__sharedPNG = {
          active: navigator.userActivation.isActive,
          name: data.files![0].name,
          type: data.files![0].type,
        };
        return Promise.resolve();
      },
    });
  });
  await initializeKidPix(page);
  await paintRedFixture(page);

  await page.getByRole("button", { name: "Export PNG" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__sharedPNG))
    .toMatchObject({ active: true, type: "image/png" });
  const shared = await page.evaluate(() => (window as any).__sharedPNG);
  expect(shared.name).toMatch(/^kidpix-.*\.png$/);
});

test("closing the native share sheet requires a separate Download action", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__downloadClicks = 0;
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 5,
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: () => Promise.reject(new DOMException("cancelled", "AbortError")),
    });
    HTMLAnchorElement.prototype.click = function () {
      (window as any).__downloadClicks += 1;
    };
  });
  await initializeKidPix(page);

  await page.locator("#save").click();
  const fallback = page.getByRole("button", { name: "Download instead" });
  await expect(fallback).toBeVisible();
  expect(await page.evaluate(() => (window as any).__downloadClicks)).toBe(0);

  await fallback.click();
  expect(await page.evaluate(() => (window as any).__downloadClicks)).toBe(1);
  await expect(fallback).toBeHidden();
});
