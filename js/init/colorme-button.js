// Wire the ColorMe entry into the existing toolbar. The card's blast radius does not
// permit edits to index.html, so we inject the button (and link the picker stylesheet)
// at init time. The button gets a `title` so the status-bar hover descriptions kick in
// for free.

import "../util/colorme.js";
import "../util/colorme-picker.js";

function injectStylesheet() {
  if (document.getElementById("colorme-css-link")) return;
  const link = document.createElement("link");
  link.id = "colorme-css-link";
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = "/css/colorme.css";
  document.head.appendChild(link);
}

function injectButton() {
  if (document.getElementById("colorme")) return;
  const mainbar = document.getElementById("mainbar");
  if (!mainbar) return;

  const btn = document.createElement("button");
  btn.className = "tool";
  btn.id = "colorme";
  btn.title = "ColorMe";
  btn.setAttribute("aria-label", "ColorMe coloring pages");
  // Plain text label keeps us asset-free; the styling matches other toolbar buttons.
  btn.innerHTML =
    '<span style="display:inline-block;width:48px;height:48px;line-height:48px;text-align:center;font-weight:bold;font-size:11px;background:#fff;border:1px solid #888;">ColorMe</span>';

  // Insert at end of mainbar so existing tool indexes don't shift.
  mainbar.appendChild(btn);

  btn.addEventListener("click", function () {
    if (
      window.KiddoPaint &&
      window.KiddoPaint.ColorMePicker &&
      typeof window.KiddoPaint.ColorMePicker.open === "function"
    ) {
      window.KiddoPaint.ColorMePicker.open();
    }
  });
}

function wireToolDescription() {
  if (
    window.KiddoPaint &&
    window.KiddoPaint.ToolDescriptions &&
    !window.KiddoPaint.ToolDescriptions.ColorMe
  ) {
    window.KiddoPaint.ToolDescriptions.ColorMe =
      "Pick a coloring page to color in.";
  }
}

function init() {
  injectStylesheet();
  injectButton();
  wireToolDescription();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}
