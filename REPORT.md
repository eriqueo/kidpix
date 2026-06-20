# Build report — File Save/Export + Print

## UNDERSTANDING

**Spec** (deliverable): three toolbar affordances on this kidpix fork — Save Picture (PNG), Print, and a `.kidpix` Save/Load — backed by a Kid Pix-style modal, boundary-sanitized load, and integrated under a `kidpix-manual-fidelity/04-file-save-export-print` feature folder.

**Repo dialect** (relevant bits):

- Vanilla-JS, modular files loaded by Vite via `src/kidpix-main.js`. Each `js/**/*.js` is a side-effect module that attaches to the global `KiddoPaint` namespace pre-created in `index.html`.
- Canvas model is **immediate-mode**: the only retained state is the pixel buffer of `KiddoPaint.Display.main_canvas` (+ a debounced `localStorage["kiddopaint"]` snapshot). No retained scene graph for stamps/text/strokes. This bounds what a project file can losslessly preserve to "PNG + a tiny bit of session state".
- A PNG **"Save"** already exists as `#save` → `save_to_file()` in `js/init/kiddopaint.js` (trims/flattens via `trimAndFlattenCanvas`, names `kidpix-YYYY-MM-DD-…png`).
- A **modal system** already exists for the keyboard-shortcuts help popup (`.modal-overlay` / `.modal-content` / `.close-btn`) — reused here so the project modal matches existing chrome.
- A statusbar button precedent (`#frame-toggle`, plain text styled like a small chrome button) is the right home for "secondary" actions; the iconed main toolbar is reserved for drawing tools.
- The classic click sound is `KiddoPaint.Sounds.mainmenu()`.
- Tests are `vitest run` (jsdom) + Playwright E2E; both run in CI. `yarn typecheck` + `yarn test` gate deploy.

## WHAT I CHANGED

Minimum diff, scoped to the four files below + one new feature-record folder.

### New files

- `js/init/file-actions.js` — IIFE that wires `#print-btn`, `#project-btn`, `#project-save`, `#project-load-input`, and the project modal close/Escape handlers. Implements:
  - `print_drawing()` — toggles `body.printing` class, calls `window.print()`, clears on `afterprint`. Feature-detects `window.print`; falls back to a self-contained PNG export (does not reach into `init/kiddopaint.js`'s module-scoped `save_to_file`).
  - `save_project()` — serializes `{ magic: "kidpix-project", version: 1, createdAt, canvas: {width,height,png}, retainedState: { frame } }` to a Blob and downloads as `kidpix-YYYY-…kidpix`.
  - `sanitizeProject(raw)` — boundary validator: checks magic, version range, data-URL prefix on `canvas.png`, allow-lists `retainedState.frame` against `KiddoPaint.FrameStyles`. Returns only the safe subset.
  - `applyProject(safe)` — undo-save, clear, `drawImage`, persist, apply frame.
  - `KiddoPaint.FileActions` namespace surfaces `print`, `saveProject`, `loadProjectFromFile`, `sanitizeProject` for tests/debug.
- `js/init/file-actions.test.js` — 7 vitest cases covering the sanitizer (well-formed file, bad magic, unknown version, invalid version, non-data-URL `png` (e.g. `javascript:`), unknown frame value dropped, non-object input).
- `kidpix-manual-fidelity/04-file-save-export-print/README.md` — feature record per spec (format spec, sanitization summary, smoke checklist).

### Edited files

- `index.html` — added `<button id="print-btn">` and `<button id="project-btn">` to `#statusbar`; added `#project-modal` markup beside the existing keyboard-shortcuts modal (Save Project button, Load Project label-wrapping a hidden `<input type=file accept=".kidpix,application/json">`, a status line, and a "use Save for PNG / Print to print" tip).
- `src/kidpix-main.js` — imported `../js/init/file-actions.js` right after `init/kiddopaint.js`.
- `src/assets/css/kidpix.css` —
  - Extended the `#frame-toggle` block to also style `#print-btn` and `#project-btn` (same chrome; positioned `right: 230px / 130px / 14px` respectively).
  - Added a "File actions" section with `.project-actions` / `.project-action-btn` (Kid Pix-flavored yellow gradient buttons with hard black borders and offset shadow to match the modal header).
  - Added a `@media print` block that hides toolbar/statusbar/subtoolbars/modals, strips frames/borders, and scales `#kiddopaint` to `max-width: 100% / max-height: 100vh` with `print-color-adjust: exact` so the white canvas fill renders on paper. Rules are scoped to `body.printing` so they only apply during the print flow.

### Blast radius

- `#save` semantics unchanged — existing E2E (`tests/e2e/example.spec.ts` references `#save`) untouched.
- `#frame-toggle` markup/IDs/behaviour unchanged; only the CSS selector list was widened to include the two new sibling buttons.
- No changes to drawing tools, color palette, undo, persistence, or sound library.
- No changes to module load order; new file imported after `init/kiddopaint.js` so `KiddoPaint.FrameStyles` is defined before wiring.

## HOW VERIFIED

Ran the repo's own gates in the worktree (node 22.16.0 via Nix + corepack yarn 1.22.22):

- `yarn install --frozen-lockfile` → clean.
- `yarn typecheck` → **green** (`tsc -p tsconfig.app.json --noEmit`, no errors).
- `yarn test` → **8 files, 96 tests passed** (was 89, +7 new sanitizer tests in `js/init/file-actions.test.js`).
- `yarn build` → **both `dist/` and `dist-gh/` built**, PWA precache regenerated, no warnings beyond the pre-existing `vite-plugin-pwa` peer-dep notice.
- `node --check` on the new JS files — clean.

E2E (Playwright) **not run** in this sandbox (would require a browser download). The changes are additive to chrome the existing specs don't assert on; the one spec that touches `#save` (`example.spec.ts:39`) is untouched.

Cross-browser smoke (the Print + Save/Load round-trip in real Chrome/Safari/Firefox) is the P6 review step the spec calls out and is listed in `kidpix-manual-fidelity/04-file-save-export-print/README.md` as a pre-merge checklist — out of scope for sandboxed CI.

## WHAT REMAINS

- **Manual cross-browser smoke** (desktop Chrome / Safari / Firefox): PNG download, print preview (single page, no white-on-white), `.kidpix` round-trip. Listed in the feature README.
- **iOS Safari** is explicitly out of the minimal-viable target (anchor download + print quirks); accepted per spec.
- **No icons on the new statusbar buttons** — they're text-styled to match the existing `#frame-toggle` precedent rather than fabricating new PNGs. A future polish pass could replace them with kp-style icons if desired.
- **Project file size**: large canvases produce ~MB JSON. Spec's "no file-size ceiling" kill-vector is acknowledged but not mitigated (would need PNG-as-Blob with multipart container — over-engineering for v1).

BUILD-VERDICT: success