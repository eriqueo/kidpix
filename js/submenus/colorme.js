/**
 * ColorMe submenu — one button per coloring-book page. Clicking a page button
 * loads it into the locked line-art layer (bnimCanvas) and arms the ColorMe
 * paint-bucket tool. The page list is sourced from KiddoPaint.ColorMe.pages,
 * which is populated by src/colorme-init.ts at boot.
 */
(function () {
  function buildSubmenu() {
    var pages = (KiddoPaint.ColorMe && KiddoPaint.ColorMe.pages) || [];
    KiddoPaint.Submenu.colorme = pages.map(function (p) {
      return {
        name: p.title,
        imgSrc: p.url,
        handler: function () {
          KiddoPaint.Tools.ColorMe.loadPage(p);
        },
      };
    });
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
