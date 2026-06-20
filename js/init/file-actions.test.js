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
        canvas: { width: 1, height: 1, png: PNG },
        retainedState: { frame: "frame-wood" },
      },
      overrides,
    );
  }

  it("accepts a well-formed v1 project", () => {
    const safe = KiddoPaint.FileActions.sanitizeProject(valid());
    expect(safe.png).toBe(PNG);
    expect(safe.frame).toBe("frame-wood");
  });

  it("rejects missing/wrong magic", () => {
    expect(() =>
      KiddoPaint.FileActions.sanitizeProject(valid({ magic: "nope" })),
    ).toThrow(/not a kidpix project/);
  });

  it("rejects unknown future versions", () => {
    expect(() =>
      KiddoPaint.FileActions.sanitizeProject(valid({ version: 99 })),
    ).toThrow(/newer than this build/);
  });

  it("rejects invalid version", () => {
    expect(() =>
      KiddoPaint.FileActions.sanitizeProject(valid({ version: 0 })),
    ).toThrow(/unknown project version/);
  });

  it("rejects non-data-url canvas images (e.g. javascript:)", () => {
    expect(() =>
      KiddoPaint.FileActions.sanitizeProject(
        valid({ canvas: { png: "javascript:alert(1)" } }),
      ),
    ).toThrow(/not a data URL/);
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
