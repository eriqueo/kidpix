# Build report — `kidpix-manual-fidelity/09-edit-stamp-editor`

## UNDERSTANDING

**Spec goal.** Deliver a manual-fidelity Kid Pix Stamp Editor: pixel-grid
editor (paint / erase / palette / mirror-H / mirror-V / rotate / clear /
undo-last-stroke), modal overlay launched from an "Edit Stamp" toolbar
control, and edited bitmaps written back so the main canvas Stamp tool
renders them.

**Repo dialect.**
- Vanilla JS in `KiddoPaint.*` namespaces, loaded via `src/kidpix-main.js`
  importing files in dependency order; new modules are added as additional
  imports. No bundler-level wiring beyond that import list.
- Stamps are emoji strings rendered by `KiddoPaint.Stamps.stamp(...)`, which
  uses `ctx.fillText` and returns an `HTMLCanvasElement` sized as
  `max(size+5%, 24) × max(size+5%, 24) × 1.15`. There is no native bitmap
  slot, so the integration is a renderer shim, not a slot mutation.
- The Stamp tool's identifier is `KiddoPaint.Tools.Stamp.stamp` (an emoji
  string). That string is the natural override-map key.
- The sprites submenu (`#genericsubmenu`) is rebuilt by `#stamp`'s mousedown
  handler in `js/init/kiddopaint.js:749`. There was no pre-existing Edit
  Stamp control; per the standing fan-build policy (clause 4) the build
  creates and injects one.
- Tests are vitest + jsdom; tests in `**/*.{test,spec}.{js,ts,tsx}` are auto-
  collected by `vitest.config.ts`.

## WHAT-I-CHANGED

New module — `kidpix-manual-fidelity/09-edit-stamp-editor/`:
- `SPEC.md` — grid (32×32), palette source, transform semantics, persistence
  scope (in-memory primary + localStorage best-effort), kill-vector
  mitigations.
- `pixel-grid.js` (P2) — host-free grid state: `createGrid`, paint/erase,
  bounds, `beginStroke / endStroke / undoLastStroke` (single-level), and
  `toCanvas(targetSize)`.
- `pixel-grid.test.js` — 8 tests.
- `transforms.js` (P3) — pure `mirrorH / mirrorV / rotateCW / clear`,
  composing with the grid's begin/end stroke for undo.
- `transforms.test.js` — 8 tests, incl. rotate-×4 identity, mirror-×2
  identity, and rotate-throws-on-non-square (SPEC).
- `stamp-overrides.js` (P4) — owns `KiddoPaint.Stamps.overrides`,
  `setFromGrid / get / has / clear`, `load / persist` to localStorage
  (`kidpix.stampEditor.overrides.v1`), `renderTo(key, size)` matching the
  text renderer's output canvas size, `gridForKey(key, defaultSize)`, and
  `installShim()` that wraps `KiddoPaint.Stamps.stamp` so overrides render
  via bitmap while un-overridden stamps fall through unchanged.
- `stamp-overrides.test.js` — 6 tests.
- `editor-modal.js` (P5) — modal overlay (palette swatches + Erase +
  ⇋ H + ⇵ V + ↻ + Clear + Undo + Save + Cancel), canvas-backed grid render
  with click/drag + touch handlers scoped to the modal canvas, `Modal.open` /
  `Modal.close` (close restores `KiddoPaint.Current.tool`), and the
  `#editstamp` toolbar control that's injected into the sprites submenu
  whenever the Stamp tool is selected.
- `FIDELITY.md` (P6) — behavior parity table + smoke trace + ambiguity
  resolutions.

Touched existing file:
- `src/kidpix-main.js` — appended four imports under a section comment,
  ordered AFTER `js/stamps/stamps.js` so the shim sees the real
  `Stamps.stamp` to wrap.

Blast radius: the only behavior change to existing code paths is the
`Stamps.stamp(...)` shim. For any stamp key with NO override (which is every
key by default on a fresh load), the shim calls through to the original
function unchanged. The override map is empty on a fresh install. No
existing tools, brushes, textures, builders, submenus, or sounds are
edited. No HTML/CSS in `index.html` is edited — the Edit Stamp button is
DOM-inserted at runtime.

## HOW-VERIFIED

- `yarn test --run` — **111 / 111 pass** (3 new test files, 22 new tests;
  legacy 89 tests still green).
- `yarn build` — **green**. Both `dist/` and `dist-gh/` produced; 133 modules
  transformed; PWA precache includes the new modules transparently via Vite.
- Modal/UI was not exercised in a real browser as part of this build; that
  is the reviewer's smoke step per FIDELITY.md (P6 sign-off is on parity +
  unit invariants).

## WHAT-REMAINS

- Headed browser smoke pass of the paint → edit → stamp → reload flow (the
  reviewer step the manual section 09 sign-off envisions). The static and
  unit-level checks are all green.
- Optional polish: theming the modal to match the manual's chrome more
  closely (current modal is functional but uses neutral grey rather than
  the classic 1990s pixel-bevel buttons).
- The override key is the raw stamp identifier (emoji). If a future change
  introduces non-text stamps with the same identifier, the map could
  collide — fine for the current emoji-only stamp set.
