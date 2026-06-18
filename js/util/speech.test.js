import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

if (!global.window.KiddoPaint) {
  global.window.KiddoPaint = {};
}

await import("./speech.js");

const Speech = window.KiddoPaint.Speech;

function installMockSynth() {
  const speak = vi.fn();
  const cancel = vi.fn();
  class FakeUtterance {
    constructor(text) {
      this.text = text;
      this.lang = "";
      this.rate = 1;
    }
  }
  window.speechSynthesis = { speak, cancel };
  window.SpeechSynthesisUtterance = FakeUtterance;
  return { speak, cancel, FakeUtterance };
}

function clearSynth() {
  delete window.speechSynthesis;
  delete window.SpeechSynthesisUtterance;
}

describe("KiddoPaint.Speech", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    clearSynth();
  });

  describe("when speechSynthesis is unavailable (jsdom default)", () => {
    it("is not available", () => {
      clearSynth();
      expect(Speech.isAvailable()).toBe(false);
    });

    it("speak() returns false and does not throw", () => {
      clearSynth();
      expect(() => Speech.speak("A")).not.toThrow();
      expect(Speech.speak("A")).toBe(false);
    });
  });

  describe("language persistence", () => {
    it("defaults to en-US", () => {
      expect(Speech.getLang()).toBe("en-US");
    });

    it("persists a supported language", () => {
      Speech.setLang("es-ES");
      expect(Speech.getLang()).toBe("es-ES");
      expect(localStorage.getItem(Speech.LANG_KEY)).toBe("es-ES");
    });

    it("ignores unsupported languages", () => {
      Speech.setLang("es-ES");
      Speech.setLang("fr-FR");
      expect(Speech.getLang()).toBe("es-ES");
    });
  });

  describe("phraseFor()", () => {
    it("maps digits to English words", () => {
      expect(Speech.phraseFor("0", "en-US")).toBe("zero");
      expect(Speech.phraseFor("7", "en-US")).toBe("seven");
      expect(Speech.phraseFor("12", "en-US")).toBe("twelve");
      expect(Speech.phraseFor("25", "en-US")).toBe("twenty five");
    });

    it("maps digits to Spanish words", () => {
      expect(Speech.phraseFor("0", "es-ES")).toBe("cero");
      expect(Speech.phraseFor("7", "es-ES")).toBe("siete");
      expect(Speech.phraseFor("12", "es-ES")).toBe("doce");
      expect(Speech.phraseFor("25", "es-ES")).toBe("veinticinco");
    });

    it("passes letters through unchanged (locale voice pronounces them)", () => {
      expect(Speech.phraseFor("A", "en-US")).toBe("A");
      expect(Speech.phraseFor("Z", "es-ES")).toBe("Z");
    });
  });

  describe("speak() with mocked speechSynthesis", () => {
    it("speaks a letter with the requested language", () => {
      const { speak } = installMockSynth();
      const ok = Speech.speak("A", { lang: "en-US" });
      expect(ok).toBe(true);
      expect(speak).toHaveBeenCalledTimes(1);
      const utt = speak.mock.calls[0][0];
      expect(utt.text).toBe("A");
      expect(utt.lang).toBe("en-US");
    });

    it("speaks the Spanish digit word when lang is es-ES", () => {
      const { speak } = installMockSynth();
      Speech.speak("7", { lang: "es-ES" });
      const utt = speak.mock.calls[0][0];
      expect(utt.text).toBe("siete");
      expect(utt.lang).toBe("es-ES");
    });

    it("uses persisted language when no lang option is given", () => {
      const { speak } = installMockSynth();
      Speech.setLang("es-ES");
      Speech.speak("0");
      const utt = speak.mock.calls[0][0];
      expect(utt.text).toBe("cero");
      expect(utt.lang).toBe("es-ES");
    });

    it("cancels any pending speech before speaking", () => {
      const { speak, cancel } = installMockSynth();
      Speech.speak("A");
      expect(cancel).toHaveBeenCalled();
      expect(speak).toHaveBeenCalled();
    });

    it("returns false for empty / null input", () => {
      installMockSynth();
      expect(Speech.speak(null)).toBe(false);
      expect(Speech.speak("")).toBe(false);
    });

    it("speaks every English letter A-Z", () => {
      const { speak } = installMockSynth();
      for (var i = 0; i < 26; i++) {
        var ch = String.fromCharCode(65 + i);
        Speech.speak(ch, { lang: "en-US" });
        var utt = speak.mock.calls[i][0];
        expect(utt.text).toBe(ch);
        expect(utt.lang).toBe("en-US");
      }
    });

    it("speaks every digit 0-9 in both languages", () => {
      const { speak } = installMockSynth();
      for (var i = 0; i <= 9; i++) {
        Speech.speak(String(i), { lang: "en-US" });
        Speech.speak(String(i), { lang: "es-ES" });
      }
      // 20 calls total
      expect(speak).toHaveBeenCalledTimes(20);
    });
  });
});
