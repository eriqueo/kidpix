/**
 * Minimal kidpix hook — adds a "SlideShow" button to the toolbar, mounts the
 * editor, and files a copy of the drawing in the SlideShow library whenever
 * the toolbar Save button is pressed. No existing tool is moved or replaced.
 *
 * Defensive: bails silently when the toolbar / IndexedDB isn't there, so
 * legacy bootstrap (and tests that import this module) stay unaffected.
 *
 * Talks to the legacy engine only through the DOM (`#kiddopaint` and the
 * `kidpix:picture-saved` document event); nothing from `js/` is imported.
 */
import { createEditor } from "./editor";
import { createIndexedDbStore, filePictureIfNew, type SlideshowStore } from "./store";

export function installSlideshow(): void {
  if (typeof document === "undefined") return;
  if (!(globalThis as { indexedDB?: IDBFactory }).indexedDB) return;
  const toolbar = document.getElementById("mainbar") ?? document.getElementById("toolbar");
  if (!toolbar) return;
  if (document.getElementById("kp-slideshow-btn")) return;

  const store = createIndexedDbStore();
  const editor = createEditor(store);
  document.body.appendChild(editor.root);

  const btn = document.createElement("button");
  btn.id = "kp-slideshow-btn";
  btn.className = "tool";
  btn.title = "SlideShow";
  btn.textContent = "📽";
  btn.style.cssText = "font-size:28px;line-height:1;";
  btn.addEventListener("click", () => {
    void editor.open();
  });
  toolbar.appendChild(btn);

  installSaveCapture(store);
}

/**
 * Every PNG save (toolbar button or the `s` key) goes through the legacy
 * `save_to_file()` in js/init/kiddopaint.js, which dispatches
 * `kidpix:picture-saved` on `document` when done. On that event we file the
 * main canvas as a library Picture — the editor's "Press Save in the toolbar"
 * hint. Saving twice without drawing files one picture (dedupe is persisted
 * in the store, see `filePictureIfNew`).
 */
export const PICTURE_SAVED_EVENT = "kidpix:picture-saved";

function installSaveCapture(store: SlideshowStore): void {
  document.addEventListener(PICTURE_SAVED_EVENT, () => {
    const canvas = document.getElementById("kiddopaint");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL("image/png");
    } catch {
      return;
    }
    // Store methods open the DB lazily; skipping init() keeps the legacy
    // localStorage seed off this path (it runs only when the editor opens).
    void filePictureIfNew(store, dataUrl).catch((e: unknown) => {
      console.warn("slideshow: could not file picture", e);
    });
  });
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => installSlideshow(), { once: true });
  } else {
    installSlideshow();
  }
}
