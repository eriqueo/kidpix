import { describe, it, expect, beforeAll } from "vitest";

beforeAll(async () => {
  globalThis.window = globalThis;
  globalThis.KiddoPaint = globalThis.KiddoPaint || {};
  await import("./image-import.js");
});

describe("ImageImport._fitLetterbox", () => {
  const fit = () => window.KiddoPaint.ImageImport._fitLetterbox;

  it("centers a square inside 640x480 with vertical letterbox margins", () => {
    const r = fit()(1000, 1000, 640, 480);
    expect(r.w).toBe(480);
    expect(r.h).toBe(480);
    expect(r.x).toBe(80);
    expect(r.y).toBe(0);
  });

  it("scales a wide image to fit width, letterboxes top/bottom", () => {
    const r = fit()(1600, 800, 640, 480);
    expect(r.w).toBe(640);
    expect(r.h).toBe(320);
    expect(r.x).toBe(0);
    expect(r.y).toBe(80);
  });

  it("scales a tall image to fit height", () => {
    const r = fit()(400, 800, 640, 480);
    expect(r.w).toBe(240);
    expect(r.h).toBe(480);
    expect(r.x).toBe(200);
    expect(r.y).toBe(0);
  });

  it("returns full canvas for degenerate source", () => {
    const r = fit()(0, 0, 640, 480);
    expect(r).toEqual({ x: 0, y: 0, w: 640, h: 480 });
  });
});

describe("ImageImport._isAcceptedFile", () => {
  const accepts = () => window.KiddoPaint.ImageImport._isAcceptedFile;

  it("accepts an allow-listed MIME type", () => {
    expect(accepts()({ name: "picture.bin", type: "image/png" })).toBe(true);
  });

  it("accepts an allow-listed extension when iPad Files omits MIME", () => {
    expect(accepts()({ name: "Cloud Picture.JPEG", type: "" })).toBe(true);
  });

  it("rejects a conflicting or unsupported supplied MIME type", () => {
    expect(accepts()({ name: "picture.png", type: "text/html" })).toBe(false);
    expect(accepts()({ name: "picture.svg", type: "" })).toBe(false);
  });
});
