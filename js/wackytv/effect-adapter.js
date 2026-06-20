// Wacky TV — ImageData adapter over the existing Electric Mixer effects.
//
// Additive: this module never modifies WholeCanvasEffect or any existing
// one-shot Mixer tool. It exposes a single function
//
//     KiddoPaint.WackyTV.applyEffect(imageData, effectName) -> ImageData
//
// that takes an arbitrary ImageData (e.g. a video frame) and returns a new
// ImageData with the requested effect applied. The effects below are the
// subset of Mixer effects that are already pure pixel ops over ImageData
// (Filters.* and Dither.*). The WebGL-backed effects (Pinch, Swirl, etc.)
// live inside a per-tool fx.canvas() texture pipeline and are out of v1.

window.KiddoPaint = window.KiddoPaint || {};
KiddoPaint.WackyTV = KiddoPaint.WackyTV || {};

// Names exposed in the UI. Keep stable for tests.
KiddoPaint.WackyTV.EFFECTS = [
  "none",
  "invert",
  "sunshine",
  "threshold",
  "nightvision",
  "floydsteinberg",
  "bayer",
  "atkinson",
];

// Copy an ImageData so callers can keep working with their input.
function cloneImageData(src) {
  // Detached ImageDatas (no associated DOM) can't be constructed from a
  // canvas in tests, so we build one by hand. The Uint8ClampedArray is
  // copied to keep the caller's buffer untouched.
  var copy = new Uint8ClampedArray(src.data);
  if (typeof ImageData === "function") {
    try {
      return new ImageData(copy, src.width, src.height);
    } catch (e) {
      // Fall through to the duck-typed shape.
    }
  }
  return { data: copy, width: src.width, height: src.height };
}

// Pull pixels back out of a canvas after a globalCompositeOperation pass.
function canvasToImageData(canvas) {
  var ctx = canvas.getContext("2d");
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

KiddoPaint.WackyTV.applyEffect = function applyEffect(src, effect) {
  if (!src || !src.data) {
    throw new Error("WackyTV.applyEffect: ImageData required");
  }
  var name = (effect || "none").toLowerCase();
  if (name === "none") {
    return cloneImageData(src);
  }

  // For the simple per-pixel walks we copy first and mutate the copy in
  // place — Filters.* / Dither.* both work this way.
  var working = cloneImageData(src);

  switch (name) {
    case "invert":
      // Filters.invert is a straight per-pixel 255-x walk over the buffer.
      Filters.invert(working);
      return working;

    case "threshold":
      Filters.threshold(working, 128);
      return working;

    case "nightvision": {
      // Filters.sobel returns a fresh ImageData built from a fresh buffer.
      var s = Filters.sobel(working);
      return s;
    }

    case "floydsteinberg":
      return Dither.floydsteinberg(working);

    case "bayer":
      return Dither.bayer(working, 128);

    case "atkinson":
      return Dither.atkinson(working);

    case "sunshine": {
      // Filters.gcoOverlay returns a *canvas* (because it relies on
      // globalCompositeOperation). Pull pixels back so the adapter
      // contract — ImageData in, ImageData out — holds.
      var canvas = Filters.gcoOverlay(working, 0.5);
      return canvasToImageData(canvas);
    }
  }
  // Unknown effect: fail loud so we catch typos in tests.
  throw new Error("WackyTV.applyEffect: unknown effect '" + effect + "'");
};

// Exported for tests so they can verify the round-trip without booting
// the rest of the app.
KiddoPaint.WackyTV._cloneImageData = cloneImageData;
