# WS0 Findings — portable/offline/responsive diagnosis (2026-06-14)

Diagnose-only pass for the "CD-ROM" session. **No fixes applied.** Companion to the iPad spike
(see `PHASE-STATUS.md` §spike). Stop-and-review gate before any WS1–WS3 work.

## Method & honesty caveat
These root causes are from **static code + build-output analysis** (call sites, the PWA precache
manifest, built `index.html`), not on-device profiling — this machine (NixOS) can't launch a
browser, and I don't have the iPad. Where I say "near-certain," the code evidence is strong enough
to act on; where I say "confirm on-device," get a real number first. **Recommended confirmation:**
add temporary `performance.now()` marks around the suspects in §1 (I can add these in WS3) and read
them off the iPad, or use Safari Web Inspector's timeline over USB.

---

## 1. Lag — ranked root causes (evidence)

**#1 (near-certain) — Per-stroke `toDataURL()` + synchronous `localStorage` write.**
- `js/util/display.js:167` `saveUndo()` → `main_canvas.toDataURL()` = a full synchronous **PNG
  encode of the 1300×650 = 845k-pixel canvas** on every stroke commit, pushed to `undoData`.
- Then `:178` `saveUndoRedoToLocalStorage()` → `JSON.stringify` of up to **10** such base64 PNG
  data-URLs and a **synchronous `localStorage.setItem`** (`:40`). That's ~megabytes serialized and
  written on the main thread **every stroke** (`clearBeforeSaveMain → saveUndo`, reached by
  `saveMain()`/`saveMainGco()` which every tool calls on mouseup).
- Why it matches the symptom: hundreds of ms of main-thread work *after each stroke* = exactly the
  "very laggy" feel. iPad Safari is much slower at `toDataURL` + big `setItem` than desktop.
- Confirm on-device: `performance.now()` around `saveUndo` and `saveUndoRedoToLocalStorage`.

**#2 (likely) — Sound `.play()` on every `mousemove`.**
- `js/tools/pencil.js:20` (`Sounds.pencil()`), `js/tools/eraser.js:17` (`Sounds.eraser()`) fire an
  `Audio.play()` on **every** pointer-move (dozens/sec). Mobile Safari janks on rapid `.play()`.
- Confirm: throttle/disable sound and compare draw smoothness.

**#3 (load + memory) — 64 eager `new Audio()` at startup.**
- `js/sounds/sounds.js` constructs 64 `Audio` objects at load (plus the known
  `// XXX FIXME TODO: switch everything to lazy load; too many audios() throws error in chrome`).
  Startup cost + memory pressure on iPad; contributes to slow first paint / general sluggishness.

**#4 (tool-specific) — `willReadFrequently` only on the main context.**
- `js/init/kiddopaint.js:15` sets `{ willReadFrequently: true }` on **main only**; the `bnim/anim/
  preview/tmp` contexts (`:30,40,50,60`) and `display.js`'s offscreen canvases do not. ~68 readback
  call sites (`getImageData/putImageData`) live in `cut`, `magnify`, `paintcan`, the mixers, `smoke`,
  `spiral`, `trim-canvas`. These specific tools pay the slow GPU→CPU readback path; **not** the
  general drawing path, so lower priority than #1/#2.

**#5 (not lag, but WS1-relevant) — no `devicePixelRatio` handling.**
- `devicePixelRatio` appears nowhere. Fixed 1300×650 backing CSS-scaled on a retina iPad looks
  blurry/soft. Relevant to WS1 crispness, not to throughput.

---

## 2. Offline — root cause (quantified)

The PWA precaches the **app shell only**: build reported `precache 8 entries (339 KiB)` — JS/CSS/
HTML/icons. But the app ships **176 sound files + 192 images = 368 assets** that are **not
precached**. Cause: `vite.config.ts` workbox `globPatterns` is `js,css,html,ico,svg,woff2` (excludes
`png/mp3/m4a`); images + audio use `runtimeCaching: CacheFirst`, i.e. cached **only after being
fetched online once**. So a fresh/cleared offline load has no sounds and missing tool art →
"offline works but poorly." **Fix direction (WS2):** precache all assets (add `png/mp3/m4a` to
globPatterns, raise `maximumFileSizeToCacheInBytes`) — trade-off: a large (~tens-of-MB) precache /
install, but guarantees true offline. Worth confirming total asset MB before committing.

---

## 3. `file://` portability gap (the CD-ROM test)

Neither build opens from `file://`. Built `dist-gh/index.html` uses **absolute** paths
(`/kidpix/assets/main-*.js`, `/kidpix/manifest.webmanifest`, `/kidpix/registerSW.js`) and a
`<script type="module" crossorigin>`. On `file://`: absolute `/kidpix/...` resolves to filesystem
root (broken); ES-module + `crossorigin` scripts are blocked by browser CORS on `file://`; service
workers don't run on `file://` at all. `dist/` (base `/`) has the same absolute-path problem.

**WS2 options (to decide with Eric):**
- (a) **Path-relative build** (`base: './'`, dedicated portable target) → opens from `file://` as a
  folder-of-files; still risks the module-script CORS issue in some browsers unless JS is inlined.
- (b) **Single-file inlined build** (e.g. `vite-plugin-singlefile`) → inlines JS/CSS as **inline**
  scripts (kills the module-CORS issue) = the truest "one .html you keep forever". But 368 binary
  assets can't all sanely base64-inline (tens of MB). Pure single-file = everything base64 = large.
- **Recommended:** a portable target = inlined JS/CSS (`singlefile`-style, no SW, relative) +
  assets as relative files beside `index.html` → a "one-folder CD-ROM" that opens from `file://`.
  Reserve full base64 single-file for if Eric wants a literal single file and accepts the size.

---

## 4. Responsive canvas / orientation (the red flag) — root cause

`<canvas id="kiddopaint" width="1300" height="650">` (fixed backing). CSS (`src/assets/css/
kidpix.css:161`) gives the 5 stacked canvases only `border` + `image-rendering` + grid placement —
**no width/height/max sizing**, no viewport fit, no DPR. So the drawing area is a fixed 1300×650
box that ignores the window and orientation. Confirms Eric's #1 complaint.

**Critical Fence note for WS1 (coordinate remap):** input uses `ev._x = ev.offsetX` (`ev_canvas`
in `kiddopaint.js`). Today display==backing (1:1), so `offsetX` maps straight to backing pixels. The
moment we CSS-scale the canvas, `offsetX` (display px) ≠ backing px → **touch will land in the wrong
place** unless we remap: `backingX = offsetX * (canvas.width / rect.width)` (and DPR). This remap
must **extend** the `ev._x/_y` path, not replace it. Per §3 of the prompt, this is presentation-only
— **backing store stays 1300×650** (don't touch it: parity goldens, undo `ImageData`, compositing).

---

## 5. Broken-tool catalog (catalog only — do NOT fix this session)

Placeholders that select a fallback tool + play a `todo`/`unimpl` sound (no real effect):
- `js/submenus/eraser.js` — **"Black Hole"**, **"Count Down"** (→ plain Eraser + `Sounds.todo()`);
  plus `unimpl()` entries; "Drop Out"/"Sweep" are commented out.
- `js/submenus/jumble.js` — 5 `unimpl()` entries.
- `js/submenus/brush.js` — 4 `unimpl()` entries.
- `js/submenus/truck.js` — 1 `unimpl()` entry.
All are upstream placeholders, **not regressions**. Real implementations are future core-tools builds.

---

## 6. Fence / blast-radius summary (engineering-review gate)

- **Do not touch the backing store** (1300×650): load-bearing for parity goldens, undo `ImageData`,
  cross-layer compositing. WS1 is presentation-only.
- **Extend, don't replace,** the `ev._x/_y` touch→mouse path (coordinate remap).
- WS1/WS2 are **presentation/build-target** changes → low blast radius on tool logic, and the parity
  gate should stay GREEN (if a golden breaks, you changed the backing store — stop).
- WS3 perf fixes touch shared `display.js` (saveUndo/localStorage) → **higher** blast radius (every
  tool calls saveMain). Treat as a real change: full stepwise refinement + premortem before editing.
- `?core` default-legacy behavior must remain unchanged. No ESLint/Prettier.

---

## Recommended sequencing (for Eric's approval)
1. **WS1 (responsive canvas)** — highest user-visible value, presentation-only, contained. Full
   stepwise refinement; stop at Phase 4 for approval.
2. **WS2 (portable + offline)** — precache-all + a `file://`-able portable build target.
3. **WS3 (perf)** — fix #1 (debounce/async undo + drop per-stroke `toDataURL`/localStorage or move
   off the hot path) and #2 (throttle move-sounds). Re-measure vs an on-device baseline. Highest
   blast radius → most caution.
4. WS4 (optional) — one placeholder tool via the hexagon.

**Stop here. Awaiting Eric's review of these findings before any WS1–WS3 work.**
