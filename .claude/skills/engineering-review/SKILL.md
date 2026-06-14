---
name: engineering-review
description: >-
  Enforce the project's engineering principles before any non-trivial change to the kidpix
  codebase — refactors, migrating a legacy tool to the hexagonal core, removing/replacing
  legacy `KiddoPaint` code, adding a new tool/sound subsystem, or committing to a migration
  phase. Use this skill whenever the work would modify existing behavior, restructure modules,
  cross the legacy↔core bridge, or start a roadmap phase. Auto-trigger on: "refactor", "migrate
  this tool", "rewrite", "remove the legacy", "replace KiddoPaint", "hexagonal", "should we
  change", "clean this up", or before opening a PR that touches `js/`, `src/`, `core/`, or
  `ports/`. Even simple-looking changes in this globally-coupled engine hide invariants —
  do not skip.
disable-model-invocation: false
---

# Engineering Review (kidpix)

This codebase is a globally-coupled canvas engine mid-migration to a hexagonal TS core. Small
changes have large blast radius (50+ tools share `KiddoPaint.Current`/`Display`/`Sounds`). Run
this gate before modifying existing behavior or starting a roadmap phase. Read
[`docs/ARCHITECTURE.md`](../../../docs/ARCHITECTURE.md) and
[`docs/hexagonal-roadmap.md`](../../../docs/hexagonal-roadmap.md) first — they are the source of
truth for the seams and the plan.

## Gate 1 — Chesterton's Fence (before you touch existing code)
Never remove/rewrite legacy code until you can explain *why it's there*. Specifically:
- Is the target on the **Fence list** in ARCHITECTURE.md (5-layer canvas pipeline, keyboard
  modifiers, 3-color L/R/middle model, undo localStorage persistence, touch→mouse + `ev._x/_y`,
  no-ESLint-by-design)? If yes → it encodes behavior kids recognize or the iPad input path. Do
  NOT casually change it; justify in writing and preserve the behavior.
- Map the **blast radius**: `rg` every reader/writer of the global state or function you're
  changing. A tool reads `KiddoPaint.Current.scaling`? Changing it touches every tool.
- Find the **precedent**: how did the original author solve this class of problem elsewhere?
  Match their pattern (tool singleton + mouse handlers, submenu `{name,handler}` config, sounds
  Library entries) rather than inventing a new dialect.

## Gate 2 — Creating-systems principles (when adding/extracting code)
- **Hexagonal:** business logic (drawing math, stroke model, tool state) goes in `core/` with
  ZERO imports of DOM/canvas/audio/localStorage. I/O lives only in `adapters/` behind `ports/`
  interfaces. Test: could this run headless in Node? If not, the boundary is wrong.
- **Contracts before code:** write/extend the port interface (`Renderer`, `SoundPort`,
  `InputPort`, `PersistencePort`) before implementing. Validate data crossing the bridge.
- **Data-driven:** new tools/sounds belong in the declarative registry (config + asset), not
  hardcoded singletons. No `if (tool === 'pencil')` ladders.
- **One running app:** new core tools register into the legacy event loop via the bridge. Do not
  spawn a second parallel app to keep in sync.

## Gate 3 — Parity (when migrating a legacy tool to core)
- Deterministic tool (pencil/line/shapes)? → must pass the **perceptual-diff** harness with
  RNG/velocity seeded. Stochastic FX tool (smoke/spray/kaleidoscope)? → it's **exempt** from
  pixel parity; ship a "no-crash + visually sane" smoke test and leave it in legacy unless there's
  a real reason to move it. Never block on exact-match for a random-driven tool.

## Gate 4 — Premortem (before committing to a phase or an irreversible change)
For any roadmap phase, bridge change, or legacy removal, run the **premortem** discipline (global
`premortem` skill, or the protocol: "it's N months later and this failed — why?"). The standing
risk register lives at the bottom of `docs/hexagonal-roadmap.md` — check whether your change
re-introduces a mitigated risk (esp. #1 tail death-march, #3 dual-maintenance, #2 parity tar pit).

## Output
Produce a short written verdict: Fence findings + blast radius, which principles apply and how,
parity classification (deterministic/exempt), and either "proceed" or "revise — here's why."
Then follow the repo's commit workflow (conventional commits, intermediate commits per logical
step; note any `.claude/` change in the commit message).
