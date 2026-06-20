# Build report — Wacky TV

## UNDERSTANDING

**Spec.** Add a Wacky TV tool: play an HTML5 video, run each frame through
the existing Electric Mixer effects via an additive `ImageData → ImageData`
adapter, render the effected frames live on a preview canvas, and let the
user "capture" the current frame into the main picture canvas through the
existing paste pathway. Bundle a CC0 sample, accept local files, muted by
default, Kid-Pix-styled UI, capture sound, tests for the adapter and the
capture→paste path. Frame-only capture for v1 (clip capture deferred). No
feature flag (the build branch is the shipping branch).

**Repo dialect.** Kid Pix is a globally-coupled engine hung off
`window.KiddoPaint.*`. Tools live as constructed objects on
`KiddoPaint.Tools.*` with the three-method `mousedown / mousemove /
mouseup` interface. Drawing flows through five canvas layers; the canonical
"paste to picture" pattern is `Display.saveUndo()` → write to
`Display.main_context`. The existing Mixer (`WholeCanvasEffect` in
`js/tools/wholefx.js`) mixes WebGL-backed effects (via `fx.canvas()`,
glfx.js) with pure-JS pixel-walk effects (`Filters.*`, `Dither.*`). Tests
use Vitest + jsdom; `src/test-setup.ts` installs a deliberately thin
canvas/ImageData mock — the existing real test suites (`core/`,
`js/stamps/stamp-names.test.js`) work around it by not relying on those
APIs.

## WHAT-I-CHANGED

Six phases (P1–P6 in the spec), four commits on `build/2026-06-20-brain-3y320g-build`.

| Phase | Commit | Files |
|------|--------|-------|
| P1 design doc | `d027763` | `docs/wacky-tv-design.md` |
| P3 effect adapter + tests | `5f21cd0` | `js/wackytv/effect-adapter.{js,test.js}` |
| P4 capture path + tests | `5fc2b9b` | `js/wackytv/capture.{js,test.js}` |
| P2/P6 UI + wiring | `f448f58` | `js/wackytv/wacky-tv.js`, `index.html`, `js/init/kiddopaint.js`, `src/kidpix-main.js` |

**Effect adapter (`js/wackytv/effect-adapter.js`).** Pure
`ImageData → ImageData` wrapper that round-trips through existing
`Filters.invert / threshold / sobel / gcoOverlay` and
`Dither.floydsteinberg / bayer / atkinson`. Exposes a stable `EFFECTS`
list. WebGL-backed effects (Pinch, Swirl, etc.) are explicitly out of v1
because their state lives inside a per-tool `fx.canvas()` texture pipeline
that can't be cheaply driven from arbitrary `ImageData` without exactly
the kind of one-shot-rewrite the spec forbids.

**Capture path (`js/wackytv/capture.js`).** `pasteImageDataToMain` scales
the frame to fit the picture canvas (aspect-preserving, centred), then
calls `Display.saveUndo()` and `main_context.drawImage()` — the same
protocol every other engine paste uses. Display is injected (with the live
`KiddoPaint.Display` as the default) so the function is unit-testable.

**UI tool (`js/wackytv/wacky-tv.js`).** Modal overlay (reuses the existing
`.modal-overlay` / `.modal-content` CSS classes from the Keyboard Shortcuts
help popup) containing: hidden `<video muted autoplay playsinline loop>`,
a 256×192 scratch canvas for the effect pipeline, a same-size preview
canvas, file picker, "Sample" button, play/pause, effect dropdown, capture
button. Render loop is `requestAnimationFrame` gated to ~15fps (TICK_MS=66)
so an O(n) pixel walk on ~49k pixels stays inside the frame budget. The
"Sample" video is a procedurally drawn animated canvas exposed via
`captureStream()` — genuinely CC0 (ships as code, not as a bundled binary)
and avoids the licensing kill-vector. The capture button reuses
`KiddoPaint.Sounds.stamp` for the Kid-Pix-style audio.

**Wiring.** New `📺 Wacky TV` button added to `#mainbar` in `index.html`
(after Redo). Click handler in `js/init/kiddopaint.js` opens the modal and
plays `Sounds.mainmenu`. Imports added to `src/kidpix-main.js`.
ToolDescriptions entry added so the status bar shows a hover description
matching the rest of the toolbar.

**Blast radius (what I touched).**
- New: `docs/wacky-tv-design.md`, four `js/wackytv/*.js` files (incl. 2
  test files), one new toolbar button.
- Edited: `src/kidpix-main.js` (added 4 import lines), `index.html`
  (one new `<button>`), `js/init/kiddopaint.js` (one click listener +
  one entry in `ToolDescriptions`).
- **Not touched**: `wholefx.js`, any existing Mixer tool, the
  `KiddoPaint.Tools.Toolbox.*` registry, the canvas event dispatcher,
  the undo/redo/persist machinery, or any existing tool wiring. The Wacky
  TV button does NOT change `KiddoPaint.Current.tool`, so opening the
  modal does not affect what the main canvas does on click.

## HOW-VERIFIED

**Static review.**
- All adapter call targets (`Filters.{invert,threshold,sobel,gcoOverlay}`,
  `Dither.{floydsteinberg,bayer,atkinson}`) verified to exist in
  `js/util/filters.js` and `js/util/dither.js`.
- Display API targets (`saveUndo`, `main_canvas`, `main_context`) verified
  in `js/util/display.js`.
- `KiddoPaint.Sounds.stamp` verified at `js/sounds/sounds.js:335`.
- Vitest include glob (`**/js/**/*.{test,spec}.js`) matches the new
  `js/wackytv/*.test.js` files.

**Tests written.**
- `effect-adapter.test.js`: 10 cases — effect list shape, `none` identity
  + buffer-copy semantics, invert math, threshold edges, dither 1-bit
  output, unknown effect throws, null input throws. Adapter test installs
  a 3-arg-capable `ImageData` polyfill before importing because
  `src/test-setup.ts` ships a 2-arg-only mock that doesn't fit the
  adapter's contract.
- `capture.test.js`: 4 cases — `saveUndo` runs strictly before
  `drawImage`, placement math (aspect-preserving centring on a 200×100
  canvas), the source passed to `drawImage` is a properly-scaled
  `HTMLCanvasElement` at the correct destination, missing-display
  throws. Test installs a per-canvas fake `getContext` so the
  `putImageData → drawImage` chain in the offscreen-scaling helper
  actually goes through.

**Test execution.** ⚠️ The sandbox this build agent runs in has no
`node` / `yarn` / `npm` on `$PATH` (verified — only nix coreutils, git,
ripgrep, etc. are present). I could not run `yarn test`, `yarn typecheck`,
or `yarn build` here. The committed test files mirror the structure of
existing repo tests (jsdom env, dynamic imports of `js/util/*` modules,
duck-typed fakes around the canvas mock) and the production code paths
were verified by static review against the dependencies listed above.

CI on push (`test.yml`) will run `vitest run` and the existing Playwright
suite — that is the actual green-light gate, and is the standard workflow
for this repo.

## WHAT-REMAINS

- **CI confirmation.** `yarn test` + `yarn build` + Playwright need to run
  on push. If a test asserts something the production code doesn't quite
  do, fix forward — the implementation is small.
- **Optional polish.** The 📺 button is text-rendered (uses an emoji); a
  proper pixel-art icon at `img/toolbar/` would match the rest of the
  toolbar more faithfully. Deferred — not in the spec deliverable.
- **Out-of-scope by spec.** Clip / multi-frame capture (deferred to a
  future feature request); WebGL-backed Mixer effects in the adapter
  (would need a different glfx integration path).

---

BUILD-VERDICT: success
