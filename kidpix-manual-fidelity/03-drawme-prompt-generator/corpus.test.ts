import { describe, expect, it } from "vitest";
import { CORPUS } from "./corpus";
import { CATEGORIES } from "./schema";

/**
 * Corpus fixture invariants. These are the "reviewable fixture" anchors from
 * spec step P1 — if the corpus changes, these surface the diff.
 */
describe("DrawMe corpus", () => {
  it("defines every required category", () => {
    for (const cat of CATEGORIES) {
      expect(CORPUS[cat]).toBeDefined();
      expect(Array.isArray(CORPUS[cat])).toBe(true);
    }
  });

  it("has enough entries per slot to feel like 'thousands of suggestions'", () => {
    // 4 slots * >=10 entries each = >=10,000 combinations. Original KidPix
    // DrawMe advertised "thousands of suggestions"; matching that combinatoric
    // floor is our manual-fidelity floor.
    let combinations = 1;
    for (const cat of CATEGORIES) {
      expect(CORPUS[cat].length).toBeGreaterThanOrEqual(10);
      combinations *= CORPUS[cat].length;
    }
    expect(combinations).toBeGreaterThanOrEqual(10_000);
  });

  it("contains no empty or whitespace-only entries", () => {
    for (const cat of CATEGORIES) {
      for (const entry of CORPUS[cat]) {
        expect(entry).toBe(entry.trim());
        expect(entry.length).toBeGreaterThan(0);
      }
    }
  });

  it("contains no duplicates within a category", () => {
    for (const cat of CATEGORIES) {
      const set = new Set(CORPUS[cat]);
      expect(set.size).toBe(CORPUS[cat].length);
    }
  });
});
