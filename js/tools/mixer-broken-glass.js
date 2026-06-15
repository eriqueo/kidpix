// Broken Glass mixer effect.
//
// Manual: "Shatters your drawing into many jagged pieces." We partition the picture into
// a jittered grid of triangular shards (generated once when you press down so they don't
// jiggle), then push each shard outward from where you clicked. Dragging farther pushes
// the pieces farther apart; the white "cracks" between them are the gaps the shards leave
// behind. Each shard also rotates a hair for a real shattered-glass look.
KiddoPaint.Tools.Toolbox.MixerBrokenGlass = function () {
  var tool = this;
  this.isDown = false;
  this.initialClick = null;
  this.sourceCanvas = null;
  this.shards = null;
  this.maxDistFromCenter = 1;

  this.cols = 7;
  this.rows = 5;

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

    tool.buildShards(ev._x, ev._y);
    KiddoPaint.Display.saveUndo();
    tool.mousemove(ev);
  };

  // Build the triangular shard mesh once. Interior grid vertices are jittered so the
  // pieces are jagged; border vertices stay on the canvas edge so the picture fills it.
  this.buildShards = function (centerX, centerY) {
    var w = KiddoPaint.Display.main_canvas.width;
    var h = KiddoPaint.Display.main_canvas.height;
    var cols = tool.cols;
    var rows = tool.rows;
    var cellW = w / cols;
    var cellH = h / rows;

    var verts = [];
    for (var i = 0; i <= cols; i++) {
      verts[i] = [];
      for (var j = 0; j <= rows; j++) {
        var x = i * cellW;
        var y = j * cellH;
        var interior = i > 0 && i < cols && j > 0 && j < rows;
        if (interior) {
          x += getRandomFloat(-cellW * 0.35, cellW * 0.35);
          y += getRandomFloat(-cellH * 0.35, cellH * 0.35);
        }
        verts[i][j] = [x, y];
      }
    }

    var shards = [];
    var maxDist = 1;
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        var v00 = verts[i][j];
        var v10 = verts[i + 1][j];
        var v11 = verts[i + 1][j + 1];
        var v01 = verts[i][j + 1];
        // Split each cell into two triangles (alternate the diagonal for variety).
        var tris =
          (i + j) % 2 === 0
            ? [
                [v00, v10, v11],
                [v00, v11, v01],
              ]
            : [
                [v00, v10, v01],
                [v10, v11, v01],
              ];
        for (var t = 0; t < tris.length; t++) {
          var p = tris[t];
          var cxp = (p[0][0] + p[1][0] + p[2][0]) / 3;
          var cyp = (p[0][1] + p[1][1] + p[2][1]) / 3;
          var dist = Math.hypot(cxp - centerX, cyp - centerY);
          if (dist > maxDist) maxDist = dist;
          shards.push({
            pts: p,
            cx: cxp,
            cy: cyp,
            dist: dist,
            // unit vector pointing away from the shatter center (fallback for a shard
            // sitting exactly on the center).
            dirx: dist > 0.001 ? (cxp - centerX) / dist : 0,
            diry: dist > 0.001 ? (cyp - centerY) / dist : 0,
            theta: getRandomFloat(-0.18, 0.18),
          });
        }
      }
    }
    tool.shards = shards;
    tool.maxDistFromCenter = maxDist;
  };

  this.mousemove = function (ev) {
    if (!tool.isDown || !tool.shards) return;

    var w = KiddoPaint.Display.main_canvas.width;
    var dragged = distanceBetween(ev, tool.initialClick);
    // How far the outermost shards travel, scaled by drag (capped to a sane spread).
    var maxPush = remap(0, 500, 0, w * 0.18, clamp(0, 500, dragged));

    var ctx = KiddoPaint.Display.context; // tmp layer
    KiddoPaint.Display.clearTmp();
    // White backdrop so the gaps between separated shards read as glass cracks.
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, w, KiddoPaint.Display.main_canvas.height);
    ctx.imageSmoothingEnabled = false;

    for (var s = 0; s < tool.shards.length; s++) {
      var sh = tool.shards[s];
      // Outer shards move more than inner ones, so the picture "blows apart".
      var push = maxPush * (sh.dist / tool.maxDistFromCenter);
      var dx = sh.dirx * push;
      var dy = sh.diry * push;

      ctx.save();
      // Rotate the shard about its own centroid, then displace it outward.
      ctx.translate(sh.cx + dx, sh.cy + dy);
      ctx.rotate(sh.theta);
      ctx.translate(-sh.cx, -sh.cy);
      ctx.beginPath();
      ctx.moveTo(sh.pts[0][0], sh.pts[0][1]);
      ctx.lineTo(sh.pts[1][0], sh.pts[1][1]);
      ctx.lineTo(sh.pts[2][0], sh.pts[2][1]);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(tool.sourceCanvas, 0, 0);
      ctx.restore();
    }

    KiddoPaint.Sounds.mixershadowbox();
  };

  this.mouseup = function (ev) {
    if (!tool.isDown) return;
    tool.isDown = false;
    KiddoPaint.Display.canvas.classList = "";
    KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");

    // Bake by replace: the shattered result (with its white cracks) is the new picture.
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
    tool.shards = null;
    tool.initialClick = null;
  };
};
KiddoPaint.Tools.MixerBrokenGlass =
  new KiddoPaint.Tools.Toolbox.MixerBrokenGlass();
