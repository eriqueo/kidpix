/**
 * Minimal kidpix hook — adds a "SlideShow" button to the toolbar and mounts
 * the editor. No existing tool is moved or replaced.
 *
 * Defensive: bails silently when the toolbar / IndexedDB isn't there, so
 * legacy bootstrap (and tests that import this module) stay unaffected.
 */
import { createEditor } from "./editor";
import { createIndexedDbStore } from "./store";

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
}

if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => installSlideshow(), { once: true });
  } else {
    installSlideshow();
  }
}
