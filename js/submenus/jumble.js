KiddoPaint.Submenu.jumble = [
  {
    name: "Invert",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-164.png",
    handler: function () {
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerInverter;
    },
  },
  {
    name: "Raindrops",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-165.png",
    handler: function () {
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.AnimBrush;
      KiddoPaint.Tools.AnimBrush.reset();
      KiddoPaint.Tools.AnimBrush.animInterval = 50;
      KiddoPaint.Tools.AnimBrush.postprocess = function () {
        KiddoPaint.Display.canvas.classList = "";
        KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      };
      KiddoPaint.Tools.AnimBrush.texture = function (step, distancePrev) {
        KiddoPaint.Display.canvas.classList = "";
        KiddoPaint.Display.canvas.classList.add("cursor-guy-wow");
        KiddoPaint.Sounds.bubblepops();
        const color = KiddoPaint.Colors.randomAllColor();
        return KiddoPaint.Brushes.Raindrops(color);
      };
    },
  },
  {
    name: "Checkerboard",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-166.png",
    handler: function () {
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerCheckerboard;
    },
  },
  {
    name: "Wallpaper",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-167.png",
    handler: function () {
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerWallpaper;
    },
  },
  {
    name: "Venetian Blinds",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-168.png",
    handler: function () {
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerVenetianBlinds;
    },
  },
  {
    name: "The Outliner",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-169.png",
    handler: function () {
      // Edge-detect the whole canvas: traces the picture's outlines. Drag distance
      // controls the edge thickness (see JumbleFx.EDGE in wholefx.js).
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Tools.WholeCanvasEffect.effect = JumbleFx.EDGE;
      KiddoPaint.Current.tool = KiddoPaint.Tools.WholeCanvasEffect;
    },
  },
  {
    name: "Shadow Boxes",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-170.png",
    handler: function () {
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerShadowBoxes;
    },
  },
  {
    name: "Zoom In",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-171.png",
    handler: function () {
      // Real magnification centered on the click point. Drag farther to zoom in closer
      // (the new-engine equivalent of the original's "click repeatedly to zoom closer").
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerZoomIn;
    },
  },
  {
    name: "Broken Glass",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-172.png",
    handler: function () {
      // Shatter the picture into many jagged shards that blow apart from the click
      // point, with white cracks between them. Drag farther to break it apart more.
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerBrokenGlass;
    },
  },
  {
    name: "Picture In A Picture",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-173.png",
    handler: function () {
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerPip;
    },
  },
  {
    name: "The Highlighter",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-174.png",
    handler: function () {
      // "Highlights everything": brightens the whole picture toward white like a
      // highlighter pen. Drag distance controls how bright (JumbleFx.HIGHLIGHT).
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Tools.WholeCanvasEffect.effect = JumbleFx.HIGHLIGHT;
      KiddoPaint.Current.tool = KiddoPaint.Tools.WholeCanvasEffect;
    },
  },
  {
    name: "Pattern Maker",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-175.png",
    handler: function () {
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerPattern;
    },
  },
  {
    name: "Wrap Around",
    imgSrc: "img/mixer/tool-submenu-wacky-mixer-176.png",
    handler: function () {
      // Slide the whole picture; what falls off one edge wraps to the opposite edge.
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerWrapAround;
    },
  },
  {
    name: "Snow Flakes And Rain Drops",
    emoji: "❄️",
    handler: function () {
      // Drag to scatter snow over the picture (drag farther = thicker snow). Hold Option
      // to melt the flakes into blue raindrops. See js/tools/mixer-snowflakes.js.
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerSnowflakes;
    },
  },
  {
    name: "Splash!",
    emoji: "💦",
    handler: function () {
      // Hold the mouse button down to splash big multicolor paint blobs onto the picture —
      // the longer you hold, the more blobs. See js/tools/mixer-splash.js.
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-guy-smile");
      KiddoPaint.Current.tool = KiddoPaint.Tools.MixerSplash;
    },
  },
  {
    name: "Swirl",
    emoji: "🍭",
    handler: function () {
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-lollipop");
      KiddoPaint.Tools.WholeCanvasEffect.effect = JumbleFx.SWIRL;
      KiddoPaint.Current.tool = KiddoPaint.Tools.WholeCanvasEffect;
    },
  },
  {
    name: "Pancake Stack",
    emoji: "🥞",
    handler: function () {
      KiddoPaint.Display.canvas.classList = "";
      KiddoPaint.Display.canvas.classList.add("cursor-pancakes");
      KiddoPaint.Tools.WholeCanvasEffect.effect = JumbleFx.PANCAKE;
      KiddoPaint.Current.tool = KiddoPaint.Tools.WholeCanvasEffect;
    },
  },
];
