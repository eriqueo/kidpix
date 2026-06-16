// Count Down eraser.
//
// Manual: "Count down to today's date and time." Big numbers count down over your
// picture (9, 8, 7 … 0), then the canvas is erased to white and stamped with the
// current date and time. Undo is paused while it runs so it's a single undo step.
KiddoPaint.Tools.Toolbox.EraserCountDown = function () {
  var tool = this;
  this.isDown = false;

  this.mousedown = function (ev) {
    tool.isDown = true;
    tool.animate(ev);
  };

  this.mousemove = function (ev) {};

  this.mouseup = function (ev) {
    if (tool.isDown) {
      tool.isDown = false;
    }
  };

  this.animate = function (ev) {
    KiddoPaint.Display.saveUndo();
    KiddoPaint.Display.pauseUndo();

    var w = KiddoPaint.Display.main_canvas.width;
    var h = KiddoPaint.Display.main_canvas.height;
    var n = 9;

    var intervalID = setInterval(step, 450);
    step();

    function step() {
      var ctx = KiddoPaint.Display.previewContext;
      KiddoPaint.Display.clearPreview();

      if (n >= 0) {
        // Draw the current countdown number over the picture (on the preview layer).
        ctx.fillStyle = "black";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "bold " + Math.round(h * 0.6) + "px Geneva, sans-serif";
        ctx.fillText(String(n), w / 2, h / 2);
        n--;
        return;
      }

      // Done counting: erase to white, then stamp today's date and time.
      clearInterval(intervalID);
      KiddoPaint.Display.clearPreview();
      KiddoPaint.Display.clearAll();

      var mctx = KiddoPaint.Display.main_context;
      var label = new Date().toLocaleString();
      mctx.fillStyle = "black";
      mctx.textAlign = "center";
      mctx.textBaseline = "middle";
      var fs = Math.round(h * 0.09);
      mctx.font = "bold " + fs + "px Geneva, sans-serif";
      // Shrink to fit the canvas width if the locale string is long.
      while (fs > 8 && mctx.measureText(label).width > w * 0.9) {
        fs -= 2;
        mctx.font = "bold " + fs + "px Geneva, sans-serif";
      }
      mctx.fillText(label, w / 2, h / 2);

      KiddoPaint.Display.saveToLocalStorage();
      KiddoPaint.Display.resumeUndo();
    }
  };
};
KiddoPaint.Tools.EraserCountDown =
  new KiddoPaint.Tools.Toolbox.EraserCountDown();
