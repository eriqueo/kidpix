// Pure pixel-editor model for the Edit Stamp Goodie.
// No DOM access — all operations work on a flat boolean grid so they can be
// unit-tested with vitest. The UI layer (editor-ui.js) wraps this.

(function (root) {
  var KP = root.KiddoPaint || (root.KiddoPaint = {});
  var S = KP.Stamps || (KP.Stamps = {});
  var Editor = (S.Editor = S.Editor || {});

  var DEFAULT_SIZE = 32;

  function makeBlankGrid(size) {
    var g = new Array(size * size);
    for (var i = 0; i < g.length; i++) g[i] = false;
    return g;
  }

  function EditorState(size) {
    this.size = size || DEFAULT_SIZE;
    this.grid = makeBlankGrid(this.size);
  }

  EditorState.prototype.idx = function (x, y) {
    return y * this.size + x;
  };

  EditorState.prototype.get = function (x, y) {
    return !!this.grid[this.idx(x, y)];
  };

  EditorState.prototype.set = function (x, y, val) {
    this.grid[this.idx(x, y)] = !!val;
  };

  EditorState.prototype.togglePixel = function (x, y) {
    var i = this.idx(x, y);
    this.grid[i] = !this.grid[i];
  };

  EditorState.prototype.clear = function () {
    for (var i = 0; i < this.grid.length; i++) this.grid[i] = false;
  };

  // Rotate 90° clockwise: new[x][y] = old[y][size-1-x]
  EditorState.prototype.rotateRight = function () {
    var n = this.size;
    var next = makeBlankGrid(n);
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        next[y * n + x] = this.grid[(n - 1 - x) * n + y];
      }
    }
    this.grid = next;
  };

  EditorState.prototype.flipH = function () {
    var n = this.size;
    var next = makeBlankGrid(n);
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        next[y * n + x] = this.grid[y * n + (n - 1 - x)];
      }
    }
    this.grid = next;
  };

  EditorState.prototype.flipV = function () {
    var n = this.size;
    var next = makeBlankGrid(n);
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        next[y * n + x] = this.grid[(n - 1 - y) * n + x];
      }
    }
    this.grid = next;
  };

  // Copy from an "original" grid (boolean flat array of length size*size).
  EditorState.prototype.restoreOriginal = function (original) {
    if (!original || original.length !== this.grid.length) return;
    for (var i = 0; i < this.grid.length; i++) {
      this.grid[i] = !!original[i];
    }
  };

  // Render the current state to a fresh 32×32 canvas. Filled cells become
  // opaque black (the Kid Pix stamp convention); empty cells are transparent.
  EditorState.prototype.toCanvas = function () {
    var n = this.size;
    var canvas = (typeof document !== "undefined")
      ? document.createElement("canvas")
      : null;
    if (!canvas) return null;
    canvas.width = n;
    canvas.height = n;
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, n, n);
    ctx.fillStyle = "#000";
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (this.grid[y * n + x]) ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  };

  // Static helper: convert raw ImageData (32×32 RGBA) → boolean grid by
  // treating any non-transparent pixel as "on". Used when seeding the editor
  // from an existing sprite.
  Editor.imageDataToGrid = function (imageData, size) {
    var n = size || DEFAULT_SIZE;
    var grid = makeBlankGrid(n);
    if (!imageData || !imageData.data) return grid;
    var count = Math.min(grid.length, Math.floor(imageData.data.length / 4));
    for (var i = 0; i < count; i++) {
      // "on" if alpha > 16 AND not nearly white
      var r = imageData.data[i * 4];
      var g = imageData.data[i * 4 + 1];
      var b = imageData.data[i * 4 + 2];
      var a = imageData.data[i * 4 + 3];
      grid[i] = a > 16 && !(r > 240 && g > 240 && b > 240);
    }
    return grid;
  };

  // Static helper: render a grid (boolean flat array) to a canvas at a given
  // scale. Used by the override short-circuit to drop in a replacement sprite.
  Editor.gridToCanvas = function (grid, size, scale) {
    var n = size || DEFAULT_SIZE;
    var s = scale || 1;
    if (typeof document === "undefined") return null;
    var canvas = document.createElement("canvas");
    canvas.width = n * s;
    canvas.height = n * s;
    var ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    if (s === 1) {
      var img = ctx.createImageData(n, n);
      for (var i = 0; i < grid.length; i++) {
        var off = i * 4;
        if (grid[i]) {
          img.data[off + 3] = 255;
        } else {
          img.data[off + 3] = 0;
        }
      }
      ctx.putImageData(img, 0, 0);
    } else {
      ctx.fillStyle = "#000";
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n; x++) {
          if (grid[y * n + x]) ctx.fillRect(x * s, y * s, s, s);
        }
      }
    }
    return canvas;
  };

  Editor.DEFAULT_SIZE = DEFAULT_SIZE;
  Editor.EditorState = EditorState;
  Editor.makeBlankGrid = makeBlankGrid;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Editor;
  }
})(typeof window !== "undefined" ? window : globalThis);
