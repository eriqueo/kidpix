import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { initializeKidPix, selectTool } from "./shared/tool-helpers";

test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });

const sourcePicture = new URL("../../src/assets/pwa-192.png", import.meta.url);

async function uploadPicture(page: Parameters<typeof initializeKidPix>[0]) {
  await selectTool(page, "eraser");
  const addButton = page.getByRole("button", { name: "Add Picture Here" });
  const chooserPromise = page.waitForEvent("filechooser");
  await addButton.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "rainbow-picture.png",
    mimeType: "image/png",
    buffer: await readFile(sourcePicture),
  });
  await expect(page.locator("#statusbar-text")).toContainText(
    "Picture added! It is now one of",
  );
  await expect(addButton).toHaveText("Picture Added! Add Another");
}

test("an uploaded picture is dithered, queued, persisted, and revealed", async ({
  page,
}) => {
  await initializeKidPix(page);
  await uploadPicture(page);

  const first = await page.evaluate(async () => {
    const kp = (window as any).KiddoPaint;
    await kp.HiddenPictures.ready;
    const records = kp.HiddenPictures.getCustomPictures();
    const tool = kp.Tools.EraserHiddenPicture;
    const image = new Image();
    image.src = records[0].dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let monochrome = true;
    for (let i = 0; i < pixels.length; i += 4) {
      if (
        (pixels[i] !== 0 && pixels[i] !== 255) ||
        pixels[i] !== pixels[i + 1] ||
        pixels[i] !== pixels[i + 2] ||
        pixels[i + 3] !== 255
      ) {
        monochrome = false;
        break;
      }
    }
    return {
      customCount: records.length,
      isQueued: tool.hiddenPictures.includes(records[0].dataUrl),
      isCurrent: tool.activeSource === records[0].dataUrl,
      dimensions: [image.width, image.height],
      monochrome,
    };
  });
  expect(first).toMatchObject({
    customCount: 1,
    isQueued: true,
    isCurrent: true,
    dimensions: [192, 192],
    monochrome: true,
  });

  // Content-derived keys make re-uploading the same processed picture idempotent.
  await uploadPicture(page);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).KiddoPaint.HiddenPictures.getCustomPictures().length,
      ),
    )
    .toBe(1);

  await page.reload();
  await page.waitForSelector("#tmpCanvas");
  await page.evaluate(async () => {
    const kp = (window as any).KiddoPaint;
    await kp.HiddenPictures.ready;
    Math.random = () => 0.999999;
    kp.Display.clearMain();
  });
  await selectTool(page, "eraser");
  await page.getByRole("button", { name: "Hidden Pictures" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const kp = (window as any).KiddoPaint;
        const record = kp.HiddenPictures.getCustomPictures()[0];
        return {
          count: kp.HiddenPictures.getCustomPictures().length,
          current: kp.Tools.EraserHiddenPicture.activeSource === record.dataUrl,
        };
      }),
    )
    .toEqual({ count: 1, current: true });

  await page.evaluate(() => {
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
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>("#kiddopaint")!;
        const pixels = canvas
          .getContext("2d")!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] !== 0) return true;
        }
        return false;
      }),
    )
    .toBe(true);
});

test("storage failure keeps the picture for this session and says so", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: undefined,
    });
  });
  await initializeKidPix(page);
  await uploadPicture(page);
  await expect(page.locator("#statusbar-text")).toContainText(
    "this session only",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).KiddoPaint.HiddenPictures.getCustomPictures().length,
      ),
    )
    .toBe(1);

  await page.reload();
  await page.waitForSelector("#tmpCanvas");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const hidden = (window as any).KiddoPaint.HiddenPictures;
        await hidden.ready;
        return hidden.getCustomPictures().length;
      }),
    )
    .toBe(0);
});
