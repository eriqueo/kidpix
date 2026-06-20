// Snowflakes And Rain Drops mixer effect.
//
// Manual: "Snowflakes fall on your picture. Option melts snowflakes into raindrops."
// The original is animated, but the Mixer engine here is drag-driven, so we scatter
// instead of animate: a fixed pool of flakes is generated when you press down, and the
// drag distance reveals more of them — drag a little for a light dusting, drag far for a
// blizzard. Holding Option swaps the white six-point flakes for slanted blue raindrops.
//
// The picture is preserved: each frame redraws the snapshot and lays the snow on top, so
// baking on mouseup just keeps that composite. One undo step (saveUndo on mousedown).
KiddoPaint.Tools.Toolbox.MixerSnowflakes = function () {
  var tool = this;
  this.isDown = false;
  this.initialClick = null;
  this.sourceCanvas = null;
  this.flakes = null;
  this.isRain = false;
  this.lastShown = 0;

  this.MAX_FLAKES = 600;

  this.mousedown = function (ev) {
    tool.isDown = true;
    tool.initialClick = ev;
    tool.isRain = !!KiddoPaint.Current.modifiedAlt; // Option melts snow into rain
    tool.lastShown = 0;
    KiddoPaint.Display.canvas.classList = "";
    KiddoPaint.Display.canvas.classList.add("cursor-guy-wow");

    var snapshot = KiddoPaint.Display.main_context.getImageData(
      0,
      0,
      KiddoPaint.Display.main_canvas.width,
      KiddoPaint.Display.main_canvas.height,
    );
    tool.sourceCanvas = KiddoPaint.Display.imageTypeToCanvas(snapshot, false);

    tool.buildFlakes();
    KiddoPaint.Display.saveUndo();
    tool.mousemove(ev);
  };

  // Pre-generate the whole flake pool once so positions stay put while you drag (dragging
  // reveals more of them rather than re-randomizing, which would shimmer).
  this.buildFlakes = function () {
    var w = KiddoPaint.Display.main_canvas.width;
    var h = KiddoPaint.Display.main_canvas.height;
    var flakes = [];
    for (var i = 0; i < tool.MAX_FLAKES; i++) {
      flakes.push({
        x: getRandomFloat(0, w),
        y: getRandomFloat(0, h),
        size: getRandomFloat(3, 9),
        rot: getRandomFloat(0, Math.PI),
        slant: getRandomFloat(-0.25, 0.25), // raindrop lean
      });
    }
    tool.flakes = flakes;
  };

  this.mousemove = function (ev) {
    if (!tool.isDown || !tool.flakes) return;

    var w = KiddoPaint.Display.main_canvas.width;
    var h = KiddoPaint.Display.main_canvas.height;
    var dragged = distanceBetween(ev, tool.initialClick);
    // Drag distance -> how many flakes are revealed (light dusting to blizzard).
    var n = Math.round(
      remap(0, 500, 0, tool.MAX_FLAKES, clamp(0, 500, dragged)),
    );

    var ctx = KiddoPaint.Display.context; // tmp layer (occludes main while drawing)
    KiddoPaint.Display.clearTmp();
    ctx.drawImage(tool.sourceCanvas, 0, 0); // picture stays underneath the snow

    for (var i = 0; i < n; i++) {
      var f = tool.flakes[i];
      if (tool.isRain) {
        tool.drawRaindrop(ctx, f);
      } else {
        tool.drawSnowflake(ctx, f);
      }
    }

    // Light, throttled sound as the snow thickens (avoid per-pixel audio spam).
    if (n > tool.lastShown + tool.MAX_FLAKES / 12) {
      tool.lastShown = n;
      KiddoPaint.Sounds.mixersnowflakes();
    }
  };

  // A simple six-point flake: three crossing strokes, soft white.
  this.drawSnowflake = function (ctx, f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = Math.max(1, f.size / 4);
    ctx.lineCap = "round";
    for (var k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(-f.size, 0);
      ctx.lineTo(f.size, 0);
      ctx.stroke();
      ctx.rotate(Math.PI / 3);
    }
    ctx.restore();
  };

  // A raindrop: short slanted translucent-blue streak.
  this.drawRaindrop = function (ctx, f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.strokeStyle = "rgba(90,150,235,0.75)";
    ctx.lineWidth = Math.max(1, f.size / 3);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-f.slant * f.size, -f.size * 1.6);
    ctx.lineTo(f.slant * f.size, f.size * 1.6);
    ctx.stroke();
    ctx.restore();
  };

  this.mouseup = function (ev) {
    if (!tool.isDown) return;
    tool.isDown = false;
    KiddoPaint.Display.canvas.classList = "";
    KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");

    // Bake the snapshot+snow composite that is sitting on the tmp layer into the picture.
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
    tool.flakes = null;
    tool.initialClick = null;
  };
};
KiddoPaint.Tools.MixerSnowflakes =
  new KiddoPaint.Tools.Toolbox.MixerSnowflakes();
