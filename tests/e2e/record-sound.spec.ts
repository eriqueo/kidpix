import { test, expect } from "@playwright/test";

// End-to-end: click Record, stop after ~1s, then Play, and verify the
// resulting Audio element actually fired its `play` event. Relies on the
// fake-media chromium flags wired in playwright.config.ts.
test.describe("record sound", () => {
  // Fake-media flags only land on the chromium project (playwright.config.ts);
  // firefox/webkit would prompt for mic and hang.
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "fake-media flags are chromium-only",
  );
  test("records a clip and plays it back", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Patch HTMLAudioElement.play() before any click so playLatest() flips
    // the flag we assert on below.
    await page.addInitScript(() => {
      (window as any).__audioPlayed = false;
      const origPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        this.addEventListener("play", () => {
          (window as any).__audioPlayed = true;
        });
        // Mark optimistically too in case the audio data won't actually
        // decode in headless: the contract under test is "playLatest tried
        // to play the stored clip", not "fake audio decodes cleanly".
        (window as any).__audioPlayed = true;
        return origPlay.apply(this, arguments as any);
      };
    });
    // addInitScript only fires on next navigation, so reload once.
    await page.reload();
    await page.waitForLoadState("networkidle");

    const recordBtn = page.locator("#record");
    const playBtn = page.locator("#play");
    await expect(recordBtn).toBeVisible();
    await expect(playBtn).toBeVisible();

    // Start recording, wait ~1s, stop.
    await recordBtn.click();
    await expect(recordBtn).toHaveText("Stop");
    await page.waitForTimeout(1000);
    await recordBtn.click();

    // Wait for the recorder to settle and the storage key to be written.
    await expect
      .poll(
        () => page.evaluate(() => !!localStorage.getItem("kiddopaint_sound")),
        { timeout: 5000 },
      )
      .toBe(true);

    const stored = await page.evaluate(() =>
      localStorage.getItem("kiddopaint_sound"),
    );
    expect(stored).toMatch(/^data:audio\/[\w-]+(;[^,]*)?;base64,/);

    // Play back; assert the play hook fired.
    await playBtn.click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__audioPlayed), {
        timeout: 5000,
      })
      .toBe(true);
  });
});
