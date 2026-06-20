# Build report — Small Kids Mode toggle

## UNDERSTANDING

**Spec**: ship a persistent Small Kids Mode toggle that simplifies the UI
when on and is byte-equivalent to current behavior when off. Six-step
plan (P1 spec → P2 accessor → P3 toggle UI → P4 toolbar slice → P5
menus/dialogs/sounds slices → P6 manual QA). Deliverable is a single
branch with SPEC.md + accessor + settings-menu entry + per-slice flag
gates + green tests/build.

**Repo dialect**:

- Vanilla JS via global `KiddoPaint.*` namespace, loaded as ES modules
  through `src/kidpix-main.js`.
- `KiddoPaint.Settings` (`js/util/settings.js`) already owns
  localStorage-backed UI preferences (keyboard shortcuts), so the Small
  Kids Mode accessor extends that module instead of creating a new one.
- No "settings/gear menu" exists. The only existing settings affordance
  is the keyboard-shortcuts modal plus a status-bar `#frame-toggle`
  button. The minimal-hook integration (per amendment #4) is a sibling
  `#small-kids-toggle` button in the status bar — same visual style and
  discoverability model as `#frame-toggle`.
- The codebase has zero `confirm()`/`alert()`/`prompt()` calls
  (`rg`-audited) and sounds enrich rather than threaten small kids, so
  the dialog and sound slices have nothing concrete to gate in v1 —
  documented as no-op seams in SPEC.md.

## WHAT-I-CHANGED

- `kidpix-manual-fidelity/01-small-kids-mode-toggle/SPEC.md` (new) —
  P1. Enumerates the toolbar buttons hidden in v1, the namespaced
  localStorage key, non-collision audit, toggle UI placement, and
  declared no-op status of dialog/sound slices.
- `js/util/settings.js` — P2. Added `isSmallKidsMode`,
  `setSmallKidsMode`, `toggleSmallKidsMode`,
  `onSmallKidsModeChange`, `applySmallKidsModeToDom` on
  `KiddoPaint.Settings`. Namespaced key
  `kiddopaint.settings.smallKidsMode`. Default `false`. Wraps
  localStorage in try/catch so private-mode browsers don't break the
  app. Sets `body.small-kids-mode` class on every change.
- `js/util/settings.test.js` (new) — 8 unit tests covering default,
  persistence, coercion, toggle, body-class sync, dom-rehydration,
  subscriber notify+unsubscribe, and non-collision with the
  keyboard-shortcuts key.
- `index.html` — P3. Added `<button id="small-kids-toggle">` to the
  status bar, immediately before `#frame-toggle`.
- `src/assets/css/kidpix.css` — P3+P4+P5-seam.
  - Styled `#small-kids-toggle` to match `#frame-toggle`'s pill, with
    an amber highlight when active.
  - P4 toolbar slice: a single declarative rule hides `#text`,
    `#colorpicker`, `#truck`, `#save`, `#undo`, `#redo` from `#mainbar`
    when `body.small-kids-mode` is set. Kept visible: pencil, line,
    rectangle, circle, brush, mixer, paint can, eraser, stamp.
  - P5 sub-toolbar seam: any submenu button that opts in via class
    `small-kids-hidden` is hidden by a single rule when Small Kids
    Mode is on. v1 ships the seam, not the list — adding items later
    is a one-class change, no JS or flag plumbing.
- `js/init/kiddopaint.js` — P3 wiring. Added `init_small_kids_toggle`,
  called from the main `init()` after `init_frame_toggle()`. Reads
  initial state, renders the label, subscribes for re-render, applies
  the body class on boot, and toggles on click.

**Blast radius**: all gating is a single CSS class on `<body>`.
Adult-mode (flag = false, default) renders zero gated rules and never
touches the accessor at runtime beyond the boot-time
`applySmallKidsModeToDom()` no-op. No existing tool, sound, or
submenu file was modified.

## HOW-VERIFIED

- `yarn test` — **97 passed (was 89; +8 new tests for the accessor)**
- `yarn typecheck` — clean
- `yarn build` — clean (both `dist/` and `dist-gh/` produced; PWA
  precache regenerated)
- Manual code review: `rg 'confirm\\(|alert\\(|prompt\\('` returns
  only one match (`tnt.js` code comment "Will alert every second" —
  not a dialog), confirming the dialog slice is a no-op in v1.
- localStorage key audit: `rg "localStorage" js/ src/` shows the new
  key (`kiddopaint.settings.smallKidsMode`) does not collide with the
  existing keys (`kiddopaint_frame`,
  `kiddopaint.settings.keyboardShortcutsEnabled`, persistence keys).

## WHAT-REMAINS

Within the parent spec these are explicit deferrals, not regressions:

- P5 sub-toolbar list — populating which specific advanced submenu
  options carry the `small-kids-hidden` class. The seam is in place;
  the curation belongs in a follow-up PR per slice so each diff stays
  reviewable.
- P5 sound slice — define "loud / scary" subset (explosions, broken
  glass) and route them through a gentler variant when Small Kids
  Mode is on. Audit and selection deferred — no concrete sound is
  blocking small-kid use today.
- P6 manual QA pass against goldens. Beyond the automated suite, a
  human should still click through both modes once before tagging a
  release.
- Optional: future "parent-gated" entry to the toggle if/when an auth
  surface is added. Out of scope per spec.
