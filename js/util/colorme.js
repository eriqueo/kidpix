// ColorMe — enumerate and load coloring-book line-art pages.
//
// Assets live in src/assets/colorme/*.png; this module exposes list() and load(name).
// The enumeration is build-time (Vite's import.meta.glob), so it works both in dev
// and in the bundled build. A test injector (setAssetsForTest) is exposed so unit
// tests don't depend on the bundler.

const isVite =
  typeof import.meta !== "undefined" &&
  typeof import.meta.glob === "function";

// Map of name -> URL string (resolved by Vite).
let assets = {};

if (isVite) {
  // eager:true returns { 'path': {default: url} }; we flatten to { name: url }.
  const raw = import.meta.glob("../../src/assets/colorme/*.png", {
    eager: true,
    query: "?url",
    import: "default",
  });
  for (const path in raw) {
    const m = /([^/]+)\.png$/.exec(path);
    if (m) assets[m[1]] = raw[path];
  }
}

const ColorMe = {
  // Replace the asset map (test-only).
  _setAssetsForTest(map) {
    assets = { ...map };
  },

  // Return [{name, url}, ...] sorted by name.
  list() {
    return Object.keys(assets)
      .sort()
      .map((name) => ({ name, url: assets[name] }));
  },

  // Resolve a name to its URL (or null if unknown).
  url(name) {
    return Object.prototype.hasOwnProperty.call(assets, name)
      ? assets[name]
      : null;
  },

  // Load name into the supplied 2D context, scaled to fit (cover), centered.
  // Returns a Promise that resolves to true on success, false on failure.
  load(name, ctx) {
    const url = ColorMe.url(name);
    if (!url || !ctx || !ctx.canvas) return Promise.resolve(false);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function () {
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        ctx.clearRect(0, 0, cw, ch);
        // Fit (contain): preserve aspect ratio, no cropping; transparent letterbox.
        const scale = Math.min(cw / img.width, ch / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        resolve(true);
      };
      img.onerror = function () {
        resolve(false);
      };
      img.src = url;
    });
  },
};

// Attach to the legacy namespace so the picker (and tests) can reach it.
if (typeof window !== "undefined") {
  window.KiddoPaint = window.KiddoPaint || {};
  window.KiddoPaint.ColorMe = ColorMe;
}

export default ColorMe;
export { ColorMe };
