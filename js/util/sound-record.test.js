import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Tiny in-test MediaRecorder fake. Tracks state and lets the test drive
// ondataavailable + onstop on demand.
class FakeMediaRecorder {
  constructor(stream) {
    this.stream = stream;
    this.state = "inactive";
    this.mimeType = "audio/webm";
    FakeMediaRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
  }
  stop() {
    if (this.state === "inactive") return;
    this.state = "inactive";
    // Mimic real MediaRecorder: flush a chunk, then fire onstop.
    if (this.ondataavailable)
      this.ondataavailable({
        data: new Blob(["chunk"], { type: "audio/webm" }),
      });
    if (this.onstop) this.onstop();
  }
}
FakeMediaRecorder.instances = [];

function fakeStream() {
  const tracks = [{ stop: vi.fn() }];
  return { getTracks: () => tracks };
}

async function importFresh() {
  // Re-import the module so its internal _activeRecorder state resets between
  // tests; vitest caches by default.
  vi.resetModules();
  return await import("./sound-record.js");
}

beforeEach(() => {
  FakeMediaRecorder.instances = [];
  globalThis.MediaRecorder = FakeMediaRecorder;
  // jsdom has no localStorage clear between tests; do it ourselves.
  try {
    localStorage.clear();
  } catch (e) {}
});

afterEach(() => {
  delete globalThis.MediaRecorder;
  // Reset navigator.mediaDevices between tests
  try {
    delete navigator.mediaDevices;
  } catch (e) {}
});

describe("sound-record.record()", () => {
  it("rejects with 'media-unavailable' when MediaRecorder is missing", async () => {
    delete globalThis.MediaRecorder;
    const m = await importFresh();
    await expect(m.record()).rejects.toThrow("media-unavailable");
  });

  it("rejects with 'permission-denied' when getUserMedia is denied", async () => {
    navigator.mediaDevices = {
      getUserMedia: vi.fn(() => Promise.reject(new Error("NotAllowedError"))),
    };
    const m = await importFresh();
    await expect(m.record()).rejects.toThrow("permission-denied");
  });

  it("stores a base64 data URL in localStorage after stop()", async () => {
    navigator.mediaDevices = {
      getUserMedia: vi.fn(() => Promise.resolve(fakeStream())),
    };
    const m = await importFresh();
    const p = m.record(5000);
    // Wait a tick so the getUserMedia promise + recorder construction settles.
    await new Promise((r) => setTimeout(r, 0));
    m.stop();
    const blob = await p;
    expect(blob).toBeInstanceOf(Blob);
    const stored = localStorage.getItem(m.STORAGE_KEY);
    expect(stored).toMatch(/^data:audio\/webm;base64,/);
  });

  it("auto-stops at the maxMs cap", async () => {
    vi.useFakeTimers();
    navigator.mediaDevices = {
      getUserMedia: vi.fn(() => Promise.resolve(fakeStream())),
    };
    const m = await importFresh();
    const p = m.record(300);
    // Let microtasks run so getUserMedia resolves and MediaRecorder is wired.
    await vi.advanceTimersByTimeAsync(0);
    expect(m.isRecording()).toBe(true);
    await vi.advanceTimersByTimeAsync(350);
    const blob = await p;
    expect(blob).toBeInstanceOf(Blob);
    expect(m.isRecording()).toBe(false);
    vi.useRealTimers();
  });

  it("caps requested length at MAX_CLIP_MS (15s)", async () => {
    vi.useFakeTimers();
    navigator.mediaDevices = {
      getUserMedia: vi.fn(() => Promise.resolve(fakeStream())),
    };
    const m = await importFresh();
    const p = m.record(60000);
    await vi.advanceTimersByTimeAsync(0);
    // Just under the cap: still recording.
    await vi.advanceTimersByTimeAsync(m.MAX_CLIP_MS - 10);
    expect(m.isRecording()).toBe(true);
    // Past the cap: stopped.
    await vi.advanceTimersByTimeAsync(20);
    await p;
    expect(m.isRecording()).toBe(false);
    vi.useRealTimers();
  });
});

describe("sound-record.playLatest() / clear()", () => {
  it("returns null when nothing is stored", async () => {
    const m = await importFresh();
    expect(m.playLatest()).toBeNull();
  });

  it("plays the stored clip via an Audio element", async () => {
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, "play")
      .mockImplementation(function () {
        return Promise.resolve();
      });
    localStorage.setItem("kiddopaint_sound", "data:audio/webm;base64,AAAA");
    const m = await importFresh();
    const audio = m.playLatest();
    expect(audio).toBeInstanceOf(HTMLAudioElement);
    expect(playSpy).toHaveBeenCalled();
    playSpy.mockRestore();
  });

  it("clear() removes the stored clip", async () => {
    localStorage.setItem("kiddopaint_sound", "data:audio/webm;base64,AAAA");
    const m = await importFresh();
    m.clear();
    expect(localStorage.getItem("kiddopaint_sound")).toBeNull();
  });

  it("hasStored() reflects whether a clip is present", async () => {
    const m = await importFresh();
    expect(m.hasStored()).toBe(false);
    localStorage.setItem("kiddopaint_sound", "data:audio/webm;base64,AAAA");
    expect(m.hasStored()).toBe(true);
  });
});

describe("storage round-trip", () => {
  it("survives clear / record / playLatest", async () => {
    navigator.mediaDevices = {
      getUserMedia: vi.fn(() => Promise.resolve(fakeStream())),
    };
    const m = await importFresh();
    m.clear();
    expect(m.hasStored()).toBe(false);
    const p = m.record(1000);
    await new Promise((r) => setTimeout(r, 0));
    m.stop();
    await p;
    expect(m.hasStored()).toBe(true);
    expect(localStorage.getItem(m.STORAGE_KEY)).toMatch(/^data:audio\/webm;/);
  });
});
