# 05 — File > Open Picture / Import

Stylistic equivalent of the classic Kid Pix "Open a Picture" flow. This is a
fan reproduction; behavior is reconstructed from observed 1990s Kid Pix
behavior, not from copyrighted assets.

## Entry points

- **Toolbar**: "Open Pic" button next to Save.
- **Keyboard**: `o` (when keyboard shortcuts are enabled).
- **Drag-and-drop**: drop an image file onto the canvas.
  - Plain drop → routes through this pipeline (fit + composite + undo).
  - Alt-drop → legacy behavior: hand image to the Placer tool at native size.

## Accepted formats

`image/png`, `image/jpeg`, `image/gif`, `image/bmp`, `image/webp`.

SVG, HEIC, and AVIF are intentionally excluded — they either taint the canvas
(blocking later Save), animate (GIF: first frame only is composited via the
Image element decode path), or have inconsistent browser support on iOS
Safari.

## Decode

`FileReader.readAsDataURL` → `Image` element. Data-URL sources are same-origin
so canvas does not become tainted and Save continues to work. Source images
larger than 8000px on either axis are rejected at the boundary.

## Fit-to-canvas placement

Letterbox-center, preserving aspect ratio. The image is scaled by
`min(canvasW / sourceW, canvasH / sourceH)` and centered; remaining margin is
filled with white (matching the canvas paper color). No stretch, no crop.

## Composite

Drawn onto the main 2D context as a single `drawImage`. A staging canvas is
used so the palette pass (currently a no-op) can be inserted as a single
function without changing the composite boundary.

## Undo integration

One snapshot via the existing `KiddoPaint.Display.saveUndo()` history stack.
A single Open/Import is a single undoable step — no per-region bloat, no
double-snapshotting.

## Palette / dither

Currently a passthrough (`KiddoPaint.ImageImport._palettePass`). The original
Kid Pix quantized imports to its indexed palette; wiring that pass is a P4
review item, isolated behind one function so it can be tuned without touching
the rest of the pipeline.

## Out of scope (deferred unless review demands it)

- Progress / cancel UI for slow decodes.
- Concurrent-import handling (last-write-wins is acceptable for a fan toy).
- HEIC / AVIF support.
- Animated GIF playback (first frame only).
- Import sound effect (not yet wired; mainmenu chirp plays on button click).
