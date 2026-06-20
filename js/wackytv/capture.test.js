// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from "vitest";

// The repo's src/test-setup.ts hands every canvas a thin mock context that
// lacks drawImage/putImageData/getImageData. Install a richer fake before
// importing capture.js so the paste path can actually be exercised.

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

function makeFakeCtx() {
  const ctx = {
    imageSmoothingEnabled: false,
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    getImageData: vi.fn((x, y, w, h) => new FakeImageData(w, h)),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
  };
  return ctx;
}

// HTMLCanvasElement.prototype.getContext is already a vi.fn() from test-setup;
// rebind it to a per-canvas fake context so each new canvas gets its own
// fresh ctx and we can assert against it.
const canvasContexts = new WeakMap();
HTMLCanvasElement.prototype.getContext = function () {
  let ctx = canvasContexts.get(this);
  if (!ctx) {
    ctx = makeFakeCtx();
    ctx.canvas = this;
    canvasContexts.set(this, ctx);
  }
  return ctx;
};

beforeAll(async () => {
  global.KiddoPaint = global.KiddoPaint || {};
  await import("./capture.js");
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

function makeDisplay(mw, mh) {
  const main_canvas = document.createElement("canvas");
  main_canvas.width = mw;
  main_canvas.height = mh;
  const main_context = main_canvas.getContext("2d");
  return {
    main_canvas,
    main_context,
    saveUndo: vi.fn(() => true),
  };
}

describe("WackyTV.pasteImageDataToMain", () => {
  it("calls saveUndo before drawing onto main_context", () => {
    const display = makeDisplay(200, 100);
    const order = [];
    display.saveUndo.mockImplementation(() => {
      order.push("saveUndo");
      return true;
    });
    display.main_context.drawImage.mockImplementation(() => {
      order.push("drawImage");
    });

    const frame = makeImageData(50, 50, { r: 200, g: 0, b: 0 });
    KiddoPaint.WackyTV.pasteImageDataToMain(frame, { display });
    expect(order).toEqual(["saveUndo", "drawImage"]);
  });

  it("centres + scales the frame to fit the main canvas (aspect preserved)", () => {
    const display = makeDisplay(200, 100);
    const frame = makeImageData(50, 50, { r: 0, g: 200, b: 0 });
    const placement = KiddoPaint.WackyTV.pasteImageDataToMain(frame, {
      display,
    });
    expect(placement).toEqual({ dx: 50, dy: 0, dw: 100, dh: 100 });
  });

  it("passes the scaled source canvas into drawImage at the right slot", () => {
    const display = makeDisplay(200, 100);
    const frame = makeImageData(50, 50, { r: 0, g: 0, b: 200 });
    KiddoPaint.WackyTV.pasteImageDataToMain(frame, { display });
    const calls = display.main_context.drawImage.mock.calls;
    expect(calls.length).toBe(1);
    const [src, dx, dy] = calls[0];
    expect(src instanceof HTMLCanvasElement).toBe(true);
    expect(src.width).toBe(100); // scaled to fit
    expect(src.height).toBe(100);
    expect(dx).toBe(50);
    expect(dy).toBe(0);
  });

  it("throws when Display is missing or incomplete", () => {
    expect(() =>
      KiddoPaint.WackyTV.pasteImageDataToMain(
        makeImageData(2, 2, { r: 0, g: 0, b: 0 }),
        { display: {} },
      ),
    ).toThrow();
  });
});
