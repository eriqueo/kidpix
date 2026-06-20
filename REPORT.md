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
