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
