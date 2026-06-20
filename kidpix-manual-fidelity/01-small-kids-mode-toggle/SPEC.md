# 01 — Small Kids Mode toggle

Fan-build feature inspired by classic 1990s Kid Pix's "Small Kids Mode" (a
parent-set toggle that pared the UI down to a simpler subset for the youngest
users). All references below are *stylistic equivalents* — never verbatim
copyrighted assets or wording.

## Goal

Ship a persistent **Small Kids Mode** toggle that simplifies the UI surface to
a child-friendly subset when on, and is byte-equivalent to the current adult
mode when off.

## Acceptance (machine-checkable, no human-meeting gate)

- Feature works: toggling flips the flag, the flag persists across reloads,
  body gains/loses the `small-kids-mode` class, and the gated UI elements
  hide/show accordingly.
- Existing repo tests pass (`yarn test`) and the production build succeeds
  (`yarn build`).
- Adult mode (flag = false, the default) is behaviorally unchanged: no gated
  CSS rule fires, no accessor is exercised, no extra DOM is mutated.

## Stylistic-equivalent simplification list (v1)

Drawn from classic Kid Pix Small Kids Mode behavior. Stylistic equivalents
only.

### Toolbar / tool palette — gated in this PR

When Small Kids Mode is on, hide:

| Toolbar button | Why hidden in v1                                                      |
| -------------- | --------------------------------------------------------------------- |
| `#text`        | Letter stamping requires keyboard literacy; classic also hid it.      |
| `#colorpicker` | Eyedropper requires understanding source vs. fill; cognitive load.    |
| `#truck`       | Road/rail builder is a power tool — many modifier-key behaviors.      |
| `#save`        | Save flow assumes file-management awareness.                          |
| `#undo`        | Replaced by the dynamite eraser as the canonical "start over" path.   |
| `#redo`        | Mirror of undo; same reasoning.                                       |

Tools kept visible (the "core six" plus eraser): pencil, line, rectangle,
circle, brush, mixer, paint can, eraser, stamp.

Implementation: a single CSS rule keyed off `body.small-kids-mode` —
no per-button JS, fully reversible by toggling the flag.

### Menus / sub-toolbars — gated by the same body class, no per-item logic

Each sub-toolbar can opt into simplification by adding a
`small-kids-hidden` class to advanced options (animated brushes,
mod-key-only variants). v1 does not enumerate the full list; the gate seam
is the only thing this slice ships, so adding/removing items later is a
single class change with no flag plumbing.

### Dialogs / confirmation prompts — no-op in v1

Audit (`rg 'confirm\\(|alert\\(|prompt\\('` over `js/`) found zero uses, so
there is nothing to simplify. Slice ships as a no-op with a documented
hook: any future dialog must check `KiddoPaint.Settings.isSmallKidsMode()`
before prompting and default-confirm if true.

### Sounds — no-op in v1

Classic Kid Pix kept sounds on in Small Kids Mode; muting them would
*reduce* the child-friendliness of the experience. Slice ships as a no-op
with a documented hook: future "loud / scary" sounds (explosions, broken
glass) should check `KiddoPaint.Settings.isSmallKidsMode()` and downgrade
to a gentler variant rather than muting outright.

## Persistence

- Namespaced localStorage key: `kiddopaint.settings.smallKidsMode`.
- Verified non-collision with existing keys: `kiddopaint_frame`,
  `kiddopaint.settings.keyboardShortcutsEnabled`, and the `kiddopaint_*`
  canvas-persistence keys (rg-audited).
- Default = `false` (adult mode), so a fresh install is byte-identical to
  pre-feature behavior.

## Toggle UI

A small button at the right of the status bar, mirroring `#frame-toggle`'s
style and discoverability model: visible to anyone (no parent gate), since
the codebase has no auth surface and the feature is reversible. Label
mirrors the frame button: `Kids Mode: Off` / `Kids Mode: On`.

## Reversibility

Every behavioral change is a single CSS rule predicated on
`body.small-kids-mode`. Turning the flag off removes the class, which
removes every gated rule. No JS branches in tools, no per-tool state.

## Out of scope (v1)

- Parent-gated toggle (PIN entry, etc.) — codebase has no auth model.
- Per-slice opt-in/opt-out — single flag covers all slices.
- Localization of the toggle label.
- Per-age tuning (e.g. "ages 3-4" vs "ages 5-6").
