KiddoPaint.Tools.Toolbox.EraserHiddenPicture = function () {
  var tool = this;
  this.bundledPictures = [
    // <hidden-pictures:auto>
    "img/hidden-pictures/kp-h-bear.png",
    "img/hidden-pictures/kp-h-bison.png",
    "img/hidden-pictures/kp-h-corn.png",
    "img/hidden-pictures/kp-h-eye.png",
    "img/hidden-pictures/kp-h-fox.png",
    "img/hidden-pictures/kp-h-horse.png",
    "img/hidden-pictures/kp-h-hummingbird.png",
    "img/hidden-pictures/kp-h-ladybug.png",
    "img/hidden-pictures/kp-h-lion.png",
    "img/hidden-pictures/kp-h-magnet.png",
    "img/hidden-pictures/kp-h-moth.png",
    "img/hidden-pictures/kp-h-octopus.png",
    // </hidden-pictures:auto>
  ];
  this.customPictures = [];
  this.hiddenPictures = this.bundledPictures.slice();
  this.isDown = false;
  // Bigger reveal window so uncovering the hidden picture isn't so tedious.
  this.size = 64;
  this.hiddenPattern = null;
  this.activeSource = null;

  // The reveal tool remains the single owner of the sources consumed here and
  // by Doorbell. The browser persistence bridge hydrates only validated PNG
  // data URLs through this method.
  this.setCustomPictures = function (sources) {
    tool.customPictures = sources.filter(function (source) {
      return (
        typeof source === "string" &&
        source.indexOf("data:image/png;base64,") === 0
      );
    });
    tool.hiddenPictures = tool.bundledPictures.concat(tool.customPictures);
  };

  this.usePicture = function (source) {
    return new Promise(function (resolve, reject) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = function () {
        tool.hiddenPattern = makePatternFromImage(image);
        tool.activeSource = source;
        resolve(source);
      };
      image.onerror = function () {
        reject(new Error("Hidden Picture could not be loaded"));
      };
      image.src = source;
    });
  };

  this.reset = function () {
    return tool.usePicture(tool.hiddenPictures.random());
  };

  this.mousedown = function (ev) {
    tool.isDown = true;
  };

  this.mousemove = function (ev) {
    const currentSize = tool.size * KiddoPaint.Current.scaling;
    if (tool.isDown) {
      KiddoPaint.Sounds.eraser();
      var ctx = KiddoPaint.Display.context;
      ctx.fillStyle = tool.hiddenPattern;
      ctx.fillRect(
        Math.round(ev._x) - currentSize / 2.0,
        Math.round(ev._y) - currentSize / 2.0,
        currentSize,
        currentSize,
      );
    } else {
      var ctx = KiddoPaint.Display.previewContext;
      ctx.fillStyle = "white";
      ctx.strokeStyle = "black";
      ctx.strokeRect(
        Math.round(ev._x) - currentSize / 2.0,
        Math.round(ev._y) - currentSize / 2.0,
        currentSize,
        currentSize,
      );
      ctx.fillRect(
        Math.round(ev._x) - currentSize / 2.0,
        Math.round(ev._y) - currentSize / 2.0,
        currentSize,
        currentSize,
      );
    }
  };

  this.mouseup = function (ev) {
    if (tool.isDown) {
      tool.isDown = false;
      KiddoPaint.Display.saveMain();
    }
  };
};
KiddoPaint.Tools.EraserHiddenPicture =
  new KiddoPaint.Tools.Toolbox.EraserHiddenPicture();
