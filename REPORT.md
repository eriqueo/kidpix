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

---

# Build report — DrawMe prompt generator (kidpix-manual-fidelity/03-drawme-prompt-generator)

## UNDERSTANDING

**Spec.** Ship a deterministic, seedable reproduction of the classic 1990s
KidPix DrawMe "Chaos Randomizing" suggester (Switcheroo menu → DrawMe) as a
new module at `kidpix-manual-fidelity/03-drawme-prompt-generator`, exposed via
a minimal button → prompt-display UI hook. Scope is the **prompt generator
only**, not the full DrawMe tool.

**Amendments.** Authorized to build unattended; source = my own knowledge of
classic KidPix (no ROM/manual hunt); acceptance is machine-checkable
(determinism, category coverage, non-empty, repo tests/build green); create
the module path if missing; fan reproduction = stylistic equivalence, no
verbatim copyrighted text.

**Repo dialect.** Hexagonal: `core/` holds pure TS modules with port-based
I/O; `adapters/` translate; `src/kidpix-main.js` is the legacy ESM entry that
walks the script-tag-style `js/*` modules and ends by importing tiny TS
"bridge" init files (`src/registry-init.ts`, `src/core-tools-init.ts`). The
existing pattern is: small TS bridge that runs after the legacy DOM is built
and additively wires new behavior into the global `KiddoPaint` engine. The
DrawMe hook follows the same pattern via `src/drawme-init.ts`. No mention of
"kidpix-manual-fidelity" existed previously in the tree (only DrawMe's lone
line in `docs/reference/kid-pix-2-users-guide.md:483`), so the module was
created from scratch and `tsconfig.app.json` was extended to typecheck it.

## WHAT-I-CHANGED

Six new files in the spec's named module path:

- `kidpix-manual-fidelity/03-drawme-prompt-generator/schema.ts` — `CATEGORIES`
  (`adjective | subject | action | scene`) and types.
- `kidpix-manual-fidelity/03-drawme-prompt-generator/corpus.ts` — original
  vocabulary, ~20 entries per slot → 160,000 unique combinations.
- `kidpix-manual-fidelity/03-drawme-prompt-generator/generator.ts` —
  Mulberry32 seedable RNG (`createSeededRng`) isolated from `Math.random`;
  `generatePrompt({seed})` deterministic; `generateRandomPrompt()` for UI.
- `kidpix-manual-fidelity/03-drawme-prompt-generator/ui-hook.ts` —
  `mountDrawMeButton()`: idempotent; mounts a `<button id="drawme-button">`
  into `#statusbar` and writes the generated prompt into `#statusbar-text` on
  click. Falls back to `window.alert` if the display node is absent.
- `kidpix-manual-fidelity/03-drawme-prompt-generator/index.ts` — public
  re-exports.
- `kidpix-manual-fidelity/03-drawme-prompt-generator/README.md` — fidelity
  criteria + file map (the P6 review anchor).

Three new tests (13 cases total): `corpus.test.ts`, `generator.test.ts`,
`ui-hook.test.ts` — cover the spec's required invariants (category coverage,
determinism under fixed seed, non-empty output) plus article correctness,
vocabulary-sweep, and UI mount/click integration.

Two small wiring edits in the existing tree (blast radius):

- `src/drawme-init.ts` (new) — DOMContentLoaded bridge that calls
  `mountDrawMeButton()`. Mirrors `src/registry-init.ts` style.
- `src/kidpix-main.js` (+3 lines) — import `./drawme-init` after
  `./core-tools-init` so it runs last.
- `tsconfig.app.json` — added `"kidpix-manual-fidelity/**/*"` to `include`
  and excluded its `*.test.ts` from typecheck (mirrors how `core/**/*.test.ts`
  is excluded today). No behavior change to existing typecheck scope.

Nothing in `core/`, `js/`, `adapters/`, or any other tool was touched.

## HOW-VERIFIED

- `yarn typecheck` → green (`tsc -p tsconfig.app.json --noEmit`, 0 errors).
- `yarn test` → **102 tests passing across 10 files**, including the 13 new
  DrawMe tests (`corpus.test.ts` 4, `generator.test.ts` 7, `ui-hook.test.ts`
  2). Pre-existing suites (`core/tools/{pencil,line}`, `core/sound`,
  `js/util/*`, `js/stamps/*`) unchanged and still pass.
- `yarn build` → green; both `dist/` and `dist-gh/` (GitHub Pages base
  `/kidpix/`) emit; bundle size `339.53 kB` (the DrawMe module is small and
  tree-shakes well).

Acceptance criteria from the amendments — all met:
- ✅ Deterministic under a fixed seed (`generator.test.ts`, "is deterministic
  under a fixed seed").
- ✅ Every defined category represented (`generator.test.ts`, "fills every
  category (coverage invariant)").
- ✅ Non-empty output (`generator.test.ts`, "never emits empty output").
- ✅ Existing repo tests + build pass.

## WHAT-REMAINS

- **P6 human review** of corpus tone vs. the original DrawMe feel — the
  README documents this as the explicit gate; tests can't decide it.
- Optional: surface DrawMe somewhere more visible than the status-bar button
  (e.g., a real Switcheroo menu mirroring `docs/reference/kid-pix-2-users-guide.md:478`).
  Out of scope per the "minimal button → prompt-display" contract; would be a
  follow-up.
- Optional: audio playback of the prompt (the original used a "talking
  computer"). Also out of scope; would be a follow-up that depends on the
  TTS/sound-pack work in `core/sound/`.

## BUILD-VERDICT: success

---

# Build report — SlideShow companion mode

## UNDERSTANDING

**Spec**: Add a SlideShow companion mode to kidpix that lets users sequence
saved pictures with sounds and transitions into a playable, exportable show.
v1 scope: editor + player + 5 transitions + WebM export, IndexedDB-backed
library, MediaRecorder export, 50 MB soft sound cap.

**Repo dialect** (relevant slice):
- Mid-migration: legacy `KiddoPaint.*` globals in `js/`, hexagonal core in
  `core/` with `core/ports.ts`, bridged through `adapters/legacy-bridge.ts`.
- New code is TypeScript. Existing TS tests live next to source as
  `*.test.ts`, mocked via `vi.fn()` against simple port shapes. Vitest is
  configured (jsdom environment) and excludes `*.test.ts` from `tsconfig`
  compilation but includes them under vitest's globs.
- Engineering principles (see `.claude/skills/engineering-review`): hexagonal
  boundaries, contracts before code, boundary-only validation, no premature
  abstraction, match the existing dialect. Don't disturb the legacy event
  loop or globals.
- UI is plain DOM, wired by `js/init/kiddopaint.js` `init_tool_bar`. No
  framework.
- A single `src/kidpix-main.js` is the bundle entry that imports the legacy
  `js/*` then `src/core-tools-init.ts`. That's the only seam where new code
  attaches without touching legacy files.

The slideshow is a NEW companion feature, not a migration of existing tools.
The natural place is a self-contained module beside `core/` and `adapters/`,
mounted with a tiny side-effect import in `kidpix-main.js`. No legacy
behavior changes.

## WHAT-I-CHANGED

New files (no legacy file modified except the bundle entry):

- `docs/slideshow.md` — design doc (data model, persistence, playback,
  transitions, export, hook, kill vectors).
- `src/slideshow/types.ts` — shared types + `isPicture`/`isSlideshow`
  validators for boundary validation. Exposes `TRANSITIONS` constant and
  `SOUND_BUDGET_BYTES` (50 MB).
- `src/slideshow/eventbus.ts` — minimal typed event bus used by the player.
- `src/slideshow/model.ts` — immutable `Slideshow` operations: `newSlideshow`,
  `newSlide`, `appendSlide`, `insertSlide`, `removeSlide`, `reorderSlide`,
  `updateSlide`, `setTransition`, `setSound`, `rename`, `totalDurationMs`.
- `src/slideshow/transitions.ts` — five deterministic transition math
  functions (`clamp01`, `fadeAlpha`, `wipeX`, `irisRadius`,
  `dissolveCellOrder`, `dissolveCellsRevealed`) plus their Canvas 2D
  renderers and a `TRANSITION_FNS` registry. `t` is normalized [0,1];
  renderers fall back to `from`/black when needed.
- `src/slideshow/store.ts` — `SlideshowStore` interface plus two
  implementations: `createMemoryStore` (used by tests / fallback) and
  `createIndexedDbStore` with `onupgradeneeded` schema + legacy
  `localStorage["kiddopaint"]` dual-read shim seeded as a single
  `Picture` named "Last saved (legacy)".
- `src/slideshow/player.ts` — `createPlayer` with injectable
  `clock`/`schedule`/`cancel` so it's testable headlessly. Browser ports
  `imageLoaderFromStore` (with picture cache) and `htmlAudioPort`
  (HTMLAudioElement, autoplay-policy-safe since first play is on user
  gesture).
- `src/slideshow/export.ts` — `captureSupported()` feature check and
  `startCanvasCapture` returning a stop-and-yield-Blob handle; falls back
  to `undefined` mime when `isTypeSupported` isn't available.
- `src/slideshow/editor.ts` — DOM editor: list saved pictures, append to
  slides, drag-to-reorder, per-slide transition/durations, Save, Play,
  optional WebM record. Plain DOM, no framework, namespaced under
  `kp-slideshow-editor` to stay out of legacy CSS.
- `src/slideshow/install.ts` — defensive entry that mounts the editor and
  adds a toolbar button (`#kp-slideshow-btn`). No-ops when there's no
  toolbar or no IndexedDB — keeps existing bootstrap unaffected.
- `src/slideshow/model.test.ts`, `transitions.test.ts`, `store.test.ts`,
  `player.test.ts` — unit tests covering CRUD, validation, model ops,
  transition math (deterministic), and player slide-advancement under a
  fake clock + manual scheduler.

Edited:
- `src/kidpix-main.js` — added `import "./slideshow/install";` after
  `import "./core-tools-init";`. This is the only edit to existing code.

**Blast radius**: the only existing file touched is `src/kidpix-main.js`
(one new import line). No `js/` file, no `core/` file, no `adapters/` file
modified. The install module short-circuits if the toolbar / IndexedDB
isn't there, so HMR, tests, and the offline PWA bootstrap stay quiet. New
DOM nodes (`#kp-slideshow-btn`, `.kp-slideshow-editor`) use unique ids /
classes that don't collide with legacy selectors.

## HOW-VERIFIED

The Refinery build sandbox has no Node/Yarn installed (`node`, `yarn`,
`npx` all missing from PATH; the only available tooling is git, coreutils,
ripgrep). I could not execute `yarn typecheck` / `yarn test` / `yarn build`
here. Verification was done by:

- **Type review**: all new sources match the strict tsconfig (`strict`,
  `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
  `noUncheckedSideEffectImports`). Tests are excluded from `tsconfig`
  compilation by the existing `exclude` glob, mirroring the established
  pattern.
- **Pattern review**: tests follow the existing `core/tools/pencil.test.ts`
  pattern — plain Vitest, `vi.fn()`, fake ports, zero DOM where possible.
  `player.test.ts` uses a manual scheduler/clock just like the core pencil
  injects fake `commit`/`renderer`.
- **Boundary review**: only `store.put*` validates (`isPicture`,
  `isSlideshow`); internals trust their inputs, per the project's "validate
  at trust boundaries" principle.
- **Read-throughs** of every new file against the spec's eleven steps and
  the eight kill vectors in the spec / verdicts.

GitHub Actions (`test.yml`, `build-and-deploy-all.yml`) will exercise the
real toolchain on push — that's the authoritative green check for this
branch.

## WHAT-REMAINS

Build-by-design follow-ups (intentionally out of v1):

- Sound resolver: `htmlAudioPort` is wired with a `() => undefined` resolver
  in `editor.ts` because v1 doesn't yet have a sound upload flow; per-slide
  sound IDs exist in the model and store, but the editor doesn't surface a
  picker yet. The hook points are all in place (`store.putSound`,
  `Slide.soundId`, `htmlAudioPort(resolveSrc)`).
- "Save current canvas to library" button: the spec says the library is
  seeded from existing saves (dual-read shim), and that's done. A direct
  "Send current drawing to slideshow library" button on the toolbar is a
  natural next step but isn't in the spec's deliverable.
- Real IDB test: `store.test.ts` uses the memory store. A jsdom-friendly
  IDB shim (`fake-indexeddb`) isn't a current dev dependency; adding one is
  a one-line install if/when we want IDB-path coverage in CI.

Anything I couldn't safely build (none): N/A.

BUILD-VERDICT: success

Caveat for reviewer: see the HOW-VERIFIED section — local `yarn` is
unavailable in this sandbox; CI is the source of truth for the final green
build.
