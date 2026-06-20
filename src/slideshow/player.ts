/**
 * SlideshowPlayer — rAF-driven playback with Canvas 2D transitions.
 *
 * Sources of time:
 *  - `clock()`     returns elapsed ms. Default: `performance.now()`. Tests
 *                  inject a fake clock.
 *  - `schedule(fn)` schedules the next tick. Default: `requestAnimationFrame`.
 *                   Tests inject a manual scheduler.
 *
 * Audio is intentionally opt-in (`playAudio`): the smoke test runs without it.
 */
import { EventBus, type PlayerEvents } from "./eventbus";
import type { Slide, Slideshow } from "./types";
import { transitionFn, type DrawableSource } from "./transitions";

export interface PlayerImageLoader {
  load(pictureId: string): Promise<DrawableSource>;
}

export interface PlayerAudioPort {
  /** Start the slide's sound; idempotent within the same slide index. */
  play(slide: Slide): void;
  stopAll(): void;
}

export interface PlayerOpts {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  show: Slideshow;
  images: PlayerImageLoader;
  audio?: PlayerAudioPort;
  bus?: EventBus<PlayerEvents>;
  clock?: () => number;
  schedule?: (cb: (now: number) => void) => number;
  cancel?: (handle: number) => void;
}

export type PlayerState = "idle" | "playing" | "ended";

export interface PlayerHandle {
  start(): void;
  stop(): void;
  state(): PlayerState;
  bus: EventBus<PlayerEvents>;
}

export function createPlayer(opts: PlayerOpts): PlayerHandle {
  const bus = opts.bus ?? new EventBus<PlayerEvents>();
  const clock = opts.clock ?? (() => performance.now());
  const schedule =
    opts.schedule ??
    ((cb) => requestAnimationFrame(cb) as unknown as number);
  const cancel = opts.cancel ?? ((h) => cancelAnimationFrame(h));

  let state: PlayerState = "idle";
  let handle: number | null = null;
  let slideIdx = 0;
  let slideStartMs = 0;
  let prevImage: DrawableSource | null = null;
  let currentImage: DrawableSource | null = null;

  function stopRaf() {
    if (handle !== null) {
      cancel(handle);
      handle = null;
    }
  }

  async function enterSlide(idx: number): Promise<void> {
    slideIdx = idx;
    const slide = opts.show.slides[idx];
    bus.emit("slide", { index: idx, slideId: slide.id });
    if (opts.audio) {
      try {
        opts.audio.play(slide);
      } catch (e) {
        bus.emit("error", { message: (e as Error).message ?? "audio play failed" });
      }
    }
    try {
      currentImage = await opts.images.load(slide.pictureId);
    } catch (e) {
      bus.emit("error", { message: (e as Error).message ?? "image load failed" });
      currentImage = null;
    }
    slideStartMs = clock();
    tick();
  }

  function tick(): void {
    if (state !== "playing") return;
    const slide = opts.show.slides[slideIdx];
    if (!slide) {
      finish();
      return;
    }
    const now = clock();
    const elapsed = now - slideStartMs;
    const tRaw = slide.transitionMs > 0 ? elapsed / slide.transitionMs : 1;
    const t = tRaw >= 1 ? 1 : tRaw < 0 ? 0 : tRaw;
    const fn = transitionFn(slide.transition);
    if (currentImage) {
      fn(opts.ctx, prevImage, currentImage, t, opts.width, opts.height);
    }
    bus.emit("progress", { index: slideIdx, t });

    if (elapsed >= slide.durationMs) {
      prevImage = currentImage;
      const next = slideIdx + 1;
      if (next >= opts.show.slides.length) {
        finish();
        return;
      }
      void enterSlide(next);
      return;
    }
    handle = schedule(tick);
  }

  function finish(): void {
    state = "ended";
    stopRaf();
    if (opts.audio) opts.audio.stopAll();
    bus.emit("end", { slideshowId: opts.show.id });
  }

  return {
    bus,
    state: () => state,
    start() {
      if (state === "playing") return;
      if (opts.show.slides.length === 0) {
        state = "ended";
        bus.emit("end", { slideshowId: opts.show.id });
        return;
      }
      state = "playing";
      prevImage = null;
      currentImage = null;
      bus.emit("start", { slideshowId: opts.show.id });
      void enterSlide(0);
    },
    stop() {
      if (state !== "playing") return;
      state = "ended";
      stopRaf();
      if (opts.audio) opts.audio.stopAll();
      bus.emit("end", { slideshowId: opts.show.id });
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Real-browser ports.                                                         */
/* -------------------------------------------------------------------------- */

/** Loads an image element from a picture id by looking it up in a store. */
export function imageLoaderFromStore(get: (id: string) => Promise<{ dataUrl: string } | undefined>): PlayerImageLoader {
  const cache = new Map<string, Promise<HTMLImageElement>>();
  return {
    load(id) {
      let p = cache.get(id);
      if (!p) {
        p = (async () => {
          const pic = await get(id);
          if (!pic) throw new Error(`picture not found: ${id}`);
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`image decode failed: ${id}`));
            img.src = pic.dataUrl;
          });
        })();
        cache.set(id, p);
      }
      return p;
    },
  };
}

/** Audio port using HTMLAudioElement, unlocked at construction time. */
export function htmlAudioPort(
  resolveSrc: (soundId: string) => string | undefined,
): PlayerAudioPort {
  let current: HTMLAudioElement | null = null;
  return {
    play(slide) {
      if (!slide.soundId) return;
      const src = resolveSrc(slide.soundId);
      if (!src) return;
      current?.pause();
      current = new Audio(src);
      current.preload = "auto";
      void current.play().catch(() => {});
    },
    stopAll() {
      current?.pause();
      current = null;
    },
  };
}
