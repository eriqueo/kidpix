import { describe, it, expect, beforeEach, vi } from "vitest";

// Seed the namespace + a stub Stamps.stamp before the shim installs.
beforeEach(async () => {
  window.KiddoPaint = {
    Stamps: {
      stamp: vi.fn(function () {
        const c = document.createElement("canvas");
        c.dataset.origin = "fallback";
        return c;
      }),
    },
  };
  try {
    window.localStorage.clear();
  } catch {}
  vi.resetModules();
  await import("./pixel-grid.js");
  await import("./stamp-overrides.js");
});

describe("StampEditor overrides", () => {
  it("has(key) is false before any edit", () => {
    expect(window.KiddoPaint.StampEditor.Overrides.has("🚂")).toBe(false);
  });

  it("setFromGrid stores width/height/pixels under the key", () => {
    const SE = window.KiddoPaint.StampEditor;
    const g = SE.createGrid(4, 4);
    g.currentColor = "rgb(1,2,3)";
    g.paint(0, 0);
    SE.Overrides.setFromGrid("🚂", g);
    const ov = SE.Overrides.get("🚂");
    expect(ov.width).toBe(4);
    expect(ov.height).toBe(4);
    expect(ov.pixels[0][0]).toBe("rgb(1,2,3)");
    expect(ov.pixels[3][3]).toBeNull();
  });

  it("persists to localStorage and reloads", async () => {
    const SE = window.KiddoPaint.StampEditor;
    const g = SE.createGrid(4, 4);
    g.currentColor = "#0f0";
    g.paint(1, 1);
    SE.Overrides.setFromGrid("🚂", g);

    const stored = window.localStorage.getItem(SE.Overrides._STORAGE_KEY);
    expect(stored).toBeTruthy();

    // Wipe the in-memory map, then reload.
    window.KiddoPaint.Stamps.overrides = {};
    SE.Overrides.load();
    expect(SE.Overrides.get("🚂").pixels[1][1]).toBe("#0f0");
  });

  it("installShim routes overridden keys to the bitmap renderer and falls through otherwise", () => {
    const SE = window.KiddoPaint.StampEditor;
    const g = SE.createGrid(4, 4);
    g.currentColor = "#abc";
    g.paint(0, 0);
    SE.Overrides.setFromGrid("X", g);

    // Overridden key: shim returns a fresh canvas, NOT the fallback marker.
    const overridden = window.KiddoPaint.Stamps.stamp("X", false, false, 64, 0, null);
    expect(overridden).toBeInstanceOf(HTMLCanvasElement);
    expect(overridden.dataset.origin).toBeUndefined();

    // Un-overridden key: shim falls through to the original (fallback canvas).
    const fallback = window.KiddoPaint.Stamps.stamp("Y", false, false, 64, 0, null);
    expect(fallback.dataset.origin).toBe("fallback");
  });

  it("gridForKey returns a pre-loaded grid when an override exists", () => {
    const SE = window.KiddoPaint.StampEditor;
    const g = SE.createGrid(4, 4);
    g.currentColor = "#fff";
    g.paint(2, 3);
    SE.Overrides.setFromGrid("Z", g);
    const reloaded = SE.Overrides.gridForKey("Z");
    expect(reloaded.width).toBe(4);
    expect(reloaded.getPixel(2, 3)).toBe("#fff");
  });

  it("clear removes an override and persists", () => {
    const SE = window.KiddoPaint.StampEditor;
    const g = SE.createGrid(4, 4);
    g.currentColor = "#fff";
    g.paint(0, 0);
    SE.Overrides.setFromGrid("A", g);
    SE.Overrides.clear("A");
    expect(SE.Overrides.has("A")).toBe(false);
  });
});
