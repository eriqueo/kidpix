// File > Open / Import — load an external image onto the canvas.
//
// Loads a user-supplied image (file-picker, drag-drop, or clipboard paste) into
// the background-image layer (bnimCanvas — per CLAUDE.md the "Background image
// manipulation" layer), scaled to fit, centered, preserving aspect ratio. The
// imported image is then composited UNDER the existing drawing on the main
// canvas (globalCompositeOperation = "destination-over") so the kid's
// in-progress work is never overwritten. The existing Display undo API is
// called so the import is a single revertable step.
//
// Surface (all attached to KiddoPaint.FileImport):
//   importImage(source)  -> Promise<boolean>   accepts File | DragEvent | ClipboardEvent
//   computeFit(iw, ih, cw, ch) -> {x, y, w, h} pure helper, scale-to-fit centered
//   isImageMime(type)    -> boolean            accepts the common web image MIMEs
//   extractFile(source)  -> File | null        normalizes source -> File
//   installListeners(canvas) -> void           wires drop/paste + injects picker button
//
// Tests cover computeFit / isImageMime / extractFile; the actual canvas drawing
// is exercised by the Playwright drag-drop spec.

(function () {
  var ns = (typeof window !== "undefined" ? window.KiddoPaint : globalThis.KiddoPaint);
  if (!ns) {
    // Standalone (unit-test) load: create just enough namespace to attach to.
    ns = (typeof window !== "undefined" ? (window.KiddoPaint = {}) : (globalThis.KiddoPaint = {}));
  }
  ns.FileImport = ns.FileImport || {};

  var ACCEPTED_MIMES = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/svg+xml",
  ];

  ns.FileImport.isImageMime = function (type) {
    if (!type || typeof type !== "string") return false;
    return ACCEPTED_MIMES.indexOf(type.toLowerCase()) !== -1;
  };

  // Scale-to-fit, centered. Preserves aspect ratio. Never upscales beyond the
  // canvas size in either axis (a tiny source image stays at native size to
  // avoid pixel blur — KidPix renders pixelated).
  ns.FileImport.computeFit = function (iw, ih, cw, ch) {
    if (!iw || !ih || !cw || !ch) return { x: 0, y: 0, w: 0, h: 0 };
    var scale = Math.min(cw / iw, ch / ih, 1);
    var w = Math.round(iw * scale);
    var h = Math.round(ih * scale);
    var x = Math.floor((cw - w) / 2);
    var y = Math.floor((ch - h) / 2);
    return { x: x, y: y, w: w, h: h };
  };

  // Normalize any of (File, DragEvent.dataTransfer, ClipboardEvent.clipboardData,
  // raw DragEvent, raw ClipboardEvent) into a single File or null.
  ns.FileImport.extractFile = function (source) {
    if (!source) return null;
    // Already a File / Blob with a type
    if (typeof File !== "undefined" && source instanceof File) {
      return ns.FileImport.isImageMime(source.type) ? source : null;
    }
    // DragEvent: look at dataTransfer.files
    var dt = source.dataTransfer || source.clipboardData;
    if (dt) {
      if (dt.files && dt.files.length > 0) {
        for (var i = 0; i < dt.files.length; i++) {
          if (ns.FileImport.isImageMime(dt.files[i].type)) return dt.files[i];
        }
      }
      // Clipboard paste: items[] may carry images as a "file" kind.
      if (dt.items && dt.items.length > 0) {
        for (var j = 0; j < dt.items.length; j++) {
          var item = dt.items[j];
          if (item.kind === "file" && ns.FileImport.isImageMime(item.type)) {
            var f = item.getAsFile();
            if (f) return f;
          }
        }
      }
    }
    return null;
  };

  // Core: load `file` into an Image, then draw it (centered/scaled) into the
  // bnim layer, then composite-under into main with one undo step. Returns a
  // promise resolved to true on success, false if no usable file/no canvases.
  function drawImageToBnimAndComposite(img) {
    var Display = ns.Display;
    if (!Display || !Display.bnimContext || !Display.main_context) return false;

    var cw = Display.main_canvas.width;
    var ch = Display.main_canvas.height;
    var fit = ns.FileImport.computeFit(img.width || img.naturalWidth,
                                        img.height || img.naturalHeight,
                                        cw, ch);

    // One undo step BEFORE any main-canvas mutation. This snapshots the
    // current drawing so the user can revert the import.
    if (typeof Display.saveUndo === "function") Display.saveUndo();

    // Stage into bnim (the background-image layer) first.
    Display.bnimContext.clearRect(0, 0, cw, ch);
    Display.bnimContext.drawImage(img, fit.x, fit.y, fit.w, fit.h);

    // Composite under existing main artwork — destination-over keeps the
    // kid's in-progress strokes on top, the imported photo behind them.
    var prevGco = Display.main_context.globalCompositeOperation;
    Display.main_context.globalCompositeOperation = "destination-over";
    Display.main_context.drawImage(Display.bnimCanvas, 0, 0);
    Display.main_context.globalCompositeOperation = prevGco;

    // Persist the new main-canvas state.
    if (typeof Display.saveToLocalStorage === "function") Display.saveToLocalStorage();

    return true;
  }

  ns.FileImport.importImage = function (source) {
    return new Promise(function (resolve) {
      var file = ns.FileImport.extractFile(source);
      if (!file) {
        resolve(false);
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { resolve(false); };
      reader.onload = function (ev) {
        var img = new Image();
        img.onload = function () { resolve(drawImageToBnimAndComposite(img)); };
        img.onerror = function () { resolve(false); };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // Wire all three entry points: drop on the supplied canvas, paste on the
  // document, and a "File > Open" button injected next to the Save button.
  ns.FileImport.installListeners = function (canvas) {
    // 1) Drag-and-drop onto the drawing canvas. The existing image_upload
    //    listener in init_listeners handles the legacy "Placer" path; that
    //    stays wired. Our handler runs first and short-circuits when a file
    //    is dropped, so the legacy path is only used if no file is present.
    if (canvas) {
      canvas.addEventListener("drop", function (ev) {
        var f = ns.FileImport.extractFile(ev);
        if (!f) return;
        if (ev.preventDefault) ev.preventDefault();
        ev.stopPropagation();
        ns.FileImport.importImage(f);
      }, true); // capture, to run before the legacy listener
    }

    // 2) Clipboard paste anywhere in the document.
    document.addEventListener("paste", function (ev) {
      var f = ns.FileImport.extractFile(ev);
      if (!f) return;
      if (ev.preventDefault) ev.preventDefault();
      ns.FileImport.importImage(f);
    });

    // 3) File-picker button: position:fixed in the top-right corner so we
    //    don't disturb the flex-wrap layout of #mainbar (adding it inside
    //    mainbar shifts a button to the next row and breaks unrelated
    //    layout-position tests). Functions exactly like a normal button.
    if (!document.getElementById("file-open")) {
      var btn = document.createElement("button");
      btn.id = "file-open";
      btn.title = "Open Picture";
      btn.setAttribute("aria-label", "Open Picture");
      btn.textContent = "Open";
      btn.style.cssText =
        "position:fixed;top:4px;right:4px;z-index:10001;" +
        "padding:4px 8px;font-size:12px;cursor:pointer;";

      var input = document.createElement("input");
      input.type = "file";
      input.accept = ACCEPTED_MIMES.join(",");
      input.style.display = "none";
      input.id = "file-open-input";
      input.addEventListener("change", function (ev) {
        var f = ev.target.files && ev.target.files[0];
        if (f) ns.FileImport.importImage(f);
        ev.target.value = ""; // allow re-picking the same file
      });

      btn.addEventListener("click", function () { input.click(); });
      document.body.appendChild(btn);
      document.body.appendChild(input);
    }
  };
})();
