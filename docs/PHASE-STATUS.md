# Phase Execution Status

Execution tracker for [hexagonal-roadmap.md](./hexagonal-roadmap.md). Updated 2026-06-14.

## Session: portable/offline/responsive ("CD-ROM") — WS0 diagnosis done
iPad on-device spike (2026-06-14): strong POC but very laggy; fixed-size canvas doesn't adapt to
window; needs landscape+portrait; some tools are upstream placeholders. **WS0 (diagnose-only)
complete** → see [spike-2026-06-14-findings.md](./spike-2026-06-14-findings.md) for measured root
causes: per-stroke `toDataURL()`+localStorage and per-move sound (lag); only 8/376 assets precached
(offline); absolute `/kidpix/` base + module scripts (no `file://`); fixed 1300×650 backing + no CSS
fit/DPR (responsive). **Awaiting Eric's review before WS1 (responsive canvas) / WS2 (portable+offline)
/ WS3 (perf).** Backing store stays 1300×650 (presentation-only fixes); parity gate must stay green.

## Done (committed on `main`)

| Phase | What landed | Verify |
|---|---|---|
| 0 | Decision docs + ADR-0001; `engineering-review` skill; **React skeleton removed** (bundle 505→312 KB); **parity harness** (`tests/parity/`, `yarn test:parity`); CD audit | `yarn test` (89), `yarn typecheck`, `yarn build` |
| 1 | **Data-driven sound registry** (`core/sound/`) — add a funny sound = one line in `core/sound/custom-sounds.ts` | `core/sound/sound-registry.test.ts` |
| 2 | **Tool contract + ports** (`core/ports.ts`) | `yarn typecheck` |
| 3 | **Core pencil through the hexagon** + `LegacyToolAdapter` bridge; `?core` opt-in | `core/tools/pencil.test.ts` + `tests/parity/pencil-core.parity.spec.ts` |
| 4 | **Core line** (proves pattern generalizes; evolved ports: `clear()`, `modified`) | `core/tools/line.test.ts` + line parity specs |
| 6 | **Installable offline PWA** (`vite-plugin-pwa`); iOS meta; pinch-zoom locked | `yarn build` → `dist-gh/{sw.js,manifest.webmanifest}` |

State: **89 unit tests pass, `tsc` clean, build clean.** Default app behavior unchanged
(legacy engine still drives everything; core tools are opt-in via `?core`).

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
4. 🤖 **Parity baselines — automated, not yet run.** NixOS local can't launch Chromium (tried
   `steam-run`; Playwright's nss/nspr preflight still fails). Solved via CI instead:
   `.github/workflows/generate-parity-baselines.yml` (manual dispatch) generates the `@golden`
   legacy baselines on Ubuntu, commits the PNGs, and runs the core-vs-legacy parity gate.
   **Trigger:** `gh workflow run "Generate parity baselines"` (or the Actions tab).
5. 📱 **iPad spike — needs your device.** Once Pages is live, install the PWA to the home screen
   and test (a) audio-unlock on first tap, (b) touch drawing, (c) offline reload. Findings →
   adapter constraints.

## Housekeeping — done (2026-06-14)
- ✅ Fixed the 0s push "failures": `deploy.yml` removed (redundant + referenced a nonexistent
   script; its test-before-deploy intent moved into `build-and-deploy-all.yml`); `claude.yml`
   trigger restored (valid workflow; runs only on `@claude` mentions; needs `ANTHROPIC_API_KEY`).
- ✅ Parity gate added to `test.yml` — every PR now verifies core tools match the legacy goldens.
- ✅ README ownership strings repointed to eriqueo.

## Known issues / future builds
- **Erasers "Black Hole" & "Count Down" are upstream placeholders** — both handlers just select
   the plain `Eraser` and play a "todo" sound (sibling effects "Drop Out"/"Sweep" are commented
   out in `js/submenus/eraser.js`). They erase like a normal eraser but have no special animation;
   the effects were never implemented in this fork. NOT a regression. Implementing the real
   black-hole/countdown animations is a good future **core-tools** build (needs design).

## Open follow-ups (genuinely need Eric / not safely automatable here)
- **`flake.nix` dev shell for Playwright on NixOS** — deliberately NOT fabricated (can't be
   verified on this box, and it's your Nix domain). Recommended approach: nixpkgs
   `playwright-driver.browsers` + `PLAYWRIGHT_BROWSERS_PATH`, pinning `@playwright/test` to the
   nixpkgs driver version. Would fix local E2E + parity. CI covers the need meanwhile.
- Proper purpose-`maskable` artwork (current 192/512 are upscaled from the 180 icon).
