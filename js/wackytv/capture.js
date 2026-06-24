// Wacky TV — capture the currently-effected frame into the main picture.
//
// We route the paste through the existing Display pathway so undo, persist,
// and the canvas layer stack behave exactly like an ordinary paint stroke.
// (The same pattern the eraser-effects and Mixer effects use: write to the
// main canvas, then call saveUndo before mutating so the prior state is
// captured on the undo stack.)

window.KiddoPaint = window.KiddoPaint || {};
KiddoPaint.WackyTV = KiddoPaint.WackyTV || {};

// Internal: blit an ImageData into a canvas, scaling to fit. ImageData
// itself can't be drawn scaled; we round-trip through an offscreen canvas
// so drawImage can do the scale.
function imageDataToScaledCanvas(imageData, targetW, targetH) {
  var off = document.createElement("canvas");
  off.width = imageData.width;
  off.height = imageData.height;
  off.getContext("2d").putImageData(imageData, 0, 0);
  if (off.width === targetW && off.height === targetH) {
    return off;
  }
  var scaled = document.createElement("canvas");
  scaled.width = targetW;
  scaled.height = targetH;
  var sctx = scaled.getContext("2d");
  // Smooth scaling so a camera photo stays crisp rather than blocky.
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(off, 0, 0, targetW, targetH);
  return scaled;
}

// Public: paste the (effected) frame onto the main picture canvas, centered
// and scaled to fill the canvas while preserving aspect.
KiddoPaint.WackyTV.pasteImageDataToMain = function pasteImageDataToMain(
  imageData,
  opts,
) {
  opts = opts || {};
  var display = (opts.display || (window.KiddoPaint && KiddoPaint.Display));
  if (!display || !display.main_canvas || !display.main_context) {
    throw new Error("WackyTV.pasteImageDataToMain: Display not initialised");
  }

  var mw = display.main_canvas.width;
  var mh = display.main_canvas.height;

  // Fit the frame inside the main canvas, keeping aspect ratio (Kid Pix
  // pictures are 2:1; videos usually 4:3 or 16:9). Centred. This matches the
  // way a stamp lands when you drop it in.
  var iw = imageData.width;
  var ih = imageData.height;
  var scale = Math.min(mw / iw, mh / ih);
  var dw = Math.max(1, Math.round(iw * scale));
  var dh = Math.max(1, Math.round(ih * scale));
  var dx = Math.floor((mw - dw) / 2);
  var dy = Math.floor((mh - dh) / 2);

  var src = imageDataToScaledCanvas(imageData, dw, dh);

  // Same paste protocol as the rest of the engine: snapshot for undo,
  // then drawImage onto the main context.
  if (typeof display.saveUndo === "function") {
    display.saveUndo();
  }
  display.main_context.drawImage(src, dx, dy);

  return { dx: dx, dy: dy, dw: dw, dh: dh };
};
