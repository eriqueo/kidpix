// Splash! mixer effect.
//
// Manual: "Big blobs of paint are splashed on your drawing. The longer you hold the mouse
// button down, the more blobs appear." That hold-to-accumulate behavior is the defining
// trait, so this uses the timer idiom (like the Count Down eraser) rather than the
// drag-distance idiom: while the button is held, a timer keeps splashing fresh multicolor
// blobs onto an off-screen accumulator that is composited over the picture each tick.
//
// The picture is preserved — blobs are added on top. Undo is paused across the splash so
// the whole burst collapses to a single undo step.
KiddoPaint.Tools.Toolbox.MixerSplash = function () {
  var tool = this;
  this.isDown = false;
  this.intervalID = null;
  this.splatCanvas = null;
  this.splatCtx = null;
  this.blobCount = 0;

  this.TICK_MS = 130;
  this.MAX_BLOBS = 400; // cap so a long hold can't run away

  this.mousedown = function (ev) {
    tool.isDown = true;
    tool.blobCount = 0;
    KiddoPaint.Display.canvas.classList = "";
    KiddoPaint.Display.canvas.classList.add("cursor-guy-wow");

    var w = KiddoPaint.Display.main_canvas.width;
    var h = KiddoPaint.Display.main_canvas.height;
    tool.splatCanvas = document.createElement("canvas");
    tool.splatCanvas.width = w;
    tool.splatCanvas.height = h;
    tool.splatCtx = tool.splatCanvas.getContext("2d");

    KiddoPaint.Display.saveUndo();
    KiddoPaint.Display.pauseUndo();

    tool.intervalID = setInterval(tool.tick, tool.TICK_MS);
    tool.tick(); // splash immediately on press
  };

  this.mousemove = function (ev) {};

  this.tick = function () {
    if (!tool.isDown) return;
    var w = KiddoPaint.Display.main_canvas.width;
    var h = KiddoPaint.Display.main_canvas.height;

    // A few big blobs per tick, each a random vivid color at a random spot.
    var perTick = 2 + Math.floor(getRandomFloat(0, 2)); // 2-3
    for (var i = 0; i < perTick && tool.blobCount < tool.MAX_BLOBS; i++) {
      tool.drawBlob(
        tool.splatCtx,
        getRandomFloat(0, w),
        getRandomFloat(0, h),
        KiddoPaint.Colors.randomAllColor(),
      );
      tool.blobCount++;
    }

    // Show the accumulated splatter over the picture (preview sits above main).
    KiddoPaint.Display.clearPreview();
    KiddoPaint.Display.previewContext.drawImage(tool.splatCanvas, 0, 0);

    KiddoPaint.Sounds.mixersplash();
  };

  // One irregular paint blob: a fat central splat plus a few satellite droplets, so it
  // reads as thrown paint rather than a clean circle.
  this.drawBlob = function (ctx, cx, cy, color) {
    var r = getRandomFloat(14, 34);
    ctx.fillStyle = color;

    // Central blob as a jittered radial polygon.
    var pts = 9;
    ctx.beginPath();
    for (var i = 0; i <= pts; i++) {
      var a = (i / pts) * Math.PI * 2;
      var rr = r * getRandomFloat(0.7, 1.15);
      var px = cx + Math.cos(a) * rr;
      var py = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Satellite droplets flung around the main blob.
    var drops = 3 + Math.floor(getRandomFloat(0, 4));
    for (var d = 0; d < drops; d++) {
      var da = getRandomFloat(0, Math.PI * 2);
      var dist = getRandomFloat(r, r * 2.2);
      var dr = getRandomFloat(2, r * 0.35);
      ctx.beginPath();
      ctx.arc(cx + Math.cos(da) * dist, cy + Math.sin(da) * dist, dr, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  this.mouseup = function (ev) {
    if (!tool.isDown) return;
    tool.isDown = false;
    if (tool.intervalID) {
      clearInterval(tool.intervalID);
      tool.intervalID = null;
    }
    KiddoPaint.Display.canvas.classList = "";
    KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");

    // Bake the splatter additively onto the picture (the picture is kept underneath).
    KiddoPaint.Display.main_context.drawImage(tool.splatCanvas, 0, 0);
    KiddoPaint.Display.clearPreview();
    KiddoPaint.Display.saveToLocalStorage();
    KiddoPaint.Display.resumeUndo();

    tool.splatCanvas = null;
    tool.splatCtx = null;
  };
};
KiddoPaint.Tools.MixerSplash = new KiddoPaint.Tools.Toolbox.MixerSplash();
