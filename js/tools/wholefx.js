const JumbleFx = {
  PINCH: "pinch",
  SWIRL: "swirl",
  LENSBLUR: "lensblur",
  TRIBLUR: "triblur",
  ZOOM: "zoom",
  HEXAGON: "hexagon",
  INK: "ink",
  EDGE: "edge",
  PANCAKE: "pancake",
  PIXELATE: "pixelate",
  HUE: "hue",
  SAT: "sat",
  HIGHLIGHT: "highlight",
  NIGHTVISION: "nightvision",
  INVERT: "invert",
  SUNSHINE: "sunshine",
  DITHER: "dither",
  THRESHOLD: "threshold",
};

// Expose JumbleFx to global scope for access from other modules
window.JumbleFx = JumbleFx;

KiddoPaint.Tools.Toolbox.WholeCanvasEffect = function () {
  var tool = this;
  this.isDown = false;
  try { this.gfx = fx.canvas(); } catch (e) { this.gfx = null; } // graceful fallback when WebGL unavailable
  this.textureGfx = {};
  this.mainImageData = {};
  this.initialClick = {};
  this.effect = JumbleFx.PANCAKE;

  this.mousedown = function (ev) {
    tool.isDown = true;
    tool.initialClick = ev;
    tool.mainImageData = KiddoPaint.Display.main_context.getImageData(
      0,
      0,
      KiddoPaint.Display.main_canvas.width,
      KiddoPaint.Display.main_canvas.height,
    );
    tool.textureGfx = tool.gfx.texture(KiddoPaint.Display.main_canvas);
    KiddoPaint.Display.saveUndo();
    KiddoPaint.Display.clearMain(); // this causes the bug where if the mouse move off screen, the mouseout even clears tmp context and everything is lost; but we need the main clear incase there's alpha it gets double rendered on preview...
    tool.mousemove(ev);
  };

  this.mousemove = function (ev) {
    if (tool.isDown) {
      KiddoPaint.Display.clearTmp();
      var drawDistance = distanceBetween(ev, tool.initialClick);
      switch (tool.effect) {
        case JumbleFx.PINCH:
          var strength = remap(0, 500, -1, 1, drawDistance);
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .bulgePinch(
              tool.initialClick._x,
              tool.initialClick._y,
              200,
              strength,
            )
            .update();
          break;
        case JumbleFx.SWIRL:
          var horizDist = Math.abs(ev._x - tool.initialClick._x);
          var vertDist = ev._y - tool.initialClick._y;
          var swirlAngle = remap(
            -300,
            300,
            -Math.PI * 2,
            Math.PI * 2,
            vertDist,
          );
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .swirl(
              tool.initialClick._x,
              tool.initialClick._y,
              horizDist,
              swirlAngle,
            )
            .update();
          break;
        case JumbleFx.LENSBLUR:
          var strength = remap(0, 500, 0, 50, drawDistance);
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .lensBlur(strength, 0.88, 0.70841)
            .update();
          break;
        case JumbleFx.TRIBLUR:
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .triangleBlur(drawDistance / 5.0)
            .update();
          break;
        case JumbleFx.ZOOM:
          var strength = remap(0, 250, 0, 1, drawDistance);
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .zoomBlur(tool.initialClick._x, tool.initialClick._y, strength)
            .update();
          break;
        case JumbleFx.HEXAGON:
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .hexagonalPixelate(
              tool.initialClick._x,
              tool.initialClick._y,
              drawDistance / 10.0,
            )
            .update();
          break;
        case JumbleFx.INK:
          var strength = remap(0, 250, -1, 1, drawDistance);
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .ink(strength)
            .update();
          break;
        case JumbleFx.HUE:
          var strength = remap(0, 1000, -1, 1, drawDistance);
          //KiddoPaint.Display.previewContext.fillText(strength, ev._x, ev._y);
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .hueSaturation(strength, 0)
            .update();
          break;
        case JumbleFx.SAT:
          var strength = remap(0, 500, -1, 1, drawDistance);
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .hueSaturation(0, strength)
            .update();
          break;
        case JumbleFx.EDGE:
          // Outline every line but KEEP the picture's color. edgeWork renders a 50%-grey
          // field with dark/light edge lines; 50% grey is neutral under the 'overlay'
          // blend, so compositing the edges over the original embosses just the outlines
          // and leaves flat color areas as-is. (radius floored so a plain click — which
          // is drawDistance 0 — still produces real outlines instead of a grey wipe.)
          var edges = tool.gfx
            .draw(tool.textureGfx)
            .edgeWork(Math.max(2, drawDistance / 10.0))
            .update();
          var ec = document.createElement("canvas");
          ec.width = KiddoPaint.Display.main_canvas.width;
          ec.height = KiddoPaint.Display.main_canvas.height;
          var ectx = ec.getContext("2d");
          ectx.drawImage(
            KiddoPaint.Display.imageTypeToCanvas(tool.mainImageData, false),
            0,
            0,
          );
          ectx.globalCompositeOperation = "overlay";
          ectx.drawImage(edges, 0, 0);
          var renderedGfx = ec;
          break;
        case JumbleFx.HIGHLIGHT:
          // "Highlights everything": make the colors pop like a highlighter — a gentle
          // brightness/contrast lift plus a saturation boost that grows with the drag,
          // instead of washing the whole picture out to white.
          var sat = remap(0, 500, 0, 0.9, clamp(0, 500, drawDistance));
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .brightnessContrast(0.12, 0.12)
            .hueSaturation(0, sat)
            .update();
          break;
        case JumbleFx.PANCAKE:
          // A real "stack of pancakes" that's visible on ANY background. The old version
          // drew full-canvas copies offset in the drag direction — on a full-bleed
          // picture those copies' edges land off-screen, so nothing showed unless the
          // background was white/erased. Instead bake a pile: the full picture on the
          // bottom, then progressively smaller copies shifted toward the drag direction,
          // each with a drop shadow so the layers separate against any colors. Drag
          // farther = taller stack.
          var baseImg = tool.gfx
            .draw(tool.textureGfx)
            .brightnessContrast(0, 0)
            .update();
          var pw = KiddoPaint.Display.main_canvas.width;
          var ph = KiddoPaint.Display.main_canvas.height;
          var pc = document.createElement("canvas");
          pc.width = pw;
          pc.height = ph;
          var pctx = pc.getContext("2d");
          pctx.imageSmoothingEnabled = false;
          pctx.drawImage(baseImg, 0, 0); // bottom pancake = the whole picture

          var dirx = Math.sign(ev._x - tool.initialClick._x) || 1;
          var diry = Math.sign(ev._y - tool.initialClick._y) || 1;
          var layers = Math.min(8, 2 + Math.floor(drawDistance / 60));
          var step = KiddoPaint.Current.modifiedAlt ? 12 : 28;
          for (var i = 1; i <= layers; i++) {
            var scale = 1 - i * 0.1; // each pancake a little smaller
            if (scale <= 0.15) break;
            var lw = pw * scale;
            var lh = ph * scale;
            var lx = (pw - lw) / 2 + i * step * dirx;
            var ly = (ph - lh) / 2 + i * step * diry;
            pctx.shadowColor = "rgba(0,0,0,0.5)";
            pctx.shadowBlur = 6;
            pctx.shadowOffsetX = 2;
            pctx.shadowOffsetY = 2;
            pctx.drawImage(baseImg, lx, ly, lw, lh);
          }
          pctx.shadowBlur = 0;
          pctx.shadowColor = "transparent";
          var renderedGfx = pc;
          break;
        case JumbleFx.PIXELATE:
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .brightnessContrast(0, 0)
            .update();
          var blocks = remap(0, 500, 50, 7, clamp(0, 500, drawDistance));
          renderedGfx = pixelateCanvas(renderedGfx, blocks);
          break;
        case JumbleFx.NIGHTVISION:
          var s = Filters.sobel(tool.mainImageData);
          renderedGfx = KiddoPaint.Display.imageTypeToCanvas(s, false);
          break;
        case JumbleFx.INVERT:
          var alpha = remap(0, 500, 1, 0, clamp(0, 500, drawDistance));
          var s = Filters.gcoInvert(tool.mainImageData, alpha);
          renderedGfx = s;
          break;
        case JumbleFx.SUNSHINE:
          var alpha = remap(0, 500, 1, 0, clamp(0, 500, drawDistance));
          var s = Filters.gcoOverlay(tool.mainImageData, alpha);
          renderedGfx = s;
          break;
        case JumbleFx.DITHER:
          var s = {};
          if (KiddoPaint.Current.modifiedCtrl) {
            var threshold = remap(0, 500, 192, 0, clamp(0, 500, drawDistance));
            s = Dither.bayer(tool.mainImageData, threshold);
          } else if (KiddoPaint.Current.modifiedMeta) {
            s = Dither.atkinson(tool.mainImageData);
          } else {
            s = Dither.floydsteinberg(tool.mainImageData);
          }
          renderedGfx = KiddoPaint.Display.imageTypeToCanvas(s, false);
          break;
        case JumbleFx.THRESHOLD:
          // var threshold = remap(0, 500, 1, 255, clamp(0, 500, drawDistance));
          var s = Dither.threshold(tool.mainImageData, 100);
          renderedGfx = KiddoPaint.Display.imageTypeToCanvas(s, false);
          break;
      }
      KiddoPaint.Display.context.drawImage(renderedGfx, 0, 0);
    }
  };

  this.mouseup = function (ev) {
    if (tool.isDown) {
      tool.isDown = false;
      tool.textureGfx.destroy();
      tool.textureGfx = {};
      tool.mainImageData = {};
      tool.initialClick = {};
      KiddoPaint.Display.saveMainSkipUndo();
    }
  };
};
KiddoPaint.Tools.WholeCanvasEffect =
  new KiddoPaint.Tools.Toolbox.WholeCanvasEffect();
