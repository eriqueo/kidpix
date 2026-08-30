# kidpix architecture and developer map

This is the living entry point for the current repository. It records boundaries and
routes readers to the detailed source for decisions, product contracts, and history. It
does not carry test counts; run the checks for a current baseline.

## Product and repository

kidpix is Eric's modular vanilla-JavaScript/TypeScript continuation of the public-domain
Kid Pix drawing app. The deploy owned by this repository is
<https://eriqueo.github.io/kidpix/>. `origin` is `eriqueo/kidpix`; the separately deployed
`justinpearson/kidpix` repository is upstream lineage, not the release target.

The active work queue is [prompts-TODO/current.txt](prompts-TODO/current.txt).
`prompts-TODO/backlog.txt` and `prompts-TODO/misc.txt` are ungroomed inputs and may describe
features that have since shipped. They are not execution queues.

## Current runtime shape

- [index.html](index.html) initializes the `window.KiddoPaint` namespace and loads
  [src/kidpix-main.js](src/kidpix-main.js) as the one application entry point.
- `src/kidpix-main.js` imports the modular engine in dependency order, wires additive
  TypeScript bridges and feature modules, then calls `init_kiddo_paint()`.
- [js/](js/) remains the primary interactive drawing engine: global drawing state,
  canvas/event plumbing, tools, brushes, textures, stamps, submenus, and sounds.
- [core/](core/) contains testable TypeScript seams. Pencil and Line have core
  implementations behind the opt-in `?core` bridge; ColorMe uses a core flood-fill through
  its legacy UI. Default drawing behavior remains on the legacy tool path.
- [src/slideshow/](src/slideshow/), ColorMe, DrawMe, stamp editing, sound recording, and
  Wacky Cam are feature modules composed into the same app rather than separate frontends.
  Legacy → feature seams are DOM events, not imports: `save_to_file()` in
  [js/init/kiddopaint.js](js/init/kiddopaint.js) dispatches `kidpix:picture-saved` on
  `document`, and the SlideShow installer files the `#kiddopaint` canvas on that event.
- [js/init/mobile-drawers.js](js/init/mobile-drawers.js) owns the phone layout: Tools and
  Colors rails plus a "More actions" sheet that exposes `#statusbar-actions` (Kids Mode,
  Print, Project, Frame, DrawMe) on phone widths, where CSS hides the status bar. One drawer
  is open at a time; the phone rules live in one media block in
  [src/assets/css/kidpix.css](src/assets/css/kidpix.css). Tablet and desktop keep the status
  bar inline. Covered by [tests/e2e/mobile-acceptance.spec.ts](tests/e2e/mobile-acceptance.spec.ts).
- [pwa/](pwa/) and [vite.config.ts](vite.config.ts) own packaging. A build emits a root-based
  `dist/` and GitHub-Pages-based `dist-gh/`; the build checker enforces the offline precache
  contract described in [docs/pwa.md](docs/pwa.md).

There is no React application. React was deliberately removed in favor of one running app
and a strangler-fig core; the decision and constraints live in
[ADR-0001](docs/adr/0001-no-react-strangler-fig-tool-contract.md).

## Load-bearing behavior

Treat these as compatibility boundaries until caller searches and parity evidence prove a
change safe:

- The five canvas layers (`bnim`, `anim`, `main`, `preview`, `tmp`) support animation,
  previews, compositing, and undo.
- The 1300×650 drawing backing store is distinct from responsive presentation sizing.
- Touch/pointer normalization supplies `_x` and `_y` to tools and is the iPad drawing path.
- Tools and submenus share mutable singleton state, three-button colors, and modifier-key
  behavior that many effects read dynamically.
- The current drawing persists across reloads; undo/redo is intentionally memory-only and
  cleared during startup. Persisted formats require compatibility evidence before they change.
- Pixel rendering uses nearest-neighbor behavior where the original art depends on it.
- ESLint and Prettier are absent by design; do not reintroduce them as incidental cleanup.

The historical fence analysis is preserved in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). That file is explicitly a 2026-06-14 snapshot,
not current routing or a source for test counts.

## Development contract

The package scripts in [package.json](package.json) are authoritative:

```bash
yarn install --frozen-lockfile
yarn dev
yarn typecheck && yarn test
yarn build
yarn test:pwa
```

`yarn test` runs the project-document contract check before Vitest. `yarn build` produces
both deployment shapes and runs the PWA build checker. `yarn test:pwa` consumes those built
artifacts, so build first. Browser and pixel-parity checks are available through
`yarn test:e2e` and `yarn test:parity`. On NixOS, set `KIDPIX_CHROMIUM` to the system Chromium
binary for Playwright.

Pull requests run coverage, Chromium E2E, parity, build, and offline-PWA checks in
[.github/workflows/test.yml](.github/workflows/test.yml). A push to `main` runs typecheck,
the test gate, build, and the Pages deployment in
[.github/workflows/build-and-deploy-all.yml](.github/workflows/build-and-deploy-all.yml).
Tests passing locally means tested, not deployed; project "done" still requires the `main`
deployment to render the change.

## Decision and history map

- [docs/adr/0001-no-react-strangler-fig-tool-contract.md](docs/adr/0001-no-react-strangler-fig-tool-contract.md): why the repo has one app, no React base, and
  an incremental core bridge.
- [docs/hexagonal-roadmap.md](docs/hexagonal-roadmap.md): the migration strategy and original
  premortem. Read it as strategy; verify phase state in code.
- [docs/PHASE-STATUS.md](docs/PHASE-STATUS.md): dated execution history and remaining manual
  device work. Commands and counts in it are historical observations.
- [docs/pwa.md](docs/pwa.md): current offline/install/update contract.
- [docs/slideshow.md](docs/slideshow.md): SlideShow product contract, reconciled with the
  shipped journey on 2026-08-30; its "Not shipped" list is authoritative for what the UI
  must not promise.
- [docs/ipad-acceptance.md](docs/ipad-acceptance.md): the physical-iPad checklist that
  Chromium emulation cannot replace; record dated results there.
- [docs/reference/kid-pix-2-users-guide.md](docs/reference/kid-pix-2-users-guide.md): fidelity
  reference for original tool behavior.
- Git history is the source for removed implementations and completed feature narratives;
  do not copy an old plan back into a living guide.
