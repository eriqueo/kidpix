import { describe, it, expect } from "vitest";
import { composePrompt } from "./drawme.js";
import { srng } from "./utils.js";
import phrases from "./drawme-phrases.json";

const REQUIRED_KEYS = ["adjectives", "subjects", "verbs", "objects", "settings"];

function makeData() {
  return {
    adjectives: ["purple", "sparkly", "tiny"],
    subjects: ["cat", "dog", "dinosaur"],
    verbs: ["eating", "juggling", "riding"],
    objects: ["spaghetti", "a cupcake", "a rubber duck"],
    settings: ["on the moon", "in a bathtub", "under the ocean"],
  };
}

describe("composePrompt()", () => {
  it("produces a deterministic prompt from a seeded RNG", () => {
    const rng1 = srng(42);
    const rng2 = srng(42);
    const data = makeData();
    const a = composePrompt(() => rng1.next(), data);
    const b = composePrompt(() => rng2.next(), data);
    expect(a).toBe(b);
    expect(a).toMatch(/^Draw an? \w/);
    expect(a.endsWith("!")).toBe(true);
  });

  it("accepts an rng object with .next() directly", () => {
    const rng = srng(7);
    const data = makeData();
    const result = composePrompt(rng, data);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("never produces undefined or empty slots", () => {
    const data = makeData();
    for (let seed = 0; seed < 25; seed++) {
      const rng = srng(seed);
      const result = composePrompt(() => rng.next(), data);
      expect(result).not.toMatch(/undefined/);
      expect(result).not.toMatch(/\s\s/);
      expect(result.split(" ").length).toBeGreaterThanOrEqual(5);
    }
  });

  it("chooses 'an' before vowel-initial adjectives, 'a' otherwise", () => {
    const dataA = { ...makeData(), adjectives: ["enormous"] };
    const dataB = { ...makeData(), adjectives: ["purple"] };
    const rngA = srng(1);
    const rngB = srng(1);
    expect(composePrompt(() => rngA.next(), dataA)).toMatch(/^Draw an enormous /);
    expect(composePrompt(() => rngB.next(), dataB)).toMatch(/^Draw a purple /);
  });

  it("throws when a required category is missing or empty", () => {
    const base = makeData();
    for (const key of REQUIRED_KEYS) {
      const bad = { ...base, [key]: [] };
      expect(() => composePrompt(() => 0, bad)).toThrow(key);
    }
    expect(() => composePrompt(() => 0, null)).toThrow();
    expect(() => composePrompt(() => 0, {})).toThrow();
  });

  it("throws when rng is invalid", () => {
    expect(() => composePrompt(null, makeData())).toThrow();
    expect(() => composePrompt(123, makeData())).toThrow();
  });

  it("uses every category from the shipped phrase data", () => {
    for (const key of REQUIRED_KEYS) {
      expect(Array.isArray(phrases[key])).toBe(true);
      expect(phrases[key].length).toBeGreaterThanOrEqual(12);
    }
    const rng = srng(2026);
    const result = composePrompt(() => rng.next(), phrases);
    expect(result.startsWith("Draw ")).toBe(true);
    expect(result).not.toMatch(/undefined/);
  });
});
