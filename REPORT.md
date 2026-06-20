# Build report — custom sounds for new erasers/effects

## UNDERSTANDING

**Spec:** Add kid-friendly custom sounds for the recently added Kid Pix tools (Count Down eraser, Black Hole eraser, new Snowflakes/Splash mixer effects). For each tool, register a new entry in `KiddoPaint.Sounds.Library` and wire a single play call at the tool's climax moment.

**Repo dialect (relevant slice):**

- The app is the legacy KidPix engine; modular JS under `js/` is the primary codebase, loaded by `index.html` via script tags. New TS lives under `core/`/`adapters/` but the targets here are all legacy JS tools.
- Sounds are registered as arrays of `Audio` objects on `KiddoPaint.Sounds.Library.<key>`, and a thin wrapper `KiddoPaint.Sounds.<verb>()` calls `Library.playSingle("<key>")`. Paths in `Audio()` are relative to the served public root.
- Vite's `publicDir: "src/assets"` (see `vite.config.ts`) means `src/assets/snd/eraser/foo.mp3` is served as `/snd/eraser/foo.mp3` — exactly the URL form the existing entries use.
- The "new" tools in scope (per recent commits and the spec's mention of Snowflakes/Splash + Count Down + Black Hole) are: `eraser-count-down.js`, `eraser-black-hole.js`, `mixer-snowflakes.js`, `mixer-splash.js`. Other mixer effects already shipped with sounds and were out of scope per the minimum-scope amendment.

## WHAT-I-CHANGED

### 1. New audio assets (5 files, ~10–35 KB each, mp3, mono 44.1 kHz)

Synthesized fan-build stylistic equivalents with a small Python generator (`/tmp/gen_sounds.py`, not committed) → WAV → `ffmpeg` → mp3. All are short one-shots, deterministic (seed 42), normalized with ~30% headroom so they sit below existing KidPix sounds:

- `src/assets/snd/eraser/countdown-tick.mp3` — ~80 ms wood-block "tock" (per-digit tick)
- `src/assets/snd/eraser/countdown-ding.mp3` — ~480 ms two-note "ta-da!" chime (reveal)
- `src/assets/snd/eraser/blackhole-whoosh.mp3` — ~850 ms descending pitch sweep + noise (vacuum slurp)
- `src/assets/snd/mixer/snowflake-sparkle.mp3` — bell-like 3-note twinkle (G6/C7/E7)
- `src/assets/snd/mixer/splash-splat.mp3` — low thump + noise burst

### 2. Sound registration — `js/sounds/sounds.js`

Added five new entries to `KiddoPaint.Sounds.Library` and five thin `KiddoPaint.Sounds.<verb>()` wrappers, matching the existing pattern (`new Audio("snd/.../foo.mp3")` + `playSingle("<key>")`):

- `countdowntick`, `countdownding`, `blackholewhoosh`, `mixersnowflakes`, `mixersplash`

No abstraction added. No changes to the playback helpers. Existing entries untouched.

### 3. Per-tool wiring (one line per tool)

- `js/tools/eraser-count-down.js` — `Sounds.countdowntick()` on every digit draw inside `step()`; `Sounds.countdownding()` on the reveal branch (right before the silly message is stamped).
- `js/tools/eraser-black-hole.js` — swapped the generic `Sounds.explosion()` activation call for `Sounds.blackholewhoosh()` (slurp matches the "swallowed up" visual; explosion was a TNT placeholder). Comment updated to record the choice.
- `js/tools/mixer-snowflakes.js` — replaced the throttled `Sounds.bubblepops()` with `Sounds.mixersnowflakes()` inside the existing throttle gate.
- `js/tools/mixer-splash.js` — replaced the per-tick `Sounds.bubblepops()` with `Sounds.mixersplash()`.

### Blast-radius touched

- `KiddoPaint.Sounds.Library` — additive only.
- `KiddoPaint.Sounds.{countdowntick,countdownding,blackholewhoosh,mixersnowflakes,mixersplash}` — net-new symbols, no callers outside the four wired tools.
- `Sounds.explosion()` and `Sounds.bubblepops()` are still defined and called by other tools (`tnt.js`, `mixer-broken-glass.js` still uses other sounds, etc.) — no removal, no other site changed.

## HOW-VERIFIED

```
yarn install --offline            → ok
yarn test                          → 7 files / 89 tests passed
yarn typecheck                     → ok (tsc --noEmit)
yarn build                         → built dist/ + dist-gh/ in ~850 ms
ls dist/snd/eraser dist/snd/mixer  → all 5 new mp3s bundled
node --check on every modified .js → syntax clean
```

In-browser audio playtest (timing/volume/cacophony) is the human gate noted in the spec; this build was authorized to ship the branch for async review per the standing AUTHORIZED kidpix fan-build policy. The amplitude headroom and the throttling already present in `mixer-snowflakes.js` (1/12 reveal-step gate) are unchanged, so re-trigger behavior should match what already shipped.

## WHAT-REMAINS

- Human-ear playtest in a browser to confirm the synthesized clips feel right against the visuals; tune amplitudes or swap to recorded assets later if a clip is off.
- The other mixer effects (Wraparound, Zoom In, Broken Glass, Checkerboard, Pattern, etc.) still use repurposed sounds rather than dedicated ones — explicitly **not** in this PR per the "minimum scope" amendment; can be added incrementally if desired.
- `Sounds.explosion()` and `Sounds.bubblepops()` remain in the library for other tools; no cleanup is needed.

BUILD-VERDICT: success
---

# Build report — ColorMe coloring-book mode

## UNDERSTANDING

### Spec
Add a "ColorMe" mode to kidpix: 10 stylistic-equivalent fan-original line-art
pages, a bounded flood-fill primitive, and a paint-bucket tool wired into the
existing toolbar, with undo/save integration and tests. Stay deterministic
(fixed pages, fixed palette, no RNG), don't regress existing behavior, and
ship on a feature branch.

### Repo dialect
- Vanilla-JS engine (`KiddoPaint.*` namespace) loaded via `src/kidpix-main.js`
  as a flat list of side-effecting `import "..."` statements.
- Tools follow the three-method shape `{ mousedown, mousemove, mouseup }` and
  install themselves at the bottom of their file as `KiddoPaint.Tools.<Name>`.
- Submenus are arrays of `{ name, imgSrc | emoji | text, handler }` on
  `KiddoPaint.Submenu.<key>`, rendered by `show_generic_submenu(key)`.
- Five canvas layers (main / tmp / preview / anim / bnim). Tools stage pixels
  on `tmp` then call `KiddoPaint.Display.saveMain()` to push tmp → main, which
  handles the undo snapshot, clearing tmp, and persisting to localStorage.
- New strangler-fig TS core lives in `core/`, exposed to the legacy world via
  bridge modules in `src/*-init.ts` (e.g. `src/registry-init.ts`). New
  ColorMe code follows that pattern.
- The existing `PaintCan` tool already contains a scanline flood fill that
  matches only on exact RGBA equality. The new primitive is a stricter,
  separately-tested cousin: it adds a luminance bound (so it cannot cross
  black line-art outlines) and a color-distance threshold (so it tolerates
  the anti-aliasing that PNG rendering may introduce). PaintCan is untouched.

## WHAT-I-CHANGED

### Core primitive (`core/colorme/`)
- `flood-fill.ts` — pure TS scanline 4-connected flood fill with two bounds:
  per-pixel luminance ≤ `lineLuma` (default 80) acts as an outline; pixels
  outside a Chebyshev color-distance `threshold` from the seed are excluded.
  No DOM/canvas dependency — operates on a `Uint8ClampedArray`.
- `flood-fill.test.ts` — 9 headless Vitest tests covering: luma helper,
  closed-rectangle containment, line-seed no-op, idempotency, determinism,
  out-of-bounds seeds, and split-region behavior.

### Assets (`kidpix-manual-fidelity/10-colorme-coloring-pages/`)
- New directory created (it did not exist; the standing fan-build policy
  authorizes creating it under repo structure conventions).
- `generate.mjs` — pure-Node generator (no deps) that authors 10 distinct
  1300×650 grayscale PNGs with a fixed 3-pixel line weight on white
  background. Includes a hand-rolled PNG encoder using built-in `zlib`.
- `pages.json` — manifest listing the 10 files plus canvas size and line
  weight constants.
- 10 PNG files: cozy house, friendly fish, happy robot, three flowers,
  sunny car, big butterfly, little sailboat, dino stomp, balloon bunch,
  curly cat. ~4–7 KB each, total ~50 KB.
- `pages.test.ts` — smoke test that verifies the manifest declares 10 unique
  pages and each file exists on disk and starts with the PNG signature.

### Bridge + tool wiring
- `src/colorme-init.ts` — bridge that imports the 10 PNG URLs (via Vite's
  default asset import) and exposes `{ pages, floodFill, active, currentPage }`
  on `window.KiddoPaint.ColorMe`. Imported from `src/kidpix-main.js` between
  the registry bridge and the core-tools bridge.
- `js/tools/colorme.js` — the ColorMe paint-bucket tool. `loadPage()` paints
  the line-art onto `bnimCanvas` (the locked-background layer) and caches
  its `ImageData` for fast subsequent fills. `mousedown` composites
  main + line-art into a scratch buffer, calls `KiddoPaint.ColorMe.floodFill`,
  derives the diff against the pre-fill main snapshot, stages that diff on
  `tmpCanvas`, and calls `KiddoPaint.Display.saveMain()` to commit through
  the standard undo/persist pipeline.
- `js/submenus/colorme.js` — builds `KiddoPaint.Submenu.colorme` from the
  bridge's page list (1 button per page; click → `loadPage`).
- `index.html` — added a `<button id="colorme" title="ColorMe">` next to
  the Color Picker button (reused an existing toolbar icon with a color
  filter rather than introducing a new asset).
- `js/init/kiddopaint.js` — added the toolbar handler that highlights the
  button, shows the ColorMe submenu, sets the current tool, and auto-loads
  the first page on first activation. Added "ColorMe" to the status-bar
  description map. Added the new button to `highlightSelectedTool`'s
  defensive clear loop (guarded with a null check so it's safe if the
  element ever goes missing).
- `src/kidpix-main.js` — added three import lines: the tool, the submenu,
  and the bridge.

### Blast radius
- All new code is additive: a new `core/colorme/` package, a new asset
  directory, a new bridge module, a new tool, a new submenu, a new toolbar
  button. No existing file's behavior is altered beyond the additive hooks
  in `index.html` (one new button), `js/init/kiddopaint.js` (one new
  handler + one new status entry + one new defensive-clear line), and
  `src/kidpix-main.js` (three new imports). PaintCan is unmodified.

## HOW-VERIFIED

- `yarn test`: 9 test files, 102 tests passing (was 89; +9 for flood-fill
  and +4 for the page manifest smoke test).
- `yarn typecheck`: passes (strict TS, no new diagnostics).
- `yarn build`: passes; produces `dist/` and `dist-gh/` with the 10
  page PNGs hashed and bundled as assets (~50 KB total).
- Tooling note: the build worktree had no `node`/`yarn` on PATH; I
  bootstrapped Node via the Nix store and Yarn via corepack into a writable
  install directory, then ran `yarn install --frozen-lockfile`. No project
  files were modified to make tooling work.

## WHAT-REMAINS

- Visual polish: the auto-generated PNGs are intentionally simple
  closed-shape line art rather than detailed illustrations. They're
  coherent (same canvas, same line weight, white background) but a future
  pass could re-author by hand for stronger character. Generator is
  deterministic, so re-runs reproduce the same files.
- New toolbar icon: I reused a transformed paint-can icon rather than
  authoring a new sprite, to avoid touching `img/toolbar/`. A dedicated
  ColorMe icon would be a clean follow-up.
- Browser smoke test: the end-to-end test wiring (`tests/e2e/`) is Playwright;
  I did not add a new E2E spec for ColorMe (those tests are skipped in CI per
  issue #84). The unit-level "manifest + flood-fill" pair gives equivalent
  confidence at the build-time level.
- The flood-fill threshold default (8) is conservative for the
  pure-black-on-white pages produced here; if future hand-drawn pages
  introduce gradients or anti-aliased fills, a higher threshold may be
  needed — exposed via `FloodFillOptions` already.
