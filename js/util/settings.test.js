import { describe, it, expect, beforeEach } from "vitest";

if (!global.window.KiddoPaint) {
  global.window.KiddoPaint = {};
}

await import("./settings.js");

const Settings = window.KiddoPaint.Settings;
const KEY = "kiddopaint.settings.smallKidsMode";

describe("KiddoPaint.Settings — Small Kids Mode", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.className = "";
    // Drop any subscribers leaked from earlier tests.
    Settings._smallKidsSubs.length = 0;
  });

  it("defaults to false when localStorage is empty", () => {
    expect(Settings.isSmallKidsMode()).toBe(false);
  });

  it("persists set value to the namespaced localStorage key", () => {
    Settings.setSmallKidsMode(true);
    expect(localStorage.getItem(KEY)).toBe("true");
    expect(Settings.isSmallKidsMode()).toBe(true);
  });

  it("coerces truthy/falsy inputs to booleans", () => {
    Settings.setSmallKidsMode(1);
    expect(Settings.isSmallKidsMode()).toBe(true);
    Settings.setSmallKidsMode(0);
    expect(Settings.isSmallKidsMode()).toBe(false);
  });

  it("toggles and returns the new value", () => {
    expect(Settings.toggleSmallKidsMode()).toBe(true);
    expect(Settings.toggleSmallKidsMode()).toBe(false);
  });

  it("syncs body.small-kids-mode class on set", () => {
    Settings.setSmallKidsMode(true);
    expect(document.body.classList.contains("small-kids-mode")).toBe(true);
    Settings.setSmallKidsMode(false);
    expect(document.body.classList.contains("small-kids-mode")).toBe(false);
  });

  it("applySmallKidsModeToDom mirrors the stored flag", () => {
    localStorage.setItem(KEY, "true");
    Settings.applySmallKidsModeToDom();
    expect(document.body.classList.contains("small-kids-mode")).toBe(true);
  });

  it("notifies subscribers and supports unsubscribe", () => {
    const calls = [];
    const off = Settings.onSmallKidsModeChange((v) => calls.push(v));
    Settings.setSmallKidsMode(true);
    Settings.setSmallKidsMode(false);
    off();
    Settings.setSmallKidsMode(true);
    expect(calls).toEqual([true, false]);
  });

  it("does not collide with the keyboard-shortcuts key", () => {
    Settings.setSmallKidsMode(true);
    expect(
      localStorage.getItem("kiddopaint.settings.keyboardShortcutsEnabled"),
    ).toBe(null);
  });
});
