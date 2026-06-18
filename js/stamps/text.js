// Pull in the speech helper so the Text tool can speak letters/numbers
// when a child selects one. Keeps the wiring self-contained inside the
// Text-tool module rather than scattering it across init code.
import "../util/speech.js";

KiddoPaint.Text.english = {
  face: "sans-serif",
  pages: 3,
  character1: {
    letters: [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "Z",
    ],
  },
  character2: {
    letters: [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16",
      "17",
      "18",
      "19",
      "20",
      "21",
      "22",
      "23",
      "24",
      "25",
    ],
  },
  character3: {
    letters: [
      ".",
      "!",
      "?",
      "@",
      "#",
      "$",
      "%",
      "^",
      "&",
      "*",
      "+",
      "-",
      "=",
      "(",
      ")",
      "[",
      "]",
      "{",
      "}",
      "<",
      ">",
      "|",
      ",",
      ";",
      ":",
      "'",
      '"',
      "\\",
      "/",
      "_",
    ],
  },
};

KiddoPaint.Text.wingdings = {
  face: "sans-serif",
  pages: 4,
  character1: {
    letters: ["✗", "◎", "✘", "❍", "✖︎", "⚬", "✕", "✧"],
    //        cards: ['🂡', '🂢', '🂣', '🂤', '🂥', '🂦', '🂧', '🂨', '🂩', '🂪', '🂫', '🂬', '🂭', '🂮', '🂱', '🂲', '🂳', '🂴', '🂵', '🂶', '🂷', '🂸', '🂹', '🂺', '🂻', '🂼', '🂽', '🂾', '🃁', '🃂', '🃃', '🃄', '🃅', '🃆', '🃇', '🃈', '🃉', '🃊', '🃋', '🃌', '🃍', '🃎', '🃑', '🃒', '🃓', '🃔', '🃕', '🃖', '🃗', '🃘', '🃙', '🃚', '🃛', '🃜', '🃝', '🃞', '🃟']
  },
  character2: {
    letters: [
      "❖",
      "◎",
      "◉",
      "⦿",
      "✢",
      "✣",
      "✤",
      "✥",
      "✦",
      "✧",
      "★",
      "☆",
      "✯",
      "✩",
      "✪",
      "✫",
      "✬",
      "✭",
      "✮",
      "✶",
      "✷",
      "✵",
      "✸",
      "✹",
      "✺",
      "❊",
      "✻",
      "✽",
      "✼",
      "❉",
      "✱",
      "✲",
      "✾",
      "❃",
      "❋",
      "✳",
      "✴",
      "❇",
      "❈",
      "※",
      "❅",
      "❆",
      "❄",
      "✿",
      "❀",
      "❁",
      "❂",
      "☙",
      "❧",
      "❦",
    ],
  },
  character3: {
    letters: ["♠", "♣", "♥", "♦"],
  },
  character4: {
    letters: [
      "◭",
      "⧑",
      "◮",
      "⧒",
      "⧖",
      "◹",
      "⬣",
      "◩",
      "◁",
      "⊙",
      "⊖",
      "▩",
      "◵",
      "⬕",
      "◫",
      "⬔",
      "⋄",
      "◔",
      "◱",
      "▹",
      "◯",
      "⦶",
      "❏",
      "◷",
      "⬘",
      "⊘",
      "⊚",
      "⧨",
      "◀",
      "❐",
      "◰",
      "⬖",
      "⊿",
      "⦿",
      "△",
      "◊",
      "⧋",
      "◈",
      "◺",
      "⧊",
      "◿",
      "◶",
      "◸",
      "▪",
      "◎",
      "⬚",
      "⟁",
      "◤",
      "▵",
      "▨",
      "▷",
      "◓",
      "◇",
      "⬠",
      "◅",
      "▴",
      "▸",
      "◂",
      "◃",
      "◉",
      "◨",
      "◪",
      "⬙",
      "⬡",
      "◬",
      "⬒",
      "∆",
      "⌔",
      "⊝",
      "▣",
      "◣",
      "❍",
      "◒",
      "◥",
      "▰",
      "⊜",
      "◳",
      "▻",
      "⎔",
      "◴",
      "⦸",
      "⬢",
      "∇",
      "⬗",
      "▼",
      "▾",
      "◆",
      "⬓",
      "⧩",
      "⧫",
      "◧",
      "◕",
      "▧",
      "⊠",
      "❑",
      "⊛",
      "⧗",
      "◐",
      "▦",
      "❒",
      "◢",
      "⦾",
      "▿",
      "◑",
      "⟐",
      "▶",
      "▤",
      "▲",
      "◲",
      "⧓",
      "◼",
      "▥",
      "▽",
    ],
  },
};

KiddoPaint.Text.nextPage = function () {
  KiddoPaint.Text.page += 1;
  if (KiddoPaint.Text.page > KiddoPaint.Text.english.pages) {
    KiddoPaint.Text.page = 1;
  }
};

// --- Speech wiring ------------------------------------------------------
// Speaks the name of a selected letter/number through the Web Speech API.
// Uses event delegation on the #texttoolbar so we hook the Text tool's
// selection event without modifying the central event dispatcher.
KiddoPaint.Text.speakStamp = function (stamp) {
  if (typeof window === "undefined") return;
  if (!window.KiddoPaint || !window.KiddoPaint.Speech) return;
  window.KiddoPaint.Speech.speak(stamp);
};

KiddoPaint.Text.initSpeechWiring = function () {
  if (typeof document === "undefined") return;
  var bar = document.getElementById("texttoolbar");
  if (!bar) return;

  // Letter / number selection: any xal* button click should speak it.
  bar.addEventListener("mousedown", function (ev) {
    var target = ev.target;
    while (target && target !== bar && !(target.id && /^xal\d+$/.test(target.id))) {
      target = target.parentNode;
    }
    if (!target || target === bar) return;
    if (!target.firstChild) return;
    var label = (target.firstChild.nodeValue || "").trim();
    if (!label) return;
    KiddoPaint.Text.speakStamp(label);
  });

  // Language toggle button: flip en-US <-> es-ES and persist.
  var langBtn = document.getElementById("speechlang");
  if (langBtn && window.KiddoPaint && window.KiddoPaint.Speech) {
    var Speech = window.KiddoPaint.Speech;
    var refresh = function () {
      var h1 = langBtn.querySelector("h1");
      if (h1) h1.textContent = Speech.getLang() === "es-ES" ? "ES" : "EN";
    };
    refresh();
    langBtn.addEventListener("mousedown", function () {
      var next = Speech.getLang() === "en-US" ? "es-ES" : "en-US";
      Speech.setLang(next);
      refresh();
      // Demo the new language using the currently-selected character.
      if (window.KiddoPaint.Tools && window.KiddoPaint.Tools.Stamp) {
        Speech.speak(window.KiddoPaint.Tools.Stamp.stamp);
      }
    });
  }
};

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      KiddoPaint.Text.initSpeechWiring();
    });
  } else {
    KiddoPaint.Text.initSpeechWiring();
  }
}

KiddoPaint.Text.nextWingding = (function (page) {
  var idx = 0;
  return function (page) {
    if (idx >= KiddoPaint.Text.wingdings["character" + page].letters.length) {
      idx = 0;
    }
    var ret = KiddoPaint.Text.wingdings["character" + page].letters[idx];
    idx += 1;
    return ret;
  };
})();
