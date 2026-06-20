# 09 — Edit Stamp / Stamp Editor

Manual-fidelity spec for the Kid Pix Stamp Editor, modeled on section 09 of the
1990s Kid Pix user manual. Fan reproduction (stylistic equivalent), built into
the existing modular-JS codebase. Authorized under the standing kidpix
fan-build policy: no original assets required; ship if the existing repo build
& tests pass and behavior is intact.

## Goal

Let the user edit the currently selected stamp on a pixel grid (paint / erase /
palette swatches / mirror-H / mirror-V / rotate / clear / undo-last-stroke),
write the edited bitmap back to the active stamp slot via a per-session
override, and have the main canvas Stamp tool render the edit.

## Decisions

### Grid
- **Dimensions:** 32 × 32 pixels (canonical Kid Pix / KP2 Stamp Editor size).
- **Rendering:** canvas-backed pixel grid (NOT per-pixel DOM — killVector v7).
  One `<canvas>` for the grid, one for an overlay (gridlines, cursor).
  On-screen scale: 12 px per cell → 384 × 384 visible. Internal storage is a
  `pixels[y][x]` 2-D array of CSS color strings (or `null` = transparent).
- **Square grid only.** All transforms below are defined for square grids;
  this avoids the off-by-one rotation killVector (v8).

### Palette
- **Source:** `KiddoPaint.Colors.Current.Palette` (the same swatch row the
  paint tools use). The editor reads it at open time; toggling palettes outside
  the editor does NOT mutate the open editor.
- **Erase:** a dedicated "Erase / Transparent" swatch in the toolbar. Selecting
  it makes paint strokes write `null` instead of a color.
- **Current color:** synced with `KiddoPaint.Current.color` when the editor
  opens; the editor maintains its own `currentColor` after that so it doesn't
  fight the global picker.

### Transforms
- **Mirror Horizontal:** reflect about the vertical axis (`x' = W-1-x`).
- **Mirror Vertical:** reflect about the horizontal axis (`y' = H-1-y`).
- **Rotate:** 90° clockwise. Each tap rotates 90°.
- **Clear:** set every cell to `null` (transparent).
- **Undo last stroke:** snapshot the grid on `mousedown` and restore on Undo.
  Single level — exactly one stroke back, matching the manual's single Undo.

### Persistence
- **Primary:** in-memory per-session override map
  `KiddoPaint.Stamps.overrides[key] = { width, height, pixels }`.
- **Secondary (best-effort):** mirror to `localStorage` under
  `kidpix.stampEditor.overrides.v1`, so edits survive a reload. Failures
  (quota, disabled storage) are swallowed; in-memory map is the source of
  truth.
- **Key:** the stamp identifier — for emoji stamps this is the emoji string
  itself (`KiddoPaint.Tools.Stamp.stamp`).

### Transparency encoding
- `pixels[y][x] === null` means transparent. Stored as `null` in JSON for
  localStorage. The renderer skips `null` cells when drawing onto the target
  canvas, so the alpha channel handles itself.

### Stamp slot data shape
- The existing renderer is text-based: `KiddoPaint.Stamps.stamp(stamp, alt,
  ctrl, size, hueShift, color)` calls `ctx.fillText(stamp, …)`. There is no
  native bitmap slot. The integration shim wraps that function: if an override
  exists for `stamp`, the override bitmap is drawn onto a canvas sized the same
  way the text renderer would size it; otherwise the original fillText path
  runs unchanged. This keeps the renderer's interface (canvas-out, same
  dimensions) intact — no callers need to change.

### Edit Stamp control (toolbar wiring)
- A `#editstamp` button is appended to the sprites submenu when the Stamp tool
  is active. Clicking it opens the editor modal seeded with the currently
  selected stamp. This is the manual section 09 entry point. Confirmed by P1
  inspection that no such control existed in the scaffold; created under the
  fan-build policy clause 4.

## Architecture

```
kidpix-manual-fidelity/09-edit-stamp-editor/
├── SPEC.md             — this file
├── pixel-grid.js       — P2: state + paint/erase
├── pixel-grid.test.js
├── transforms.js       — P3: mirror-H/V, rotate, clear, undo
├── transforms.test.js
├── stamp-overrides.js  — P4: per-session map + localStorage mirror
├── stamp-overrides.test.js
├── editor-modal.js     — P5: modal UI + Edit Stamp wiring
└── FIDELITY.md         — P6: sign-off
```

Boundaries:
- `pixel-grid` knows nothing about KiddoPaint globals — pure state.
- `transforms` is a set of pure functions on a grid.
- `stamp-overrides` is the only module that touches `KiddoPaint.Stamps`.
- `editor-modal` is the only module that touches the DOM toolbar.

## Killvector mitigations (cross-ref)

- v1 (shape mismatch): override is consumed by a shim inside
  `KiddoPaint.Stamps.stamp`, which already produces a `<canvas>`. Same
  output type → no caller change.
- v2 (persistence): explicit decision above — in-memory primary,
  localStorage best-effort.
- v3 (manual gaps): single-level undo + square grid + 90°-only rotate
  removes the most-ambiguous behaviors.
- v4 (modal/event conflicts): modal uses its own pointer handlers scoped
  to its overlay; on close it restores the previously-selected tool.
- v5 (frozen assets): never mutates the asset — overrides live in a map.
- v6 (no Edit Stamp control): create one (policy clause 4).
- v7 (perf): canvas-backed grid.
- v8 (rotate artifacts): square grid only.
- v9 (no undo): single-level stroke undo.
- v10 (palette divergence): editor reads the live shared palette at open.

## P6 sign-off

See `FIDELITY.md` for the side-by-side notes after the modal is wired.
