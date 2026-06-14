# Hexagonal / TypeScript Roadmap (v3 — post-premortem, no-React)

> Eric's repo, originally forked from `justinpearson/kidpix`. Goal: a clean, modular, testable
> TypeScript core that (a) lets us add tools + funny sounds easily and (b) packages as a
> standalone offline app for an iPad. Honors Eric's engineering principles (hexagonal core,
> contracts-before-code, Chesterton's Fence, premortem). See [ARCHITECTURE.md](./ARCHITECTURE.md)
> and [ADR-0001](./adr/0001-no-react-strangler-fig-tool-contract.md) for the "why not React" call.
> Risk register at the bottom — the premortem reshaped this plan; read it.

## What "done" means (reframed by premortem — this is the most important section)
Success is **"a clean TypeScript core that makes adding NEW tools and sounds delightful,"**
NOT "all ~50 legacy tools re-implemented." We use a **strangler-fig** approach: wrap the legacy
engine behind typed ports, route all new work through the clean core, and let the core grow until
legacy is vestigial. Legacy tools keep running via an adapter for as long as is useful — retired
**opportunistically, never as a required march**. This removes the death-spiral (a half-migrated
repo that rots in the 40-tool tail). "Keep vs. delete legacy" is a decision deferred ~6 months,
made on momentum — the near-term work is identical either way.

## Guiding constraints (non-negotiable)
- **One running app, via a bridge — never two.** New `core` tools register into the *existing*
  legacy event loop (`KiddoPaint.Tools`) through a thin adapter. No dual-default, no parallel
  app to keep in sync. (Premortem #3: dual-maintenance kills solo projects.)
- **Kid-value first.** The data-driven tool+sound registry ships in Phase 1 over the legacy
  engine, so Eric can add funny sounds/simple tools in week one — before any hexagon exists.
- **Parity = perceptual + seeded, with FX exemptions.** Deterministic tools (pencil/line/shapes)
  gate on a perceptual-diff threshold with RNG/velocity seeded; inherently stochastic FX tools
  (smoke, spray, kaleidoscope…) are **exempt** from pixel parity and get "no-crash + visually
  sane" smoke tests instead. (Premortem #2: exact-match on stochastic tools is a tar pit.)
- **No UI framework as the base.** We are NOT continuing the React migration (we don't need
  upstream compatibility — see ADR-0001). The chrome is a **data-driven render of the tool
  registry** in plain TypeScript; reach for Lit (~5KB, web-standards) only if/when hand-maintained
  DOM gets painful, and keep the chrome renderer isolated so that swap stays cheap.
- **Chesterton's Fence holds.** No tool loses recognizable behavior; preserve the Fence list in
  ARCHITECTURE.md; do NOT re-add ESLint/Prettier (removed upstream on purpose).

## Target shape (hexagonal)
```
core/        pure TS, no DOM/canvas/audio imports — drawing algorithms, stroke model,
             tool state machines, color/undo logic, brush/texture math (port from js/brushes,
             js/textures, js/util — already ~pure). The Tool contract lives here.
ports/       interfaces: Renderer (draw intent), SoundPort, InputPort, PersistencePort, Clock, Rng
adapters/    Canvas2DRenderer, WebAudioSound, DomInput (incl. touch→mouse + ev._x/_y),
             LocalStoragePersistence, LegacyToolAdapter  — the only code allowed to touch I/O
shells/      data-driven chrome (plain TS; Lit later if needed) + a thin headless shell for tests
```
A tool becomes: `(pointer, ToolContext{renderer, sound, state, rng}) → draws via ports` —
testable in Node with zero DOM. The chrome renders from each tool's `meta` + `submenu` data.

## The Tool contract (the center of gravity — contracts-before-code, finalize in Phase 2)
```ts
interface ToolContext {            // injected; a tool never reaches for globals
  renderer: Renderer;              // draw intent (Canvas2D today; WebGL-capable later)
  sound: SoundPort;                // ctx.sound.play('squiggle')
  state: DrawingStateView;         // read-only: color/altColor/terColor, scaling, multiplier, mods
  rng: () => number;               // SEEDABLE — makes stochastic tools testable/parity-able
}
interface Tool {
  meta: ToolMeta;                  // id, name, icon, category  → chrome renders FROM this
  submenu?: SubmenuSpec;           // declarative subtools (sizes, textures, sliders, …)
  onPointerDown?(p: Point, ctx: ToolContext): void;
  onPointerMove?(p: Point, ctx: ToolContext): void;
  onPointerUp?(p: Point, ctx: ToolContext): void;
}
```
- **Backwards-compat (behavior):** migrating a legacy tool is a *mechanical lift*, not a rewrite —
  keep the drawing math; swap `KiddoPaint.Display.context`→`ctx.renderer`,
  `.Current.color`→`ctx.state.color`, `.Sounds.x()`→`ctx.sound.play('x')`. Parity-gated.
- **Backwards-compat (saved data):** undo/redo persists raw `ImageData` in localStorage
  (format-stable). Protect with a test that loads an old-format save.
- **Expansion:** a new tool needing a control the old chrome lacks adds a control *type* to
  `SubmenuSpec`; the chrome renderer learns it once. Chrome grows by extending a schema, not by
  hand-coding bespoke UI per tool.
- **Bridge:** `LegacyToolAdapter` implements `Tool` by wrapping an old singleton + feeding it a
  shim global. New tools skip it. The `KiddoPaint` global ends up as ONE adapter behind a port,
  not a tax on new code.

## Phases (each ends shippable + committed; conventional commits, intermediate commits)

**Phase 0 — Foundation, parity oracle & iPad spike (small, de-risks the whole plan)**
- Confirm CD works under `eriqueo` (audit workflows + base/URL for hardcoded `justinpearson`;
  deploy to `eriqueo.github.io/kidpix`). *(Premortem #8.)*
- Stand up the **parity harness** with the tolerance defined up front: perceptual diff + seeded
  RNG/velocity for deterministic tools; an FX-exemption list. Golden baselines committed. *(#2.)*
- **iPad spike NOW:** legacy app as a bare PWA on a real iPad — test audio-unlock-on-tap and
  touch drawing. Findings become adapter constraints, not Phase-6 rework. *(#7.)*
- Deliverable: green CI on `eriqueo`, parity harness, documented iPad findings.

**Phase 1 — Kid-value first: data-driven tool + sound registry (over legacy)**
- Build the **declarative tool+sound registry** as a thin layer over the legacy engine (not the
  hexagon yet). Adding a funny sound = drop mp3 + one config entry; a simple custom tool = config.
  This is the motivation fuel and the thing Eric actually wants. *(Premortem #1/#6.)*
- Deliverable: Eric can add custom sounds/simple tools via config in the running app.

**Phase 2 — Define ports & extract the pure core (no behavior change)**
- Contracts-before-code: finalize the `Tool` contract + write port interfaces (`Renderer`,
  `SoundPort`, `InputPort`, `PersistencePort`, `Rng`). Extract the already-pure modules
  (`brushes/`, `textures/`, `util/colors`, geometry) into `core/` as typed TS with unit tests;
  legacy calls them via a shim.
- Deliverable: tested `core/` + `ports/` + the `Tool` contract; legacy unchanged.

**Phase 3 — Bridge + vertical slice: ONE tool through the hexagon (pencil)**
- Build the **bridge adapter** so a `core` tool registers into the *existing* legacy event loop
  (`KiddoPaint.Tools`) — ONE running app, no dual-default. *(Premortem #3.)*
- Re-implement pencil as `core` tool + `Canvas2DRenderer` + `WebAudioSound`; prove perceptual
  parity vs legacy pencil. Confirm the command abstraction can express `globalAlpha`/compositing/
  ImageData-readback or add an explicit escape hatch. *(#5.)*
- **Decision gate before scaling:** this validates the whole architecture on the simplest tool.
- Deliverable: pencil runs through the hexagon inside the one app; pattern documented.

**Phase 4 — Migrate-on-touch, opportunistically (NOT a march through all 50)**
- From here, migrate a legacy tool to `core` only when we're changing it anyway, or when it's
  genuinely valuable. Simple tools (line/rect/circle/eraser) first; stamps/brushes as needed.
  **Stochastic FX tools stay in legacy indefinitely** unless there's a reason. No tail death-march.
- Submenus migrate from mutate-the-singleton to declarative config as their tools migrate.

**Phase 5 — Flip default only if/when it's clearly better**
- Optional. Make the core path default *only* once it carries enough value to beat legacy for
  Eric's kids. The legacy bridge can remain forever — that's a feature, not debt.

**Phase 6 — iPad / standalone packaging (constraints already known from Phase 0 spike)**
- PWA (manifest + service worker for offline; apple-touch-icon exists) → "Add to Home Screen".
  Optionally Capacitor for a real `.ipa` sideload later.

## Open questions to resolve before Phase 3
- Perceptual-diff threshold value, and the precise FX-exemption list.
- Lit-vs-plain-TS trigger: at what point does hand-maintained chrome DOM justify Lit?
- Whether the bridge stays the long-term integration surface (likely yes; decide on momentum).

## Explicitly NOT doing
- No rewrite-from-scratch. No two-apps-in-parallel. No tail death-march through all 50 tools.
- No exact-pixel parity on stochastic tools. No re-adding ESLint/Prettier. No removing legacy
  until its tools are migrated AND at parity (strangler-fig retires it opportunistically, not on a deadline).
- No speculative ports we don't yet need (only Renderer/Sound/Input/Persistence to start).

## Risk register (from premortem, 2026-06-14)
| # | Kill vector | Sev×Lik | Mitigation (phase) |
|---|---|---|---|
| 1 | 40-tool tail never finishes (motivation) | 🔴 | Redefine "done" = great core + strangler-fig bridge; migrate-on-touch (P4) |
| 2 | Pixel-parity tar pit on stochastic tools | 🔴 | Perceptual+seeded parity, FX exemption list defined up front (P0) |
| 3 | Dual-maintenance burden (two apps) | 🔴 | Bridge into one running app; no dual-default (P3) |
| 4 | ~~Upstream divergence~~ — RESOLVED: we forked away, no upstream-compat goal (ADR-0001) | ✅ | n/a |
| 5 | Command abstraction can't express canvas tricks | 🟡 | Validate on pencil incl. alpha/composite/readback; escape hatch (P3) |
| 6 | Kid-value (sounds) lands last → motivation dies | 🟡 | Registry in Phase 1, before the hexagon |
| 7 | iPad audio-unlock / touch breaks late | 🟡 | iPad spike in Phase 0, not Phase 6 |
| 8 | CD points at `justinpearson` | 🟢 | Audit workflows in Phase 0 |
