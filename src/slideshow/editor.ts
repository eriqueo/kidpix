/**
 * SlideshowEditor — minimal DOM UI.
 *
 * Self-contained: builds its own DOM tree in a host element, holds the model
 * locally, and persists on `Save`. Opening without an id reopens the most
 * recently saved show. Reorder via ▲/▼ buttons (touch-safe) or HTML5 drag.
 *
 * Deliberately plain DOM (no framework) to match the rest of the kidpix UI and
 * stay outside the legacy `KiddoPaint.*` globals.
 *
 * Stable hooks for tests: `.kp-ss-picture[data-picture-id]`,
 * `li.kp-ss-slide[data-picture-id][data-missing]`, `[data-action=...]`,
 * `input[name=slideshow-name]`, `.kp-ss-player[data-state]`.
 */
import {
  appendSlide,
  latestSlideshow,
  newSlide,
  newSlideshow,
  removeSlide,
  reorderSlide,
  updateSlide,
  rename,
} from "./model";
import type { SlideshowStore } from "./store";
import { TRANSITIONS, type Picture, type Slideshow, type TransitionId } from "./types";
import { createPlayer, imageLoaderFromStore, type PlayerHandle } from "./player";
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
  let player: PlayerHandle | null = null;

  function stopPlayer() {
    player?.stop();
    player = null;
  }

  const panel = document.createElement("div");
  panel.style.cssText =
    "max-width:960px;margin:0 auto;background:#222;border:2px solid #fff;border-radius:8px;padding:16px;";
  root.appendChild(panel);

  // Header
  const header = document.createElement("div");
  header.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:12px;";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.name = "slideshow-name";
  nameInput.placeholder = "Slideshow name";
  nameInput.style.cssText = "flex:1;font-size:18px;padding:6px;";
  nameInput.addEventListener("input", () => {
    model = rename(model, nameInput.value);
  });
  const newBtn = button("New", "new", () => {
    model = newSlideshow("Untitled");
    nameInput.value = model.name;
    renderList();
  });
  const closeBtn = button("Close", "close", () => close());
  header.append(nameInput, newBtn, closeBtn);
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
  listLabel.textContent = "Slides (▲▼ or drag to reorder)";
  panel.appendChild(listLabel);
  const list = document.createElement("ol");
  list.style.cssText = "list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;";
  panel.appendChild(list);

  // Action bar
  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;";
  actions.appendChild(button("Save", "save", () => void save()));
  actions.appendChild(button("Play", "play", () => void play(false)));
  if (captureSupported()) actions.appendChild(button("Record WebM (no sound)", "record", () => void play(true)));
  panel.appendChild(actions);

  // Player surface (created lazily on play)
  const playerHost = document.createElement("div");
  playerHost.className = "kp-ss-player";
  playerHost.dataset.state = "idle";
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
      card.type = "button";
      card.className = "kp-ss-picture";
      card.dataset.pictureId = p.id;
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
      li.className = "kp-ss-slide";
      li.draggable = true;
      li.dataset.index = String(i);
      li.dataset.pictureId = slide.pictureId;
      li.style.cssText =
        "display:flex;gap:8px;align-items:center;background:#333;padding:6px;border:1px solid #555;";
      const pic = pictures.find((p) => p.id === slide.pictureId);
      li.dataset.missing = pic ? "false" : "true";
      if (pic) {
        const thumb = document.createElement("img");
        thumb.src = pic.dataUrl;
        thumb.width = 64;
        thumb.height = 48;
        thumb.alt = pic.name;
        li.appendChild(thumb);
      } else {
        const gone = document.createElement("div");
        gone.textContent = "Picture missing";
        gone.title = slide.pictureId;
        gone.style.cssText =
          "width:64px;height:48px;font-size:10px;display:flex;align-items:center;justify-content:center;background:#600;text-align:center;";
        li.appendChild(gone);
      }

      const transSel = document.createElement("select");
      transSel.name = "transition";
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

      const durInput = numInput("durationMs", slide.durationMs, 200, 60000, (v) => {
        model = updateSlide(model, slide.id, { durationMs: v });
      });
      li.appendChild(labeled("Duration ms", durInput));

      const tInput = numInput("transitionMs", slide.transitionMs, 0, 10000, (v) => {
        model = updateSlide(model, slide.id, { transitionMs: v });
      });
      li.appendChild(labeled("Trans ms", tInput));

      const up = button("▲", "up", () => {
        model = reorderSlide(model, i, i - 1);
        renderList();
      });
      up.disabled = i === 0;
      up.style.marginLeft = "auto";
      li.appendChild(up);
      const down = button("▼", "down", () => {
        model = reorderSlide(model, i, i + 1);
        renderList();
      });
      down.disabled = i === model.slides.length - 1;
      li.appendChild(down);
      const del = button("✕", "remove", () => {
        model = removeSlide(model, slide.id);
        renderList();
      });
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
    // A previous run must be stopped first so its stale rAF loop / "end"
    // listener cannot flip data-state under the new one.
    stopPlayer();
    playerHost.style.display = "block";
    playerHost.dataset.state = "playing";
    playerHost.replaceChildren();
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    canvas.style.cssText = "max-width:100%;background:#000;";
    playerHost.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      playerHost.dataset.state = "idle";
      playerHost.style.display = "none";
      flash("Canvas 2D unavailable.");
      return;
    }
    const thisPlayer = createPlayer({
      ctx,
      width: canvas.width,
      height: canvas.height,
      show: model,
      images: imageLoaderFromStore((id) => store.getPicture(id)),
      // No audio port: per-slide sound has no editor UI yet (see docs/slideshow.md).
    });

    let capture: ReturnType<typeof startCanvasCapture> = null;
    if (record) capture = startCanvasCapture(canvas, 30);

    player = thisPlayer;
    thisPlayer.bus.on("error", (e) => flash(`Playback problem: ${e.message}`));
    thisPlayer.bus.on("end", async () => {
      if (player !== thisPlayer) return; // superseded or closed
      player = null;
      playerHost.dataset.state = "ended";
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

    thisPlayer.start();
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
    stopPlayer();
    root.style.display = "none";
    playerHost.replaceChildren();
    playerHost.style.display = "none";
    playerHost.dataset.state = "idle";
  }

  return {
    root,
    close,
    async open(slideshowId) {
      try {
        await store.init();
        pictures = (await store.listPictures()).sort((a, b) => b.createdMs - a.createdMs);
      } catch (e) {
        pictures = [];
        flash(`Storage unavailable: ${(e as Error).message}`);
      }
      const existing = slideshowId
        ? await store.getSlideshow(slideshowId).catch(() => undefined)
        : latestSlideshow(await store.listSlideshows().catch(() => []));
      model = existing ?? newSlideshow("Untitled");
      nameInput.value = model.name;
      renderPicker();
      renderList();
      root.style.display = "block";
    },
  };
}

/* ------------------------------- helpers ---------------------------------- */

function button(label: string, action: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.action = action;
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

function numInput(
  name: string,
  value: number,
  min: number,
  max: number,
  onChange: (v: number) => void,
): HTMLInputElement {
  const i = document.createElement("input");
  i.type = "number";
  i.name = name;
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
