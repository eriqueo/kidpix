import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  LAYER_ORDER,
  compositeLayers,
  formatFilename,
} from "./file-export.js";

describe("LAYER_ORDER", () => {
  it("matches the documented bottom-up composite order (main → bnim → anim → preview → tmp)", () => {
    expect(LAYER_ORDER).toEqual(["main", "bnim", "anim", "preview", "tmp"]);
  });
});

describe("formatFilename()", () => {
  it("produces a kidpix-YYYY-MM-DD-HHMMSS.png filename", () => {
    // 2026-06-18 09:07:05 local time
    const d = new Date(2026, 5, 18, 9, 7, 5);
    expect(formatFilename(d)).toBe("kidpix-2026-06-18-090705.png");
  });

  it("zero-pads single-digit fields", () => {
    const d = new Date(2026, 0, 2, 3, 4, 5);
    expect(formatFilename(d)).toBe("kidpix-2026-01-02-030405.png");
  });

  it("defaults to the current time when no date passed", () => {
    const name = formatFilename();
    expect(name).toMatch(/^kidpix-\d{4}-\d{2}-\d{2}-\d{6}\.png$/);
  });
});

describe("compositeLayers()", () => {
  // The test-setup mock of getContext returns a stub without drawImage; add it
  // so we can record the order layers are stacked.
  function makeFakeCanvas(name) {
    return {
      __name: name,
      width: 10,
      height: 10,
    };
  }

  let drawnOrder;
  let createdCtx;

  beforeEach(() => {
    drawnOrder = [];
    createdCtx = {
      imageSmoothingEnabled: true,
      drawImage: vi.fn((c) => drawnOrder.push(c.__name)),
    };
    // Stub document.createElement('canvas') to hand back an object whose
    // getContext returns our recording ctx. Other createElement calls (none
    // here) fall through to the jsdom impl.
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => createdCtx,
        };
      }
      return realCreate(tag);
    });
  });

  it("draws layers bottom-up in LAYER_ORDER", () => {
    const layers = {
      main: makeFakeCanvas("main"),
      bnim: makeFakeCanvas("bnim"),
      anim: makeFakeCanvas("anim"),
      preview: makeFakeCanvas("preview"),
      tmp: makeFakeCanvas("tmp"),
    };
    compositeLayers(layers);
    expect(drawnOrder).toEqual(["main", "bnim", "anim", "preview", "tmp"]);
  });

  it("disables image smoothing on the offscreen canvas (pixel-perfect)", () => {
    const layers = {
      main: makeFakeCanvas("main"),
      bnim: makeFakeCanvas("bnim"),
      anim: makeFakeCanvas("anim"),
      preview: makeFakeCanvas("preview"),
      tmp: makeFakeCanvas("tmp"),
    };
    compositeLayers(layers);
    expect(createdCtx.imageSmoothingEnabled).toBe(false);
  });

  it("sizes the offscreen canvas to the main layer", () => {
    const main = { __name: "main", width: 1300, height: 650 };
    const layers = {
      main,
      bnim: makeFakeCanvas("bnim"),
      anim: makeFakeCanvas("anim"),
      preview: makeFakeCanvas("preview"),
      tmp: makeFakeCanvas("tmp"),
    };
    const out = compositeLayers(layers);
    expect(out.width).toBe(1300);
    expect(out.height).toBe(650);
  });

  it("throws loudly when any layer is missing", () => {
    const full = {
      main: makeFakeCanvas("main"),
      bnim: makeFakeCanvas("bnim"),
      anim: makeFakeCanvas("anim"),
      preview: makeFakeCanvas("preview"),
      tmp: makeFakeCanvas("tmp"),
    };
    for (const missing of ["main", "bnim", "anim", "preview", "tmp"]) {
      const incomplete = { ...full };
      delete incomplete[missing];
      expect(() => compositeLayers(incomplete)).toThrowError(
        new RegExp("missing layer '" + missing + "'"),
      );
    }
  });

  it("throws when called without an argument", () => {
    expect(() => compositeLayers()).toThrowError(/layers argument is required/);
  });
});
