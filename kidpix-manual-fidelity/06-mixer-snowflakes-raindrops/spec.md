# Spec — Mixer: Snow Flakes & Rain Drops

Fan reproduction of the classic Kid Pix 2 Mixer effect. Stylistic equivalent,
not a verbatim port.

## Inputs

- **Tool selection:** Mixer (Jumble) submenu → "Snow Flakes & Rain Drops".
- **Pointer:** mousedown → mousemove (drag) → mouseup on the canvas.
- **Modifier:** `Alt` / `Option` held at mousedown selects the rain variant
  for the duration of the gesture.

## Outputs

- A composite of the existing picture + a scatter of snow (or rain) particles,
  baked into the main canvas on mouseup and persisted via
  `KiddoPaint.Display.saveToLocalStorage()`.

## Particle taxonomy

| Variant   | Trigger             | Glyph                                       | Color                  |
|-----------|---------------------|---------------------------------------------|------------------------|
| Snowflake | default (no Alt)    | three crossing strokes (six-point flake)    | `rgba(255,255,255,.92)`|
| Raindrop  | `Alt`/Option held   | short slanted streak                        | `rgba(90,150,235,.75)` |

Per-particle position, rotation/slant, and size are randomized inside a fixed
pool of 600 particles generated once at mousedown.

## Density & randomness

- Pool size: `MAX_FLAKES = 600`.
- Particles are pre-generated at mousedown and stay put for the gesture
  (dragging reveals more of the existing pool rather than re-randomizing —
  re-randomizing on every move would shimmer).
- Visible count: `n = remap(0..500px drag → 0..MAX_FLAKES)`.
- Randomness is unseeded (`getRandomFloat` / `Math.random`); each gesture is
  fresh. Determinism is **not** a requirement — the manual behavior is also
  visibly random run-to-run.

## Canvas interaction model

- **Layer:** drawing happens on the `tmp` layer; the snapshot of the main
  canvas is redrawn underneath each frame so the picture stays visible beneath
  the snow/rain.
- **Bake on mouseup:** the tmp composite is copied into the main canvas, tmp
  is cleared, state is saved to localStorage.
- **Undo:** a single undo step is saved on mousedown (one undo reverts the
  entire snow/rain gesture).

## Out of scope (v1)

- **Sound cue from the original manual.** The implementation uses an existing
  ambient `bubblepops` sound, throttled to once per ~50 new flakes; the
  original tool's specific audio is not reproduced.
- **Continuous / animated snowfall.** The Mixer engine here is drag-driven,
  not animated. The manual's animated falling effect is approximated as a
  drag-density scatter rather than time-based animation.
- **Seedable / deterministic randomness.**
- **Cursor / icon art beyond the existing `cursor-guy-wow` / `cursor-guy-smile`
  states.**

## Acceptance

Per the standing fan-build policy this entry is machine-checkable, not
human-reviewed:

- The tool is selectable from the Mixer submenu in the running app.
- A drag scatters white snowflakes on the canvas; the picture beneath is
  preserved.
- Holding Option (Alt) at mousedown switches the scatter to blue raindrops at
  the same positions.
- One undo step reverts the gesture.
- Existing repo `yarn typecheck` + `yarn test` + `yarn build` remain green.
