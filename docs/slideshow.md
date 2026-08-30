# SlideShow companion mode

A stylistic-equivalent of the classic KidPix SlideShow: sequence saved pictures
with transitions into a playable show. This is the product contract for what
ships today; planned work is listed separately under "Not shipped".

It is a brownfield feature added beside the legacy engine. It changes no
existing tool; it adds one toolbar button (`#kp-slideshow-btn`) that opens a
self-contained editor and player, and it listens to the toolbar Save button.

## The journey (covered by `tests/e2e/slideshow.spec.ts`)

1. **Create.** Draw, then save (toolbar **Save** button or the `s` key).
   Besides the PNG download, a copy of the drawing is filed in the SlideShow
   library as "Picture hh:mm:ss". Saving again without drawing files nothing
   new: the capture is compared with the newest library picture, so this holds
   across reloads.
2. **Arrange.** Open SlideShow. The picker lists library pictures newest first;
   clicking one appends a slide. Each slide row has a transition select,
   duration (ms), transition length (ms), ▲/▼ to reorder (touch-safe), ✕ to
   remove. (HTML5 drag-to-reorder is still wired for pointer devices but is
   untested; ▲/▼ is the supported path.)
3. **Save / Play.** **Save** writes the show to IndexedDB. **Play** runs it on an
   800×600 canvas inside the editor; the player surface reports
   `data-state="idle" | "playing" | "ended"`.
4. **Close / reopen.** Reopening the editor loads the most recently saved show
   with its order and settings. **New** starts an empty show without deleting
   the saved one.

Reopen shows only the latest saved show. There is no UI to list, pick, or
delete other shows, or to delete library pictures.

## Scope

In:
- Picture library (IndexedDB `kidpix-slideshow`, stores `pictures`,
  `slideshows`, `sounds`), fed by the toolbar Save and seeded once from the
  legacy `localStorage["kiddopaint"]` slot when the library is empty
  (picture named "Last saved").
- Ordered slide list (`model.ts`) — append / insert / remove / reorder / update.
- Five transitions: `cut`, `fade`, `wipe`, `iris`, `dissolve`; math is
  deterministic in `t ∈ [0, 1]`.
- Optional **Record WebM (no sound)** via `MediaRecorder` on the player canvas;
  a download link appears when playback ends. The button is hidden when
  `MediaRecorder` / `canvas.captureStream` are unavailable.
- Unit tests: store CRUD + validation, model ops + reopen rule, transition math,
  player advance on a fake clock. Browser journey: the E2E spec above.

Not shipped (model fields and hooks exist; no UI, no doc claim):
- Per-slide sounds. `Slide.soundId`, the `sounds` store and
  `htmlAudioPort` exist, but the editor exposes no sound picker and the
  player runs without an audio port. The 50 MB sound budget constant is unused.
- Audio in the WebM export; preloading the next slide; fullscreen presentation.
- Mobile/touch polish beyond ▲/▼ reordering; GIF/MP4; cloud sync; any plugin
  or transition framework.
- Library retention. Nothing prunes the library: each effective save adds a
  full PNG data URL of the 1300×650 canvas to IndexedDB, and there is no UI to
  delete pictures.

## Data model

```ts
type TransitionId = 'cut' | 'fade' | 'wipe' | 'iris' | 'dissolve';

interface Slide {
  id: string;
  pictureId: string;
  soundId?: string;          // reserved; never set by the editor
  transition: TransitionId;
  transitionMs: number;      // transition INTO this slide
  durationMs: number;        // total hold, clamped >= transitionMs
}

interface Slideshow { id: string; name: string; slides: Slide[]; createdMs: number; updatedMs: number }
interface Picture   { id: string; name: string; dataUrl: string; createdMs: number }
```

Ids are `<prefix>-<base36 time>-<counter>` from `model.ts` (not UUIDs).
Everything crossing into the store is validated by `isPicture` / `isSlideshow`
at `put*` time.

## Persistence

`store.ts` is the only module that talks to IndexedDB (database version 1;
`onupgradeneeded` creates the three stores). `createMemoryStore()` is the
test/IDB-less twin with the same interface.

- The library grows by one picture per effective Save; nothing prunes it.
- A slide whose picture was deleted from the store renders as "Picture
  missing" (`data-missing="true"`); during playback it draws nothing (the
  previous frame stays) for its duration and the show still reaches `ended`.
- If IndexedDB is absent the toolbar button is never installed. If the store
  fails at open time the editor shows "Storage unavailable: …" with an empty
  picker and a fresh untitled show.
- The legacy slot is read-only; the slideshow store never writes localStorage.

## Playback

`player.ts` drives a `requestAnimationFrame` loop over `performance.now()`;
tests inject a fake clock and scheduler. Each slide renders
`transitionFn(slide.transition)(ctx, prev, current, clamp01(elapsed / transitionMs))`
and advances when `elapsed >= durationMs`. Image load failures emit an
`error` event (surfaced as a flash) and the slide draws nothing.

## Transitions

Pure `(ctx, from, to, t, w, h)` renderers, plus exported math for tests:
`fadeAlpha`, `wipeX`, `irisRadius`, `dissolveCellOrder`, `dissolveCellsRevealed`.
`cut` shows `to` for `t > 0`; `fade` uses `globalAlpha = t`; `wipe` clips a
left-to-right rectangle of width `t·w`; `iris` clips a centered circle of
radius `t·hypot(w,h)/2`; `dissolve` reveals `floor(t·192)` cells of a 16×12
grid in a fixed hashed order.

## Hook into the existing app

`src/kidpix-main.js` imports `src/slideshow/install.ts` once. `install.ts`
touches the legacy engine only through the DOM: it appends the toolbar button
to `#mainbar`, mounts the editor under `<body>`, and listens for the
`kidpix:picture-saved` event that the legacy `save_to_file()`
(js/init/kiddopaint.js) dispatches on `document` after every PNG save; the
listener reads `#kiddopaint` (the main canvas) with `toDataURL`. It imports
nothing from `js/`, and is a no-op without `#mainbar`/`#toolbar` or IndexedDB.
