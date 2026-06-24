KiddoPaint.Stamps.stamp = function (
  stamp,
  alt,
  ctrl,
  size,
  shiftAmount,
  color,
) {
  stamp = stamp || "";
  var canvasBrush = document.createElement("canvas");
  canvasBrush.width = Math.max(size + size * 0.05, 24);
  canvasBrush.height = Math.max(size + size * 0.05, 24);
  canvasBrush.height += 0.15 * canvasBrush.height; // prevent clipping on bottom

  var contextBrush = canvasBrush.getContext("2d");
  contextBrush.font = size + "px " + KiddoPaint.Stamps.currentFace;
  if (color) {
    // chrome & safari compat hack
    contextBrush.fillStyle = color;
  }

  contextBrush.save();
  if (ctrl && alt) {
    contextBrush.scale(-1, 1);
    contextBrush.scale(1, -1);
    contextBrush.translate(-size, -size);
    contextBrush.fillText(stamp, 0, size - 0.15 * canvasBrush.height);
  } else if (ctrl) {
    contextBrush.scale(1, -1);
    contextBrush.fillText(stamp, 0, -0.15 * canvasBrush.height);
  } else if (alt) {
    contextBrush.translate(size, size);
    contextBrush.scale(-1, 1);
    contextBrush.fillText(stamp, 0, 0);
  } else {
    contextBrush.fillText(stamp, 0, size);
  }
  contextBrush.restore();

  if (shiftAmount != 0) {
    hueShift(canvasBrush, contextBrush, shiftAmount);
  }

  return canvasBrush;
};

KiddoPaint.Stamps.nextPage = function () {
  KiddoPaint.Stamps.page += 1;
  if (KiddoPaint.Stamps.page > KiddoPaint.Stamps.grouping.pages) {
    KiddoPaint.Stamps.page = 1;
  }
};

KiddoPaint.Stamps.prevPage = function () {
  KiddoPaint.Stamps.page -= 1;
  if (KiddoPaint.Stamps.page < 1) {
    KiddoPaint.Stamps.page = KiddoPaint.Stamps.grouping.pages;
  }
};

// --- Edit Stamp goodie: override layer (additive) ---------------------------
// User-edited sprites are persisted in localStorage as a JSON map keyed by
// `${spritesheet-filename}:${row}:${col}`. The PNG spritesheets in util/ are
// never mutated; the override layer is consulted just-in-time by a wrapper
// around extractSprite (see js/init/edit-stamp.js).
KiddoPaint.Stamps.OVERRIDE_STORAGE_KEY = "kidpix:stampOverrides";

KiddoPaint.Stamps.stampOverrideId = function (sheetFilename, row, col) {
  return sheetFilename + ":" + row + ":" + col;
};

KiddoPaint.Stamps._readOverrides = function () {
  try {
    if (typeof localStorage === "undefined") return {};
    var raw = localStorage.getItem(KiddoPaint.Stamps.OVERRIDE_STORAGE_KEY);
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
};

KiddoPaint.Stamps._writeOverrides = function (map) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      KiddoPaint.Stamps.OVERRIDE_STORAGE_KEY,
      JSON.stringify(map || {}),
    );
  } catch (e) {}
};

KiddoPaint.Stamps.getOverride = function (id) {
  var map = KiddoPaint.Stamps._readOverrides();
  return Object.prototype.hasOwnProperty.call(map, id) ? map[id] : null;
};

KiddoPaint.Stamps.setOverride = function (id, gridBooleans) {
  var map = KiddoPaint.Stamps._readOverrides();
  // Store as 0/1 string to keep localStorage compact.
  var encoded = "";
  for (var i = 0; i < gridBooleans.length; i++) {
    encoded += gridBooleans[i] ? "1" : "0";
  }
  map[id] = { v: 1, size: 32, grid: encoded };
  KiddoPaint.Stamps._writeOverrides(map);
};

KiddoPaint.Stamps.clearOverride = function (id) {
  var map = KiddoPaint.Stamps._readOverrides();
  if (Object.prototype.hasOwnProperty.call(map, id)) {
    delete map[id];
    KiddoPaint.Stamps._writeOverrides(map);
  }
};

KiddoPaint.Stamps.decodeOverrideGrid = function (entry) {
  if (!entry || typeof entry.grid !== "string") return null;
  var n = (entry.size || 32) * (entry.size || 32);
  var out = new Array(n);
  for (var i = 0; i < n; i++) out[i] = entry.grid.charAt(i) === "1";
  return out;
};
