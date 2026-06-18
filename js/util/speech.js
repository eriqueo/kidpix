/**
 * KiddoPaint.Speech
 * Thin, defensive wrapper around window.speechSynthesis that speaks the
 * names of letters and numbers selected in the Text tool. Works in
 * English (en-US) and Spanish (es-ES); persists the language choice in
 * localStorage. No-ops gracefully when the Web Speech API is unavailable
 * (e.g. under jsdom in tests, or in browsers without speechSynthesis).
 */

if (typeof KiddoPaint === "undefined") {
  var KiddoPaint = {};
}

KiddoPaint.Speech = (function () {
  var LANG_KEY = "kiddopaint.settings.textSpeechLang";
  var DEFAULT_LANG = "en-US";
  var SUPPORTED = ["en-US", "es-ES"];

  // Spoken names for digit strings (multi-digit values like "10"-"25" used
  // by the Text tool's number page need a real word, not letter-by-letter).
  var DIGIT_WORDS = {
    "en-US": {
      "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
      "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
      "10": "ten", "11": "eleven", "12": "twelve", "13": "thirteen",
      "14": "fourteen", "15": "fifteen", "16": "sixteen", "17": "seventeen",
      "18": "eighteen", "19": "nineteen", "20": "twenty",
      "21": "twenty one", "22": "twenty two", "23": "twenty three",
      "24": "twenty four", "25": "twenty five",
    },
    "es-ES": {
      "0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro",
      "5": "cinco", "6": "seis", "7": "siete", "8": "ocho", "9": "nueve",
      "10": "diez", "11": "once", "12": "doce", "13": "trece",
      "14": "catorce", "15": "quince", "16": "dieciséis", "17": "diecisiete",
      "18": "dieciocho", "19": "diecinueve", "20": "veinte",
      "21": "veintiuno", "22": "veintidós", "23": "veintitrés",
      "24": "veinticuatro", "25": "veinticinco",
    },
  };

  function getSynth() {
    if (typeof window === "undefined") return null;
    if (!window.speechSynthesis) return null;
    if (typeof window.SpeechSynthesisUtterance !== "function") return null;
    return window.speechSynthesis;
  }

  function getLang() {
    try {
      var v = (typeof localStorage !== "undefined") &&
        localStorage.getItem(LANG_KEY);
      if (v && SUPPORTED.indexOf(v) !== -1) return v;
    } catch (e) { /* ignore */ }
    return DEFAULT_LANG;
  }

  function setLang(lang) {
    if (SUPPORTED.indexOf(lang) === -1) return;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
  }

  // Convert a Text-tool character into a speakable phrase for the given lang.
  function phraseFor(text, lang) {
    if (text == null) return "";
    var s = String(text);
    if (DIGIT_WORDS[lang] && DIGIT_WORDS[lang][s] != null) {
      return DIGIT_WORDS[lang][s];
    }
    // Letters and unknown single chars: speak the character itself; the
    // chosen voice's locale will pronounce A as "ay" (en) or "ah" (es).
    return s;
  }

  function speak(text, opts) {
    var synth = getSynth();
    if (!synth) return false;
    var lang = (opts && opts.lang) || getLang();
    var phrase = phraseFor(text, lang);
    if (!phrase) return false;
    try {
      synth.cancel();
      var u = new window.SpeechSynthesisUtterance(phrase);
      u.lang = lang;
      u.rate = 0.9;
      synth.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    LANG_KEY: LANG_KEY,
    SUPPORTED: SUPPORTED,
    DEFAULT_LANG: DEFAULT_LANG,
    getLang: getLang,
    setLang: setLang,
    phraseFor: phraseFor,
    speak: speak,
    isAvailable: function () { return getSynth() !== null; },
  };
})();

if (typeof window !== "undefined") {
  window.KiddoPaint = window.KiddoPaint || {};
  window.KiddoPaint.Speech = KiddoPaint.Speech;
}
