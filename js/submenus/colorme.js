/**
 * ColorMe submenu — one button per coloring-book page, plus an "Upload" tile so
 * kids (or a grown-up) can drop in their own line art to color. Clicking a page
 * loads it into the locked line-art layer (bnimCanvas) and arms the ColorMe
 * paint-bucket. The page list is sourced from KiddoPaint.ColorMe.pages, which
 * src/colorme-init.ts populates at boot (bundled pages + any saved uploads).
 */
(function () {
  // Lazily-created hidden <input type=file> reused for every upload.
  var fileInput = null;

  function ensureFileInput() {
    if (fileInput) return fileInput;
    fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";
    fileInput.addEventListener("change", onFileChosen);
    document.body.appendChild(fileInput);
    return fileInput;
  }

  // "my-cool-drawing.png" -> "My Cool Drawing"
  function titleFromFilename(name) {
    var base = String(name || "")
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim();
    if (!base) return "My Page";
    return base.replace(/\b\w/g, function (c) {
      return c.toUpperCase();
    });
  }

  // Draw the uploaded image onto a page-sized white canvas (fit + center) and
  // return a PNG data URL. Normalizing here bounds the size we persist and gives
  // the flood-fill a clean white background outside the art.
  function normalizeToColorPage(img) {
    var disp = KiddoPaint.Display;
    var W = (disp && disp.bnimCanvas && disp.bnimCanvas.width) || 1300;
    var H = (disp && disp.bnimCanvas && disp.bnimCanvas.height) || 650;
    var c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    var s = Math.min(W / img.width, H / img.height);
    var dw = Math.round(img.width * s);
    var dh = Math.round(img.height * s);
    var dx = Math.floor((W - dw) / 2);
    var dy = Math.floor((H - dh) / 2);
    ctx.drawImage(img, dx, dy, dw, dh);
    return c.toDataURL("image/png");
  }

  function onFileChosen(ev) {
    var input = ev.target;
    var file = input.files && input.files[0];
    input.value = ""; // let the same file be re-picked later
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var meta = {
          file: file.name,
          title: titleFromFilename(file.name),
          url: normalizeToColorPage(img),
          custom: true,
        };
        if (KiddoPaint.ColorMe && KiddoPaint.ColorMe.addCustomPage) {
          meta = KiddoPaint.ColorMe.addCustomPage(meta);
        } else if (KiddoPaint.ColorMe && KiddoPaint.ColorMe.pages) {
          KiddoPaint.ColorMe.pages.push(meta);
        }
        // Refresh the tiles so the new page shows, then load + arm it.
        buildSubmenu();
        show_generic_submenu("colorme");
        KiddoPaint.Tools.ColorMe.loadPage(meta);
        KiddoPaint.Current.tool = KiddoPaint.Tools.ColorMe;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function buildSubmenu() {
    var pages = (KiddoPaint.ColorMe && KiddoPaint.ColorMe.pages) || [];
    var entries = pages.map(function (p) {
      return {
        name: p.title,
        imgSrc: p.url,
        handler: function () {
          KiddoPaint.Tools.ColorMe.loadPage(p);
        },
      };
    });
    // Upload tile last: pick a picture from disk to color.
    entries.push({
      name: "Upload a coloring page…",
      text: "➕",
      handler: function () {
        ensureFileInput().click();
      },
    });
    KiddoPaint.Submenu.colorme = entries;
  }

  // Build immediately if the bridge has already populated pages, else retry
  // shortly (the bridge module finishes evaluation in the same tick chain).
  if (KiddoPaint.ColorMe && KiddoPaint.ColorMe.pages) {
    buildSubmenu();
  } else {
    // Bridge hasn't loaded yet — defer one microtask.
    Promise.resolve().then(buildSubmenu);
  }
})();
