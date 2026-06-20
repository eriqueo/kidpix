import { describe, expect, it } from "vitest";
import { createSeededRng, generatePrompt } from "./generator";
import { CORPUS } from "./corpus";
import { CATEGORIES } from "./schema";

describe("DrawMe prompt generator", () => {
  it("is deterministic under a fixed seed", () => {
    const a = generatePrompt({ seed: 12345 });
    const b = generatePrompt({ seed: 12345 });
    expect(a.text).toBe(b.text);
    expect(a.parts).toEqual(b.parts);
  });

  it("produces different output for different seeds (sampled)", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 50; s++) seen.add(generatePrompt({ seed: s }).text);
    // Mad-libs from 20*20*20*20 = 160k combinations: 50 seeds should give many distinct outputs.
    expect(seen.size).toBeGreaterThan(40);
  });

  it("fills every category (coverage invariant)", () => {
    const p = generatePrompt({ seed: 42 });
    expect(p.parts.map((x) => x.category)).toEqual([...CATEGORIES]);
    for (const part of p.parts) {
      expect(part.value).toBeTruthy();
      expect(CORPUS[part.category]).toContain(part.value);
    }
  });

  it("never emits empty output (non-empty invariant)", () => {
    for (let s = 0; s < 200; s++) {
      const p = generatePrompt({ seed: s });
      expect(p.text.length).toBeGreaterThan(0);
      expect(p.text.startsWith("Draw ")).toBe(true);
      expect(p.text.endsWith(".")).toBe(true);
    }
  });

  it("uses correct indefinite article (a/an) based on adjective", () => {
    // sweep many seeds; any prompt starting with vowel adjective must use "an"
    for (let s = 0; s < 500; s++) {
      const p = generatePrompt({ seed: s });
      const adj = p.parts.find((x) => x.category === "adjective")!.value;
      const expected = /^[aeiou]/i.test(adj) ? "Draw an " : "Draw a ";
      expect(p.text.startsWith(expected)).toBe(true);
    }
  });

  it("Mulberry32 RNG is stable across calls for a given seed", () => {
    const r1 = createSeededRng(7);
    const r2 = createSeededRng(7);
    for (let i = 0; i < 10; i++) expect(r1()).toBe(r2());
  });

  it("samples across the full vocabulary (no slot stuck on one value)", () => {
    const buckets = {
      adjective: new Set<string>(),
      subject: new Set<string>(),
      action: new Set<string>(),
      scene: new Set<string>(),
    };
    for (let s = 0; s < 500; s++) {
      const p = generatePrompt({ seed: s });
      for (const part of p.parts) buckets[part.category].add(part.value);
    }
    // With 500 seeds and 20-entry slots, we expect to see most of the vocabulary.
    for (const cat of CATEGORIES) {
      expect(buckets[cat].size).toBeGreaterThanOrEqual(CORPUS[cat].length - 2);
    }
  });
});
