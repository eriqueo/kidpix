/**
 * KiddoPaint.KidsMode — "Small Kids Mode"
 *
 * Locks the UI down so a small child gets the canvas + their current tool and
 * nothing they can accidentally navigate away from: hides the tool-options
 * submenu, the top frame chrome, and disables single-key keyboard shortcuts.
 *
 * Activation:
 *   - URL query string contains `kidsMode=1`, or
 *   - localStorage key `kiddopaint.settings.kidsMode === "true"`.
 *
 * Escape hatch: a sustained long-press on the title bar (8 seconds) toggles
 * the mode off. Documented here so a parent can recover the full UI without
 * clearing storage.
 */

if (typeof window !== "undefined" && !window.KiddoPaint) {
  window.KiddoPaint = {};
}

(function () {
  var STORAGE_KEY = "kiddopaint.settings.kidsMode";
  var BODY_CLASS = "kids-mode";
  var LONG_PRESS_MS = 8000;

  function getDoc() {
    return typeof document !== "undefined" ? document : null;
  }

  function getStorage() {
    try {
      return typeof localStorage !== "undefined" ? localStorage : null;
    } catch (_e) {
      return null;
    }
  }

  function readStored() {
    var s = getStorage();
    if (!s) return false;
    try {
      return s.getItem(STORAGE_KEY) === "true";
    } catch (_e) {
      return false;
    }
  }

  function writeStored(value) {
    var s = getStorage();
    if (!s) return;
    try {
      s.setItem(STORAGE_KEY, value ? "true" : "false");
    } catch (_e) {
      /* ignore quota errors */
    }
  }

  function urlEnabled() {
    if (typeof window === "undefined" || !window.location) return false;
    var q = window.location.search || "";
    return /(^|[?&])kidsMode=1(&|$)/.test(q);
  }

  function applyClass(enabled) {
    var doc = getDoc();
    if (!doc || !doc.body) return;
    if (enabled) {
      doc.body.classList.add(BODY_CLASS);
    } else {
      doc.body.classList.remove(BODY_CLASS);
    }
  }

  var KidsMode = {
    STORAGE_KEY: STORAGE_KEY,
    BODY_CLASS: BODY_CLASS,

    isEnabled: function () {
      return urlEnabled() || readStored();
    },

    enable: function () {
      writeStored(true);
      applyClass(true);
    },

    disable: function () {
      writeStored(false);
      applyClass(false);
    },

    toggle: function () {
      if (this.isEnabled()) {
        this.disable();
      } else {
        this.enable();
      }
    },

    // Test seam: re-evaluate URL+storage and sync the body class.
    sync: function () {
      applyClass(this.isEnabled());
    },

    // Wire up the long-press escape hatch on the title bar.
    installEscapeHatch: function () {
      var doc = getDoc();
      if (!doc) return;
      var titlebar = doc.getElementById("titlebar");
      if (!titlebar) return;
      var timer = null;
      var clear = function () {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };
      var start = function () {
        clear();
        timer = setTimeout(function () {
          KidsMode.disable();
        }, LONG_PRESS_MS);
      };
      titlebar.addEventListener("mousedown", start);
      titlebar.addEventListener("touchstart", start, { passive: true });
      titlebar.addEventListener("mouseup", clear);
      titlebar.addEventListener("mouseleave", clear);
      titlebar.addEventListener("touchend", clear);
      titlebar.addEventListener("touchcancel", clear);
    },

    init: function () {
      // URL beats storage: ?kidsMode=1 persists the mode so a reload keeps it.
      if (urlEnabled()) {
        writeStored(true);
      }
      applyClass(this.isEnabled());
      this.installEscapeHatch();
    },
  };

  window.KiddoPaint.KidsMode = KidsMode;

  // Block single-key shortcuts at the document level. The legacy keydown
  // handler in js/init/kiddopaint.js gates them on
  // KiddoPaint.Settings.isKeyboardShortcutsEnabled(); for defense-in-depth we
  // also stop propagation here so any other handler registered later cannot
  // dispatch a tool change from a stray keypress. Modifier keys and the
  // help-popup '?' are still allowed through.
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener(
      "keydown",
      function (e) {
        if (!KidsMode.isEnabled()) return;
        if (
          e.keyCode === 16 || // Shift
          e.keyCode === 17 || // Ctrl
          e.keyCode === 18 || // Alt
          e.keyCode === 91 || // Meta (left)
          e.keyCode === 93 || // Meta (right)
          e.keyCode === 192 // Tilde
        ) {
          return;
        }
        // Allow '?' (Shift+/) so a parent can still see the help popup.
        if (e.keyCode === 191 && e.shiftKey) return;
        e.stopImmediatePropagation();
        e.preventDefault();
      },
      true, // capture, so we run before document.onkeydown
    );
  }

  // Run init when the DOM is ready. Idempotent: safe to call multiple times.
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        KidsMode.init();
      });
    } else {
      KidsMode.init();
    }
  }
})();
