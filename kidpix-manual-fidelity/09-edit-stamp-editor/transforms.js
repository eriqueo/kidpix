// P3 — Pure transforms on a grid's pixels array.
//
// Each transform mutates the grid via grid.replacePixels(next); callers wrap
// it in beginStroke/endStroke if they want it undoable.

(function (root) {
  var KP = root.KiddoPaint || (root.KiddoPaint = {});
  var SE = KP.StampEditor || (KP.StampEditor = {});
  var T = (SE.Transforms = SE.Transforms || {});

  function emptyLike(pixels) {
    var h = pixels.length;
    var w = pixels[0].length;
    var out = new Array(h);
    for (var y = 0; y < h; y++) {
      out[y] = new Array(w);
      for (var x = 0; x < w; x++) out[y][x] = null;
    }
    return out;
  }

  T.mirrorH = function (grid) {
    var w = grid.width,
      h = grid.height;
    var next = emptyLike(grid.pixels);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) next[y][x] = grid.pixels[y][w - 1 - x];
    }
    grid.replacePixels(next);
  };

  T.mirrorV = function (grid) {
    var w = grid.width,
      h = grid.height;
    var next = emptyLike(grid.pixels);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) next[y][x] = grid.pixels[h - 1 - y][x];
    }
    grid.replacePixels(next);
  };

  // 90° clockwise. Requires width === height (square grid — see SPEC.md).
  T.rotateCW = function (grid) {
    if (grid.width !== grid.height) {
      throw new Error("rotateCW requires a square grid");
    }
    var n = grid.width;
    var next = emptyLike(grid.pixels);
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        next[x][n - 1 - y] = grid.pixels[y][x];
      }
    }
    grid.replacePixels(next);
  };

  T.clear = function (grid) {
    grid.replacePixels(emptyLike(grid.pixels));
  };

  T._internals = { emptyLike: emptyLike };
})(typeof window !== "undefined" ? window : globalThis);
