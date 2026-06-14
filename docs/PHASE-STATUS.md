# Phase Execution Status

Execution tracker for [hexagonal-roadmap.md](./hexagonal-roadmap.md). Updated 2026-06-14.

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

## Open follow-ups (genuinely need Eric / not safely automatable here)
- **`flake.nix` dev shell for Playwright on NixOS** — deliberately NOT fabricated (can't be
   verified on this box, and it's your Nix domain). Recommended approach: nixpkgs
   `playwright-driver.browsers` + `PLAYWRIGHT_BROWSERS_PATH`, pinning `@playwright/test` to the
   nixpkgs driver version. Would fix local E2E + parity. CI covers the need meanwhile.
- Proper purpose-`maskable` artwork (current 192/512 are upscaled from the 180 icon).
