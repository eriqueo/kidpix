import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const phrasesPath = resolve(__dirname, "../../js/util/drawme-phrases.json");
const phrases = JSON.parse(readFileSync(phrasesPath, "utf-8")) as {
  subjects: string[];
  adjectives: string[];
  verbs: string[];
  objects: string[];
  settings: string[];
};

test.describe("DrawMe!", () => {
  test("button is present and clicking it renders a prompt from the JSON", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const button = page.locator("#drawme-button");
    await expect(button).toBeVisible();
    await expect(button).toHaveText("Draw Me!");

    await button.click();

    const banner = page.locator("#drawme-banner");
    await expect(banner).toBeVisible();

    const text = (await banner.textContent())?.trim() ?? "";
    expect(text.length).toBeGreaterThan(0);
    expect(text.startsWith("Draw ")).toBe(true);
    expect(text.endsWith("!")).toBe(true);
    expect(text).not.toMatch(/undefined/);

    // Every slot in the rendered prompt must come from the shipped JSON.
    const hasFrom = (arr: string[]) => arr.some((entry) => text.includes(entry));
    expect(hasFrom(phrases.adjectives)).toBe(true);
    expect(hasFrom(phrases.subjects)).toBe(true);
    expect(hasFrom(phrases.verbs)).toBe(true);
    expect(hasFrom(phrases.objects)).toBe(true);
    expect(hasFrom(phrases.settings)).toBe(true);
  });
});
