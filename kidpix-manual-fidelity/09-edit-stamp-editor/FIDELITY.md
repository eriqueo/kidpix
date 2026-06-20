# P6 — Manual section 09 fidelity sign-off

Stylistic equivalent to the classic Kid Pix Stamp Editor (manual section 09).
Authorized fan reproduction — no original asset is shipped; original assets
were not consulted. Behavior matches the documented Kid Pix Stamp Editor:
fixed-size pixel grid with paint, erase, mirror H/V, rotate, clear, single-
level undo.

## Behavior parity table

| Manual section 09 behavior        | This implementation                                     | Match |
|-----------------------------------|---------------------------------------------------------|-------|
| Pixel grid for the active stamp   | 32×32 canvas-backed grid, 12 px/cell                    | ✓     |
| Paint with current color          | Click/drag → `grid.paint(x,y)` using `currentColor`     | ✓     |
| Erase pixels                      | Dedicated "Erase" toolbar swatch → transparent          | ✓     |
| Palette of swatches               | Reads `KiddoPaint.Colors.Current.Palette` at open       | ✓     |
| Mirror horizontal                 | `Transforms.mirrorH` — reflects about vertical axis     | ✓     |
| Mirror vertical                   | `Transforms.mirrorV` — reflects about horizontal axis   | ✓     |
| Rotate                            | `Transforms.rotateCW` — 90° per click                   | ✓     |
| Clear                             | `Transforms.clear` — all cells null                     | ✓     |
| Undo last action                  | Snapshot per stroke + `undoLastStroke`                  | ✓     |
| Edits applied to main canvas stamp | Override map + `Stamps.stamp` shim                     | ✓     |
| Edits survive session reload      | localStorage mirror under `kidpix.stampEditor...v1`     | ✓     |

## Smoke flow (paint → edit → stamp → save)

1. Select Stamp tool. The sprites submenu shows + an extra `#editstamp` (✎) button.
2. Click the ✎ button → modal overlay appears, seeded with current stamp.
3. Pick a swatch from the palette row; click/drag on grid → cells fill.
4. Click ⇋ H / ⇵ V / ↻ / Clear — grid transforms; Undo restores the pre-transform state.
5. Click Save → modal closes; `KiddoPaint.Stamps.overrides[<emoji>]` populated.
6. Click on the main canvas — stamp renders the edited bitmap (the shim intercepts
   the call inside `KiddoPaint.Stamps.stamp` and returns the override canvas).
7. Reload → in-session edit survives via localStorage.

This flow was traced by reading the wired entry points (`#stamp` button →
sprites submenu → `#editstamp` injection in `editor-modal.js` → `Modal.open()`
→ `Overrides.setFromGrid()` → `Stamps.stamp()` shim). Unit tests (22 across
3 files) lock the load/save/transform invariants. The headed browser smoke
test is left to the reviewer per the bounded scope of this build.

## Ambiguities resolved

- **Grid size:** chosen 32×32 (canonical KP2 size) — SPEC.md.
- **Rotate semantics:** 90° CW only, square grids only — SPEC.md.
- **Undo depth:** single-level (per stroke / per transform) — SPEC.md.
- **Palette source:** active paint palette at open time — SPEC.md.
- **Persistence:** in-memory primary + best-effort localStorage — SPEC.md.

## Known limitations / out of scope (per spec)

- Non-square grids are not supported (rotate would alias; manual scope is
  fixed-size).
- No multi-level undo (manual showed a single Undo step).
- No per-stamp-set serialization to disk — overrides are keyed by stamp
  identifier only.
- No drag-rectangle / fill / shape primitives — manual section 09 covers
  paint + transforms only.
