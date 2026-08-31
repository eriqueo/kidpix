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

async function confirmProjectSave(
  page: Parameters<typeof initializeKidPix>[0],
  name?: string,
) {
  const dialog = page.getByRole("dialog", { name: "Save Project As" });
  await expect(dialog).toBeVisible();
  if (name !== undefined) await dialog.getByLabel("Project name").fill(name);
  await dialog.getByRole("button", { name: "Save to Files" }).click();
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
  await confirmProjectSave(page);
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

test("opening a project keeps the frame toggle cycle in sync", async ({ page }) => {
  await initializeKidPix(page);

  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1300;
    canvas.height = 650;
    const project = {
      magic: "kidpix-project",
      version: 1,
      createdAt: new Date(0).toISOString(),
      canvas: {
        width: canvas.width,
        height: canvas.height,
        png: canvas.toDataURL("image/png"),
      },
      retainedState: { frame: "frame-gold" },
    };
    await (window as any).KiddoPaint.FileActions.openFile(
      new File([JSON.stringify(project)], "gold-frame.kidpix", {
        type: "application/json",
      }),
    );
  });

  await expect(page.locator("#paint")).toHaveClass(/frame-gold/);
  await expect(page.locator("#frame-toggle")).toHaveText("Frame: Gold");
  await page.locator("#frame-toggle").click();
  await expect(page.locator("#paint")).toHaveClass(/frame-classic/);
  await expect(page.locator("#frame-toggle")).toHaveText("Frame: Classic");
});

test("Save Project lets the artist choose the .kidpix filename", async ({ page }) => {
  await initializeKidPix(page);

  await page.locator("#save").click();
  const downloadPromise = page.waitForEvent("download");
  await confirmProjectSave(page, "Rainbow Castle");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Rainbow Castle.kidpix");
  await expect(page.getByRole("dialog", { name: "Save Project As" })).toBeHidden();
});

test("cancelling the project-name dialog creates no file", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__downloadClicks = 0;
    HTMLAnchorElement.prototype.click = function () {
      (window as any).__downloadClicks += 1;
    };
  });
  await initializeKidPix(page);

  await page.locator("#save").click();
  const dialog = page.getByRole("dialog", { name: "Save Project As" });
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => (window as any).__downloadClicks)).toBe(0);
  await expect(page.locator("#statusbar-text")).toHaveText("Save cancelled.");
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

test("ordinary PNG import starts visibly and avoids a base64 FileReader copy", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__imageDataUrlReads = 0;
    const original = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (...args) {
      (window as any).__imageDataUrlReads += 1;
      return original.apply(this, args as any);
    };
  });
  await initializeKidPix(page);

  const result = await page.evaluate(async () => {
    const bytes = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZrMEAAAAASUVORK5CYII=",
      ),
      (character) => character.charCodeAt(0),
    );
    (window as any).__imageDataUrlReads = 0;
    const operation = (window as any).KiddoPaint.FileActions.openFile(
      new File([bytes], "tiny.png", { type: "image/png" }),
    );
    const immediateStatus = document.querySelector("#statusbar-text")!.textContent;
    await operation;
    const canvas = document.querySelector<HTMLCanvasElement>("#kiddopaint")!;
    return {
      immediateStatus,
      reads: (window as any).__imageDataUrlReads,
      exportPrefix: canvas.toDataURL("image/png").slice(0, 22),
    };
  });

  expect(result).toEqual({
    immediateStatus: "Opening picture…",
    reads: 0,
    exportPrefix: "data:image/png;base64,",
  });
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
          active: navigator.userActivation.isActive,
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
  await confirmProjectSave(page);
  await expect
    .poll(() => page.evaluate(() => (window as any).__sharedProject))
    .toMatchObject({ active: true, type: "application/json" });
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
  await confirmProjectSave(page);
  const fallback = page.getByRole("button", { name: "Download instead" });
  await expect(fallback).toBeVisible();
  expect(await page.evaluate(() => (window as any).__downloadClicks)).toBe(0);

  await fallback.click();
  expect(await page.evaluate(() => (window as any).__downloadClicks)).toBe(1);
  await expect(fallback).toBeHidden();
});
