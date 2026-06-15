// Wrap Around mixer effect.
//
// Dragging slides the whole picture around the canvas; whatever falls off one edge
// reappears on the opposite edge (toroidal / "wrap around" scroll). Unlike the
// glfx-backed effects this has no WebGL primitive, so it's a small ImageData tool
// built on the standard mixer pattern (snapshot on mousedown, preview on tmp during
// mousemove, commit to main on mouseup).
KiddoPaint.Tools.Toolbox.MixerWrapAround = function () {
  var tool = this;
  this.isDown = false;
  this.initialClick = null;
  this.sourceCanvas = null; // the picture as it was when the drag started

  this.mousedown = function (ev) {
    tool.isDown = true;
    tool.initialClick = ev;
    KiddoPaint.Display.canvas.classList = "";
    KiddoPaint.Display.canvas.classList.add("cursor-guy-wow");
    // Snapshot the current artwork once; we slide this fixed snapshot around so the
    // wrap stays stable while dragging instead of smearing previous frames.
    var snapshot = KiddoPaint.Display.main_context.getImageData(
      0,
      0,
      KiddoPaint.Display.main_canvas.width,
      KiddoPaint.Display.main_canvas.height,
    );
    tool.sourceCanvas = KiddoPaint.Display.imageTypeToCanvas(snapshot, false);
    KiddoPaint.Display.saveUndo();
    tool.mousemove(ev);
  };

  this.mousemove = function (ev) {
    if (!tool.isDown) return;

    var w = KiddoPaint.Display.main_canvas.width;
    var h = KiddoPaint.Display.main_canvas.height;

    // Drag delta, wrapped into [0, w) / [0, h). Double-modulo keeps it positive for
    // leftward/upward drags. Rounded so we copy whole pixels (no blurry subpixel draw).
    var dx = (((Math.round(ev._x - tool.initialClick._x) % w) + w) % w) | 0;
    var dy = (((Math.round(ev._y - tool.initialClick._y) % h) + h) % h) | 0;

    // Draw the snapshot as a 2x2 tile grid so the wrapped portions fill the canvas:
    // the main copy at (dx,dy) plus the three neighbours that cover the exposed edges.
    var ctx = KiddoPaint.Display.context; // tmp layer
    KiddoPaint.Display.clearTmp();
    ctx.drawImage(tool.sourceCanvas, dx, dy);
    ctx.drawImage(tool.sourceCanvas, dx - w, dy);
    ctx.drawImage(tool.sourceCanvas, dx, dy - h);
    ctx.drawImage(tool.sourceCanvas, dx - w, dy - h);

    KiddoPaint.Sounds.mixerwallpaper();
  };

  this.mouseup = function (ev) {
    if (!tool.isDown) return;
    tool.isDown = false;
    KiddoPaint.Display.canvas.classList = "";
    KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");

    // Commit: the wrapped result must REPLACE the original (saveMainSkipUndo only draws
    // tmp *over* main, which would leave the un-shifted original showing through any
    // transparent pixels). Clear main first, then stamp the tmp preview down.
    KiddoPaint.Display.main_context.clearRect(
      0,
      0,
      KiddoPaint.Display.main_canvas.width,
      KiddoPaint.Display.main_canvas.height,
    );
    KiddoPaint.Display.main_context.drawImage(KiddoPaint.Display.canvas, 0, 0);
    KiddoPaint.Display.clearTmp();
    KiddoPaint.Display.saveToLocalStorage();

    tool.sourceCanvas = null;
    tool.initialClick = null;
  };
};
KiddoPaint.Tools.MixerWrapAround =
  new KiddoPaint.Tools.Toolbox.MixerWrapAround();
