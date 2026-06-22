/**
 * ColorMe — coloring-book paint-bucket tool.
 *
 * Loads a black-on-white line-art page as a locked background (drawn on
 * bnimCanvas), then on click runs the bounded flood-fill primitive against
 * the composite of main + line-art, writing only the new fill onto main_canvas.
 *
 * The flood-fill primitive lives in core/colorme/flood-fill.ts and is wired
 * onto KiddoPaint.ColorMe by src/colorme-init.ts before this tool is used.
 */
KiddoPaint.Tools.Toolbox.ColorMe = function () {
  var tool = this;

  // Pre-allocated cache of the line-art page's pixel buffer (filled on page load).
  this.lineArtData = null;

  // Promise-style page loader. Draws the PNG into bnimCanvas and snapshots its pixels
  // so flood-fill doesn't have to re-read the canvas on every click.
  this.loadPage = function (pageMeta, onLoaded) {
    var img = new Image();
    img.onload = function () {
      var bnim = KiddoPaint.Display.bnimCanvas;
      var ctx = KiddoPaint.Display.bnimContext;
      ctx.clearRect(0, 0, bnim.width, bnim.height);
      // Center the page; scale down only if it overflows.
      var sx = Math.min(1, bnim.width / img.width);
      var sy = Math.min(1, bnim.height / img.height);
      var s = Math.min(sx, sy);
      var dw = Math.round(img.width * s);
      var dh = Math.round(img.height * s);
      var dx = Math.floor((bnim.width - dw) / 2);
      var dy = Math.floor((bnim.height - dh) / 2);
      // White-out the bnim layer first so the page sits on a clean background.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, bnim.width, bnim.height);
      ctx.drawImage(img, dx, dy, dw, dh);
      tool.lineArtData = ctx.getImageData(0, 0, bnim.width, bnim.height);
      KiddoPaint.ColorMe.currentPage = pageMeta;
      // Remember the page so a reload restores it instead of reverting to the
      // first bundled page. (Page art lives on bnim, which isn't persisted, so
      // the page id is the thing we need to carry across sessions.)
      try {
        localStorage.setItem("kiddopaint_colorme_current", pageMeta.file);
      } catch (e) {}
      if (onLoaded) onLoaded();
    };
    img.src = pageMeta.url;
  };

  // Compose a fill-target buffer: start from main_canvas, then overlay the line-art's
  // dark pixels so flood-fill treats them as outlines. Returns the ImageData (mutable).
  this.composeFillBuffer = function () {
    var w = KiddoPaint.Display.main_canvas.width;
    var h = KiddoPaint.Display.main_canvas.height;
    var mainData = KiddoPaint.Display.main_context.getImageData(0, 0, w, h);
    var line = tool.lineArtData;
    if (!line) return mainData;
    var md = mainData.data;
    var ld = line.data;
    for (var i = 0; i < md.length; i += 4) {
      // If the main canvas is fully transparent here, paint the line-art's
      // background (white) underneath so the flood-fill seed sees a fillable
      // pixel rather than alpha=0 transparent.
      if (md[i + 3] === 0) {
        md[i] = ld[i];
        md[i + 1] = ld[i + 1];
        md[i + 2] = ld[i + 2];
        md[i + 3] = ld[i + 3] || 255;
      } else {
        // Otherwise, if a line-art pixel is dark, force it to black so the
        // flood-fill cannot cross it. (Already-painted regions are left alone.)
        var lr = ld[i], lg = ld[i + 1], lb = ld[i + 2];
        // Rec.709 luma
        var lum = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
        if (lum <= 80) {
          md[i] = 0; md[i + 1] = 0; md[i + 2] = 0; md[i + 3] = 255;
        }
      }
    }
    return mainData;
  };

  this.mousedown = function (ev) {
    if (!tool.lineArtData) return; // no page loaded yet
    var x = ev._x;
    var y = ev._y;
    var w = KiddoPaint.Display.main_canvas.width;
    var h = KiddoPaint.Display.main_canvas.height;

    KiddoPaint.Sounds.paintcan();

    var color = color2json(KiddoPaint.Current.color);
    var fillColor = { r: color.r, g: color.g, b: color.b, a: color.a == null ? 255 : color.a };

    // Snapshot main BEFORE we mutate, so we can detect the touched pixels by diff.
    var beforeMain = KiddoPaint.Display.main_context.getImageData(0, 0, w, h);
    var compose = tool.composeFillBuffer();

    var result = KiddoPaint.ColorMe.floodFill(
      compose.data,
      w, h, x, y,
      fillColor,
    );
    if (!result) return;

    // Write back only the pixels that changed (which by construction never
    // include line-art outlines, since flood-fill bounds at them).
    var bd = beforeMain.data;
    var cd = compose.data;
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

    // Stage the diff on tmp (so unchanged regions stay alpha=0), then composite
    // tmp onto main via the standard saveMain pipeline. saveMain handles the
    // undo snapshot and persistence, matching every other tool's contract.
    KiddoPaint.Display.context.clearRect(0, 0, w, h);
    KiddoPaint.Display.context.putImageData(out, 0, 0);
    KiddoPaint.Display.saveMain();
  };

  this.mousemove = function () {};
  this.mouseup = function () {};
};
KiddoPaint.Tools.ColorMe = new KiddoPaint.Tools.Toolbox.ColorMe();
