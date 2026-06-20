// P5 — Modal UI + Edit Stamp toolbar control.
//
// Opens an overlay containing the canvas-backed pixel grid and a toolbar
// (palette / erase / mirror-H / mirror-V / rotate / clear / undo / save /
// close). On open: seed the grid from any existing override for the current
// stamp; on save: write back via StampEditor.Overrides.setFromGrid so the
// main canvas Stamp tool will render the edit.

(function (root) {
  if (!root.document) return; // jsdom-test-safe; nothing to wire in node

  var KP = root.KiddoPaint || (root.KiddoPaint = {});
  var SE = KP.StampEditor || (KP.StampEditor = {});
  var CELL_PX = 12;
  var DEFAULT_SIZE = 32;

  var state = null;

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function activePalette() {
    try {
      var pal =
        KP.Colors &&
        KP.Colors.Current &&
        KP.Colors.Current.Palette;
      if (Array.isArray(pal) && pal.length) return pal.slice();
    } catch (e) {}
    return [
      "rgb(0,0,0)",
      "rgb(255,255,255)",
      "rgb(255,0,0)",
      "rgb(255,255,0)",
      "rgb(0,255,0)",
      "rgb(0,0,255)",
    ];
  }

  function paintGridToScreen() {
    var ctx = state.gridCtx;
    var g = state.grid;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, state.canvas.width, state.canvas.height);
    for (var y = 0; y < g.height; y++) {
      for (var x = 0; x < g.width; x++) {
        var c = g.pixels[y][x];
        if (c == null) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
      }
    }
    // gridlines
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i <= g.width; i++) {
      ctx.moveTo(i * CELL_PX + 0.5, 0);
      ctx.lineTo(i * CELL_PX + 0.5, g.height * CELL_PX);
    }
    for (var j = 0; j <= g.height; j++) {
      ctx.moveTo(0, j * CELL_PX + 0.5);
      ctx.lineTo(g.width * CELL_PX, j * CELL_PX + 0.5);
    }
    ctx.stroke();
  }

  function eventCell(ev) {
    var rect = state.canvas.getBoundingClientRect();
    var scaleX = state.canvas.width / rect.width;
    var scaleY = state.canvas.height / rect.height;
    var px = (ev.clientX - rect.left) * scaleX;
    var py = (ev.clientY - rect.top) * scaleY;
    return {
      x: clamp(Math.floor(px / CELL_PX), 0, state.grid.width - 1),
      y: clamp(Math.floor(py / CELL_PX), 0, state.grid.height - 1),
    };
  }

  function onPointerDown(ev) {
    ev.preventDefault();
    state.isDrawing = true;
    state.grid.beginStroke();
    var c = eventCell(ev);
    state.grid.paint(c.x, c.y);
    paintGridToScreen();
  }

  function onPointerMove(ev) {
    if (!state.isDrawing) return;
    ev.preventDefault();
    var c = eventCell(ev);
    state.grid.paint(c.x, c.y);
    paintGridToScreen();
  }

  function onPointerUp() {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    state.grid.endStroke();
  }

  function selectSwatch(color, btnNode) {
    state.grid.currentColor = color;
    state.grid.eraseMode = false;
    if (state.activeSwatch) state.activeSwatch.classList.remove("active");
    btnNode.classList.add("active");
    state.activeSwatch = btnNode;
  }

  function selectErase(btnNode) {
    state.grid.eraseMode = true;
    if (state.activeSwatch) state.activeSwatch.classList.remove("active");
    btnNode.classList.add("active");
    state.activeSwatch = btnNode;
  }

  function build(stampKey) {
    var doc = root.document;

    var overlay = doc.createElement("div");
    overlay.id = "stamp-editor-overlay";
    overlay.setAttribute("data-kpfid", "09-edit-stamp-editor");
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.55);" +
      "display:flex;align-items:center;justify-content:center;z-index:9999;";

    var modal = doc.createElement("div");
    modal.id = "stamp-editor-modal";
    modal.style.cssText =
      "background:#cdcdcd;border:2px solid #333;padding:12px;" +
      "font-family:sans-serif;color:#111;box-shadow:0 4px 16px rgba(0,0,0,.5);";

    var title = doc.createElement("div");
    title.textContent = "Edit Stamp — " + (stampKey || "");
    title.style.cssText = "font-weight:bold;margin-bottom:8px;";
    modal.appendChild(title);

    var canvas = doc.createElement("canvas");
    canvas.width = DEFAULT_SIZE * CELL_PX;
    canvas.height = DEFAULT_SIZE * CELL_PX;
    canvas.style.cssText =
      "image-rendering:pixelated;display:block;background:#fff;border:1px solid #333;cursor:crosshair;";
    modal.appendChild(canvas);

    var bar = doc.createElement("div");
    bar.style.cssText = "margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;";

    // palette swatches
    var palette = activePalette();
    var swatchWrap = doc.createElement("div");
    swatchWrap.style.cssText = "display:flex;flex-wrap:wrap;gap:2px;margin-right:8px;";
    palette.forEach(function (color) {
      var sw = doc.createElement("button");
      sw.type = "button";
      sw.title = color;
      sw.style.cssText =
        "width:20px;height:20px;background:" +
        color +
        ";border:1px solid #333;padding:0;cursor:pointer;";
      sw.addEventListener("click", function () {
        selectSwatch(color, sw);
      });
      swatchWrap.appendChild(sw);
      if (!state || !state.activeSwatch) {
        // pick the first as default
        state && selectSwatch(color, sw);
      }
    });
    bar.appendChild(swatchWrap);

    function toolBtn(label, title, onClick) {
      var b = doc.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.title = title;
      b.style.cssText =
        "padding:4px 8px;background:#eee;border:1px solid #333;cursor:pointer;";
      b.addEventListener("click", onClick);
      bar.appendChild(b);
      return b;
    }

    var eraseBtn = toolBtn("Erase", "Erase (transparent)", function () {
      selectErase(eraseBtn);
    });

    toolBtn("⇋ H", "Mirror horizontal", function () {
      state.grid.beginStroke();
      SE.Transforms.mirrorH(state.grid);
      state.grid.endStroke();
      paintGridToScreen();
    });
    toolBtn("⇵ V", "Mirror vertical", function () {
      state.grid.beginStroke();
      SE.Transforms.mirrorV(state.grid);
      state.grid.endStroke();
      paintGridToScreen();
    });
    toolBtn("↻", "Rotate 90° CW", function () {
      if (state.grid.width !== state.grid.height) return;
      state.grid.beginStroke();
      SE.Transforms.rotateCW(state.grid);
      state.grid.endStroke();
      paintGridToScreen();
    });
    toolBtn("Clear", "Clear", function () {
      state.grid.beginStroke();
      SE.Transforms.clear(state.grid);
      state.grid.endStroke();
      paintGridToScreen();
    });
    toolBtn("Undo", "Undo last stroke", function () {
      state.grid.undoLastStroke();
      paintGridToScreen();
    });

    var spacer = doc.createElement("div");
    spacer.style.cssText = "flex:1;";
    bar.appendChild(spacer);

    toolBtn("Save", "Save stamp", function () {
      SE.Overrides.setFromGrid(state.stampKey, state.grid);
      close();
    });
    toolBtn("Cancel", "Cancel", function () {
      close();
    });

    modal.appendChild(bar);
    overlay.appendChild(modal);

    // event handlers scoped to the modal canvas, not the global doc
    canvas.addEventListener("mousedown", onPointerDown);
    canvas.addEventListener("mousemove", onPointerMove);
    root.addEventListener("mouseup", onPointerUp);
    canvas.addEventListener("touchstart", function (ev) {
      if (ev.touches.length)
        onPointerDown({
          clientX: ev.touches[0].clientX,
          clientY: ev.touches[0].clientY,
          preventDefault: function () {
            ev.preventDefault();
          },
        });
    });
    canvas.addEventListener("touchmove", function (ev) {
      if (ev.touches.length)
        onPointerMove({
          clientX: ev.touches[0].clientX,
          clientY: ev.touches[0].clientY,
          preventDefault: function () {
            ev.preventDefault();
          },
        });
    });
    canvas.addEventListener("touchend", onPointerUp);

    return { overlay: overlay, modal: modal, canvas: canvas, eraseBtn: eraseBtn };
  }

  function open(stampKey) {
    if (state) close();
    var key = stampKey || (KP.Tools && KP.Tools.Stamp && KP.Tools.Stamp.stamp);
    if (!key) return;

    var built = build(key);
    var grid = SE.Overrides.gridForKey(key, DEFAULT_SIZE);
    // Default currentColor from the global picker if available.
    if (KP.Current && KP.Current.color) grid.currentColor = KP.Current.color;

    state = {
      stampKey: key,
      overlay: built.overlay,
      canvas: built.canvas,
      gridCtx: built.canvas.getContext("2d"),
      grid: grid,
      isDrawing: false,
      activeSwatch: null,
      previousTool: KP.Current && KP.Current.tool,
    };

    // Visually mark the first swatch as active
    var firstSwatch = built.modal.querySelector("button[title^='rgb']");
    if (firstSwatch) selectSwatch(grid.currentColor, firstSwatch);

    root.document.body.appendChild(built.overlay);
    paintGridToScreen();
  }

  function close() {
    if (!state) return;
    if (state.overlay && state.overlay.parentNode) {
      state.overlay.parentNode.removeChild(state.overlay);
    }
    // Restore prior tool so the main paint flow isn't left in an odd mode.
    if (state.previousTool && KP.Current) {
      KP.Current.tool = state.previousTool;
    }
    root.removeEventListener("mouseup", onPointerUp);
    state = null;
  }

  SE.Modal = {
    open: open,
    close: close,
    _state: function () {
      return state;
    },
  };

  // Wire the Edit Stamp control. Inject a button into the sprites submenu the
  // first time the stamp tool is selected, and any time the submenu is rebuilt.
  function ensureEditStampButton() {
    var doc = root.document;
    var menu = doc.getElementById("genericsubmenu");
    if (!menu) return;
    if (doc.getElementById("editstamp")) return;
    var btn = doc.createElement("button");
    btn.id = "editstamp";
    btn.className = "tool";
    btn.title = "Edit Stamp";
    btn.textContent = "✎";
    btn.style.cssText =
      "font-size:24px;line-height:1;padding:8px;min-width:48px;min-height:48px;";
    btn.addEventListener("click", function () {
      open();
    });
    menu.appendChild(btn);
  }

  function attach() {
    var doc = root.document;
    var stampBtn = doc.getElementById("stamp");
    if (stampBtn) {
      stampBtn.addEventListener("mousedown", function () {
        // Defer so init code that rebuilds the submenu runs first.
        setTimeout(ensureEditStampButton, 0);
      });
    }
    // Also expose a manual hook in case other init paths show the submenu.
    SE.Modal.ensureEditStampButton = ensureEditStampButton;
  }

  if (root.document.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", attach);
  } else {
    attach();
  }
})(typeof window !== "undefined" ? window : globalThis);
