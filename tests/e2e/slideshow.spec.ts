import { test, expect, type Page } from "@playwright/test";
import {
  initializeKidPix,
  selectTool,
  testCanvasDrag,
  setupConsoleErrorMonitoring,
  assertNoConsoleErrors,
} from "./shared/tool-helpers";

// One complete SlideShow journey through the visible UI (prompts-TODO/current.txt §3):
// make two pictures → arrange → play → close → reopen with the same order/settings,
// then verify the authoritative IndexedDB store and the missing-picture path.

const DB_NAME = "kidpix-slideshow";

const editor = (page: Page) => page.locator(".kp-slideshow-editor");
const pictureCards = (page: Page) => page.locator("button.kp-ss-picture");
const slideRows = (page: Page) => page.locator("li.kp-ss-slide");
const action = (page: Page, name: string) =>
  editor(page).locator(`[data-action="${name}"]`);

// Save downloads a PNG and (contract) also files the picture in the SlideShow
// library, whether triggered from the toolbar button or the `s` key. Downloads
// are accepted by default; we just let them go.
async function drawAndSave(
  page: Page,
  from: { x: number; y: number },
  via: "button" | "key" = "button",
) {
  await selectTool(page, "pencil");
  await testCanvasDrag(page, from, { x: from.x + 120, y: from.y + 80 });
  if (via === "key") {
    // Single-key shortcuts are off by default (child-friendly); the setting is
    // read on every keydown, so enabling it here is enough.
    await page.evaluate(() =>
      localStorage.setItem("kiddopaint.settings.keyboardShortcutsEnabled", "true"),
    );
    await page.keyboard.press("s");
  } else {
    await page.click("#save");
  }
}

async function readSlideshowsFromIdb(page: Page) {
  return page.evaluate(async (dbName) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const req = db.transaction("slideshows", "readonly").objectStore("slideshows").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows as { id: string; name: string; slides: { pictureId: string; transition: string; durationMs: number; transitionMs: number }[] }[];
  }, DB_NAME);
}

async function deletePictureFromIdb(page: Page, id: string) {
  await page.evaluate(
    async ({ dbName, id }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await new Promise<void>((resolve, reject) => {
        const req = db.transaction("pictures", "readwrite").objectStore("pictures").delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      db.close();
    },
    { dbName: DB_NAME, id },
  );
}

test.describe("SlideShow journey", () => {
  test.beforeEach(async ({ page }) => {
    await initializeKidPix(page);
  });

  test("create two pictures → arrange → play → close → reopen keeps order and settings", async ({ page }) => {
    const errors = setupConsoleErrorMonitoring(page);

    // Create: two distinct pictures, one via the toolbar Save, one via the `s` key.
    await drawAndSave(page, { x: 200, y: 200 });
    await drawAndSave(page, { x: 600, y: 300 }, "key");

    // Open the editor; the picker must show both saved pictures (newest first).
    await page.click("#kp-slideshow-btn");
    await expect(editor(page)).toBeVisible();
    await expect(pictureCards(page)).toHaveCount(2);
    const newest = await pictureCards(page).nth(0).getAttribute("data-picture-id");
    const older = await pictureCards(page).nth(1).getAttribute("data-picture-id");
    expect(newest).toBeTruthy();
    expect(older).toBeTruthy();
    expect(newest).not.toBe(older);

    // Arrange: add both, then move the second slide up so the order becomes [older, newest].
    await pictureCards(page).nth(0).click();
    await pictureCards(page).nth(1).click();
    await expect(slideRows(page)).toHaveCount(2);
    await slideRows(page).nth(1).locator('[data-action="up"]').click();
    await expect(slideRows(page).nth(0)).toHaveAttribute("data-picture-id", older!);
    await expect(slideRows(page).nth(1)).toHaveAttribute("data-picture-id", newest!);

    // Settings on slide 1; short durations so Play finishes quickly.
    const first = slideRows(page).nth(0);
    await first.locator('select[name="transition"]').selectOption("wipe");
    await first.locator('input[name="transitionMs"]').fill("100");
    await first.locator('input[name="transitionMs"]').press("Tab");
    await first.locator('input[name="durationMs"]').fill("300");
    await first.locator('input[name="durationMs"]').press("Tab");
    const second = slideRows(page).nth(1);
    await second.locator('input[name="durationMs"]').fill("300");
    await second.locator('input[name="durationMs"]').press("Tab");

    await editor(page).locator('input[name="slideshow-name"]').fill("My Show");
    await action(page, "save").click();
    await expect(editor(page).getByText("Saved.")).toBeVisible();

    // Play: the player surface reports playing → ended.
    await action(page, "play").click();
    const player = editor(page).locator(".kp-ss-player");
    await expect(player).toHaveAttribute("data-state", "playing");
    await expect(player).toHaveAttribute("data-state", "ended", { timeout: 10000 });

    // Close, reopen: same show, same order, same settings.
    await action(page, "close").click();
    await expect(editor(page)).toBeHidden();
    await page.click("#kp-slideshow-btn");
    await expect(editor(page)).toBeVisible();
    await expect(editor(page).locator('input[name="slideshow-name"]')).toHaveValue("My Show");
    await expect(slideRows(page)).toHaveCount(2);
    await expect(slideRows(page).nth(0)).toHaveAttribute("data-picture-id", older!);
    await expect(slideRows(page).nth(1)).toHaveAttribute("data-picture-id", newest!);
    await expect(slideRows(page).nth(0).locator('select[name="transition"]')).toHaveValue("wipe");
    await expect(slideRows(page).nth(0).locator('input[name="durationMs"]')).toHaveValue("300");
    await expect(slideRows(page).nth(0).locator('input[name="transitionMs"]')).toHaveValue("100");

    // Authoritative store agrees with the UI.
    const shows = await readSlideshowsFromIdb(page);
    expect(shows).toHaveLength(1);
    expect(shows[0].name).toBe("My Show");
    expect(shows[0].slides.map((s) => s.pictureId)).toEqual([older, newest]);
    expect(shows[0].slides[0]).toMatchObject({ transition: "wipe", durationMs: 300, transitionMs: 100 });

    assertNoConsoleErrors(errors, "slideshow journey");
  });

  test("a slide whose picture is missing is flagged and playback still finishes", async ({ page }) => {
    await drawAndSave(page, { x: 200, y: 200 });
    await drawAndSave(page, { x: 600, y: 300 });
    await page.click("#kp-slideshow-btn");
    await expect(pictureCards(page)).toHaveCount(2);
    const gone = await pictureCards(page).nth(0).getAttribute("data-picture-id");
    await pictureCards(page).nth(0).click();
    await pictureCards(page).nth(1).click();
    for (const row of [slideRows(page).nth(0), slideRows(page).nth(1)]) {
      await row.locator('input[name="durationMs"]').fill("300");
      await row.locator('input[name="durationMs"]').press("Tab");
    }
    await action(page, "save").click();
    await expect(editor(page).getByText("Saved.")).toBeVisible();
    await action(page, "close").click();

    await deletePictureFromIdb(page, gone!);

    await page.click("#kp-slideshow-btn");
    await expect(slideRows(page)).toHaveCount(2);
    await expect(slideRows(page).nth(0)).toHaveAttribute("data-missing", "true");
    await expect(slideRows(page).nth(1)).toHaveAttribute("data-missing", "false");

    await action(page, "play").click();
    const player = editor(page).locator(".kp-ss-player");
    await expect(player).toHaveAttribute("data-state", "ended", { timeout: 10000 });
  });
});
