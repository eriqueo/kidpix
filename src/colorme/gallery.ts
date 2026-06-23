/**
 * "My Saved Pages" gallery — the separate route for reopening saved ColorMe
 * pages. A modal overlay (styled like the slideshow editor) showing each saved
 * page as a thumbnail: click to load it back onto the canvas and keep coloring,
 * or × to delete. Reads/writes through KiddoPaint.ColorMe.* (wired by
 * src/colorme-init.ts); all legacy globals are read lazily at click time so
 * this module has no load-order coupling to the legacy engine.
 */
import type { SavedColoring } from "./saved-store";

interface ColorMeApi {
  reloadSavedPages?: () => Promise<SavedColoring[]>;
  getSavedPages?: () => SavedColoring[];
  deleteSavedColoring?: (id: string) => Promise<void>;
}

interface LegacyKiddoPaint {
  ColorMe?: ColorMeApi;
  Tools?: { ColorMe?: { loadPage: (meta: unknown) => void } };
  Current?: { tool?: unknown };
  Display?: { canvas?: HTMLCanvasElement };
}

function kp(): LegacyKiddoPaint | undefined {
  return (window as unknown as { KiddoPaint?: LegacyKiddoPaint }).KiddoPaint;
}

function btn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText =
    "font-size:14px;padding:6px 12px;cursor:pointer;border-radius:6px;border:1px solid #888;background:#eee;";
  b.addEventListener("click", onClick);
  return b;
}

export interface ColorMeGallery {
  open(): Promise<void>;
}

export function createColorMeGallery(): ColorMeGallery {
  let root: HTMLElement | null = null;
  let grid: HTMLElement | null = null;

  function ensureRoot(): HTMLElement {
    if (root) return root;
    root = document.createElement("div");
    root.className = "kp-colorme-gallery";
    root.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.75);display:none;z-index:9999;overflow:auto;padding:20px;color:#fff;font-family:sans-serif;";
    // Click on the dim backdrop (but not the panel) closes.
    root.addEventListener("click", (e) => {
      if (e.target === root) close();
    });

    const panel = document.createElement("div");
    panel.style.cssText =
      "max-width:960px;margin:0 auto;background:#222;border:2px solid #fff;border-radius:8px;padding:16px;";
    root.appendChild(panel);

    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px;";
    const title = document.createElement("h2");
    title.textContent = "My Saved Pages";
    title.style.cssText = "margin:0;font-size:22px;";
    header.append(title, btn("Close", () => close()));
    panel.appendChild(header);

    grid = document.createElement("div");
    grid.style.cssText =
      "display:flex;gap:12px;flex-wrap:wrap;background:#111;padding:12px;border:1px solid #444;border-radius:6px;min-height:120px;";
    panel.appendChild(grid);

    document.body.appendChild(root);
    return root;
  }

  function close(): void {
    if (root) root.style.display = "none";
  }

  function loadPage(saved: SavedColoring): void {
    const k = kp();
    const colorMeTool = k?.Tools?.ColorMe;
    if (!colorMeTool) return;
    // Synthetic page meta: the saved snapshot is a full-canvas image, so
    // loadPage composites it 1:1. savedId lets a later Save update this entry
    // rather than creating a duplicate.
    colorMeTool.loadPage({
      title: saved.title,
      url: saved.dataUrl,
      saved: true,
      savedId: saved.id,
    });
    if (k?.Current && k.Tools?.ColorMe) k.Current.tool = k.Tools.ColorMe;
    const canvas = k?.Display?.canvas;
    if (canvas) {
      canvas.className = "";
      canvas.classList.add("cursor-bucket");
    }
    close();
  }

  function card(saved: SavedColoring): HTMLElement {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "position:relative;width:160px;display:flex;flex-direction:column;gap:4px;";

    const pic = document.createElement("button");
    pic.title = "Open " + saved.title;
    pic.style.cssText =
      "padding:0;border:2px solid #888;border-radius:6px;background:#fff;cursor:pointer;overflow:hidden;height:90px;";
    const img = document.createElement("img");
    img.src = saved.dataUrl;
    img.alt = saved.title;
    img.style.cssText = "width:100%;height:100%;object-fit:contain;display:block;";
    pic.appendChild(img);
    pic.addEventListener("click", () => loadPage(saved));
    wrap.appendChild(pic);

    const label = document.createElement("div");
    label.textContent = saved.title;
    label.style.cssText =
      "font-size:13px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    wrap.appendChild(label);

    const del = document.createElement("button");
    del.textContent = "×";
    del.title = "Delete " + saved.title;
    del.style.cssText =
      "position:absolute;top:-8px;right:-8px;width:24px;height:24px;border-radius:50%;border:1px solid #fff;background:#c33;color:#fff;font-size:16px;line-height:1;cursor:pointer;";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      const k = kp();
      if (k?.ColorMe?.deleteSavedColoring) {
        await k.ColorMe.deleteSavedColoring(saved.id);
        await render();
      }
    });
    wrap.appendChild(del);

    return wrap;
  }

  async function render(): Promise<void> {
    if (!grid) return;
    const k = kp();
    const pages = k?.ColorMe?.reloadSavedPages
      ? await k.ColorMe.reloadSavedPages()
      : (k?.ColorMe?.getSavedPages?.() ?? []);
    grid.replaceChildren();
    if (!pages.length) {
      const empty = document.createElement("div");
      empty.textContent =
        "No saved pages yet. Color a page, then tap 💾 Save my page.";
      empty.style.cssText = "opacity:0.7;align-self:center;";
      grid.appendChild(empty);
      return;
    }
    for (const p of pages) grid.appendChild(card(p));
  }

  return {
    async open() {
      ensureRoot();
      await render();
      if (root) root.style.display = "block";
    },
  };
}
