// P4 — Per-session stamp override map + localStorage mirror.
//
// Owns KiddoPaint.Stamps.overrides. The Stamps.stamp() shim (added by this
// module) consults the map before falling back to the original fillText
// renderer, so existing callers see an unchanged contract.
//
// Override entry shape:
//   { width, height, pixels: string|null [height][width] }

(function (root) {
  var KP = root.KiddoPaint || (root.KiddoPaint = {});
  var SE = KP.StampEditor || (KP.StampEditor = {});
  var STORAGE_KEY = "kidpix.stampEditor.overrides.v1";

  KP.Stamps = KP.Stamps || {};
  if (!KP.Stamps.overrides) KP.Stamps.overrides = {};

  var Overrides = (SE.Overrides = SE.Overrides || {});

  Overrides.has = function (key) {
    return Object.prototype.hasOwnProperty.call(KP.Stamps.overrides, key);
  };

  Overrides.get = function (key) {
    return KP.Stamps.overrides[key] || null;
  };

  Overrides.setFromGrid = function (key, grid) {
    if (!key) return;
    KP.Stamps.overrides[key] = {
      width: grid.width,
      height: grid.height,
      pixels: grid.snapshot(),
    };
    Overrides.persist();
  };

  Overrides.clear = function (key) {
    delete KP.Stamps.overrides[key];
    Overrides.persist();
  };

  Overrides.persist = function () {
    try {
      if (!root.localStorage) return;
      root.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(KP.Stamps.overrides),
      );
    } catch (e) {
      // quota / disabled storage: in-memory map is the source of truth.
    }
  };

  Overrides.load = function () {
    try {
      if (!root.localStorage) return;
      var raw = root.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (var k in parsed) {
          if (Object.prototype.hasOwnProperty.call(parsed, k)) {
            KP.Stamps.overrides[k] = parsed[k];
          }
        }
      }
    } catch (e) {
      // ignore — corrupt entry just means "no overrides yet".
    }
  };

  // Render an override onto a canvas sized to `size`. Used by the stamps shim.
  Overrides.renderTo = function (key, size) {
    var ov = Overrides.get(key);
    if (!ov) return null;
    if (!root.document) return null;
    var canvas = root.document.createElement("canvas");
    canvas.width = Math.max(size + size * 0.05, 24);
    canvas.height = Math.max(size + size * 0.05, 24);
    canvas.height += 0.15 * canvas.height;
    var ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    ctx.imageSmoothingEnabled = false;
    var cellW = size / ov.width;
    var cellH = size / ov.height;
    for (var y = 0; y < ov.height; y++) {
      for (var x = 0; x < ov.width; x++) {
        var c = ov.pixels[y][x];
        if (c == null) continue;
        ctx.fillStyle = c;
        ctx.fillRect(
          Math.floor(x * cellW),
          Math.floor(y * cellH),
          Math.ceil(cellW),
          Math.ceil(cellH),
        );
      }
    }
    return canvas;
  };

  // Install the renderer shim. The original KiddoPaint.Stamps.stamp is kept
  // and called when no override exists for the key.
  Overrides.installShim = function () {
    if (Overrides._shimInstalled) return;
    var original = KP.Stamps.stamp;
    if (typeof original !== "function") return; // stamps module not loaded yet
    KP.Stamps.stamp = function (stamp, alt, ctrl, size, shiftAmount, color) {
      if (Overrides.has(stamp)) {
        var canvas = Overrides.renderTo(stamp, size);
        if (canvas) return canvas;
      }
      return original.call(KP.Stamps, stamp, alt, ctrl, size, shiftAmount, color);
    };
    Overrides._shimInstalled = true;
  };

  // Build a grid pre-loaded with the existing override for `key`, or an
  // empty grid if there isn't one.
  Overrides.gridForKey = function (key, defaultSize) {
    var size = defaultSize || 32;
    var ov = Overrides.get(key);
    var grid = SE.createGrid(
      ov ? ov.width : size,
      ov ? ov.height : size,
    );
    if (ov) grid.replacePixels(JSON.parse(JSON.stringify(ov.pixels)));
    return grid;
  };

  Overrides._STORAGE_KEY = STORAGE_KEY;

  // Attempt eager install + load. Safe to no-op if Stamps.stamp isn't ready.
  Overrides.load();
  Overrides.installShim();
})(typeof window !== "undefined" ? window : globalThis);
