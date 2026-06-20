/**
 * SlideShow companion mode — shared types.
 *
 * Pure data shapes. No DOM, no IndexedDB. Everything that crosses the trust
 * boundary into the store is validated by `isPicture` / `isSlideshow`.
 */

export type SlideId = string;
export type PictureId = string;
export type SoundId = string;

export const TRANSITIONS = ["cut", "fade", "wipe", "iris", "dissolve"] as const;
export type TransitionId = (typeof TRANSITIONS)[number];

export interface Slide {
  id: SlideId;
  pictureId: PictureId;
  soundId?: SoundId;
  transition: TransitionId;
  transitionMs: number;
  durationMs: number;
}

export interface Slideshow {
  id: string;
  name: string;
  slides: Slide[];
  createdMs: number;
  updatedMs: number;
}

export interface Picture {
  id: PictureId;
  name: string;
  dataUrl: string;
  createdMs: number;
}

export interface SoundBlob {
  id: SoundId;
  name: string;
  mime: string;
  bytes: ArrayBuffer;
  createdMs: number;
}

export const DEFAULT_TRANSITION_MS = 600;
export const DEFAULT_DURATION_MS = 3000;
export const SOUND_BUDGET_BYTES = 50 * 1024 * 1024;

export function isTransitionId(x: unknown): x is TransitionId {
  return typeof x === "string" && (TRANSITIONS as readonly string[]).includes(x);
}

export function isSlide(x: unknown): x is Slide {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.pictureId === "string" &&
    isTransitionId(s.transition) &&
    typeof s.transitionMs === "number" &&
    typeof s.durationMs === "number" &&
    s.transitionMs >= 0 &&
    s.durationMs >= 0 &&
    (s.soundId === undefined || typeof s.soundId === "string")
  );
}

export function isSlideshow(x: unknown): x is Slideshow {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.createdMs === "number" &&
    typeof s.updatedMs === "number" &&
    Array.isArray(s.slides) &&
    s.slides.every(isSlide)
  );
}

export function isPicture(x: unknown): x is Picture {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    typeof p.dataUrl === "string" &&
    typeof p.createdMs === "number"
  );
}
