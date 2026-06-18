// DrawMe! UI: registers a button + banner that displays and speaks a
// randomly-composed silly-scene prompt. Composer lives in js/util/drawme.js.
import "../util/drawme.js";
import phrases from "../util/drawme-phrases.json";

var BANNER_ID = "drawme-banner";
var BUTTON_ID = "drawme-button";
var STYLE_ID = "drawme-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  var style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent =
    "#" +
    BANNER_ID +
    "{position:fixed;top:8px;left:50%;transform:translateX(-50%);" +
    "background:#ffeb3b;color:#222;border:2px solid #222;border-radius:8px;" +
    "padding:8px 16px;font:bold 18px/1.2 sans-serif;z-index:9999;" +
    "box-shadow:2px 2px 0 #222;max-width:90vw;text-align:center;display:none;}";
  document.head.appendChild(style);
}

function ensureBanner() {
  var banner = document.getElementById(BANNER_ID);
  if (!banner) {
    banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    document.body.appendChild(banner);
  }
  return banner;
}

// TODO(drawme): when card 02's js/util/speech.js ships, swap to that helper.
function speak(text) {
  try {
    if (
      typeof window !== "undefined" &&
      window.speechSynthesis &&
      typeof window.SpeechSynthesisUtterance === "function"
    ) {
      var utter = new window.SpeechSynthesisUtterance(text);
      utter.rate = 0.95;
      utter.pitch = 1.1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    }
  } catch (_e) {
    /* speech is best-effort; silence failures */
  }
}

function showPrompt() {
  var compose =
    window.KiddoPaint && window.KiddoPaint.DrawMe && window.KiddoPaint.DrawMe.composePrompt;
  if (typeof compose !== "function") return;
  var rng = Math.random;
  var text = compose(rng, phrases);
  var banner = ensureBanner();
  banner.textContent = text;
  banner.style.display = "block";
  speak(text);
}

function ensureButton() {
  if (document.getElementById(BUTTON_ID)) return;
  var statusbar = document.getElementById("statusbar");
  if (!statusbar) return;
  var btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.type = "button";
  btn.title = "Get a silly drawing idea";
  btn.textContent = "Draw Me!";
  btn.addEventListener("click", function (ev) {
    ev.preventDefault();
    showPrompt();
  });
  statusbar.appendChild(btn);
}

function setup() {
  ensureStyle();
  ensureButton();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
}

if (typeof window !== "undefined" && window.KiddoPaint) {
  window.KiddoPaint.DrawMe = Object.assign(window.KiddoPaint.DrawMe || {}, {
    phrases: phrases,
    showPrompt: showPrompt,
  });
}
