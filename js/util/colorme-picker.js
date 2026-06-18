// ColorMe picker — a modal that shows thumbnails of every coloring page; clicking
// one loads the line-art into the main canvas so the kid can color it in.
//
// Why main canvas (not the `bnim` background layer the card mentioned): the global
// mouseleave handler in js/init/kiddopaint.js calls Display.clearBnim(), which would
// wipe the line-art the first time the cursor left the canvas. Loading into the main
// canvas (with saveUndo) gives kids a persistent page they can color, undo, and
// "reload" via the picker to start over — matching the card's user story.

import ColorMe from "./colorme.js";

const MODAL_ID = "colorme-picker-modal";

function ensureModal() {
  let modal = document.getElementById(MODAL_ID);
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = MODAL_ID;
  modal.className = "colorme-modal-overlay";
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="colorme-modal" role="dialog" aria-modal="true" aria-label="ColorMe — pick a page">
      <div class="colorme-modal-header">
        <h2>ColorMe — Pick a Page</h2>
        <button type="button" class="colorme-close" aria-label="Close">&times;</button>
      </div>
      <div class="colorme-modal-body">
        <p class="colorme-hint">Click a picture to color it in. Open this menu again to start over.</p>
        <div class="colorme-grid" id="colorme-grid"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.addEventListener("click", function (e) {
    if (e.target === modal) close();
  });
  modal.querySelector(".colorme-close").addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
      close();
    }
  });

  return modal;
}

function renderGrid() {
  const grid = document.getElementById("colorme-grid");
  if (!grid) return;
  grid.innerHTML = "";
  const items = ColorMe.list();
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "colorme-empty";
    empty.textContent = "No coloring pages found.";
    grid.appendChild(empty);
    return;
  }
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "colorme-thumb";
    btn.setAttribute("data-name", item.name);
    btn.title = item.name;
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.name;
    img.loading = "lazy";
    const label = document.createElement("span");
    label.className = "colorme-thumb-label";
    label.textContent = item.name;
    btn.appendChild(img);
    btn.appendChild(label);
    btn.addEventListener("click", function () {
      pick(item.name);
    });
    grid.appendChild(btn);
  }
}

function open() {
  const modal = ensureModal();
  renderGrid();
  modal.setAttribute("aria-hidden", "false");
  modal.style.display = "flex";
}

function close() {
  const modal = document.getElementById(MODAL_ID);
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  modal.style.display = "none";
}

function pick(name) {
  // Load into the main canvas via Display.saveUndo so the page becomes part of the
  // drawing (and is undoable). We bypass the in-progress `tmp` layer entirely.
  const D = (typeof window !== "undefined" && window.KiddoPaint && window.KiddoPaint.Display) || null;
  if (!D || !D.main_context || !D.main_canvas) {
    close();
    return;
  }
  ColorMe.load(name, D.main_context).then(function (ok) {
    if (ok) {
      // Snapshot for undo and persist current drawing.
      if (typeof D.saveUndo === "function") D.saveUndo();
      if (typeof D.saveToLocalStorage === "function") D.saveToLocalStorage();
      // Mark canvas as having content (matches what other loaders do).
      if (window.KiddoPaint && window.KiddoPaint.Current) {
        window.KiddoPaint.Current.canvasHasContent = true;
      }
    }
    close();
  });
}

const ColorMePicker = { open, close, pick, _renderGrid: renderGrid };

if (typeof window !== "undefined") {
  window.KiddoPaint = window.KiddoPaint || {};
  window.KiddoPaint.ColorMePicker = ColorMePicker;
}

// Wire the toolbar button (added in index.html) on DOMContentLoaded.
function wireButton() {
  const btn = document.getElementById("colorme");
  if (btn && !btn.__colormeWired) {
    btn.__colormeWired = true;
    btn.addEventListener("click", open);
  }
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireButton);
  } else {
    wireButton();
  }
}

export default ColorMePicker;
export { ColorMePicker, open, close, pick };
