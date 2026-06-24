// Edit Stamp goodie — modal pixel editor UI.
// Pure DOM glue around KiddoPaint.Stamps.Editor (see editor.js).
// Opens with a stamp loaded as base; user toggles cells / rotates / flips /
// clears / restores; Save writes the grid into the override layer
// (localStorage), Cancel discards.

(function (root) {
  if (typeof document === "undefined") return;
  var KP = root.KiddoPaint || (root.KiddoPaint = {});
  var Stamps = KP.Stamps || (KP.Stamps = {});

  var MODAL_ID = "edit-stamp-modal";
  var CELL_PX = 16; // 32 cells × 16px = 512px editor surface

  function ensureStyles() {
    if (document.getElementById("edit-stamp-styles")) return;
    var link = document.createElement("link");
    link.id = "edit-stamp-styles";
    link.rel = "stylesheet";
    link.href = "/css/edit-stamp.css";
    document.head.appendChild(link);
  }

  function makeButton(label, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = "edit-stamp-btn";
    btn.addEventListener("click", onClick);
    return btn;
  }

  function buildModal(session) {
    var overlay = document.createElement("div");
    overlay.id = MODAL_ID;
    overlay.className = "edit-stamp-overlay";

    var content = document.createElement("div");
    content.className = "edit-stamp-content";
    overlay.appendChild(content);

    var header = document.createElement("div");
    header.className = "edit-stamp-header";
    header.textContent = "Edit Stamp";
    content.appendChild(header);

    var meta = document.createElement("div");
    meta.className = "edit-stamp-meta";
    meta.id = "edit-stamp-meta";
    meta.textContent = session.label || "";
    content.appendChild(meta);

    var gridWrap = document.createElement("div");
    gridWrap.className = "edit-stamp-grid";
    gridWrap.id = "edit-stamp-grid";
    gridWrap.style.gridTemplateColumns = "repeat(32, " + CELL_PX + "px)";
    gridWrap.style.gridTemplateRows = "repeat(32, " + CELL_PX + "px)";
    content.appendChild(gridWrap);

    var cells = new Array(32 * 32);
    for (var y = 0; y < 32; y++) {
      for (var x = 0; x < 32; x++) {
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "edit-stamp-cell";
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        gridWrap.appendChild(cell);
        cells[y * 32 + x] = cell;
      }
    }

    function refreshGrid() {
      for (var i = 0; i < cells.length; i++) {
        cells[i].classList.toggle("on", !!session.state.grid[i]);
      }
    }

    gridWrap.addEventListener("click", function (ev) {
      var target = ev.target;
      if (!target || !target.classList.contains("edit-stamp-cell")) return;
      var x = parseInt(target.dataset.x, 10);
      var y = parseInt(target.dataset.y, 10);
      session.state.togglePixel(x, y);
      refreshGrid();
    });

    var toolRow = document.createElement("div");
    toolRow.className = "edit-stamp-toolrow";
    toolRow.appendChild(
      makeButton("Rotate ↻", function () {
        session.state.rotateRight();
        refreshGrid();
      }),
    );
    toolRow.appendChild(
      makeButton("Flip H", function () {
        session.state.flipH();
        refreshGrid();
      }),
    );
    toolRow.appendChild(
      makeButton("Flip V", function () {
        session.state.flipV();
        refreshGrid();
      }),
    );
    toolRow.appendChild(
      makeButton("Clear", function () {
        session.state.clear();
        refreshGrid();
      }),
    );
    toolRow.appendChild(
      makeButton("Restore Original", function () {
        session.state.restoreOriginal(session.original);
        refreshGrid();
      }),
    );
    content.appendChild(toolRow);

    var actionRow = document.createElement("div");
    actionRow.className = "edit-stamp-actionrow";
    var saveBtn = makeButton("Save to set", function () {
      Stamps.setOverride(session.id, session.state.grid);
      closeModal();
    });
    saveBtn.id = "edit-stamp-save";
    saveBtn.classList.add("edit-stamp-save");
    var cancelBtn = makeButton("Cancel", function () {
      closeModal();
    });
    cancelBtn.id = "edit-stamp-cancel";
    actionRow.appendChild(saveBtn);
    actionRow.appendChild(cancelBtn);
    content.appendChild(actionRow);

    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) closeModal();
    });

    refreshGrid();
    return overlay;
  }

  function closeModal() {
    var ex = document.getElementById(MODAL_ID);
    if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
  }

  // Read a sprite's original pixels from a loaded sheet Image (synchronously)
  // and convert to a boolean grid. The sheet must be fully loaded.
  function originalGridFromImage(img, row, col) {
    if (!img || !img.complete) return null;
    try {
      var c = document.createElement("canvas");
      c.width = 32;
      c.height = 32;
      var cx = c.getContext("2d");
      cx.imageSmoothingEnabled = false;
      cx.drawImage(img, col * 32, row * 32, 32, 32, 0, 0, 32, 32);
      var data = cx.getImageData(0, 0, 32, 32);
      return Stamps.Editor.imageDataToGrid(data, 32);
    } catch (e) {
      return null;
    }
  }

  // Public API: open the editor for a given sprite location.
  //   sheetFilename: e.g. "kidpix-spritesheet-0.png" (basename only)
  //   sheetUrl: image URL to load if the original is needed
  //   row, col: 0-indexed sprite position in the sheet
  Stamps.openEditor = function (opts) {
    ensureStyles();
    closeModal();

    opts = opts || {};
    var sheetFilename = opts.sheetFilename || "kidpix-spritesheet-0.png";
    var sheetUrl = opts.sheetUrl || ("img/stamp/" + sheetFilename);
    var row = opts.row | 0;
    var col = opts.col | 0;
    var id = Stamps.stampOverrideId(sheetFilename, row, col);

    var state = new Stamps.Editor.EditorState(32);
    var original = Stamps.Editor.makeBlankGrid(32);

    var existing = Stamps.getOverride(id);
    if (existing) {
      var decoded = Stamps.decodeOverrideGrid(existing);
      if (decoded) state.restoreOriginal(decoded);
    }

    var label =
      sheetFilename + " — row " + (row + 1) + ", col " + (col + 1);
    var session = {
      id: id,
      sheetFilename: sheetFilename,
      sheetUrl: sheetUrl,
      row: row,
      col: col,
      state: state,
      original: original,
      label: label,
    };

    var overlay = buildModal(session);
    document.body.appendChild(overlay);

    // Asynchronously fetch the original sheet so "Restore Original" works.
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      var grid = originalGridFromImage(img, row, col);
      if (grid) {
        session.original = grid;
        // If the editor opened with a blank slate AND there is no override,
        // seed from the original on load.
        if (!existing) {
          state.restoreOriginal(grid);
          // refresh the UI manually
          var cells = overlay.querySelectorAll(".edit-stamp-cell");
          for (var i = 0; i < cells.length; i++) {
            cells[i].classList.toggle("on", !!state.grid[i]);
          }
        }
      }
    };
    img.src = sheetUrl;

    return session;
  };

  Stamps.closeEditor = closeModal;
})(typeof window !== "undefined" ? window : globalThis);
