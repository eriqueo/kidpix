import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// kids-mode.js is an IIFE that registers itself on window.KiddoPaint and runs
// init() once on load. We re-import it fresh for each test by clearing the
// module cache so the IIFE re-evaluates against the current jsdom state.
async function loadKidsMode() {
  vi.resetModules();
  await import("./kids-mode.js?t=" + Math.random());
  return window.KiddoPaint.KidsMode;
}

function clearKidsMode() {
  if (window.KiddoPaint) {
    delete window.KiddoPaint.KidsMode;
  }
  document.body.className = "";
  document.body.innerHTML = '<div id="titlebar"></div>';
  localStorage.clear();
  // Reset URL so urlEnabled() reads cleanly between tests.
  window.history.replaceState({}, "", "/");
}

describe("KiddoPaint.KidsMode", () => {
  beforeEach(() => {
    if (!window.KiddoPaint) window.KiddoPaint = {};
    clearKidsMode();
  });

  afterEach(() => {
    clearKidsMode();
  });

  it("does not apply the body class when no flag is set", async () => {
    const KidsMode = await loadKidsMode();
    expect(KidsMode.isEnabled()).toBe(false);
    expect(document.body.classList.contains("kids-mode")).toBe(false);
  });

  it("enable() adds the body class and persists to localStorage", async () => {
    const KidsMode = await loadKidsMode();
    KidsMode.enable();
    expect(document.body.classList.contains("kids-mode")).toBe(true);
    expect(localStorage.getItem(KidsMode.STORAGE_KEY)).toBe("true");
    expect(KidsMode.isEnabled()).toBe(true);
  });

  it("disable() removes the body class and persists", async () => {
    const KidsMode = await loadKidsMode();
    KidsMode.enable();
    KidsMode.disable();
    expect(document.body.classList.contains("kids-mode")).toBe(false);
    expect(localStorage.getItem(KidsMode.STORAGE_KEY)).toBe("false");
    expect(KidsMode.isEnabled()).toBe(false);
  });

  it("toggle() flips between enabled and disabled", async () => {
    const KidsMode = await loadKidsMode();
    expect(KidsMode.isEnabled()).toBe(false);
    KidsMode.toggle();
    expect(KidsMode.isEnabled()).toBe(true);
    expect(document.body.classList.contains("kids-mode")).toBe(true);
    KidsMode.toggle();
    expect(KidsMode.isEnabled()).toBe(false);
    expect(document.body.classList.contains("kids-mode")).toBe(false);
  });

  it("persists across a simulated page reload (re-import re-reads storage)", async () => {
    let KidsMode = await loadKidsMode();
    KidsMode.enable();
    expect(document.body.classList.contains("kids-mode")).toBe(true);

    // Simulate a reload: drop the body class, re-evaluate the module. The
    // localStorage entry should drive the body class back on via init().
    document.body.classList.remove("kids-mode");
    delete window.KiddoPaint.KidsMode;
    KidsMode = await loadKidsMode();
    expect(KidsMode.isEnabled()).toBe(true);
    expect(document.body.classList.contains("kids-mode")).toBe(true);
  });

  it("URL flag ?kidsMode=1 turns the mode on at init time", async () => {
    window.history.replaceState({}, "", "/?kidsMode=1");
    const KidsMode = await loadKidsMode();
    expect(KidsMode.isEnabled()).toBe(true);
    expect(document.body.classList.contains("kids-mode")).toBe(true);
    // …and persists for subsequent navigations without the query string.
    expect(localStorage.getItem(KidsMode.STORAGE_KEY)).toBe("true");
  });
});
