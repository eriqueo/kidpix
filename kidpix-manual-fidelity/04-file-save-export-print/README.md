# 04 — File: Save / Export / Print

Feature record for the Kid Pix-style File menu affordances added to this fork.

## What ships

Three toolbar affordances:

| Affordance        | Where                | What it does                                                                 |
| ----------------- | -------------------- | ---------------------------------------------------------------------------- |
| **Save Picture**  | Main toolbar (`#save`) | Existing PNG export (`js/init/kiddopaint.js` `save_to_file`). Unchanged.    |
| **Print**         | Status bar (`#print-btn`)   | `window.print()` against a print stylesheet that isolates the canvas.  |
| **Project…**      | Status bar (`#project-btn`) | Opens a Kid Pix-style modal with Save / Load `.kidpix` project actions. |

## `.kidpix` file format (v1)

A `.kidpix` file is a JSON document:

```json
{
  "magic": "kidpix-project",
  "version": 1,
  "createdAt": "2026-06-20T08:00:00.000Z",
  "canvas": {
    "width": 1300,
    "height": 650,
    "png": "data:image/png;base64,..."
  },
  "retainedState": {
    "frame": "frame-wood"
  }
}
```

### Why a PNG-in-JSON snapshot?

The Kid Pix engine is **immediate-mode**: once a tool commits to `main_canvas`, the
strokes, stamps and text become plain pixels. There is no retained scene graph to
serialize. A project file is therefore essentially `version + canvasPNG + a tiny bit of
session state` (currently just the frame style). The version field is shipped now so
later builds can add retained state without a migration framework — pre-1.0 fan files
are allowed to break.

### Boundary sanitization (Load)

`KiddoPaint.FileActions.sanitizeProject` validates every field before anything reaches
the canvas:

- `magic` must equal `"kidpix-project"`.
- `version` must be a number `≥ 1` and `≤` the build's `PROJECT_VERSION`.
- `canvas.png` must be a `data:image/` URL (decoded into an `<Image>` — non-image data
  cannot escape into the DOM or run as script).
- `retainedState.frame` is allow-listed against `KiddoPaint.FrameStyles`.

Anything else is dropped before `applyProject` runs.

## Print

A small `@media print` block in `src/assets/css/kidpix.css` hides the toolbar,
statusbar, subtoolbars and modals, removes the wood frame, and scales `#kiddopaint` to
the page. `body.printing` is toggled on right before `window.print()` and cleared on
`afterprint` so the screen view is never disturbed. `print-color-adjust: exact` is set
on the canvas so the white background fills actually render on paper across browsers.

If `window.print` is missing (some in-app browsers), the Print button falls back to a
PNG download.

## Cross-browser smoke notes (desktop)

Out of scope for sandboxed CI; please verify before merging:

- [ ] Chrome (macOS / Linux) — PNG export, Print preview (single page, no white-on-white), Save+Load round-trip.
- [ ] Safari (macOS) — same. Safari occasionally clips the print canvas when the wood frame is present; the `body.printing` class removes the frame and any border.
- [ ] Firefox (macOS / Linux) — same.

iOS Safari is explicitly **out of the minimal-viable target** (Save anchor + print
quirks); known and accepted.

## Files

- `index.html` — adds `#print-btn`, `#project-btn`, and the `#project-modal`.
- `js/init/file-actions.js` — Print, Save/Load Project, sanitization, modal wiring.
- `src/kidpix-main.js` — imports `file-actions.js` after `init/kiddopaint.js`.
- `src/assets/css/kidpix.css` — statusbar button layout, project action buttons, `@media print` rules.

## Manual smoke

1. Draw something. Click **Project…** → **Save Project**. A `kidpix-YYYY…kidpix` file downloads.
2. Click **Save** in the main toolbar — a PNG still downloads (existing behaviour, unchanged).
3. Click **Print**. The browser print dialog appears with only the canvas visible at page scale.
4. Clear the canvas. Click **Project…** → **Load Project…** and pick the file from step 1. The picture restores and the frame style matches.
5. Try loading a non-JSON file or a JSON file without `magic` — the modal shows a friendly error and the canvas is untouched.
