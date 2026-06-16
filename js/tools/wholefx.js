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
          // Floor the radius: edgeWork(0) — what a pure click (drawDistance 0)
          // produced — returns a flat grey frame that wipes the picture. The original
          // Outliner outlines on a click, so give a click a real radius and let
          // dragging thicken the outlines from there.
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .edgeWork(Math.max(2, drawDistance / 10.0))
            .update();
          break;
        case JumbleFx.HIGHLIGHT:
          // "Highlights everything": brighten the whole picture toward white, like
          // swiping a highlighter over it. Drag farther = brighter. A touch of contrast
          // keeps it from washing out to flat grey.
          var brightness = remap(0, 500, 0, 0.6, clamp(0, 500, drawDistance));
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .brightnessContrast(brightness, 0.15)
            .update();
          break;
        case JumbleFx.PANCAKE:
          var renderedGfx = tool.gfx
            .draw(tool.textureGfx)
            .brightnessContrast(0, 0)
            .update();
          // Build a visible "stack of pancakes": several copies of the picture offset
          // and receding in the drag direction, with the crisp original drawn on top
          // by the shared drawImage below. The upstream values (2 copies, 16px spacing,
          // alpha fading to 0) made the stack peek only a few faint pixels out from
          // behind that top copy, so on a short drag / large canvas it looked like
          // nothing happened. Use more copies, wider spacing, and a floored opacity so
          // the stack actually reads as a stack.
          var howManyPancakes = 3 + drawDistance / 48;
          var increment = KiddoPaint.Current.modifiedAlt ? 10 : 24;
          var furthestAway = howManyPancakes * increment;

          var deltax = ev._x - tool.initialClick._x;
          var deltay = ev._y - tool.initialClick._y;

          for (var i = 1; i < howManyPancakes; i++) {
            // Nearer copies are more opaque; floor at 0.35 so far copies stay visible.
            KiddoPaint.Display.context.globalAlpha =
              0.35 + 0.65 * (i / howManyPancakes);
            KiddoPaint.Display.context.drawImage(
              renderedGfx,
              (furthestAway - i * increment) * Math.sign(deltax),
              (furthestAway - i * increment) * Math.sign(deltay),
            );
          }
          KiddoPaint.Display.context.globalAlpha = 1;
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
