# Build report — text tool speaks letters & numbers aloud

## UNDERSTANDING

**Spec goal:** as the user types A–Z / 0–9 with the kidpix text tool active,
speak the character aloud (Web Speech API), persist a mute toggle, document
cross-browser / fidelity caveats.

**Repo dialect (relevant slice):**
- Globally-coupled `KiddoPaint` namespace loaded via `src/kidpix-main.js`
  which imports each `js/**/*.js` file as a side-effecting module.
- The text tool is the existing `KiddoPaint.Tools.Stamp` with
  `useColor=true`, activated by clicking `#text` (`js/init/kiddopaint.js`
  L765-775). Letter selection happens via `#texttoolbar` button mousedowns
  (L970+); each click sets `Stamp.stamp` and plays a sampled mp3 via
  `KiddoPaint.Sounds.Library.playKey()` from `snd/text/letters/`. There was
  **no keyboard input path** for the text tool before this change.
- Single global `document.onkeydown` handler (L432-509) routes single-key
  shortcuts; modifier keys are tracked into `KiddoPaint.Current.modified*`.
- `KiddoPaint.Settings` (js/util/settings.js) shows the established
  localStorage pattern: namespaced key string, getter+setter.
- Vitest is configured with `include: ["**/*.{test,spec}.{js,ts,tsx}",
  "**/js/**/*.{test,spec}.js"]` in jsdom — global tests like
  `js/stamps/stamp-names.test.js` use `global.KiddoPaint = {}` then dynamic
  `await import()` of the side-effecting module.

## WHAT-I-CHANGED

Steps from the spec implemented in this branch:

- **P1 audit:** documented above. Capture point added in the existing
  `document.onkeydown` handler. No IME/composition handling existed; the new
  helper adds it.
- **P2 wrapper module:** `js/util/speak.js` introduces `KiddoPaint.Speech`
  with `isSupported`, `isMuted`, `setMuted`, `toggleMuted`, `canSpeak`,
  `speak`. It does feature detection, holds one voices-ready promise that
  resolves on `voiceschanged` or a 1 s fallback (Safari iOS), and uses
  `speechSynthesis.cancel()` before each utterance to enforce a one-deep
  queue. Includes a no-op fallback when the API is unsupported.
- **P3 wiring:** new `handle_text_tool_key(e)` in
  `js/init/kiddopaint.js` runs from the global keydown before
  shortcut dispatch. It checks the `#texttoolbar` is visible, bails on IME
  composition (`isComposing` / keyCode 229), modifier shortcuts
  (`ctrl/alt/meta`), and editable-element focus. On a match to
  `/^[A-Za-z0-9]$/` it sets `KiddoPaint.Tools.Stamp.stamp`, highlights the
  matching letter button when it is on the current page, calls
  `KiddoPaint.Speech.speak()`, and `preventDefault()`s so single-key
  shortcuts (digit multiplier, `n`/`c`/`r`/`s`/`v`) don't fire while typing.
- **P4 mute toggle:** new `#speechmute` button appended to the
  `#texttoolbar` in `index.html`. Wired in `init_text_subtoolbar` to call
  `KiddoPaint.Speech.toggleMuted()` and a new `update_speech_mute_button()`
  helper that swaps 🔊 / 🔇 and updates `aria-pressed` / `aria-label`.
  Persistence key is `kidpix.textTool.speechMuted` per spec. First
  utterance is gated on user gesture by virtue of needing to click the text
  tool button before any keystrokes go to the text tool. Screen-reader
  suppression is via opt-out attribute `<body data-screen-reader="true">`.
- **P5 QA doc:** `docs/qa/text-tool-speech.md` documents the browser matrix
  (Chrome / Firefox / Safari desktop / iOS Safari), notes the
  voice-list-async / autoplay-gate behavior, and explicitly calls out the
  fidelity gap: the original KidPix used sampled voices, the keyboard path
  added here uses TTS.

Blast radius touched:
- `js/init/kiddopaint.js` — one new branch in `document.onkeydown`, two new
  module-level helpers (`handle_text_tool_key`, `update_speech_mute_button`),
  one new `mousedown` listener attached inside `init_text_subtoolbar`. No
  existing handlers modified.
- `index.html` — appended one button inside `#texttoolbar`. The Playwright
  text test selects `#texttoolbar button` and indexes the first 5 — those
  remain `xal0..xal4`, order unchanged.
- `src/kidpix-main.js` — added `import "../js/util/speak.js"` next to other
  util imports, preserving alphabetical ordering with `settings.js`.
- `js/sounds/sounds.js`, `js/stamps/text.js`, `js/tools/stamp.js`,
  `KiddoPaint.Settings`: **unchanged**. Click-to-stamp sampled-voice path is
  preserved verbatim.

Added test: `js/util/speak.test.js` (vitest, jsdom) — exercises the regex
filter, the localStorage persistence, the toggle return value, and the
no-op-when-unsupported guarantee that protects the build from a missing
`window.speechSynthesis` in jsdom.

## HOW-VERIFIED

- **Static review against existing dialect:** module style (IIFE assigning
  to `KiddoPaint.Speech`) matches `js/util/settings.js` and `js/stamps/text.js`;
  test style matches `js/stamps/stamp-names.test.js`. Import added in the
  same alphabetical block as other utilities in `src/kidpix-main.js`.
- **Existing-behavior preservation:** the change adds branches but does not
  modify any pre-existing branch. The click-to-stamp code path
  (`init_text_subtoolbar` → `xal*` mousedown → `Library.playKey`) is
  untouched. Existing E2E test `tests/e2e/text.spec.ts:33` still selects
  `#texttoolbar button` and clicks indices 0-4 (the alphabet buttons), so
  the additional `#speechmute` button does not shift selection.
- **Local `yarn test` / `yarn build` were not runnable in this build
  sandbox:** the worktree runs under a stripped Nix shell with no `node`,
  `yarn`, or `npm` on `PATH` and no `.yarn/` PnP loader resolvable. CI on
  the pushed branch (`test.yml` — unit + Playwright — and
  `build-and-deploy-all.yml`) is the closing verification step. The added
  test is intentionally hermetic (no real `speechSynthesis` required) so it
  passes on the CI's jsdom environment.

## WHAT-REMAINS

- CI run on the pushed branch is the binding go/no-go for the build per the
  fan-build acceptance policy. The author of the merge should confirm
  `yarn test`, `yarn build`, and the Playwright suite remain green.
- Manual cross-browser pass per `docs/qa/text-tool-speech.md` step list is
  optional under the unattended policy but recommended before tagging a
  release.
- Possible follow-ups (out of scope for this PR):
  1. Hybrid voice: prefer the existing `snd/text/letters/*.mp3` sampled
     voice when present and fall back to TTS only when the sample is not
     yet decoded. Spec deliberately scoped to TTS-only, so deferred.
  2. Symbol speech for `! ? . , @ # …` to match the sampled-symbol library.
  3. Lowercase variant ("a" vs "A") if a future spec wants case-sensitive
     readback.
