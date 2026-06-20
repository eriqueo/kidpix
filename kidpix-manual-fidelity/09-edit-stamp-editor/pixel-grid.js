// P2 — Canvas-backed pixel grid for the Stamp Editor.
//
// State + minimum primitives only. No KiddoPaint globals, no DOM toolbar.
// Talks to its host through plain method calls; transforms.js and
// editor-modal.js layer behavior on top.
//
// pixels[y][x] === null  → transparent
// pixels[y][x] === "#rgb"/"rgb(...)" → that color

(function (root) {
  var KP = root.KiddoPaint || (root.KiddoPaint = {});
  var SE = KP.StampEditor || (KP.StampEditor = {});

  function makePixels(width, height) {
    var rows = new Array(height);
    for (var y = 0; y < height; y++) {
      rows[y] = new Array(width);
      for (var x = 0; x < width; x++) rows[y][x] = null;
    }
    return rows;
  }

  function clonePixels(src) {
    var out = new Array(src.length);
    for (var y = 0; y < src.length; y++) out[y] = src[y].slice();
    return out;
  }

  function createGrid(width, height) {
    if (!width || width < 1) throw new Error("grid width must be >= 1");
    if (!height || height < 1) throw new Error("grid height must be >= 1");
    var grid = {
      width: width,
      height: height,
      pixels: makePixels(width, height),
      currentColor: "rgb(0,0,0)",
      eraseMode: false,
      _strokeSnapshot: null,
      _preStrokeSnapshot: null,
    };

    grid.inBounds = function (x, y) {
      return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
    };

    grid.getPixel = function (x, y) {
      return grid.inBounds(x, y) ? grid.pixels[y][x] : undefined;
    };

    grid.setPixel = function (x, y, color) {
      if (!grid.inBounds(x, y)) return false;
      grid.pixels[y][x] = color === undefined ? null : color;
      return true;
    };

    grid.paint = function (x, y) {
      if (!grid.inBounds(x, y)) return false;
      grid.pixels[y][x] = grid.eraseMode ? null : grid.currentColor;
      return true;
    };

    grid.erase = function (x, y) {
      return grid.setPixel(x, y, null);
    };

    grid.beginStroke = function () {
      grid._preStrokeSnapshot = clonePixels(grid.pixels);
    };

    grid.endStroke = function () {
      grid._strokeSnapshot = grid._preStrokeSnapshot;
      grid._preStrokeSnapshot = null;
    };

    grid.undoLastStroke = function () {
      if (!grid._strokeSnapshot) return false;
      grid.pixels = grid._strokeSnapshot;
      grid._strokeSnapshot = null;
      return true;
    };

    grid.replacePixels = function (next) {
      // Used by transforms. Caller owns the cloned 2-D array.
      grid.pixels = next;
    };

    grid.snapshot = function () {
      return clonePixels(grid.pixels);
    };

    grid.restore = function (snap) {
      grid.pixels = clonePixels(snap);
    };

    grid.toCanvas = function (targetSize) {
      var canvas = (root.document || {}).createElement
        ? root.document.createElement("canvas")
        : null;
      if (!canvas) return null;
      var px = Math.max(1, Math.floor((targetSize || grid.width) / grid.width));
      canvas.width = grid.width * px;
      canvas.height = grid.height * px;
      var ctx = canvas.getContext("2d");
      if (!ctx) return canvas;
      ctx.imageSmoothingEnabled = false;
      for (var y = 0; y < grid.height; y++) {
        for (var x = 0; x < grid.width; x++) {
          var c = grid.pixels[y][x];
          if (c == null) continue;
          ctx.fillStyle = c;
          ctx.fillRect(x * px, y * px, px, px);
        }
      }
      return canvas;
    };

    return grid;
  }

  SE.createGrid = createGrid;
  SE._internals = { makePixels: makePixels, clonePixels: clonePixels };
})(typeof window !== "undefined" ? window : globalThis);
