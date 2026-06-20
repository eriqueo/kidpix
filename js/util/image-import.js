// Open/Import Picture pipeline shared by the File > Open Picture... menu entry
// and the canvas drag-and-drop entry point.
//
// Public surface (single function = one user intent):
//   KiddoPaint.ImageImport.openFile(file)        -> Promise<void>
//   KiddoPaint.ImageImport.triggerFilePicker()   -> opens the hidden <input>
//
// Behavior:
//   - decode via Image + FileReader (works in all target browsers including iOS Safari)
//   - guard format (PNG/JPEG/GIF/BMP/WEBP) and max source dimension at the boundary
//   - fit-to-canvas: letterbox-center, preserve aspect ratio (no stretch, no crop)
//   - composite onto main canvas using existing 2D context, single undoable action
//   - palette pass is isolated for later tuning (no-op by default; classic KidPix
//     dithered to its indexed palette — left as a stub so P4 review can wire it)

(function (global) {
  var KiddoPaint = global.KiddoPaint || (global.KiddoPaint = {});
  var ns = (KiddoPaint.ImageImport = KiddoPaint.ImageImport || {});

  var ACCEPTED_MIME = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/bmp",
    "image/webp",
  ];

  // Reject obviously hostile sources at the boundary. 8000px guards against a
  // 20MP phone photo blowing memory while decoding to an ImageBitmap on a
  // low-end device.
  var MAX_SOURCE_DIMENSION = 8000;

  ns.openFile = function (file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error("no file"));
        return;
      }
      if (ACCEPTED_MIME.indexOf(file.type) === -1) {
        console.warn("ImageImport: unsupported file type", file.type);
        reject(new Error("unsupported file type: " + file.type));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(reader.error || new Error("FileReader failed"));
      };
      reader.onload = function (evt) {
        var img = new Image();
        // Data-URL sources are same-origin so canvas does not get tainted,
        // which keeps Save working after an import.
        img.onerror = function () {
          reject(new Error("decode failed (corrupt or unsupported image)"));
        };
        img.onload = function () {
          try {
            if (
              img.naturalWidth > MAX_SOURCE_DIMENSION ||
              img.naturalHeight > MAX_SOURCE_DIMENSION
            ) {
              reject(
                new Error(
                  "image too large (" +
                    img.naturalWidth +
                    "x" +
                    img.naturalHeight +
                    ")",
                ),
              );
              return;
            }
            ns._placeOnMain(img);
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // Fit decoded bitmap onto the main canvas: letterbox-center, preserve aspect.
  // Single undoable action — uses the existing history stack via saveUndo().
  ns._placeOnMain = function (img) {
    var display = KiddoPaint.Display;
    if (!display || !display.main_context) {
      throw new Error("Display not initialized");
    }
    var ctx = display.main_context;
    var cw = display.main_canvas.width;
    var ch = display.main_canvas.height;

    var fit = ns._fitLetterbox(img.naturalWidth, img.naturalHeight, cw, ch);

    // Stage on an offscreen canvas so the palette pass and final composite are
    // a single drawImage onto main — keeps the undo snapshot a single step.
    var staging = document.createElement("canvas");
    staging.width = cw;
    staging.height = ch;
    var sctx = staging.getContext("2d");
    sctx.imageSmoothingEnabled = false;
    // Letterbox background matches the canvas clear color (white) for fidelity
    // with the original Kid Pix "paper" feel.
    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, cw, ch);
    sctx.drawImage(img, fit.x, fit.y, fit.w, fit.h);

    var processed = ns._palettePass(staging);

    // Single undoable action: snapshot pre-import, then composite.
    if (display.saveUndo()) {
      ctx.drawImage(processed, 0, 0);
      if (display.clearTmp) display.clearTmp();
      if (display.saveToLocalStorage) display.saveToLocalStorage();
    }
  };

  // Fit-to-canvas math: letterbox-center, preserve aspect.
  // Exposed for testing.
  ns._fitLetterbox = function (sw, sh, dw, dh) {
    if (sw <= 0 || sh <= 0) return { x: 0, y: 0, w: dw, h: dh };
    var scale = Math.min(dw / sw, dh / sh);
    var w = Math.round(sw * scale);
    var h = Math.round(sh * scale);
    var x = Math.round((dw - w) / 2);
    var y = Math.round((dh - h) / 2);
    return { x: x, y: y, w: w, h: h };
  };

  // Palette / dither pass. No-op default — kept as a single seam so the P4
  // manual-fidelity review can wire in indexed-color dithering (the original
  // Kid Pix quantized imports to its palette).
  ns._palettePass = function (canvas) {
    return canvas;
  };

  ns.triggerFilePicker = function () {
    var input = document.getElementById("open-picture-input");
    if (!input) {
      console.warn("ImageImport: hidden <input> not found");
      return;
    }
    // Reset value so picking the same file twice re-fires change.
    input.value = "";
    input.click();
  };
})(typeof window !== "undefined" ? window : globalThis);
