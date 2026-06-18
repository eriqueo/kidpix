import { describe, it, expect, beforeEach, vi } from "vitest";

// Ensure a clean KiddoPaint global before importing the module under test.
global.KiddoPaint = {};

await import("./file-import.js");

const FI = global.KiddoPaint.FileImport;

describe("KiddoPaint.FileImport.isImageMime", () => {
  it("accepts the common web image MIMEs", () => {
    expect(FI.isImageMime("image/png")).toBe(true);
    expect(FI.isImageMime("image/jpeg")).toBe(true);
    expect(FI.isImageMime("image/gif")).toBe(true);
    expect(FI.isImageMime("image/webp")).toBe(true);
    expect(FI.isImageMime("image/svg+xml")).toBe(true);
  });
  it("is case-insensitive", () => {
    expect(FI.isImageMime("IMAGE/PNG")).toBe(true);
  });
  it("rejects non-image MIMEs", () => {
    expect(FI.isImageMime("application/pdf")).toBe(false);
    expect(FI.isImageMime("text/plain")).toBe(false);
    expect(FI.isImageMime("application/octet-stream")).toBe(false);
  });
  it("rejects falsy / non-string values", () => {
    expect(FI.isImageMime(null)).toBe(false);
    expect(FI.isImageMime(undefined)).toBe(false);
    expect(FI.isImageMime("")).toBe(false);
    expect(FI.isImageMime(42)).toBe(false);
  });
});

describe("KiddoPaint.FileImport.computeFit", () => {
  it("centers an image smaller than the canvas without upscaling", () => {
    // 100x50 image, 1300x650 canvas -> stays 100x50, centered.
    expect(FI.computeFit(100, 50, 1300, 650)).toEqual({
      x: 600, y: 300, w: 100, h: 50,
    });
  });

  it("scales a too-wide image to fit and centers vertically", () => {
    // 2600x650 (2:1) into 1300x650 (2:1) -> scale 0.5 -> 1300x325, centered.
    expect(FI.computeFit(2600, 650, 1300, 650)).toEqual({
      x: 0, y: 162, w: 1300, h: 325,
    });
  });

  it("scales a too-tall image to fit and centers horizontally", () => {
    // 650x1300 into 1300x650 -> scale 0.5 -> 325x650, centered horizontally.
    expect(FI.computeFit(650, 1300, 1300, 650)).toEqual({
      x: 487, y: 0, w: 325, h: 650,
    });
  });

  it("preserves aspect ratio for a non-trivial ratio", () => {
    // 4000x3000 (4:3) into 1300x650 -> limited by height (scale = 650/3000).
    const fit = FI.computeFit(4000, 3000, 1300, 650);
    expect(fit.h).toBe(650);
    expect(Math.abs(fit.w / fit.h - 4 / 3)).toBeLessThan(0.01);
    expect(fit.x).toBe(Math.floor((1300 - fit.w) / 2));
    expect(fit.y).toBe(0);
  });

  it("returns zeros for degenerate inputs", () => {
    expect(FI.computeFit(0, 100, 1300, 650)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(FI.computeFit(100, 0, 1300, 650)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(FI.computeFit(100, 100, 0, 650)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe("KiddoPaint.FileImport.extractFile", () => {
  function fakeFile(type) {
    return new File([new Uint8Array([1, 2, 3])], "x", { type });
  }

  it("returns a File directly when given an image File", () => {
    const f = fakeFile("image/png");
    expect(FI.extractFile(f)).toBe(f);
  });

  it("rejects a non-image File", () => {
    expect(FI.extractFile(fakeFile("application/pdf"))).toBe(null);
  });

  it("pulls the first image file out of dataTransfer.files (drag-drop)", () => {
    const png = fakeFile("image/png");
    const pdf = fakeFile("application/pdf");
    const ev = { dataTransfer: { files: [pdf, png] } };
    expect(FI.extractFile(ev)).toBe(png);
  });

  it("pulls an image out of clipboardData.items (paste)", () => {
    const png = fakeFile("image/png");
    const ev = {
      clipboardData: {
        items: [
          { kind: "string", type: "text/plain", getAsFile: () => null },
          { kind: "file", type: "image/png", getAsFile: () => png },
        ],
      },
    };
    expect(FI.extractFile(ev)).toBe(png);
  });

  it("returns null when no image is present", () => {
    expect(FI.extractFile(null)).toBe(null);
    expect(FI.extractFile({})).toBe(null);
    expect(FI.extractFile({ dataTransfer: { files: [] } })).toBe(null);
  });
});

describe("KiddoPaint.FileImport.importImage", () => {
  beforeEach(() => {
    // Fresh mock Display each test. We only verify call sequencing, not pixels —
    // jsdom canvas drawImage is a no-op. (The real pixel change is covered by
    // the Playwright drag-drop spec.)
    global.KiddoPaint.Display = {
      main_canvas: { width: 1300, height: 650 },
      bnimCanvas: {},
      main_context: {
        globalCompositeOperation: "source-over",
        drawImage: vi.fn(),
      },
      bnimContext: {
        clearRect: vi.fn(),
        drawImage: vi.fn(),
      },
      saveUndo: vi.fn(),
      saveToLocalStorage: vi.fn(),
    };
  });

  it("rejects a non-image file and never touches the canvas or undo", async () => {
    const notImage = new File(["hi"], "a.txt", { type: "text/plain" });
    const ok = await FI.importImage(notImage);
    expect(ok).toBe(false);
    expect(global.KiddoPaint.Display.saveUndo).not.toHaveBeenCalled();
    expect(global.KiddoPaint.Display.bnimContext.drawImage).not.toHaveBeenCalled();
    expect(global.KiddoPaint.Display.main_context.drawImage).not.toHaveBeenCalled();
  });

  it("returns false when nothing is extractable", async () => {
    const ok = await FI.importImage(null);
    expect(ok).toBe(false);
  });
});
