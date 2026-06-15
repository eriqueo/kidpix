KiddoPaint.Display.undoData = [];
KiddoPaint.Display.redoData = [];
KiddoPaint.Display.undoOn = true;
KiddoPaint.Display.allowClearTmp = true;

// Undo/redo history lives in memory only as ImageData snapshots (cheap getImageData,
// no per-stroke PNG encode). It is intentionally NOT persisted across reloads (WS3
// variant ii): only the *current drawing* is restored, via the "kiddopaint" key below.
// Cap kept modest because each ImageData is uncompressed (~3.4MB for 1300x650), unlike
// the old PNG data-URLs; this bounds memory on iPad.
KiddoPaint.Display.MAX_UNDO = 20;

// --- Debounced current-drawing persistence ---------------------------------------
// Encoding the canvas to a data URL + localStorage write is megabytes of synchronous
// main-thread work; doing it on every stroke was the primary lag source. Coalesce rapid
// strokes into a single trailing write, and flush on tab close/background (see init) so
// nothing is lost.
KiddoPaint.Display._persistTimer = null;
KiddoPaint.Display._persistDelayMs = 500;

KiddoPaint.Display._writeCurrentDrawing = function () {
  if (typeof Storage == "undefined") return;
  try {
    localStorage.setItem(
      "kiddopaint",
      KiddoPaint.Display.main_canvas.toDataURL(),
    );
  } catch (e) {
    // Quota fallback: re-encode smaller as JPEG.
    try {
      localStorage.setItem(
        "kiddopaint",
        KiddoPaint.Display.main_canvas.toDataURL("image/jpeg", 0.87),
      );
    } catch (e2) {
      console.log(e2);
    }
  }
};

// Force any pending debounced save to happen now (used on pagehide/visibilitychange).
KiddoPaint.Display.flushPersist = function () {
  if (KiddoPaint.Display._persistTimer !== null) {
    clearTimeout(KiddoPaint.Display._persistTimer);
    KiddoPaint.Display._persistTimer = null;
  }
  KiddoPaint.Display._writeCurrentDrawing();
};

KiddoPaint.Display.clearAll = function () {
  // clearing anim is resp of callers
  KiddoPaint.Display.saveUndo();
  KiddoPaint.Display.clearPreview();
  KiddoPaint.Display.clearTmp();
  KiddoPaint.Display.clearMain();
  KiddoPaint.Display.clearLocalStorage();
};

KiddoPaint.Display.clearMain = function () {
  KiddoPaint.Display.main_context.clearRect(
    0,
    0,
    KiddoPaint.Display.main_canvas.width,
    KiddoPaint.Display.main_canvas.height,
  );
};

KiddoPaint.Display.clearTmp = function () {
  if (KiddoPaint.Display.allowClearTmp) {
    KiddoPaint.Display.context.clearRect(
      0,
      0,
      KiddoPaint.Display.canvas.width,
      KiddoPaint.Display.canvas.height,
    );
  }
};

KiddoPaint.Display.clearPreview = function () {
  KiddoPaint.Display.previewContext.clearRect(
    0,
    0,
    KiddoPaint.Display.canvas.width,
    KiddoPaint.Display.canvas.height,
  );
};

KiddoPaint.Display.clearAnim = function () {
  KiddoPaint.Display.animContext.clearRect(
    0,
    0,
    KiddoPaint.Display.canvas.width,
    KiddoPaint.Display.canvas.height,
  );
};

KiddoPaint.Display.clearBnim = function () {
  KiddoPaint.Display.bnimContext.clearRect(
    0,
    0,
    KiddoPaint.Display.canvas.width,
    KiddoPaint.Display.canvas.height,
  );
};

KiddoPaint.Display.clearBeforeSaveMain = function () {
  if (KiddoPaint.Display.saveUndo()) {
    KiddoPaint.Display.clearMain();
    KiddoPaint.Display.main_context.drawImage(KiddoPaint.Display.canvas, 0, 0);
    KiddoPaint.Display.clearTmp();
    KiddoPaint.Display.saveToLocalStorage();
  }
};

KiddoPaint.Display.saveMainGco = function (op) {
  if (KiddoPaint.Display.saveUndo()) {
    const prevGco = KiddoPaint.Display.main_context.globalCompositeOperation;
    KiddoPaint.Display.main_context.globalCompositeOperation = op;
    KiddoPaint.Display.main_context.drawImage(KiddoPaint.Display.canvas, 0, 0);
    KiddoPaint.Display.main_context.globalCompositeOperation = prevGco;
    KiddoPaint.Display.clearTmp();
    KiddoPaint.Display.saveToLocalStorage();
  }
};

KiddoPaint.Display.saveMainGcoSkipUndo = function (op) {
  const prevGco = KiddoPaint.Display.main_context.globalCompositeOperation;
  KiddoPaint.Display.main_context.globalCompositeOperation = op;
  KiddoPaint.Display.main_context.drawImage(KiddoPaint.Display.canvas, 0, 0);
  KiddoPaint.Display.main_context.globalCompositeOperation = prevGco;
  KiddoPaint.Display.clearTmp();
  KiddoPaint.Display.saveToLocalStorage();
};

KiddoPaint.Display.saveMain = function () {
  if (KiddoPaint.Display.saveUndo()) {
    KiddoPaint.Display.main_context.drawImage(KiddoPaint.Display.canvas, 0, 0);
    KiddoPaint.Display.clearTmp();
    KiddoPaint.Display.saveToLocalStorage();
  }
};

KiddoPaint.Display.saveMainSkipUndo = function () {
  KiddoPaint.Display.main_context.drawImage(KiddoPaint.Display.canvas, 0, 0);
  KiddoPaint.Display.clearTmp();
  KiddoPaint.Display.saveToLocalStorage();
};

KiddoPaint.Display.pauseUndo = function () {
  KiddoPaint.Display.undoOn = false;
};

KiddoPaint.Display.resumeUndo = function () {
  KiddoPaint.Display.undoOn = true;
};

KiddoPaint.Display.toggleUndo = function () {
  KiddoPaint.Display.undoOn = !KiddoPaint.Display.undoOn;
};

KiddoPaint.Display.saveUndo = function () {
  if (KiddoPaint.Display.undoOn) {
    KiddoPaint.Display.undoData.push(
      KiddoPaint.Display.main_context.getImageData(
        0,
        0,
        KiddoPaint.Display.main_canvas.width,
        KiddoPaint.Display.main_canvas.height,
      ),
    );
    if (KiddoPaint.Display.undoData.length > KiddoPaint.Display.MAX_UNDO) {
      KiddoPaint.Display.undoData.shift();
    }
    KiddoPaint.Display.redoData = [];
  }
  return KiddoPaint.Display.undoOn;
};

// Note: a key non-obvious part of this undo / redo implementation is the fact
// that elsewhere in the app, the drawing tools only save the canvas immediately
// BEFORE they draw to the canvas. So the current state of the canvas is not actually
// saved in the undo or redo buffers; it is essentially a 3rd state that needs to be
// accounted for in the undo / redo logic. That's why the first step of a undo/redo
// operation is to push the canvas onto the opposite buffer, to save it.

KiddoPaint.Display.popAndLoad = function (stack) {
  // ImageData is written straight back to the canvas (synchronous, no Image.onload race).
  KiddoPaint.Display.clearMain();
  KiddoPaint.Display.main_context.putImageData(stack.pop(), 0, 0);
};

// Snapshot the current canvas as ImageData (the live "3rd state"; see note below).
KiddoPaint.Display._snapshotMain = function () {
  return KiddoPaint.Display.main_context.getImageData(
    0,
    0,
    KiddoPaint.Display.main_canvas.width,
    KiddoPaint.Display.main_canvas.height,
  );
};

KiddoPaint.Display.undo = function () {
  if (KiddoPaint.Display.undoData.length > 0) {
    KiddoPaint.Display.redoData.push(KiddoPaint.Display._snapshotMain());
    KiddoPaint.Display.popAndLoad(KiddoPaint.Display.undoData);
    // Keep the persisted current drawing in sync with what's now on screen.
    KiddoPaint.Display.saveToLocalStorage();
  } else {
    console.log("undo buffer empty, nothing to do");
  }
};

KiddoPaint.Display.redo = function () {
  if (KiddoPaint.Display.redoData.length > 0) {
    KiddoPaint.Display.undoData.push(KiddoPaint.Display._snapshotMain());
    KiddoPaint.Display.popAndLoad(KiddoPaint.Display.redoData);
    // Keep the persisted current drawing in sync with what's now on screen.
    KiddoPaint.Display.saveToLocalStorage();
  } else {
    console.log("redo buffer empty, nothing to do");
  }
};

KiddoPaint.Display.clearLocalStorage = function () {
  if (typeof Storage != "undefined") {
    localStorage.removeItem("kiddopaint");
    localStorage.removeItem("kiddopaint_undo");
    localStorage.removeItem("kiddopaint_redo");
  }
};

// Schedule a debounced write of the current drawing. Callers fire this on every stroke;
// rapid calls collapse into one trailing localStorage write (see _persistDelayMs).
KiddoPaint.Display.saveToLocalStorage = function () {
  if (typeof Storage == "undefined") return;
  if (KiddoPaint.Display._persistTimer !== null) {
    clearTimeout(KiddoPaint.Display._persistTimer);
  }
  KiddoPaint.Display._persistTimer = setTimeout(function () {
    KiddoPaint.Display._persistTimer = null;
    KiddoPaint.Display._writeCurrentDrawing();
  }, KiddoPaint.Display._persistDelayMs);
};

KiddoPaint.Display.loadFromLocalStorage = function () {
  var img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = function () {
    KiddoPaint.Display.clearMain();
    KiddoPaint.Display.main_context.drawImage(img, 0, 0);
  };
  if (typeof Storage != "undefined" && localStorage.getItem("kiddopaint")) {
    img.src = localStorage.getItem("kiddopaint");
  } else {
    img.src = "static/splash.png";
  }
};

KiddoPaint.Display.canvasToImageData = function (canvas) {
  return canvas
    .getContext("2d")
    .getImageData(0, 0, canvas.width, canvas.height);
};

KiddoPaint.Display.imageTypeToCanvas = function (imageData, doDraw) {
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  if (doDraw) {
    ctx.drawImage(imageData, 0, 0);
  } else {
    ctx.putImageData(imageData, 0, 0);
  }
  return canvas;
};
