/**
 * KiddoPaint.Settings
 * Manages user settings stored in localStorage
 */

KiddoPaint.Settings = {
  /**
   * Check if keyboard shortcuts are enabled
   * @returns {boolean} True if keyboard shortcuts are enabled, false otherwise
   */
  isKeyboardShortcutsEnabled: function () {
    // Default to false (disabled) to maintain child-friendly behavior
    var value = localStorage.getItem(
      "kiddopaint.settings.keyboardShortcutsEnabled",
    );
    return value === "true";
  },

  /**
   * Set keyboard shortcuts enabled/disabled state
   * @param {boolean} enabled - True to enable shortcuts, false to disable
   */
  setKeyboardShortcutsEnabled: function (enabled) {
    localStorage.setItem(
      "kiddopaint.settings.keyboardShortcutsEnabled",
      enabled ? "true" : "false",
    );
  },

  // -------------------------------------------------------------------------
  // Small Kids Mode
  //
  // Persistent boolean that, when on, simplifies the UI surface to a
  // child-friendly subset (stylistic equivalent of classic Kid Pix's
  // "Small Kids Mode"). Default is false so adult-mode behavior is unchanged.
  //
  // The flag is plumbed into the DOM as a `small-kids-mode` class on <body>
  // so all gating can be expressed declaratively in CSS. JS subscribers can
  // observe via KiddoPaint.Settings.onSmallKidsModeChange.
  // -------------------------------------------------------------------------

  _smallKidsKey: "kiddopaint.settings.smallKidsMode",
  _smallKidsSubs: [],

  isSmallKidsMode: function () {
    try {
      return localStorage.getItem(this._smallKidsKey) === "true";
    } catch (e) {
      return false;
    }
  },

  setSmallKidsMode: function (enabled) {
    var next = !!enabled;
    try {
      localStorage.setItem(this._smallKidsKey, next ? "true" : "false");
    } catch (e) {}
    this._applySmallKidsModeClass(next);
    for (var i = 0; i < this._smallKidsSubs.length; i++) {
      try {
        this._smallKidsSubs[i](next);
      } catch (e) {}
    }
  },

  toggleSmallKidsMode: function () {
    this.setSmallKidsMode(!this.isSmallKidsMode());
    return this.isSmallKidsMode();
  },

  /**
   * Subscribe to small-kids-mode changes.
   * @param {(enabled:boolean)=>void} fn
   * @returns {()=>void} unsubscribe
   */
  onSmallKidsModeChange: function (fn) {
    if (typeof fn !== "function") return function () {};
    this._smallKidsSubs.push(fn);
    var subs = this._smallKidsSubs;
    return function () {
      var idx = subs.indexOf(fn);
      if (idx >= 0) subs.splice(idx, 1);
    };
  },

  /**
   * Sync the <body> class with the stored flag. Idempotent; safe to call
   * during init.
   */
  applySmallKidsModeToDom: function () {
    this._applySmallKidsModeClass(this.isSmallKidsMode());
  },

  _applySmallKidsModeClass: function (enabled) {
    if (typeof document === "undefined" || !document.body) return;
    document.body.classList.toggle("small-kids-mode", !!enabled);
  },
};
