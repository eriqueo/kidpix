import { describe, it, expect, beforeEach } from "vitest";
import ColorMe from "./colorme.js";

const FIXTURE = {
  smiley: "/fixture/smiley.png",
  house: "/fixture/house.png",
  fish: "/fixture/fish.png",
};

describe("ColorMe.list()", () => {
  beforeEach(() => {
    ColorMe._setAssetsForTest(FIXTURE);
  });

  it("returns one entry per asset, sorted by name", () => {
    const items = ColorMe.list();
    expect(items.map((i) => i.name)).toEqual(["fish", "house", "smiley"]);
  });

  it("each entry has a usable url", () => {
    const items = ColorMe.list();
    for (const item of items) {
      expect(typeof item.url).toBe("string");
      expect(item.url.endsWith(".png")).toBe(true);
    }
  });

  it("reflects an empty asset map", () => {
    ColorMe._setAssetsForTest({});
    expect(ColorMe.list()).toEqual([]);
  });
});

describe("ColorMe.url()", () => {
  beforeEach(() => {
    ColorMe._setAssetsForTest(FIXTURE);
  });

  it("returns the URL for a known name", () => {
    expect(ColorMe.url("house")).toBe("/fixture/house.png");
  });

  it("returns null for an unknown name", () => {
    expect(ColorMe.url("nonexistent")).toBeNull();
  });
});

describe("ColorMe.load()", () => {
  beforeEach(() => {
    ColorMe._setAssetsForTest(FIXTURE);
  });

  it("resolves false for an unknown name", async () => {
    const ctx = makeFakeContext(100, 100);
    const ok = await ColorMe.load("nope", ctx);
    expect(ok).toBe(false);
  });

  it("resolves false when no context provided", async () => {
    const ok = await ColorMe.load("smiley", null);
    expect(ok).toBe(false);
  });

  it("clears and draws when load succeeds", async () => {
    // Stub Image so onload fires synchronously without a real network fetch.
    const RealImage = globalThis.Image;
    globalThis.Image = class {
      constructor() {
        this.width = 100;
        this.height = 50;
      }
      set src(_v) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    };
    try {
      const ctx = makeFakeContext(200, 100);
      const ok = await ColorMe.load("smiley", ctx);
      expect(ok).toBe(true);
      expect(ctx.calls.clearRect.length).toBe(1);
      expect(ctx.calls.drawImage.length).toBe(1);
    } finally {
      globalThis.Image = RealImage;
    }
  });

  it("resolves false when the image errors", async () => {
    const RealImage = globalThis.Image;
    globalThis.Image = class {
      set src(_v) {
        setTimeout(() => this.onerror && this.onerror(), 0);
      }
    };
    try {
      const ctx = makeFakeContext(200, 100);
      const ok = await ColorMe.load("smiley", ctx);
      expect(ok).toBe(false);
    } finally {
      globalThis.Image = RealImage;
    }
  });
});

function makeFakeContext(w, h) {
  const calls = { clearRect: [], drawImage: [] };
  return {
    canvas: { width: w, height: h },
    clearRect: (...a) => calls.clearRect.push(a),
    drawImage: (...a) => calls.drawImage.push(a),
    calls,
  };
}
