/**
 * KiddoPaint.Speech
 *
 * Thin wrapper around the Web Speech API (SpeechSynthesis) used by the text
 * tool to read A–Z and 0–9 aloud as the user types — a stylistic fan
 * equivalent of the original KidPix's sampled-voice readback. Pre-recorded
 * letter samples already exist in snd/text/ and play when a letter button
 * is clicked; this module covers the keyboard-typing path with TTS so the
 * behavior works without bundling additional audio.
 *
 * Design choices:
 * - Feature-detect SpeechSynthesis; degrade to a no-op when unavailable.
 * - Single utterance at a time: cancel-on-overflow so rapid typing doesn't
 *   queue lagging audio.
 * - Voice selection: wait once for `voiceschanged` (Firefox starts empty)
 *   and prefer an English voice. Best-effort, deterministic given the
 *   browser's voice list.
 * - Mute state persisted to localStorage under `kidpix.textTool.speechMuted`.
 * - First utterance is gated on a user gesture by the caller (the text-tool
 *   toolbar click counts) — we don't synthesize before any input.
 */

KiddoPaint.Speech = (function () {
  var STORAGE_KEY = "kidpix.textTool.speechMuted";
  var SPEAK_PATTERN = /^[A-Za-z0-9]$/;

  var supported =
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof window.SpeechSynthesisUtterance !== "undefined";

  var voicesReady = null;
  var preferredVoice = null;

  function readMuted() {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch (_) {
      return false;
    }
  }

  function writeMuted(muted) {
    try {
      localStorage.setItem(STORAGE_KEY, muted ? "true" : "false");
    } catch (_) {
      // Private browsing / disabled storage — silently ignore.
    }
  }

  function pickVoice(voices) {
    if (!voices || !voices.length) return null;
    // Prefer an English voice; otherwise fall back to the default.
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.toLowerCase().indexOf("en") === 0) {
        return voices[i];
      }
    }
    return voices[0];
  }

  function ensureVoices() {
    if (!supported) return Promise.resolve(null);
    if (voicesReady) return voicesReady;
    voicesReady = new Promise(function (resolve) {
      var voices = window.speechSynthesis.getVoices();
      if (voices && voices.length) {
        preferredVoice = pickVoice(voices);
        resolve(preferredVoice);
        return;
      }
      // Firefox / Chrome populate the list asynchronously.
      var settled = false;
      var onChange = function () {
        if (settled) return;
        var v = window.speechSynthesis.getVoices();
        if (v && v.length) {
          settled = true;
          preferredVoice = pickVoice(v);
          window.speechSynthesis.removeEventListener &&
            window.speechSynthesis.removeEventListener(
              "voiceschanged",
              onChange,
            );
          resolve(preferredVoice);
        }
      };
      if (window.speechSynthesis.addEventListener) {
        window.speechSynthesis.addEventListener("voiceschanged", onChange);
      } else {
        window.speechSynthesis.onvoiceschanged = onChange;
      }
      // Fallback timeout so callers don't wait forever on Safari iOS, which
      // may never fire voiceschanged. Speaking without a chosen voice is
      // fine — the browser uses its default.
      setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(null);
      }, 1000);
    });
    return voicesReady;
  }

  // Best-effort detection that a screen reader is announcing keystrokes
  // already; we don't want to double-speak. There is no reliable browser
  // API, so we honor an explicit opt-out via the mute toggle (set by the
  // user) and a `data-screen-reader` attribute on <body> for embedders.
  function likelyScreenReaderActive() {
    if (typeof document === "undefined" || !document.body) return false;
    var attr = document.body.getAttribute("data-screen-reader");
    return attr === "true" || attr === "1";
  }

  function canSpeak(ch) {
    if (!supported) return false;
    if (readMuted()) return false;
    if (likelyScreenReaderActive()) return false;
    return SPEAK_PATTERN.test(ch);
  }

  function speak(ch) {
    if (!canSpeak(ch)) return false;
    // Normalize to uppercase so "a" and "A" sound the same.
    var text = ch.toUpperCase();
    ensureVoices().then(function () {
      try {
        // Cancel anything pending so rapid typing doesn't accumulate.
        window.speechSynthesis.cancel();
        var utter = new window.SpeechSynthesisUtterance(text);
        if (preferredVoice) utter.voice = preferredVoice;
        utter.rate = 1;
        utter.pitch = 1;
        window.speechSynthesis.speak(utter);
      } catch (_) {
        // Speech can throw on some Safari builds — swallow silently.
      }
    });
    return true;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    SPEAK_PATTERN: SPEAK_PATTERN,
    isSupported: function () {
      return supported;
    },
    isMuted: readMuted,
    setMuted: function (muted) {
      writeMuted(!!muted);
      if (muted && supported) {
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}
      }
    },
    toggleMuted: function () {
      var next = !readMuted();
      writeMuted(next);
      if (next && supported) {
        try {
          window.speechSynthesis.cancel();
        } catch (_) {}
      }
      return next;
    },
    canSpeak: canSpeak,
    speak: speak,
  };
})();
