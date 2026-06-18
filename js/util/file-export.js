// File export utilities — composite the five canvas layers and download as PNG,
// or trigger window.print() with a print stylesheet hiding everything but the canvas.
//
// Layer order is documented in CLAUDE.md ("Multi-Layer Canvas System"): main is the
// final artwork, bnim is a background-image manipulation layer behind any animation,
// anim is animated effects, preview is tool previews, tmp is the active drawing
// operations on top. Compositing for export draws them bottom-up in that order.

// IIFE keeps helpers private while still attaching the public API to KiddoPaint.
(function (global) {
  var LAYER_ORDER = ["main", "bnim", "anim", "preview", "tmp"];

  // Map logical layer name → KiddoPaint.Display property name. Kept explicit so
  // the compositor is decoupled from the slightly inconsistent display naming
  // ("main_canvas" vs "bnimCanvas").
  var DISPLAY_KEYS = {
    main: "main_canvas",
    bnim: "bnimCanvas",
    anim: "animCanvas",
    preview: "previewCanvas",
    tmp: "canvas", // KiddoPaint.Display.canvas is tmpCanvas
  };

  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function formatFilename(date) {
    var d = date || new Date();
    var stamp =
      d.getFullYear() +
      "-" +
      pad2(d.getMonth() + 1) +
      "-" +
      pad2(d.getDate()) +
      "-" +
      pad2(d.getHours()) +
      pad2(d.getMinutes()) +
      pad2(d.getSeconds());
    return "kidpix-" + stamp + ".png";
  }

  // Pure: takes a {main, bnim, anim, preview, tmp} dict of HTMLCanvasElement-like
  // objects (each must expose width/height and be drawable by drawImage), composites
  // them in LAYER_ORDER onto a fresh offscreen canvas, and returns it.
  // Throws loudly if any of the five layers is missing — the export path must never
  // silently drop a layer (kid spent time drawing on it).
  function compositeLayers(layers) {
    if (!layers || typeof layers !== "object") {
      throw new Error("compositeLayers: layers argument is required");
    }
    for (var i = 0; i < LAYER_ORDER.length; i++) {
      var name = LAYER_ORDER[i];
      if (!layers[name]) {
        throw new Error("compositeLayers: missing layer '" + name + "'");
      }
    }
    var base = layers.main;
    var out = document.createElement("canvas");
    out.width = base.width;
    out.height = base.height;
    var ctx = out.getContext("2d");
    // Preserve pixel-perfect rendering — every other canvas in the app sets this.
    ctx.imageSmoothingEnabled = false;
    for (var j = 0; j < LAYER_ORDER.length; j++) {
      ctx.drawImage(layers[LAYER_ORDER[j]], 0, 0);
    }
    return out;
  }

  // Pull the five live layers off KiddoPaint.Display.
  function collectDisplayLayers() {
    var Display = global.KiddoPaint && global.KiddoPaint.Display;
    if (!Display) {
      throw new Error("exportPNG: KiddoPaint.Display is not initialized");
    }
    var layers = {};
    for (var i = 0; i < LAYER_ORDER.length; i++) {
      var name = LAYER_ORDER[i];
      layers[name] = Display[DISPLAY_KEYS[name]];
    }
    return layers;
  }

  // Trigger a browser download from a Blob via a temporary anchor. Same shape as
  // the original save_to_file path so Playwright's download listener sees an
  // anchor-driven download event.
  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revoke so the browser has finished kicking off the download.
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function exportPNG(filename) {
    var name = filename || formatFilename();
    var composited = compositeLayers(collectDisplayLayers());
    if (composited.toBlob) {
      composited.toBlob(function (blob) {
        if (!blob) {
          throw new Error("exportPNG: toBlob returned null");
        }
        triggerDownload(blob, name);
      }, "image/png");
    } else {
      // Fallback for environments without toBlob (e.g. older Safari) — still produces
      // a real download via the anchor-with-href-data-URL path.
      var dataUrl = composited.toDataURL("image/png");
      var a = document.createElement("a");
      a.href = dataUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    return name;
  }

  function printCanvas() {
    // The print stylesheet (kidpix.css @media print rules) hides everything except
    // the main canvas; we just hand off to the browser.
    if (typeof global.print === "function") {
      global.print();
    } else if (global.window && typeof global.window.print === "function") {
      global.window.print();
    }
  }

  // Attach to KiddoPaint namespace for browser use.
  if (global.KiddoPaint) {
    global.KiddoPaint.FileExport = {
      LAYER_ORDER: LAYER_ORDER,
      compositeLayers: compositeLayers,
      formatFilename: formatFilename,
      exportPNG: exportPNG,
      printCanvas: printCanvas,
    };
  }

  // Vitest/Node import path — named exports for unit testing without a DOM-loaded app.
  if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
    module.exports = {
      LAYER_ORDER: LAYER_ORDER,
      compositeLayers: compositeLayers,
      formatFilename: formatFilename,
      exportPNG: exportPNG,
      printCanvas: printCanvas,
    };
  }
})(typeof window !== "undefined" ? window : globalThis);
