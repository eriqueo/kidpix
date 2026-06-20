# Text tool — typed-letter speech

## Feature summary

When the **text tool** is active, typing **A–Z** or **0–9** on the keyboard
now reads the character aloud using the browser's `SpeechSynthesis` API and
selects the matching letter button (if the current text-bar page contains
it) as the next stamp. This is a stylistic fan equivalent of the original
KidPix manual's "speak the letter as you type" behavior — the original used
pre-recorded sampled voices, this implementation uses Web Speech TTS as a
zero-asset backend.

A persistent **mute toggle** (🔊 / 🔇) sits at the right end of the text
toolbar. Its state is stored in `localStorage` under the namespaced key
`kidpix.textTool.speechMuted` and survives reloads.

## Behavioral guarantees

- Only single characters matching `/^[A-Za-z0-9]$/` trigger speech. Symbols,
  modifier-key combos, IME composition, pastes, and edits inside `<input>` /
  `<textarea>` / `contenteditable` fields are ignored.
- The speech queue is single-utterance: each keystroke `cancel()`s any
  pending utterance, so rapid typing never overlaps or lags.
- When the browser doesn't expose `SpeechSynthesis`, the wrapper is a no-op
  — the text tool still works, just silently for the typed-letter path.
- The pre-existing sampled-voice path (clicking a letter button →
  `KiddoPaint.Sounds.Library.playKey`) is untouched.
- When `<body data-screen-reader="true">` is set, typed-letter speech is
  suppressed so screen-reader users don't hear each letter twice.

## Cross-browser notes

| Browser           | Status   | Notes                                                                          |
| ----------------- | -------- | ------------------------------------------------------------------------------ |
| Chrome (desktop)  | works    | Voice list populated immediately; default English voice picked.                |
| Firefox (desktop) | works    | `getVoices()` returns `[]` until `voiceschanged` fires; wrapper waits for it.  |
| Safari (desktop)  | works    | Default voice picks Siri-style English. No quirks observed.                    |
| Safari (iOS)      | partial  | First utterance requires a user gesture; subsequent keystrokes speak normally. `voiceschanged` may never fire — 1s timeout falls back to default voice. |

All browsers degrade gracefully on the autoplay-gate path because the text
tool can only be entered by tapping/clicking the text toolbar button, which
counts as a user gesture before any speech is attempted.

## Fidelity gap vs. the original KidPix

The original Kid Pix used short pre-recorded sampled voices for each letter
— the same samples that this repo ships under `snd/text/letters/` and plays
when you **click** a letter button. The TTS path used by **keyboard typing**
will not match those samples in timbre or cadence; it uses whatever voice
the host OS exposes via `SpeechSynthesis`. This is an intentional fidelity
trade-off: the keyboard path adds no new audio assets and works on any
machine, even when the recorded samples haven't loaded yet. Users who want
the sampled voice can continue to click the letter buttons.

## Manual QA checklist

1. Open the app, click the **text** tool.
2. Type `A` — hear "A", see `A` highlighted in the toolbar.
3. Type `5` — hear "five" (or "5"), highlight moves to the matching button
   if visible.
4. Type fast: `ABCDEFG`. Audio should not pile up; the latest letter wins.
5. Click 🔊 → it becomes 🔇. Typing letters no longer speaks. Reload —
   muted state persists.
6. Click 🔇 → 🔊. Speech resumes.
7. Switch to the pencil tool. Typing `A` does **not** speak.
8. Click a letter button in the toolbar — sampled-voice mp3 still plays
   (existing behavior unchanged).
