# ColorMe — coloring-book pages

PNGs in this directory are loaded by [`js/util/colorme.js`](../../../js/util/colorme.js) via Vite's build-time `import.meta.glob`. Each file becomes one entry in the picker (`js/util/colorme-picker.js`). Click a thumbnail to load that line-art into the main canvas; the original PNG is never modified, so re-opening the picker is the kid's "start over" button.

## Adding a page

Drop a new `*.png` file in this directory. It will appear in the picker the next time the dev server reloads or you rebuild. Recommended:

- 1300×650 (matches the canvas backing size — no scaling artifacts).
- Black 1-bit line art on a transparent background.
- Kid-safe subject matter.
- Lowercase, hyphen-free filename (used verbatim as the label).

## Licensing

The PNGs shipped here are generated procedurally by
[`scripts/generate-colorme-assets.py`](../../../scripts/generate-colorme-assets.py)
(pure Python stdlib — no third-party art assets). They are original work and
fall under the same license as the rest of this repository. If you replace
them with externally-sourced art, replace this section with the new license
and attribution.
