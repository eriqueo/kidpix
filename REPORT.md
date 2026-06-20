# Build report — custom sounds for new erasers/effects

## UNDERSTANDING

**Spec:** Add kid-friendly custom sounds for the recently added Kid Pix tools (Count Down eraser, Black Hole eraser, new Snowflakes/Splash mixer effects). For each tool, register a new entry in `KiddoPaint.Sounds.Library` and wire a single play call at the tool's climax moment.

**Repo dialect (relevant slice):**

- The app is the legacy KidPix engine; modular JS under `js/` is the primary codebase, loaded by `index.html` via script tags. New TS lives under `core/`/`adapters/` but the targets here are all legacy JS tools.
- Sounds are registered as arrays of `Audio` objects on `KiddoPaint.Sounds.Library.<key>`, and a thin wrapper `KiddoPaint.Sounds.<verb>()` calls `Library.playSingle("<key>")`. Paths in `Audio()` are relative to the served public root.
- Vite's `publicDir: "src/assets"` (see `vite.config.ts`) means `src/assets/snd/eraser/foo.mp3` is served as `/snd/eraser/foo.mp3` — exactly the URL form the existing entries use.
- The "new" tools in scope (per recent commits and the spec's mention of Snowflakes/Splash + Count Down + Black Hole) are: `eraser-count-down.js`, `eraser-black-hole.js`, `mixer-snowflakes.js`, `mixer-splash.js`. Other mixer effects already shipped with sounds and were out of scope per the minimum-scope amendment.

## WHAT-I-CHANGED

### 1. New audio assets (5 files, ~10–35 KB each, mp3, mono 44.1 kHz)

Synthesized fan-build stylistic equivalents with a small Python generator (`/tmp/gen_sounds.py`, not committed) → WAV → `ffmpeg` → mp3. All are short one-shots, deterministic (seed 42), normalized with ~30% headroom so they sit below existing KidPix sounds:

- `src/assets/snd/eraser/countdown-tick.mp3` — ~80 ms wood-block "tock" (per-digit tick)
- `src/assets/snd/eraser/countdown-ding.mp3` — ~480 ms two-note "ta-da!" chime (reveal)
- `src/assets/snd/eraser/blackhole-whoosh.mp3` — ~850 ms descending pitch sweep + noise (vacuum slurp)
- `src/assets/snd/mixer/snowflake-sparkle.mp3` — bell-like 3-note twinkle (G6/C7/E7)
- `src/assets/snd/mixer/splash-splat.mp3` — low thump + noise burst

### 2. Sound registration — `js/sounds/sounds.js`

Added five new entries to `KiddoPaint.Sounds.Library` and five thin `KiddoPaint.Sounds.<verb>()` wrappers, matching the existing pattern (`new Audio("snd/.../foo.mp3")` + `playSingle("<key>")`):

- `countdowntick`, `countdownding`, `blackholewhoosh`, `mixersnowflakes`, `mixersplash`

No abstraction added. No changes to the playback helpers. Existing entries untouched.

### 3. Per-tool wiring (one line per tool)

- `js/tools/eraser-count-down.js` — `Sounds.countdowntick()` on every digit draw inside `step()`; `Sounds.countdownding()` on the reveal branch (right before the silly message is stamped).
- `js/tools/eraser-black-hole.js` — swapped the generic `Sounds.explosion()` activation call for `Sounds.blackholewhoosh()` (slurp matches the "swallowed up" visual; explosion was a TNT placeholder). Comment updated to record the choice.
- `js/tools/mixer-snowflakes.js` — replaced the throttled `Sounds.bubblepops()` with `Sounds.mixersnowflakes()` inside the existing throttle gate.
- `js/tools/mixer-splash.js` — replaced the per-tick `Sounds.bubblepops()` with `Sounds.mixersplash()`.

### Blast-radius touched

- `KiddoPaint.Sounds.Library` — additive only.
- `KiddoPaint.Sounds.{countdowntick,countdownding,blackholewhoosh,mixersnowflakes,mixersplash}` — net-new symbols, no callers outside the four wired tools.
- `Sounds.explosion()` and `Sounds.bubblepops()` are still defined and called by other tools (`tnt.js`, `mixer-broken-glass.js` still uses other sounds, etc.) — no removal, no other site changed.

## HOW-VERIFIED

```
yarn install --offline            → ok
yarn test                          → 7 files / 89 tests passed
yarn typecheck                     → ok (tsc --noEmit)
yarn build                         → built dist/ + dist-gh/ in ~850 ms
ls dist/snd/eraser dist/snd/mixer  → all 5 new mp3s bundled
node --check on every modified .js → syntax clean
```

In-browser audio playtest (timing/volume/cacophony) is the human gate noted in the spec; this build was authorized to ship the branch for async review per the standing AUTHORIZED kidpix fan-build policy. The amplitude headroom and the throttling already present in `mixer-snowflakes.js` (1/12 reveal-step gate) are unchanged, so re-trigger behavior should match what already shipped.

## WHAT-REMAINS

- Human-ear playtest in a browser to confirm the synthesized clips feel right against the visuals; tune amplitudes or swap to recorded assets later if a clip is off.
- The other mixer effects (Wraparound, Zoom In, Broken Glass, Checkerboard, Pattern, etc.) still use repurposed sounds rather than dedicated ones — explicitly **not** in this PR per the "minimum scope" amendment; can be added incrementally if desired.
- `Sounds.explosion()` and `Sounds.bubblepops()` remain in the library for other tools; no cleanup is needed.

BUILD-VERDICT: success