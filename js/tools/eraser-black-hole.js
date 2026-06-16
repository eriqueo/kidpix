// Black Hole eraser.
//
// Manual: "The black hole swallows up everything!" A black disk grows from where you
// click until it has eaten the whole picture, then the canvas is left clean (white).
// Same animation shape as the TNT tool (js/tools/tnt.js): drive it with a timer, pause
// undo while it runs so the whole thing is a single undo step.
KiddoPaint.Tools.Toolbox.EraserBlackHole = function () {
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
    KiddoPaint.Sounds.explosion();

    var cx = ev._x;
    var cy = ev._y;
    var w = KiddoPaint.Display.main_canvas.width;
    var h = KiddoPaint.Display.main_canvas.height;
    // Radius needed to reach the farthest corner from the click point.
    var maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    var r = Math.max(w, h) * 0.04;

    var intervalID = setInterval(step, 30);
    step();

    function step() {
      var ctx = KiddoPaint.Display.context;
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.fill();
      KiddoPaint.Display.saveMainSkipUndo(); // bake this frame onto main, clear tmp
      r *= 1.3;
      if (r >= maxR) {
        clearInterval(intervalID);
        KiddoPaint.Display.clearAll(); // everything's swallowed -> clean white canvas
        KiddoPaint.Display.resumeUndo();
      }
    }
  };
};
KiddoPaint.Tools.EraserBlackHole =
  new KiddoPaint.Tools.Toolbox.EraserBlackHole();
