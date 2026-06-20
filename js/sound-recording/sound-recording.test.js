import { describe, it, expect, beforeEach, vi } from "vitest";

// Minimal DOM scaffolding the module needs to attach to.
function bootstrapDom() {
  document.body.innerHTML =
    '<div id="mainbar"></div>' +
    '<div id="paint"></div>' +
    '<div id="statusbar-text"></div>';
}

async function loadModule() {
  vi.resetModules();
  await import("./sound-recording.js");
}

describe("sound-recording feature flag", () => {
  beforeEach(() => {
    bootstrapDom();
    localStorage.clear();
    delete window.KiddoPaint;
    window.KiddoPaint = { ToolDescriptions: {} };
  });

  it("does not inject buttons when localStorage flag is set", async () => {
    localStorage.setItem("kiddopaint_soundrec_off", "1");
    await loadModule();
    expect(document.getElementById("record-sound")).toBeNull();
    expect(document.getElementById("play-sound")).toBeNull();
  });
});

describe("sound-recording UI + helpers", () => {
  beforeEach(() => {
    bootstrapDom();
    localStorage.clear();
    delete window.KiddoPaint;
    window.KiddoPaint = { ToolDescriptions: {} };
  });

  it("injects Record + Play buttons into the toolbar", async () => {
    await loadModule();
    const rec = document.getElementById("record-sound");
    const play = document.getElementById("play-sound");
    expect(rec).not.toBeNull();
    expect(play).not.toBeNull();
    expect(rec.getAttribute("title")).toBe("Record Sound");
    expect(play.getAttribute("title")).toBe("Play Sound");
  });

  it("registers status-bar descriptions for the new tools", async () => {
    await loadModule();
    expect(window.KiddoPaint.ToolDescriptions["Record Sound"]).toMatch(
      /record/i,
    );
    expect(window.KiddoPaint.ToolDescriptions["Play Sound"]).toMatch(/play/i);
  });

  it("exposes a versioned meta schema with backward-compat read", async () => {
    await loadModule();
    const api = window.KiddoPaint.SoundRecording;
    expect(api.SCHEMA_VERSION).toBeGreaterThanOrEqual(2);

    // Pre-feature save: no meta -> defaults to current version, no sound.
    expect(api.readMeta()).toEqual({ version: api.SCHEMA_VERSION });

    // A v1-style payload (no version field) is treated as v1, not dropped.
    localStorage.setItem("kiddopaint_meta", JSON.stringify({ foo: "bar" }));
    const upgraded = api.readMeta();
    expect(upgraded.foo).toBe("bar");
    expect(upgraded.version).toBe(1);
  });

  it("picks a supported MIME type or returns empty string", async () => {
    // Force a deterministic codec path.
    const originalMR = global.MediaRecorder;
    global.MediaRecorder = function () {};
    global.MediaRecorder.isTypeSupported = (t) => t === "audio/webm;codecs=opus";
    await loadModule();
    const mime = window.KiddoPaint.SoundRecording.pickMimeType();
    expect(mime).toBe("audio/webm;codecs=opus");
    global.MediaRecorder = originalMR;
  });

  it("returns null pickMimeType when MediaRecorder is unavailable", async () => {
    const originalMR = global.MediaRecorder;
    delete global.MediaRecorder;
    await loadModule();
    expect(window.KiddoPaint.SoundRecording.pickMimeType()).toBeNull();
    global.MediaRecorder = originalMR;
  });
});
