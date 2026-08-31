import { expect, test } from "@playwright/test";
import { initializeKidPix } from "./shared/tool-helpers";

test.use({ hasTouch: true, viewport: { width: 820, height: 1180 } });

test("classifies app sounds so iPad Silent Mode can mute them", async ({ page }) => {
  await page.addInitScript(() => {
    const session = { type: "auto" };
    Object.defineProperty(navigator, "audioSession", {
      configurable: true,
      value: session,
    });
  });
  await initializeKidPix(page);

  expect(await page.evaluate(() => (navigator as any).audioSession.type)).toBe(
    "transient",
  );
});

test("the first real touch primes Pencil, Stamp, and Eraser audio without unhandled rejection", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__audioCalls = [];
    (window as any).__rejectPencilPrime = true;
    HTMLMediaElement.prototype.play = function () {
      const src = (this as HTMLMediaElement).src;
      (window as any).__audioCalls.push({ src, muted: this.muted, action: "play" });
      if (this.muted && src.includes("/pencil/") && (window as any).__rejectPencilPrime) {
        (window as any).__rejectPencilPrime = false;
        return Promise.reject(new DOMException("blocked", "NotAllowedError"));
      }
      return Promise.resolve();
    };
    HTMLMediaElement.prototype.pause = function () {
      (window as any).__audioCalls.push({ src: this.src, muted: this.muted, action: "pause" });
    };
  });
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await initializeKidPix(page);

  await page.locator("#tmpCanvas").tap({ position: { x: 100, y: 100 } });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__audioCalls.filter(
          (call: any) =>
            call.muted &&
            ["/pencil/", "/stamp/", "/eraser/"].some((part) => call.src.includes(part)),
        ).length,
      ),
    )
    .toBeGreaterThanOrEqual(3);

  await page.locator("#tmpCanvas").tap({ position: { x: 120, y: 120 } });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__audioCalls.some(
          (call: any) => call.src.includes("/pencil/") && !call.muted,
        ),
      ),
    )
    .toBe(true);
  expect(pageErrors).toEqual([]);
});
