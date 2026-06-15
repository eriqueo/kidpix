// Zoom In mixer effect.
//
// Manual: "Zooms in on a portion of your drawing, making it several times larger. Click
// repeatedly to zoom in closer and closer." This is a true geometric magnification (not
// the zoom-*blur* glfx effect). We zoom around the point you click, and dragging farther
// zooms in closer — the new-engine equivalent of "click repeatedly to zoom closer".
KiddoPaint.Tools.Toolbox.MixerZoomIn = function () {
  var tool = this;
  this.isDown = false;
  this.initialClick = null;
  this.sourceCanvas = null; // the picture as it was when the zoom started
  this.maxZoom = 8; // a few "clicks" worth of zooming in

  this.mousedown = function (ev) {
    tool.isDown = true;
    tool.initialClick = ev;
    KiddoPaint.Display.canvas.classList = "";
    KiddoPaint.Display.canvas.classList.add("cursor-guy-wow");
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

    // Zoom factor grows with drag distance, from 1x (no drag) up to maxZoom.
    var dragged = distanceBetween(ev, tool.initialClick);
    var factor = 1 + remap(0, 500, 0, tool.maxZoom - 1, clamp(0, 500, dragged));

    // Magnify around the click point: draw the snapshot scaled by `factor`, positioned
    // so the clicked pixel stays put. A source point p maps to dx + p*factor; solving
    // for the click point cx mapping to itself gives dx = cx*(1 - factor).
    var cx = tool.initialClick._x;
    var cy = tool.initialClick._y;
    var ctx = KiddoPaint.Display.context; // tmp layer
    ctx.imageSmoothingEnabled = false; // keep it pixel-crisp like the original
    KiddoPaint.Display.clearTmp();
    ctx.drawImage(
      tool.sourceCanvas,
      cx * (1 - factor),
      cy * (1 - factor),
      w * factor,
      h * factor,
    );

    KiddoPaint.Sounds.mixerwallpaper();
  };

  this.mouseup = function (ev) {
    if (!tool.isDown) return;
    tool.isDown = false;
    KiddoPaint.Display.canvas.classList = "";
    KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");

    // The zoomed image fully covers the canvas, but bake by replace (clear then stamp)
    // so nothing of the un-zoomed original can linger underneath.
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
KiddoPaint.Tools.MixerZoomIn = new KiddoPaint.Tools.Toolbox.MixerZoomIn();
