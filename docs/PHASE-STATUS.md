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

## ⚠️ Needs Eric / CI (can't be done from this machine)

1. **Enable GitHub Pages** (one-time, repo admin — the agent's token can't):
   GitHub → repo **Settings → Pages → Source: "GitHub Actions"**. Then a push to `main`
   deploys `dist-gh/` to `https://eriqueo.github.io/kidpix/`. (The deploy workflow itself is
   already generic — no hardcoded `justinpearson`.)
2. **Delete the old fork** (token lacks `delete_repo`):
   `gh auth refresh -h github.com -s delete_repo && gh repo delete eriqueo/kidpix_bak --yes`
3. **Generate parity baselines** in a working browser env (NixOS local can't launch Chromium —
   same as the existing E2E suite). Run in CI or a flake dev shell:
   `yarn test:parity:update` for the legacy goldens, commit the PNGs under
   `tests/parity/__screenshots__/`. Then `pencil-core` / `line-core` specs gate future migrations.
4. **iPad spike** (needs your device): install the deployed PWA to the home screen and test
   (a) audio-unlock on first tap, (b) touch drawing, (c) offline reload. Findings → adapter constraints.

## Follow-ups (nice-to-have, not blocking)
- Repoint `README.md` URLs from `justinpearson` → `eriqueo` and update the narrative authorship.
- Optional `flake.nix` dev shell providing Playwright browsers (fixes local E2E + parity on NixOS).
- Add proper purpose-`maskable` artwork (current 192/512 are upscaled from the 180 icon).
