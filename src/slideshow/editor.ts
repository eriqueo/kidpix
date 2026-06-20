/**
 * SlideshowEditor — minimal DOM UI.
 *
 * Self-contained: builds its own DOM tree in a host element, holds the model
 * locally, and persists on `Save`. Drag-to-reorder via HTML5 dragstart/drop.
 *
 * Deliberately plain DOM (no framework) to match the rest of the kidpix UI and
 * stay outside the legacy `KiddoPaint.*` globals.
 */
import { appendSlide, newSlide, newSlideshow, removeSlide, reorderSlide, updateSlide, rename } from "./model";
import type { SlideshowStore } from "./store";
import { SOUND_BUDGET_BYTES, TRANSITIONS, type Picture, type Slideshow, type TransitionId } from "./types";
import { createPlayer, htmlAudioPort, imageLoaderFromStore } from "./player";
import { captureSupported, startCanvasCapture } from "./export";

export interface EditorHandle {
  open(slideshowId?: string): Promise<void>;
  close(): void;
  root: HTMLElement;
}

export function createEditor(store: SlideshowStore): EditorHandle {
  const root = document.createElement("div");
  root.className = "kp-slideshow-editor";
  root.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.75);display:none;z-index:9999;overflow:auto;padding:20px;color:#fff;font-family:sans-serif;";

  let model: Slideshow = newSlideshow();
  let pictures: Picture[] = [];

  const panel = document.createElement("div");
  panel.style.cssText =
    "max-width:960px;margin:0 auto;background:#222;border:2px solid #fff;border-radius:8px;padding:16px;";
  root.appendChild(panel);

  // Header
  const header = document.createElement("div");
  header.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:12px;";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Slideshow name";
  nameInput.style.cssText = "flex:1;font-size:18px;padding:6px;";
  nameInput.addEventListener("input", () => {
    model = rename(model, nameInput.value);
  });
  const closeBtn = button("Close", () => close());
  header.append(nameInput, closeBtn);
  panel.appendChild(header);

  // Picture picker
  const pickerLabel = document.createElement("h3");
  pickerLabel.textContent = "Saved pictures";
  panel.appendChild(pickerLabel);
  const picker = document.createElement("div");
  picker.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;max-height:160px;overflow:auto;background:#111;padding:8px;border:1px solid #444;";
  panel.appendChild(picker);

  // Slide list
  const listLabel = document.createElement("h3");
  listLabel.textContent = "Slides (drag to reorder)";
  panel.appendChild(listLabel);
  const list = document.createElement("ol");
  list.style.cssText = "list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;";
  panel.appendChild(list);

  // Action bar
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;";
  actions.appendChild(button("Save", () => void save()));
  actions.appendChild(button("Play", () => void play(false)));
  if (captureSupported()) actions.appendChild(button("Record WebM", () => void play(true)));
  panel.appendChild(actions);

  // Player surface (created lazily on play)
  const playerHost = document.createElement("div");
  playerHost.style.cssText = "display:none;background:#000;margin-top:16px;text-align:center;";
  panel.appendChild(playerHost);

  function renderPicker() {
    picker.replaceChildren();
    if (pictures.length === 0) {
      const empty = document.createElement("div");
      empty.textContent =
        "No saved pictures yet. Press Save in the toolbar to capture one.";
      empty.style.opacity = "0.7";
      picker.appendChild(empty);
      return;
    }
    for (const p of pictures) {
      const card = document.createElement("button");
      card.title = p.name;
      card.style.cssText =
        "padding:0;border:1px solid #666;background:#000;cursor:pointer;";
      const img = document.createElement("img");
      img.src = p.dataUrl;
      img.width = 96;
      img.height = 64;
      img.style.cssText = "display:block;object-fit:contain;";
      card.appendChild(img);
      card.addEventListener("click", () => {
        model = appendSlide(model, newSlide(p.id));
        renderList();
      });
      picker.appendChild(card);
    }
  }

  function renderList() {
    list.replaceChildren();
    model.slides.forEach((slide, i) => {
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.index = String(i);
      li.style.cssText =
        "display:flex;gap:8px;align-items:center;background:#333;padding:6px;border:1px solid #555;";
      const pic = pictures.find((p) => p.id === slide.pictureId);
      const thumb = document.createElement("img");
      thumb.src = pic?.dataUrl ?? "";
      thumb.width = 64;
      thumb.height = 48;
      thumb.alt = pic?.name ?? slide.pictureId;
      li.appendChild(thumb);

      const transSel = document.createElement("select");
      for (const t of TRANSITIONS) {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        if (t === slide.transition) opt.selected = true;
        transSel.appendChild(opt);
      }
      transSel.addEventListener("change", () => {
        model = updateSlide(model, slide.id, { transition: transSel.value as TransitionId });
      });
      li.appendChild(labeled("Transition", transSel));

      const durInput = numInput(slide.durationMs, 200, 60000, (v) => {
        model = updateSlide(model, slide.id, { durationMs: v });
      });
      li.appendChild(labeled("Duration ms", durInput));

      const tInput = numInput(slide.transitionMs, 0, 10000, (v) => {
        model = updateSlide(model, slide.id, { transitionMs: v });
      });
      li.appendChild(labeled("Trans ms", tInput));

      const del = button("✕", () => {
        model = removeSlide(model, slide.id);
        renderList();
      });
      del.style.marginLeft = "auto";
      li.appendChild(del);

      li.addEventListener("dragstart", (ev) => {
        ev.dataTransfer?.setData("text/plain", String(i));
      });
      li.addEventListener("dragover", (ev) => ev.preventDefault());
      li.addEventListener("drop", (ev) => {
        ev.preventDefault();
        const from = Number(ev.dataTransfer?.getData("text/plain") ?? -1);
        if (Number.isNaN(from) || from < 0) return;
        model = reorderSlide(model, from, i);
        renderList();
      });

      list.appendChild(li);
    });
  }

  async function save() {
    try {
      await store.putSlideshow({ ...model, updatedMs: Date.now() });
      flash("Saved.");
    } catch (e) {
      flash(`Save failed: ${(e as Error).message}`);
    }
  }

  async function play(record: boolean) {
    if (model.slides.length === 0) {
      flash("Add at least one slide first.");
      return;
    }
    const total = await store.totalSoundBytes();
    if (total > SOUND_BUDGET_BYTES) {
      flash(
        `Heads up: bundled sounds exceed ${Math.round(SOUND_BUDGET_BYTES / 1024 / 1024)} MB. Saves may fail.`,
      );
    }
    playerHost.style.display = "block";
    playerHost.replaceChildren();
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    canvas.style.cssText = "max-width:100%;background:#000;";
    playerHost.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      flash("Canvas 2D unavailable.");
      return;
    }
    const player = createPlayer({
      ctx,
      width: canvas.width,
      height: canvas.height,
      show: model,
      images: imageLoaderFromStore((id) => store.getPicture(id)),
      audio: htmlAudioPort(() => undefined), // v1 sound resolver wired in a later patch
    });

    let capture: ReturnType<typeof startCanvasCapture> = null;
    if (record) capture = startCanvasCapture(canvas, 30);

    player.bus.on("end", async () => {
      if (capture) {
        const blob = await capture.stop();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(model.name || "slideshow").replace(/\s+/g, "_")}.webm`;
        a.textContent = "Download recording";
        a.style.cssText = "display:block;color:#fff;margin-top:8px;";
        playerHost.appendChild(a);
      }
    });

    player.start();
  }

  function flash(msg: string) {
    const div = document.createElement("div");
    div.textContent = msg;
    div.style.cssText =
      "background:#0a0;color:#fff;padding:8px;margin-top:8px;border-radius:4px;";
    panel.appendChild(div);
    setTimeout(() => div.remove(), 3500);
  }

  function close() {
    root.style.display = "none";
    playerHost.replaceChildren();
    playerHost.style.display = "none";
  }

  return {
    root,
    close,
    async open(slideshowId) {
      await store.init();
      pictures = await store.listPictures();
      if (slideshowId) {
        const existing = await store.getSlideshow(slideshowId);
        if (existing) model = existing;
      } else {
        model = newSlideshow("Untitled");
      }
      nameInput.value = model.name;
      renderPicker();
      renderList();
      root.style.display = "block";
    },
  };
}

/* ------------------------------- helpers ---------------------------------- */

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.cssText = "padding:6px 12px;background:#444;color:#fff;border:1px solid #888;cursor:pointer;";
  b.addEventListener("click", onClick);
  return b;
}

function labeled(label: string, el: HTMLElement): HTMLElement {
  const wrap = document.createElement("label");
  wrap.style.cssText = "display:flex;flex-direction:column;font-size:11px;color:#bbb;";
  wrap.append(label, el);
  return wrap;
}

function numInput(value: number, min: number, max: number, onChange: (v: number) => void): HTMLInputElement {
  const i = document.createElement("input");
  i.type = "number";
  i.min = String(min);
  i.max = String(max);
  i.value = String(value);
  i.style.cssText = "width:80px;";
  i.addEventListener("change", () => {
    const v = Number(i.value);
    if (!Number.isFinite(v)) return;
    onChange(Math.max(min, Math.min(max, v)));
  });
  return i;
}
