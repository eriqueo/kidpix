/**
 * ColorMe — coloring-book paint-bucket tool.
 *
 * A coloring page is loaded straight onto the MAIN canvas (exactly like the
 * "Open Pic" import does), so it is a real, persistent part of the drawing:
 * it survives the mouse leaving the canvas, survives reloads (main is saved to
 * localStorage), can be drawn on with any other tool, and is undoable. The
 * paint-bucket then flood-fills regions directly on main, bounded by the page's
 * dark line art.
 *
 * (Earlier this loaded onto the transient bnimCanvas scratch layer, which the
 * canvas mouseleave handler wipes — that's why the page kept disappearing.)
 *
 * The flood-fill primitive lives in core/colorme/flood-fill.ts and is wired
 * onto KiddoPaint.ColorMe by src/colorme-init.ts before this tool is used.
 */
KiddoPaint.Tools.Toolbox.ColorMe = function () {
  // Load a coloring page onto the main canvas (white paper + the page art,
  // letterbox-centered to preserve aspect). One undoable action, then persist —
  // mirrors KiddoPaint.ImageImport._placeOnMain so ColorMe pages behave just
  // like an opened picture.
  this.loadPage = function (pageMeta, onLoaded) {
    var img = new Image();
    img.onload = function () {
      var display = KiddoPaint.Display;
      var cw = display.main_canvas.width;
      var ch = display.main_canvas.height;

      // Fit-letterbox onto an opaque white page.
      var scale = Math.min(cw / img.width, ch / img.height);
      var dw = Math.round(img.width * scale);
      var dh = Math.round(img.height * scale);
      var dx = Math.round((cw - dw) / 2);
      var dy = Math.round((ch - dh) / 2);

      var staging = document.createElement("canvas");
      staging.width = cw;
      staging.height = ch;
      var sctx = staging.getContext("2d");
      // Nearest-neighbor so the black line art stays crisp (no gray anti-alias
      // edges, which would weaken the flood-fill boundaries).
      sctx.imageSmoothingEnabled = false;
      sctx.fillStyle = "#ffffff";
      sctx.fillRect(0, 0, cw, ch);
      sctx.drawImage(img, dx, dy, dw, dh);

      // Single undoable action: snapshot pre-load main, then composite the page.
      if (display.saveUndo()) {
        display.main_context.drawImage(staging, 0, 0);
        if (display.clearTmp) display.clearTmp();
        if (display.saveToLocalStorage) display.saveToLocalStorage();
      }

      KiddoPaint.ColorMe.currentPage = pageMeta;
      if (onLoaded) onLoaded();
    };
    img.src = pageMeta.url;
  };

  // Paint-bucket: flood-fill the region under the cursor on the main canvas,
  // bounded by the page's dark lines (which live on main itself now).
  this.mousedown = function (ev) {
    var w = KiddoPaint.Display.main_canvas.width;
    var h = KiddoPaint.Display.main_canvas.height;
    var x = ev._x;
    var y = ev._y;

    KiddoPaint.Sounds.paintcan();

    var color = color2json(KiddoPaint.Current.color);
    var fillColor = {
      r: color.r,
      g: color.g,
      b: color.b,
      a: color.a == null ? 255 : color.a,
    };

    // Snapshot main, fill a working copy, then write back only the pixels that
    // changed (so unchanged regions stay untouched in the tmp->main composite).
    var before = KiddoPaint.Display.main_context.getImageData(0, 0, w, h);
    var work = KiddoPaint.Display.main_context.getImageData(0, 0, w, h);

    var result = KiddoPaint.ColorMe.floodFill(work.data, w, h, x, y, fillColor);
    if (!result) return; // seed sat on a line / out of bounds — no-op

    var bd = before.data;
    var cd = work.data;
    var out = new ImageData(w, h);
    var od = out.data;
    for (var i = 0; i < cd.length; i += 4) {
      if (
        cd[i] !== bd[i] ||
        cd[i + 1] !== bd[i + 1] ||
        cd[i + 2] !== bd[i + 2] ||
        cd[i + 3] !== bd[i + 3]
      ) {
        od[i] = cd[i];
        od[i + 1] = cd[i + 1];
        od[i + 2] = cd[i + 2];
        od[i + 3] = cd[i + 3];
      }
    }

    // Stage the diff on tmp, then composite onto main via the standard saveMain
    // pipeline (handles the undo snapshot + persistence like every other tool).
    KiddoPaint.Display.context.clearRect(0, 0, w, h);
    KiddoPaint.Display.context.putImageData(out, 0, 0);
    KiddoPaint.Display.saveMain();
  };

  this.mousemove = function () {};
  this.mouseup = function () {};
};
KiddoPaint.Tools.ColorMe = new KiddoPaint.Tools.Toolbox.ColorMe();
