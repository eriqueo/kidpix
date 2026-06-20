# Wacky TV — Design Note

Faithful stylistic equivalent of the classic Kid Pix Wacky TV / QuickTime feature:
play a video, watch it run through the Wacky Mixer effects live, and stamp the
currently-effected frame into the main picture.

## UX

- A `📺 Wacky TV` button on the main toolbar opens a modal overlay.
- Modal contents:
  - A `<video>` element (hidden — used only as the frame source).
  - A preview `<canvas>` showing the effected frames at the capped size.
  - "Load a video…" file picker (local files only).
  - "Sample" button — plays a procedurally-generated CC0 animated demo
    (bouncing color squares) drawn into a canvas and exposed via
    `captureStream()`. No bundled binary assets, no licensing risk.
  - Effect selector (the pure-JS Mixer effects that round-trip through
    `ImageData`): None, Invert, Sunshine, Threshold, Floyd-Steinberg,
    Bayer, Atkinson, Sobel/Nightvision.
  - Play / Pause and a Capture button.
- Audio: muted by default. `<video muted autoplay playsinline>`. No
  passthrough audio in v1.
- Capture sound: `KiddoPaint.Sounds.stamp()` (existing).

## Data flow

```
HTMLVideoElement
    │  (rAF tick, throttled to ~15fps)
    ▼
offscreen <canvas> @ 256x192   ← capped low-res scratch buffer
    │  drawImage(video)
    ▼
ImageData via getImageData()
    │  → WackyTV.applyEffect(imageData, effectName)   (additive adapter)
    ▼
ImageData (effected)
    │  putImageData onto preview <canvas>
    ▼
[Capture button click]
    │  WackyTV.pasteImageDataToMain(imageData)
    ▼
main picture canvas (via existing Display.saveUndo + main_context.drawImage)
```

The adapter is a pure `ImageData → ImageData` function that wraps existing
one-shot Mixer effects (`Filters.*`, `Dither.*`). The wrap is additive: we
never call into `WholeCanvasEffect` and never mutate any existing call site.
The WebGL-backed effects (Pinch, Swirl, etc.) are out of v1 because their
state lives inside a per-tool `fx.canvas()` texture pipeline and re-wiring
that for arbitrary `ImageData` is the kind of rip-through the spec
explicitly forbids.

## Performance budget

- Scratch & preview canvas: 256 × 192 (≈49k px, ~196kB per ImageData).
- Tick rate: 15fps (66ms budget) via rAF gating.
- Effects in v1 are all O(n) pixel walks — well inside the budget on a
  laptop. If a slower effect is added later, gate it behind a frame-skip.

## Integration points

- `js/util/filters.js` — `Filters.invert / threshold / gcoInvert / gcoOverlay`.
- `js/util/dither.js` — `Dither.floydsteinberg / bayer / atkinson / threshold`.
- `js/util/display.js` — `KiddoPaint.Display.{saveUndo, main_context,
  main_canvas, imageTypeToCanvas}` for the paste path.
- `js/sounds/sounds.js` — `KiddoPaint.Sounds.stamp()` for the capture sound.

## Supported codecs

Whatever the host browser plays via `<video>`. v1 only takes local files
(file picker) plus the procedural sample, so there is no remote-URL CORS
taint that would block `getImageData`.

## Scope cap (locked)

v1 is **frame capture only**. No multi-frame clip capture, no GIF/sprite
output, no audio passthrough. An extension point lives in `wacky-tv.js`
(`captureFrame`) but no scaffolding is shipped for it.

## Feature flag

None. The build branch is the shipping branch — per spec, the flag is
removed before ship.

## Removal owner

n/a — no flag to clean up.
