# SlideShow companion mode

A stylistic-equivalent of the classic KidPix SlideShow: sequence saved pictures
with sounds and transitions into a playable, exportable show.

This is a brownfield feature added beside the existing legacy engine. It does
not change any existing tool behavior; it adds a new top-level button that opens
a self-contained editor and player.

## Scope (v1)

In:
- A picture library backed by IndexedDB (`kidpix-slideshow` database, `pictures`
  + `slideshows` stores), seeded from the existing single-slot localStorage save
  (dual-read shim).
- An ordered slide list (`SlideshowModel`) — reorder / insert / remove.
- An editor UI: pick saved pictures, set per-slide sound, transition, and
  duration.
- A player: rAF-driven timeline, Canvas 2D transitions, autoplay-policy-safe
  audio (one-time user-gesture unlock).
- Five transitions: `cut`, `fade`, `wipe`, `iris`, `dissolve`. Math is
  deterministic in `t ∈ [0, 1]`, not frame count.
- Optional WebM export via `MediaRecorder` (canvas + audio mix). Gracefully
  hidden when unsupported.
- A 50 MB soft cap per slideshow's bundled sounds, with a friendly warning.
- Unit tests for the store (CRUD + migration), the model (reorder / insert /
  delete), the transition math, and a smoke test that the player advances on
  a fake clock.

Out:
- Mobile/touch polish, fullscreen UI choreography.
- GIF or MP4 encoding.
- Cloud sync.
- A general plugin / transition framework.

## Data model

```ts
type SlideId = string;       // uuid-v4 string
type PictureId = string;     // uuid-v4 string
type SoundId = string;       // 'builtin:<key>' or 'blob:<uuid>'
type TransitionId = 'cut' | 'fade' | 'wipe' | 'iris' | 'dissolve';

interface Slide {
  id: SlideId;
  pictureId: PictureId;
  soundId?: SoundId;
  transition: TransitionId;
  transitionMs: number;      // duration of the transition INTO this slide
  durationMs: number;        // total slide hold (>= transitionMs)
}

interface Slideshow {
  id: string;
  name: string;
  slides: Slide[];
  createdMs: number;
  updatedMs: number;
}

interface Picture {
  id: PictureId;
  name: string;
  dataUrl: string;            // image/png data URL of the saved canvas
  createdMs: number;
}
```

All numeric values are integers; floats are reserved for the transition `t`.

## Persistence

IndexedDB database `kidpix-slideshow` (version 1) with object stores:
- `pictures` (keyPath `id`) — picture blobs (data URLs for v1; can move to
  `Blob` later without changing the public API).
- `slideshows` (keyPath `id`) — slideshow definitions.
- `sounds` (keyPath `id`) — uploaded sound blobs keyed by `blob:<uuid>`.

Schema migration is handled inside `onupgradeneeded`. A dual-read shim looks
for the legacy `localStorage["kiddopaint"]` slot on first open and seeds it as
a `Picture` named "Last saved". The legacy slot is left in place; the
slideshow store never writes back to localStorage.

`SlideshowStore` is the only thing that talks to IndexedDB. Everything else
(model, editor, player) consumes the store through its interface, which means:
- The store has an in-memory fake (`createMemoryStore`) used by tests and any
  environment without IndexedDB.
- Boundary validation happens at `Store.put*` time; internal modules trust
  what they get.

## Playback

The player drives a `rAF` loop and consults `performance.now()`. Slide timing
is in milliseconds; transitions render against `t = clamp01(elapsed /
transitionMs)`.

Audio uses `HTMLAudioElement`. To stay inside browser autoplay policy, the
player requires a one-time user gesture (the "Play" button) before the first
audio start. Subsequent slides reuse the unlocked element.

Decode latency is hidden by preloading the next slide's picture while the
current slide holds, and by pinning audio `preload="auto"`.

## Transitions

All transitions are pure functions:

```ts
type TransitionFn = (
  ctx: CanvasRenderingContext2D,
  from: HTMLImageElement | HTMLCanvasElement | null,
  to: HTMLImageElement | HTMLCanvasElement,
  t: number,        // 0..1
  w: number,
  h: number,
) => void;
```

- `cut` — show `to` for any `t > 0`, else show `from`.
- `fade` — draw `from`, then `to` with `globalAlpha = t`.
- `wipe` — draw `from`, then `to` clipped to a left-to-right rectangle of
  width `t * w`.
- `iris` — draw `from`, then `to` clipped to a centered circle of radius
  `t * maxRadius`, where `maxRadius = hypot(w, h) / 2`.
- `dissolve` — pixel-block grid where each cell flips in based on a stable
  hash; `cellsRevealed(t) = floor(t * gridCount)`.

The deterministic math (alpha, wipe x, iris radius, dissolve cell count, the
cell ordering hash) is exposed from `transitions.ts` as named pure functions
so tests can assert behavior with no DOM. See `transitions.test.ts`.

## Export (v1)

Two modes:

1. **Present** — fullscreen-like view of the player canvas; no recording.
2. **WebM capture** — when `MediaRecorder` and
   `canvas.captureStream` are both available, the player records the canvas
   stream mixed with an `AudioContext`-routed audio destination. The download
   is a single `video/webm` Blob. If unsupported, the button is hidden.

## Hook into the existing app

A single tiny entry point is added: `src/slideshow/install.ts`. It is invoked
from `src/kidpix-main.js` once on load. It:
- Creates a top-of-toolbar button (no existing button is moved or removed).
- Mounts the editor / player into a modal-style div appended to `<body>`.
- Is a no-op if `document.getElementById("toolbar")` is absent (defensive — keeps
  legacy bootstrap and tests unaffected).

No existing tool is touched. The slideshow module imports nothing from `js/`.

## Open kill vectors and mitigations

| Vector | Mitigation |
|---|---|
| Save schema didn't previously exist | New `pictures` store + dual-read shim from legacy localStorage |
| Heavy in-browser export | v1 = playback + optional WebM only |
| Autoplay / decode latency | One-gesture unlock; preload next slide & audio |
| Scope creep | v1 scope locked above; no plugin framework |
| Transition rendering choice | Canvas 2D — simplest with existing pipeline |
| Mobile polish | Desktop-first; touch falls back to click |
| Quota | 50 MB soft cap on bundled sounds per slideshow |
