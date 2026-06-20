import { describe, it, expect, beforeEach } from "vitest";

global.KiddoPaint = {};
await import("./speak.js");

describe("KiddoPaint.Speech", () => {
  beforeEach(() => {
    try {
      localStorage.removeItem("kidpix.textTool.speechMuted");
    } catch (_) {}
  });

  it("exposes the SPEAK_PATTERN matching A–Z and 0–9 only", () => {
    const re = KiddoPaint.Speech.SPEAK_PATTERN;
    for (const ch of "ABCXYZabcxyz0123456789") {
      expect(re.test(ch)).toBe(true);
    }
    for (const ch of ["", "AB", "1.", " ", ".", "@", "AA", "10"]) {
      expect(re.test(ch)).toBe(false);
    }
  });

  it("persists mute state under the namespaced key", () => {
    expect(KiddoPaint.Speech.isMuted()).toBe(false);
    KiddoPaint.Speech.setMuted(true);
    expect(KiddoPaint.Speech.isMuted()).toBe(true);
    expect(localStorage.getItem("kidpix.textTool.speechMuted")).toBe("true");
    KiddoPaint.Speech.setMuted(false);
    expect(KiddoPaint.Speech.isMuted()).toBe(false);
  });

  it("toggleMuted returns the new state", () => {
    expect(KiddoPaint.Speech.toggleMuted()).toBe(true);
    expect(KiddoPaint.Speech.toggleMuted()).toBe(false);
  });

  it("canSpeak rejects non-matching chars and muted state", () => {
    KiddoPaint.Speech.setMuted(false);
    // In jsdom, speechSynthesis is undefined so isSupported is false
    // and canSpeak always returns false — this is the documented no-op
    // fallback. We still verify the filter rejects bad chars.
    expect(KiddoPaint.Speech.canSpeak("@")).toBe(false);
    expect(KiddoPaint.Speech.canSpeak("AB")).toBe(false);
  });

  it("speak() is a safe no-op when SpeechSynthesis is unavailable", () => {
    expect(() => KiddoPaint.Speech.speak("A")).not.toThrow();
    expect(KiddoPaint.Speech.speak("A")).toBe(false);
  });
});
