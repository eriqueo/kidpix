# Kid Pix — Architecture Ground Truth

> Lay-of-the-land snapshot to inform the hexagonal/TypeScript migration. Captured 2026-06-14
> against `eriqueo/kidpix` (forked from `justinpearson/kidpix` ← `vikrum/kidpix`).
> Companion to [hexagonal-roadmap.md](./hexagonal-roadmap.md). Update when the seams move.

## The two worlds (hybrid, mid-migration)

`index.html` runs in **dual mode**, switched by a URL param:

- **Default (no param):** shows `#js-root`, boots the **legacy vanilla-JS engine**.
- **`?react`:** shows `#react-root`, mounts the **React/TS skeleton** (`src/`).

The legacy engine is the real app today. React is a parallel skeleton at ~**7%** migration.

### Boot
- `src/kidpix-main.js` is the legacy orchestrator: imports ~100 `js/` files in dependency
  order (util → init → tools/brushes/submenus/stamps/textures/sounds), waits for DOM, calls
  `init_kiddo_paint()` (`js/init/kiddopaint.js`), and exposes the `window.KiddoPaint` global.
- `src/main.tsx` → `src/App.tsx` mounts React only when `#react-root` is visible.

## The legacy engine (`js/`)

Single global object `KiddoPaint` (`js/init/kiddopaint.js`, ~907 lines) with sub-namespaces:
`Tools`, `Textures`, `Brushes`, `Builders`, `Stamps`, `Sounds`, `Display`, `Current`, `Colors`, …

- **`KiddoPaint.Current`** — mutable global drawing state: `tool`, `color`/`altColor`/`terColor`
  (left/right/middle click), `scaling` (shift=2×), `multiplier` (number keys 1-9), modifier flags,
  `globalAlpha`, velocity. Read AND written by all ~50 tools, submenus, keyboard + event handlers.
- **`KiddoPaint.Display`** — five canvases: `bnim` (bg anim), `anim`, `main` (saved drawing),
  `preview` (live preview), `tmp` (active scratch). Plus `undoData[]`/`redoData[]` (also persisted
  to localStorage, capped ~10 states).

### Tool contract (implicit)
A tool is a singleton instance with optional `mousedown/mousemove/mouseup(ev)` methods that draw
directly to `KiddoPaint.Display.context` (the tmp layer). Example (`js/tools/pencil.js`): mousemove
calls `KiddoPaint.Sounds.pencil()`, reads `KiddoPaint.Current.color`/`scaling`, strokes the ctx;
mouseup calls `KiddoPaint.Display.saveMain()` to composite tmp → main.

- Event dispatch: one universal `ev_canvas` handler on `tmpCanvas` (mousedown/move/up), with
  touch→mouse synthesis and coordinate normalization to `ev._x`/`ev._y`.
- **Submenus** (`js/submenus/`) are config arrays of `{name, handler}`; clicking a subtool button
  runs `handler()`, which **mutates the tool singleton directly** (e.g. sets `.size`, swaps `.texture`).

## React/TS layer (`src/`) — what's actually migrated
> ⚠️ **Decision (ADR-0001): we are NOT continuing the React migration.** The `src/` React skeleton
> below is inherited from upstream and is dead weight to be removed/repurposed. New work uses a
> data-driven chrome in plain TS over a hexagonal core — see the roadmap. Description kept for context.


All presentational/stubs; **no drawing integration yet**:
- `components/UI/{Toolbar,ColorPalette}.tsx`, `components/Canvas/{CanvasContainer,CanvasLayer}.tsx`
- `contexts/KidPixContext.tsx` — reducer holding `currentTool/Color`, `brushSize`, `canvasLayers`,
  `undoStack`/`redoStack`. Defines state but **nothing dispatches into the legacy engine**.
- `hooks/useCanvasSetup.ts` (only sets cursor), `hooks/useDrawingEvents.ts` (console.logs only).
- Types: `types/global.d.ts` (KiddoPaint namespace), `types/interfaces.d.ts` (`Point`, `Color`,
  `Tool`, `CanvasLayer`, …). Real but unenforced — legacy code is untyped.

## Sounds (`js/sounds/sounds.js`)
Hardcoded `Audio` objects in `KiddoPaint.Sounds.Library.<name> = [new Audio("snd/.../x.mp3")]`;
tools call `KiddoPaint.Sounds.<name>()` (random pick + play). Known TODO: switch to lazy-load
(too many `Audio()` throws in Chrome). **Adding a custom sound today ≈ 5 min:** drop mp3 in `snd/`,
add a Library line, call it from a tool.

## Tests
- **Vitest unit:** React context/components/hooks (mostly state, no pixels) + 4 legacy pure-JS
  util tests (`js/util/colors.test.js`, `utils.test.js`, `keyboard-help.test.js`, `stamp-names`).
- **Playwright E2E:** drives DOM (select tool, subtools, switching, console-error monitoring).
  Drawing-output/pixel validation largely `test.skip()` (tracked upstream #84). 128 unit tests pass.

## Build & deploy
- Vite 6, `base: "/"`, alias `@`→`/src`, `@js`→`/js`. `yarn build` produces **`dist/`** (`base=/`)
  and **`dist-gh/`** (`base=/kidpix/` for GitHub Pages).
- GH Actions: `build-and-deploy-all.yml` (test→build→Pages), `release.yml` (tag→tarball),
  `test.yml` (PR: vitest + Playwright chromium). **Note:** deploy URL/base assume repo name `kidpix`
  — fine for us; audit workflows for hardcoded `justinpearson` before relying on CD.

## Hexagonal readiness — assessment (3/10)

**Biggest obstacles**
1. **Global mutable tool singletons** mutated by submenus (no factory/immutability/composition).
2. **Drawing embedded in tools** — every `mousemove` calls `ctx.*` directly; no "what to draw" vs
   "how to render" split. Untestable headless, no selective undo, locked to Canvas2D.
3. **Implicit global context** — 50+ tools assume `KiddoPaint.Current/Display/Sounds` exist; no DI.
4. State spread across 9 namespaces; circular coupling Tools↔Display↔Sounds↔Current.

**Natural boundaries to preserve (already ~pure)**
`js/brushes/` (shape generators), `js/textures/` (texture math), `js/util/colors.js`,
geometry utils (`smooth.js`, `douglas-peucker.js`, `fit-curve.js`). Submenus are config-driven and
could become JSON + React with the handler pattern intact.

**Chesterton's Fence — DO NOT casually disturb (they encode real behavior kids recognize)**
- Five-layer canvas pipeline (bnim/anim/main/preview/tmp) — enables live preview + undo + animation.
- Keyboard modifier system (shift=2×, ctrl/alt/meta/tilde variations, single-key shortcuts).
- 3-color L/R/middle-click model.
- Undo/redo localStorage persistence (survives reload).
- Touch→mouse synthesis + `ev._x/_y` coordinate normalization (this is the iPad input path).
- **No ESLint/Prettier** — removed on purpose upstream (commit 3f1155b) to cut friction. Don't re-add.

## Upstream migration intent (justinpearson#62, re-planning)
Bottom-up, **side-by-side** (vanilla default, React via `?react`), 5 incremental phases, E2E +
pixel-parity at each boundary, pausable/rollback-able. The detailed plan doc was deleted to re-plan
with a newer model — so the *strategy* stands but the *plan* is open. That's our window to land a
hexagonal core/ports/adapters design and PR it upstream.
