# Hidden Pictures

## In the app

Choose Eraser → **Add Picture Here**, pick a normal picture, and wait for the visible
confirmation. Kid Pix processes the picture into its black-and-white pixelated style in
the browser, makes it the current Hidden Picture, and stores the processed PNG in the
local reveal rotation. The custom queue keeps at most 20 pictures and removes the oldest
custom entry when a distinct picture is added at the limit. If browser storage is
unavailable, the confirmation says the picture will remain for that session only.

The original file is never uploaded or retained by Kid Pix.

## Add a bundled picture as a maintainer

The checked shell pipeline creates a repository asset that ships to every user:

```bash
scripts/hidden-pictures/add.sh path/to/my-photo.jpg
```

That command dithers the source, writes
`src/assets/img/hidden-pictures/kp-h-my-photo.png`, and regenerates the runtime list.
Run `yarn dev`, choose Eraser → Hidden Pictures, then start erasing to reveal a randomly
selected picture from the rotation.

## What the maintainer pipeline does

1. Watches `_inbox/` for dropped images (PNG/JPG/etc.).
2. Dithers each to 1-bit black-on-white in the app's style (flatten onto white →
   grayscale → resize ~400px long-side → error-diffusion dither).
3. Writes `src/assets/img/hidden-pictures/kp-h-<name>.png`.
4. Re-syncs the `hiddenPictures` list in `js/tools/eraser-hidden-pictures.js`.
5. Moves the original to `_inbox/_done/`.

Then refresh `yarn dev` and the new picture is in the random rotation.

## Quick start

```bash
chmod +x scripts/hidden-pictures/*.sh   # first time only
scripts/hidden-pictures/watch.sh        # leave running; drag files into _inbox/
```

Stop with Ctrl-C.

## Engines

- **`im`** (default) — ImageMagick Floyd–Steinberg. Matches the app's
  `Dither.floydsteinberg`. No extra installs (you already have ImageMagick).
- **`didder`** — true Atkinson dithering, the closest match to the app's
  `Dither.atkinson`. Install once: `brew install didder`
  (or grab a binary from https://github.com/makew0rld/didder/releases).

```bash
scripts/hidden-pictures/watch.sh --engine didder
```

## One-off (no watcher)

```bash
scripts/hidden-pictures/dither.sh path/to/art.png            # -> kp-h-art.png
scripts/hidden-pictures/dither.sh art.png --engine didder --name woodcock
scripts/hidden-pictures/sync-array.sh                        # refresh the JS list
scripts/hidden-pictures/sync-array.sh --check                # fail if the list drifted
```

## Tuning

- `--size N` — source long-side in px (default 400). The eraser draws it at 2×
  nearest-neighbor on the 1300×650 canvas, so ~400 fills like the bundled engravings.
  Bigger source = the picture fills more of the canvas.
- Source art matters most: high-contrast line art / engravings dither cleanly; busy
  photos turn to mud. Public-domain natural-history plates (where the originals came
  from) are ideal.

## How the list stays in sync

`sync-array.sh` rewrites only the block between these markers in
`js/tools/eraser-hidden-pictures.js`:

```js
// <hidden-pictures:auto>
//   ...generated entries...
// </hidden-pictures:auto>
```

The asset folder is the source of truth: the array is regenerated (sorted, deduped) from
`kp-h-*.png` every run. Delete a PNG and re-run `sync-array.sh` to drop it from the list.
Don't hand-edit between the markers — it'll be overwritten. If the markers are missing
the script refuses to run rather than guess. `yarn test` runs `--check`, so a generated
asset cannot silently miss the reveal rotation.

## Notes

- Generated `kp-h-*.png` files are **CRITICAL source assets**: commit them so Git backs
  them up and the PWA precaches them.
- The reveal rotation is bounded by `config.sh`. At the limit, a new slug is blocked
  before an asset is written; replacing an existing slug remains allowed.
- `_inbox/` and `_done/` are ignored, **AUTO-MANAGED scratch**. The watcher blocks when
  `_done/` reaches the shared scratch limit; move or delete old originals to resume. It
  never silently sheds an input.
- Re-adding a file with the same slug replaces that one generated asset by design.
