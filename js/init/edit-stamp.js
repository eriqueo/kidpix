// Edit Stamp goodie — wiring.
// 1. Wraps window.extractSprite so the override layer is consulted before the
//    PNG spritesheet is read.
// 2. Adds a "Goodies > Edit Stamp" entry point: a floating button that opens
//    the editor for the most-recently-picked sprite (or sheet 0 / row 0 /
//    col 0 by default).

(function (root) {
  if (typeof window === "undefined") return;
  var KP = root.KiddoPaint || (root.KiddoPaint = {});
  var Stamps = KP.Stamps || (KP.Stamps = {});
  var Sprite = KP.Sprite || (KP.Sprite = {});

  Sprite.lastPicked = Sprite.lastPicked || null;

  function basename(url) {
    if (!url) return "";
    try {
      return String(url).split("?")[0].split("#")[0].split("/").pop();
    } catch (e) {
      return "";
    }
  }

  function buildOverrideCanvas(entry, size) {
    var grid = Stamps.decodeOverrideGrid(entry);
    if (!grid) return null;
    return Stamps.Editor.gridToCanvas(grid, entry.size || 32, 1);
  }

  // Wrap extractSprite. The wrapper consults the override map first; if there
  // is a matching entry it returns a synthetic 32×32 canvas, otherwise it
  // delegates to the original implementation so the PNG is untouched.
  function installExtractSpriteWrapper() {
    var orig = window.extractSprite;
    if (!orig || orig.__editStampWrapped) return;
    var wrapped = function (img, size, col, row, offset) {
      try {
        var src = img && img.src ? img.src : "";
        var filename = basename(src);
        // Remember the most recently-extracted sprite so the Edit Stamp button
        // can target it.
        Sprite.lastPicked = {
          sheetFilename: filename,
          sheetUrl: src,
          row: row,
          col: col,
        };
        var id = Stamps.stampOverrideId(filename, row, col);
        var entry = Stamps.getOverride(id);
        if (entry) {
          var c = buildOverrideCanvas(entry, size);
          if (c) return c;
        }
      } catch (e) {}
      return orig(img, size, col, row, offset);
    };
    wrapped.__editStampWrapped = true;
    window.extractSprite = wrapped;
  }

  function defaultEditorTarget() {
    if (Sprite.lastPicked && Sprite.lastPicked.sheetFilename) {
      return Sprite.lastPicked;
    }
    var firstSheet =
      (Sprite.sheets && Sprite.sheets[0]) || "img/stamp/kidpix-spritesheet-0.png";
    return {
      sheetFilename: basename(firstSheet),
      sheetUrl: firstSheet,
      row: 0,
      col: 0,
    };
  }

  function installLauncherButton() {
    if (document.getElementById("edit-stamp-launch")) return;
    var btn = document.createElement("button");
    btn.id = "edit-stamp-launch";
    btn.type = "button";
    btn.title = "Goodies > Edit Stamp";
    btn.textContent = "✏️ Edit Stamp";
    btn.className = "edit-stamp-launch-btn";
    btn.addEventListener("click", function () {
      var t = defaultEditorTarget();
      Stamps.openEditor(t);
    });
    // Slot it into the status bar if available; otherwise append to body.
    var status = document.getElementById("statusbar");
    if (status) status.appendChild(btn);
    else document.body.appendChild(btn);
  }

  function init() {
    installExtractSpriteWrapper();
    installLauncherButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // Defer to next tick so utils.js has registered window.extractSprite.
    setTimeout(init, 0);
  }
})(typeof window !== "undefined" ? window : globalThis);
