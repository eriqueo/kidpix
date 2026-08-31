import { describe, it, expect, beforeAll } from "vitest";

// file-actions.js runs an IIFE that wires DOM handlers and exposes
// KiddoPaint.FileActions. Stub the globals it touches at import time, then
// validate the boundary sanitizer — the security-critical part.

global.KiddoPaint = {
  FrameStyles: [
    { cls: "frame-wood", label: "Wood" },
    { cls: "frame-rainbow", label: "Rainbow" },
  ],
  Display: {},
  Sounds: {},
};

beforeAll(async () => {
  await import("./file-actions.js");
});

describe("KiddoPaint.FileActions.sanitizeProject", () => {
  const PNG = "data:image/png;base64,iVBORw0KGgo=";

  function valid(overrides = {}) {
    return Object.assign(
      {
        magic: "kidpix-project",
        version: 1,
        canvas: { width: 1300, height: 650, png: PNG },
        retainedState: { frame: "frame-wood" },
      },
      overrides,
    );
  }

  it("accepts a well-formed v1 project", () => {
    const safe = KiddoPaint.FileActions.sanitizeProject(valid());
    expect(safe.png).toBe(PNG);
    expect(safe.frame).toBe("frame-wood");
    expect(safe.width).toBe(1300);
    expect(safe.height).toBe(650);
  });

  it("rejects missing/wrong magic", () => {
    expect(() =>
      KiddoPaint.FileActions.sanitizeProject(valid({ magic: "nope" })),
    ).toThrow(/not a Kid Pix project/);
  });

  it("rejects unknown future versions", () => {
    expect(() =>
      KiddoPaint.FileActions.sanitizeProject(valid({ version: 99 })),
    ).toThrow(/newer than this Kid Pix build/);
  });

  it("rejects invalid version", () => {
    expect(() =>
      KiddoPaint.FileActions.sanitizeProject(valid({ version: 0 })),
    ).toThrow(/Unknown project version/);
  });

  it("rejects non-data-url canvas images (e.g. javascript:)", () => {
    expect(() =>
      KiddoPaint.FileActions.sanitizeProject(
        valid({
          canvas: { width: 1300, height: 650, png: "javascript:alert(1)" },
        }),
      ),
    ).toThrow(/not a PNG/);
  });

  it("rejects canvas dimensions outside the v1 1300x650 contract", () => {
    expect(() =>
      KiddoPaint.FileActions.sanitizeProject(
        valid({ canvas: { width: 640, height: 480, png: PNG } }),
      ),
    ).toThrow(/1300 by 650/);
  });

  it("drops unknown frame styles instead of applying them", () => {
    const safe = KiddoPaint.FileActions.sanitizeProject(
      valid({ retainedState: { frame: "frame-evil" } }),
    );
    expect(safe.frame).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(() => KiddoPaint.FileActions.sanitizeProject(null)).toThrow();
    expect(() => KiddoPaint.FileActions.sanitizeProject("nope")).toThrow();
  });
});

describe("KiddoPaint.FileActions.isProjectFile", () => {
  it("recognizes the canonical extension even when Files omits MIME", () => {
    expect(
      KiddoPaint.FileActions.isProjectFile({ name: "drawing.KIDPIX", type: "" }),
    ).toBe(true);
  });

  it("leaves ordinary pictures on the image-import path", () => {
    expect(
      KiddoPaint.FileActions.isProjectFile({ name: "drawing.png", type: "image/png" }),
    ).toBe(false);
  });
});

describe("KiddoPaint.FileActions.sanitizeProjectFilename", () => {
  const sanitize = (value) =>
    KiddoPaint.FileActions.sanitizeProjectFilename(value, "kidpix-fallback");

  it("preserves an artist's readable name and owns one extension", () => {
    expect(sanitize("Rainbow Castle")).toBe("Rainbow Castle.kidpix");
    expect(sanitize("Rainbow Castle.KIDPIX")).toBe("Rainbow Castle.kidpix");
  });

  it("replaces filesystem separators and falls back for an empty name", () => {
    expect(sanitize("  clouds/rain  ")).toBe("clouds-rain.kidpix");
    expect(sanitize(" ... ")).toBe("kidpix-fallback.kidpix");
  });
});
