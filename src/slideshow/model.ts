/**
 * SlideshowModel — pure operations on an ordered slide list.
 *
 * Immutable: every mutator returns a new `Slideshow`. Lets the editor diff /
 * undo cheaply, and keeps the model trivially testable.
 */
import {
  DEFAULT_DURATION_MS,
  DEFAULT_TRANSITION_MS,
  type PictureId,
  type Slide,
  type SlideId,
  type Slideshow,
  type SoundId,
  type TransitionId,
} from "./types";

let _idCounter = 0;
function nextId(prefix: string): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

export function newSlideshow(name = "Untitled", now = Date.now()): Slideshow {
  return {
    id: nextId("ss"),
    name,
    slides: [],
    createdMs: now,
    updatedMs: now,
  };
}

export function newSlide(
  pictureId: PictureId,
  partial: Partial<Omit<Slide, "id" | "pictureId">> = {},
): Slide {
  return {
    id: nextId("sl"),
    pictureId,
    soundId: partial.soundId,
    transition: partial.transition ?? "fade",
    transitionMs: partial.transitionMs ?? DEFAULT_TRANSITION_MS,
    durationMs: partial.durationMs ?? DEFAULT_DURATION_MS,
  };
}

function touch(s: Slideshow, slides: Slide[], now = Date.now()): Slideshow {
  return { ...s, slides, updatedMs: now };
}

export function insertSlide(
  s: Slideshow,
  slide: Slide,
  index?: number,
  now = Date.now(),
): Slideshow {
  const at = index === undefined ? s.slides.length : clampIndex(index, s.slides.length);
  const next = s.slides.slice();
  next.splice(at, 0, slide);
  return touch(s, next, now);
}

export function appendSlide(s: Slideshow, slide: Slide, now = Date.now()): Slideshow {
  return touch(s, [...s.slides, slide], now);
}

export function removeSlide(s: Slideshow, id: SlideId, now = Date.now()): Slideshow {
  return touch(s, s.slides.filter((x) => x.id !== id), now);
}

export function reorderSlide(
  s: Slideshow,
  from: number,
  to: number,
  now = Date.now(),
): Slideshow {
  const len = s.slides.length;
  if (len === 0) return s;
  const f = clampIndex(from, len - 1);
  const t = clampIndex(to, len - 1);
  if (f === t) return s;
  const next = s.slides.slice();
  const [item] = next.splice(f, 1);
  next.splice(t, 0, item);
  return touch(s, next, now);
}

export function updateSlide(
  s: Slideshow,
  id: SlideId,
  patch: Partial<Omit<Slide, "id">>,
  now = Date.now(),
): Slideshow {
  let changed = false;
  const next = s.slides.map((sl) => {
    if (sl.id !== id) return sl;
    changed = true;
    const merged: Slide = { ...sl, ...patch };
    merged.transitionMs = Math.max(0, merged.transitionMs);
    merged.durationMs = Math.max(merged.transitionMs, merged.durationMs);
    return merged;
  });
  return changed ? touch(s, next, now) : s;
}

export function setTransition(
  s: Slideshow,
  id: SlideId,
  transition: TransitionId,
  now = Date.now(),
): Slideshow {
  return updateSlide(s, id, { transition }, now);
}

export function setSound(
  s: Slideshow,
  id: SlideId,
  soundId: SoundId | undefined,
  now = Date.now(),
): Slideshow {
  return updateSlide(s, id, { soundId }, now);
}

export function rename(s: Slideshow, name: string, now = Date.now()): Slideshow {
  return { ...s, name, updatedMs: now };
}

export function totalDurationMs(s: Slideshow): number {
  return s.slides.reduce((acc, sl) => acc + sl.durationMs, 0);
}

function clampIndex(n: number, max: number): number {
  if (n < 0) return 0;
  if (n > max) return max;
  return Math.floor(n);
}
