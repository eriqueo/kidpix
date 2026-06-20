// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";

// The repo's src/test-setup.ts stubs ImageData with a 2-arg constructor.
// Replace it with a proper duck-typed shape that supports both the (w, h)
// and (data, w, h) forms so Filters.* / Dither.* / our adapter all see a
// real ImageData-like object. This is set BEFORE the dynamic imports below,
// so it's in place when the modules evaluate at the top level.
class FakeImageData {
  constructor(a, b, c) {
    if (a instanceof Uint8ClampedArray) {
      this.data = a;
      this.width = b;
      this.height = c;
    } else {
      this.width = a;
      this.height = b;
      this.data = new Uint8ClampedArray(a * b * 4);
    }
  }
}
globalThis.ImageData = FakeImageData;

beforeAll(async () => {
  global.KiddoPaint = global.KiddoPaint || {};
  KiddoPaint.Display = KiddoPaint.Display || {};
  // At runtime KiddoPaint.Display.context is the app's real canvas 2d context;
  // Dither.bayer uses context.createImageData(image). Stub the one method the
  // dither paths touch so the test env matches what the live app provides.
  KiddoPaint.Display.context = KiddoPaint.Display.context || {
    createImageData: (img) => new FakeImageData(img.width, img.height),
  };
  // Filters / Dither write themselves onto window at load.
  await import("../util/filters.js");
  await import("../util/dither.js");
  await import("./effect-adapter.js");
});

function makeImageData(w, h, fill) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill.r;
    data[i + 1] = fill.g;
    data[i + 2] = fill.b;
    data[i + 3] = 255;
  }
  return new FakeImageData(data, w, h);
}

describe("WackyTV.applyEffect", () => {
  it("exposes the documented effect list", () => {
    expect(KiddoPaint.WackyTV.EFFECTS).toContain("none");
    expect(KiddoPaint.WackyTV.EFFECTS).toContain("invert");
    expect(KiddoPaint.WackyTV.EFFECTS).toContain("floydsteinberg");
  });

  it("returns an ImageData with same dimensions and a fresh buffer", () => {
    const src = makeImageData(8, 6, { r: 10, g: 20, b: 30 });
    const out = KiddoPaint.WackyTV.applyEffect(src, "none");
    expect(out.width).toBe(8);
    expect(out.height).toBe(6);
    expect(out.data).not.toBe(src.data);
  });

  it("'none' copies bytes identically", () => {
    const src = makeImageData(4, 4, { r: 17, g: 99, b: 200 });
    const out = KiddoPaint.WackyTV.applyEffect(src, "none");
    expect(Array.from(out.data)).toEqual(Array.from(src.data));
  });

  it("'invert' flips each colour channel", () => {
    const src = makeImageData(2, 2, { r: 10, g: 20, b: 30 });
    const out = KiddoPaint.WackyTV.applyEffect(src, "invert");
    expect(out.data[0]).toBe(245);
    expect(out.data[1]).toBe(235);
    expect(out.data[2]).toBe(225);
    expect(out.data[3]).toBe(255);
    // Source untouched (additive contract).
    expect(src.data[0]).toBe(10);
  });

  it("'threshold' produces a black-or-white image", () => {
    const bright = makeImageData(2, 2, { r: 200, g: 200, b: 200 });
    const dark = makeImageData(2, 2, { r: 30, g: 30, b: 30 });
    const o1 = KiddoPaint.WackyTV.applyEffect(bright, "threshold");
    const o2 = KiddoPaint.WackyTV.applyEffect(dark, "threshold");
    expect(o1.data[0]).toBe(255);
    expect(o2.data[0]).toBe(0);
  });

  it("'floydsteinberg' returns a 1-bit image", () => {
    const src = makeImageData(4, 4, { r: 100, g: 150, b: 200 });
    const out = KiddoPaint.WackyTV.applyEffect(src, "floydsteinberg");
    expect(out.width).toBe(4);
    expect(out.height).toBe(4);
    for (let i = 0; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i]);
    }
  });

  it("'bayer' returns a 1-bit image", () => {
    const src = makeImageData(4, 4, { r: 120, g: 120, b: 120 });
    const out = KiddoPaint.WackyTV.applyEffect(src, "bayer");
    for (let i = 0; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i]);
    }
  });

  it("'atkinson' returns a 1-bit image", () => {
    const src = makeImageData(4, 4, { r: 120, g: 120, b: 120 });
    const out = KiddoPaint.WackyTV.applyEffect(src, "atkinson");
    for (let i = 0; i < out.data.length; i += 4) {
      expect([0, 255]).toContain(out.data[i]);
    }
  });

  it("throws on unknown effect name", () => {
    const src = makeImageData(2, 2, { r: 0, g: 0, b: 0 });
    expect(() => KiddoPaint.WackyTV.applyEffect(src, "bogus")).toThrow();
  });

  it("throws when given non-ImageData", () => {
    expect(() => KiddoPaint.WackyTV.applyEffect(null, "invert")).toThrow();
  });
});
