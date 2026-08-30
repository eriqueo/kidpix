# Phase Execution History

Historical execution log for [hexagonal-roadmap.md](./hexagonal-roadmap.md), initiated
2026-06-14 and reconciled through 2026-08-30. It is not a work queue; current topology and
routing live in [../ARCHITECTURE.md](../ARCHITECTURE.md), and active priorities live in
[../prompts-TODO/current.txt](../prompts-TODO/current.txt).

## Portable/offline/responsive workstream

The 2026-06-14 iPad spike found synchronous per-stroke persistence, incomplete offline caching,
and fixed presentation sizing; see
[spike-2026-06-14-findings.md](./spike-2026-06-14-findings.md). Subsequent WS1–WS3 work landed
responsive presentation, complete PWA precaching, debounced current-drawing persistence, and
memory-only undo/redo. The load-bearing 1300×650 backing store remains unchanged. Physical-device
acceptance remains an active priority in the authoritative queue linked above.

## Done (committed on `main`)

| Phase | What landed | Verify |
|---|---|---|
| 0 | Decision docs + ADR-0001; `engineering-review` skill; **React skeleton removed** (bundle 505→312 KB); **parity harness** (`tests/parity/`, `yarn test:parity`); CD audit | `yarn test`, `yarn typecheck`, `yarn build` |
| 1 | **Data-driven sound registry** (`core/sound/`) — add a funny sound = one line in `core/sound/custom-sounds.ts` | `core/sound/sound-registry.test.ts` |
| 2 | **Tool contract + ports** (`core/ports.ts`) | `yarn typecheck` |
| 3 | **Core pencil through the hexagon** + `LegacyToolAdapter` bridge; `?core` opt-in | `core/tools/pencil.test.ts` + `tests/parity/pencil-core.parity.spec.ts` |
| 4 | **Core line** (proves pattern generalizes; evolved ports: `clear()`, `modified`) | `core/tools/line.test.ts` + line parity specs |
| 6 | **Installable offline PWA** (`vite-plugin-pwa`); iOS meta; pinch-zoom locked | `yarn build` → `dist-gh/{sw.js,manifest.webmanifest}` |
| WS1 | **Responsive presentation** with tablet breakpoints and phone drawers; backing store preserved | `src/assets/css/kidpix.css`, `js/init/mobile-drawers.js` |
| WS2 | **Fully offline after one visit** (2026-08-29): every deploy-owned file precached (400 entries, 3.6 MiB), Safari Range-aware audio, wait-to-activate updates, build checker, offline test against the built artifacts — see [pwa.md](./pwa.md) | `yarn build` (runs `check:pwa`), `yarn test:pwa` |
| WS3 | **Responsive-input performance**: in-memory bounded undo plus debounced current-drawing persistence | `js/util/display.js`, `js/init/kiddopaint.js` |
| Q1–Q3 | **Queue wave 2026-08-30** (`a628a39`, `527d4fa`, `f3a787e`): trustworthy Chromium signal (skips per-test with reasons, semantic selectors, Edit Stamp rebuild fix); phone "More actions" sheet for status-bar actions; complete SlideShow journey wired through `kidpix:picture-saved`. Each >50 LOC slice had a fresh-eyes audit; full gate green before push | `yarn test:e2e`, `tests/e2e/{mobile-acceptance,slideshow,tool-switching}.spec.ts` |

At this checkpoint the local gate passed. Default app behavior remained unchanged
(the legacy engine still drives drawing by default; core tools are opt-in via `?core`).

## Deferred (intentional)
- **Phase 5 (flip default to core):** only when the core path clearly beats legacy for the
  kids. Not now — the bridge keeps one running app.
- **Migrate-on-touch tail:** remaining ~48 legacy tools stay in the legacy engine and are
  migrated opportunistically (never a death-march). Stochastic FX tools stay put.

## Manual tasks — status

1. ✅ **GitHub Pages enabled** (via Pages API, build_type=workflow). Pushing `main` deploys
   `dist-gh/` to `https://eriqueo.github.io/kidpix/`.
2. ✅ **Old fork gone** — `eriqueo/kidpix_bak` returns 404 (already deleted).
3. ✅ **README repointed** to the eriqueo fork; lineage (vikrum → justinpearson → eriqueo) and
   the TS/hexagonal direction documented.
4. ✅ **Parity baselines generated and committed** (`2e90b71`). The manual
   `.github/workflows/generate-parity-baselines.yml` workflow remains the regeneration path;
   `yarn test:parity` checks core output against the committed legacy goldens.
## Housekeeping — done (2026-06-14)
- ✅ Fixed the 0s push "failures": `deploy.yml` removed (redundant + referenced a nonexistent
   script; its test-before-deploy intent moved into `build-and-deploy-all.yml`); `claude.yml`
   trigger restored (valid workflow; runs only on `@claude` mentions; needs `ANTHROPIC_API_KEY`).
- ✅ Parity gate added to `test.yml` — every PR now verifies core tools match the legacy goldens.
- ✅ README ownership strings repointed to eriqueo.

## Later resolutions

- The Black Hole and Count Down erasers were placeholders at the initial checkpoint; their
  dedicated effects landed in `622fa11` and `7589217`.
- Purpose-built maskable artwork landed with WS2 (`pwa-maskable-512.png`).
- Local Chromium Playwright runs were resolved without a flake: set `KIDPIX_CHROMIUM` to the
  system Chromium binary. The Playwright configs share that hook for `yarn test:e2e`,
  `yarn test:parity`, and `yarn test:pwa`; Firefox/WebKit remain CI-only.

## Remaining physical-device acceptance

- **iPad acceptance after the 2026-08-30 wave** — the full checklist and its dated results
   live in [ipad-acceptance.md](./ipad-acceptance.md). It includes the WS2 items (Airplane
   Mode sounds via the Range path, Hidden Pictures / stamps, update on relaunch) plus drawer
   reach, the phone More sheet, and the SlideShow journey.
