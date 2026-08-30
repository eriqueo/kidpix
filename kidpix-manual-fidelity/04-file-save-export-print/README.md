# 04 — File: Save / Export / Print

Feature record for the Kid Pix-style File menu affordances added to this fork.

## What ships

One editable-file path plus explicit output actions:

| Affordance        | Where                | What it does                                                                 |
| ----------------- | -------------------- | ---------------------------------------------------------------------------- |
| **Save Project**  | Main toolbar (`#save`) | Saves the exact editable canvas as `.kidpix`. |
| **Open File**     | Main toolbar (`#open`) | Opens either `.kidpix` or a supported ordinary image. |
| **Export PNG**    | Status bar (`#export-png-btn`) | Exports a cropped, flattened image for sharing outside Kid Pix. |
| **Print**         | Status bar (`#print-btn`) | `window.print()` against a stylesheet that isolates the canvas. |

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
session state` (currently just the frame style). It intentionally does not retain undo,
audio, the selected tool, or editable stamp/text objects. The version field is the
compatibility boundary: this build continues to read every valid v1 file it writes.

`.kidpix` files are **CRITICAL user-owned data**. Kid Pix delivers the file to the
browser/Files app and retains no managed copy or cleanup timer; the person saving it owns
its location and backup. The app's separate automatic current-drawing recovery remains
browser site data, not a substitute for an exported project.

### Boundary sanitization (Load)

`KiddoPaint.FileActions.sanitizeProject` validates every field before anything reaches
the canvas:

- `magic` must equal `"kidpix-project"`.
- `version` must be an integer `≥ 1` and `≤` the build's `PROJECT_VERSION`.
- Canvas width and height must be exactly 1300×650 for v1.
- `canvas.png` must be a base64 PNG data URL and its decoded dimensions must match the
  declared dimensions.
- `retainedState.frame` is allow-listed against `KiddoPaint.FrameStyles`.

Anything else is dropped before `applyProject` runs.

## Print

A small `@media print` block in `src/assets/css/kidpix.css` hides the toolbar,
statusbar, subtoolbars and modals, removes the wood frame, and scales `#kiddopaint` to
the page. `body.printing` is toggled on right before `window.print()` and cleared on
`afterprint` so the screen view is never disturbed. `print-color-adjust: exact` is set
on the canvas so the white background fills actually render on paper across browsers.

If `window.print` is missing (some in-app browsers), Print falls back to PNG export.

## iPad delivery

On a touch device that supports file sharing, Save and Export first verify the `File`
payload with `navigator.canShare`, then open the native share sheet. Choose **Save to
Files** to put it in On My iPad or iCloud Drive. If the sheet is closed or rejects the
file, Kid Pix shows a separate **Download instead** action; it never starts an automatic
second save. Browsers without file sharing use an ordinary download directly.

## Cross-browser smoke notes (desktop)

Physical browser checks still required:

- [ ] Physical iPad Safari / installed app — native Save to Files, reopen exact pixels,
  and continue drawing. Use [the iPad checklist](../../docs/ipad-acceptance.md).
- [ ] Desktop Safari and Firefox — download fallback and Print preview.

## Files

- `index.html` — the unified file picker plus Print and Export PNG actions.
- `js/init/file-actions.js` — project Save/Open, PNG export, native share/download
  delivery, Print, and boundary sanitization.
- `src/kidpix-main.js` — imports `file-actions.js` after `init/kiddopaint.js`.
- `src/assets/css/kidpix.css` — status-bar button layout and `@media print` rules.

## Manual smoke

1. Draw something and click **Save Project**. Save the `.kidpix` file.
2. Change or clear the canvas. Click **Open File** and choose that `.kidpix`; exact
   pixels and the frame return, then draw another stroke.
3. Click **Export PNG**, clear, and open that PNG; it imports as an ordinary flattened
   picture that can also be edited.
4. Click **Print**. The browser print dialog contains only the canvas.
5. Try a malformed `.kidpix`; the status bar reports the error and leaves the canvas
   untouched.
