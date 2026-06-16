// Count Down eraser.
//
// Big numbers count down over your picture (9, 8, 7 … 0), then the canvas is erased to
// white and a random silly message is stamped in a random goofy font and color — so you
// never know quite what you'll get. Undo is paused while it runs so it's a single step.
KiddoPaint.Tools.Toolbox.EraserCountDown = function () {
  var tool = this;
  this.isDown = false;

  // Pick one at random on each use.
  this.messages = [
    "Nothing to see here!",
    "Nothing nothing nothing nothing nothing nothing nothing",
    "Happy New Year!",
    "All gone!",
    "Poof!",
    "Ta-da!",
    "That's all, folks!",
    "Bye bye!",
    "Oops! All gone!",
    "Made you look!",
    "The end.",
    "Wheeee!",
    "Abracadabra!",
    "Surprise!",
    "Boom!",
    "See ya later, alligator!",
  ];
  // Silly font stacks. Mac/iPad-friendly names first (the target device), with generic
  // cursive/fantasy fallbacks so something playful shows everywhere.
  this.fonts = [
    '"Comic Sans MS", "Comic Sans", cursive',
    '"Marker Felt", "Chalkboard SE", fantasy',
    '"Papyrus", fantasy',
    "Impact, fantasy",
    '"Bradley Hand", "Snell Roundhand", cursive',
    '"Chalkduster", fantasy',
    "cursive",
    "fantasy",
  ];
  // Vivid colors that stay readable on the white paper (no white/pale yellow).
  this.colors = [
    "#e3000f",
    "#0050ef",
    "#7b2fbe",
    "#0a8f3c",
    "#ff6a00",
    "#d6009a",
    "#008c8c",
    "#111111",
  ];

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

      // Done counting: erase to white, then stamp a random silly message.
      clearInterval(intervalID);
      KiddoPaint.Display.clearPreview();
      KiddoPaint.Display.clearAll();

      tool.stampMessage(
        tool.messages.random(),
        tool.fonts.random(),
        tool.colors.random(),
        w,
        h,
      );

      KiddoPaint.Display.saveToLocalStorage();
      KiddoPaint.Display.resumeUndo();
    }
  };

  // Draw text centered on the main canvas, word-wrapped and auto-sized to fit.
  this.stampMessage = function (text, font, color, w, h) {
    var mctx = KiddoPaint.Display.main_context;
    mctx.fillStyle = color;
    mctx.textAlign = "center";
    mctx.textBaseline = "middle";

    var fs = Math.round(h * 0.4);
    var lines = [text];
    while (fs > 12) {
      mctx.font = "bold " + fs + "px " + font;
      lines = wrapLines(mctx, text, w * 0.88);
      var lineH = fs * 1.15;
      var totalH = lines.length * lineH;
      var maxW = 0;
      for (var i = 0; i < lines.length; i++) {
        var lw = mctx.measureText(lines[i]).width;
        if (lw > maxW) maxW = lw;
      }
      if (totalH <= h * 0.85 && maxW <= w * 0.88) break;
      fs -= 6;
    }

    var lineH = fs * 1.15;
    var startY = h / 2 - ((lines.length - 1) * lineH) / 2;
    for (var i = 0; i < lines.length; i++) {
      mctx.fillText(lines[i], w / 2, startY + i * lineH);
    }
  };

  // Greedy word-wrap to a max pixel width using the context's current font.
  function wrapLines(ctx, text, maxW) {
    var words = text.split(" ");
    var lines = [];
    var cur = "";
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + " " + words[i] : words[i];
      if (cur && ctx.measureText(test).width > maxW) {
        lines.push(cur);
        cur = words[i];
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }
};
KiddoPaint.Tools.EraserCountDown =
  new KiddoPaint.Tools.Toolbox.EraserCountDown();
