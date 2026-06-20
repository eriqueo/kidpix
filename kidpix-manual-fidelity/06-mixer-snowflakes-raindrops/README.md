# 06 — Mixer: Snow Flakes & Rain Drops

Fan reproduction of the classic Kid Pix 2 Mixer ("Jumble") effect that
sprinkles snow across the picture, with an Option-modifier variant that turns
the snow into rain.

## Where it lives

- Tool: [`js/tools/mixer-snowflakes.js`](../../js/tools/mixer-snowflakes.js)
- Wired into the Mixer submenu: [`js/submenus/jumble.js`](../../js/submenus/jumble.js)
- Status-bar copy: [`js/init/kiddopaint.js`](../../js/init/kiddopaint.js)
- Registered for the build: [`src/kidpix-main.js`](../../src/kidpix-main.js)

## Expected behavior (summary)

- **Default:** drag across the picture to scatter soft white six-point
  snowflakes. Drag distance controls density — a short tap is a light dusting,
  a long drag is a blizzard (capped at 600 flakes).
- **Option held on mousedown:** snow "melts" into slanted translucent-blue
  raindrops at the same positions.
- The underlying picture is preserved beneath the snow/rain and the composite
  is baked into the main canvas on mouseup. One undo step is saved on
  mousedown.

See [`spec.md`](spec.md) for the full behavior contract and the explicit
out-of-scope list.

## References

See [`references/SOURCES.md`](references/SOURCES.md) for citation + licensing
posture. No copyrighted manual scans are committed in this repo.
