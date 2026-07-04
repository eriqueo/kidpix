// Phone-layout drawer controller.
//
// Below 700px the CSS (kidpix.css "Responsive layout" section) turns #mainbar and
// #colorbar into off-screen edge drawers. This file injects the two floating toggle
// buttons and manages the body classes that slide the drawers in/out. On desktop and
// tablet the buttons exist but are display:none, and the body classes have no effect —
// all behavior is gated by the same 699px media query as the CSS, so there is a single
// source of truth for "phone mode".
//
// UX rules, tuned for small kids:
// - Only one drawer open at a time (they'd overlap the whole screen otherwise).
// - Picking a tool or color closes the drawer, so the canvas is immediately usable.
// - Tapping outside an open drawer closes it and SWALLOWS the tap (capture phase),
//   so the dismissing tap doesn't also paint a stray dot on the canvas.

(function () {
  // Must stay in sync with the phone breakpoint in kidpix.css: narrow screens
  // (portrait phones) or short ones (landscape phones).
  var phoneQuery = window.matchMedia(
    "(max-width: 699px), (max-height: 500px)",
  );

  var TOOLS_CLASS = "tools-drawer-open";
  var COLORS_CLASS = "colors-drawer-open";

  function isOpen() {
    return (
      document.body.classList.contains(TOOLS_CLASS) ||
      document.body.classList.contains(COLORS_CLASS)
    );
  }

  function closeDrawers() {
    document.body.classList.remove(TOOLS_CLASS);
    document.body.classList.remove(COLORS_CLASS);
  }

  function toggleDrawer(cls, otherCls) {
    document.body.classList.remove(otherCls);
    document.body.classList.toggle(cls);
  }

  function makeToggle(id, emoji, title) {
    var btn = document.createElement("button");
    btn.id = id;
    btn.className = "drawer-toggle";
    btn.title = title;
    btn.setAttribute("aria-label", title);
    btn.textContent = emoji;
    document.body.appendChild(btn);
    return btn;
  }

  function init() {
    var mainbar = document.getElementById("mainbar");
    var colorbar = document.getElementById("colorbar");
    if (!mainbar || !colorbar) return;

    var toolsBtn = makeToggle("tools-drawer-toggle", "🖍️", "Tools");
    var colorsBtn = makeToggle("colors-drawer-toggle", "🎨", "Colors");

    toolsBtn.addEventListener("click", function () {
      toggleDrawer(TOOLS_CLASS, COLORS_CLASS);
    });
    colorsBtn.addEventListener("click", function () {
      toggleDrawer(COLORS_CLASS, TOOLS_CLASS);
    });

    // Selecting a tool/color dismisses the drawer. Tool buttons act on mousedown,
    // so by the time click fires the selection has already happened.
    mainbar.addEventListener("click", function () {
      if (phoneQuery.matches) closeDrawers();
    });
    colorbar.addEventListener("click", function () {
      if (phoneQuery.matches) closeDrawers();
    });

    // Outside tap: close the drawer and stop the event (capture phase, before the
    // canvas's own listeners) so dismissing doesn't draw. Both touchstart and
    // mousedown are intercepted because the canvas listens to both.
    function outsideTap(ev) {
      if (!phoneQuery.matches || !isOpen()) return;
      var t = ev.target;
      if (
        mainbar.contains(t) ||
        colorbar.contains(t) ||
        t === toolsBtn ||
        t === colorsBtn
      ) {
        return;
      }
      closeDrawers();
      ev.stopPropagation();
      ev.preventDefault();
    }
    document.addEventListener("touchstart", outsideTap, {
      capture: true,
      passive: false,
    });
    document.addEventListener("mousedown", outsideTap, true);

    // Leaving phone mode (rotation, window resize) drops any open-drawer state so
    // the desktop/tablet layout never inherits a stale body class.
    function onMediaChange(mq) {
      if (!mq.matches) closeDrawers();
    }
    if (phoneQuery.addEventListener) {
      phoneQuery.addEventListener("change", onMediaChange);
    } else if (phoneQuery.addListener) {
      phoneQuery.addListener(onMediaChange); // older iOS Safari
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
