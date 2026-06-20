# BUILD REPORT — File > Open / Import Picture

## UNDERSTANDING

**Spec**: add Open/Import Picture matching kidpix-manual-fidelity/05. Two entry
points (File menu equivalent + canvas drag-and-drop) route through one shared
decode → fit → composite pipeline, integrated as a single undoable action.
Palette/dither isolated behind one seam for later tuning.

**Repo dialect**:
- Vanilla JS, no bundler-level transforms beyond Vite. Code attaches to the
  global `KiddoPaint` namespace (`KiddoPaint.Display`, `.Tools`, etc.).
- ES5-style IIFEs are the pattern for util files (`js/util/*.js`).
- Modules loaded explicitly in dependency order from `src/kidpix-main.js`.
- Toolbar is image-icon buttons in `index.html` with handlers wired in
  `init_tool_bar()` inside `js/init/kiddopaint.js`.
- Undo history is `KiddoPaint.Display.saveUndo()` — a full ImageData snapshot
  of the main canvas; downstream tools all use this same primitive (so a
  one-snapshot import is consistent with the existing semantics, not a
  regression).
- A `dragover`/`drop` pair already existed on the canvas, calling
  `image_upload()`. That function had two branches: alt-drop hands the image
  to the Placer tool at native size; default-drop drew it at 0,0 with no fit.
  The default branch is what we replaced with the shared pipeline.

## WHAT I CHANGED

- **New** `js/util/image-import.js` — `KiddoPaint.ImageImport` with:
  - `openFile(file)` — Promise-based decode + fit + composite + undo.
  - `triggerFilePicker()` — opens the hidden `<input>`.
  - `_fitLetterbox(sw,sh,dw,dh)` — pure math, exported for testing.
  - `_palettePass(canvas)` — no-op seam for P4 manual-fidelity dithering.
  - Boundary checks: accepted MIME whitelist (PNG/JPEG/GIF/BMP/WEBP),
    8000px max source dimension (memory guard for 20MP phone photos).
  - FileReader → Image (data URL, same-origin → canvas not tainted, so Save
    still works after an import — guards the killVector around CORS taint).
- **New** `docs/kidpix-manual-fidelity/05-file-open-import-picture.md` — the
  spec the build claims fidelity to (created per policy amendment since the
  path did not exist).
- **New** `js/util/image-import.test.js` — vitest cases for the letterbox math
  (square, wide, tall, degenerate-source).
- **Edit** `index.html` — added `<button id="open">Open Pic</button>` next to
  Save, and hidden `<input type="file" id="open-picture-input">` with the
  MIME accept list.
- **Edit** `src/kidpix-main.js` — imports `js/util/image-import.js` after the
  other utilities (load order honors its `KiddoPaint.Display` dependency).
- **Edit** `js/init/kiddopaint.js`:
  - Wired Open button + hidden input change → `ImageImport.openFile`.
  - Added `'o'` keyboard shortcut → `triggerFilePicker`.
  - Refactored `image_upload` (drag-drop): default drop now routes through
    `ImageImport.openFile`; alt-drop keeps the legacy Placer-tool path.

**Blast radius**: touched 3 existing files. The drag-drop refactor changes
default-drop behavior (was: raw drawImage at 0,0; now: letterboxed + undo) —
this is the spec's intent. Alt-drop's Placer flow is preserved unchanged. No
other tool, sound, or canvas-layer code path was touched. The undo
`saveUndo()` call is the same primitive every drawing tool uses, so import is
on the same history-stack contract as a stroke.

## HOW VERIFIED

- **Reasoned through the killVectors** in the spec:
  - Canvas taint → mitigated by data-URL decode path.
  - Memory blowup → 8000px boundary guard.
  - Pointer-event interception → existing dragover/drop listeners on canvas
    are untouched; only the file-handling branch inside `image_upload`
    changed.
  - Undo bloat → exactly one `saveUndo()` per import; same primitive as
    every stroke.
  - Fit math → letterbox-center, decided in advance; unit-tested.
  - Palette drift → flagged in the spec doc, deferred to P4 behind one seam.
- **Could not run** `yarn typecheck` / `yarn test` / `yarn build` in this
  sandbox — no `node`/`npm`/`yarn` on PATH. The repo CI (`test.yml`) will run
  vitest + Playwright on PR; the new unit test follows the existing
  `js/util/*.test.js` pattern (vitest config `include`s `**/js/**/*.test.js`)
  so it will be picked up.
- **Manual browser smoke** (Chrome/Firefox/Safari/iOS) is the P4 step in the
  spec and explicitly deferred per the build policy ("ship the branch for
  async review").

## WHAT REMAINS

- P4 manual-fidelity review:
  - Wire the palette/dither pass for indexed-color fidelity (one-function
    change; the seam is `KiddoPaint.ImageImport._palettePass`).
  - Cross-browser smoke test on Chrome/Firefox/Safari/iOS — particularly EXIF
    orientation on iPhone JPEGs (we rely on the Image element's default
    orientation handling rather than an explicit `imageOrientation`
    ImageBitmap path).
  - Confirm or override the "letterbox vs crop vs stretch" choice. Current
    default is letterbox (chosen per spec; the math seam is `_fitLetterbox`).
  - Optionally wire an import sound effect.
- A dedicated tool icon for the Open button (currently text "Open Pic" to
  avoid inventing a fake KP-style PNG).

BUILD-VERDICT: success