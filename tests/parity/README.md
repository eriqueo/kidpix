# Parity harness (migration safety net)

The oracle that lets us migrate a tool from the legacy engine to the hexagonal
`core` and **prove the pixels didn't change**. See `docs/hexagonal-roadmap.md`.

## How it works
A parity spec draws a FIXED deterministic stroke through the real input path on
the legacy engine, then screenshots the composited main canvas (`#kiddopaint`).
The committed PNG under `__screenshots__/` is the golden baseline. Playwright's
`toHaveScreenshot` compares against it with a perceptual `maxDiffPixelRatio`
(default 0.02). When a tool is later re-implemented in `core`, the same stroke
must match the golden.

## Run
```bash
yarn test:parity            # compare against committed goldens
yarn test:parity:update     # (re)generate goldens — commit the PNGs
```

## Determinism / FX exemption
Only deterministic tools (pencil, line, shapes, eraser) get pixel parity.
Inherently stochastic tools (see `FX_EXEMPT` in `parity-helpers.ts`:
spraypaint, smoke, trees, kaleidoscope, …) are **exempt** — they use
`Math.random`/velocity and can't be pixel-matched until the core exposes a
seedable `Rng` port. They get "no-crash + visually sane" smoke tests instead.

## ⚠️ Generating baselines on NixOS
Playwright's downloaded Chromium needs system libs (`libX11`, `libasound`, `libgbm`,
…) that NixOS doesn't expose in `/usr/lib`, so `yarn test:parity:update` fails to
launch a browser locally on `hwc-laptop`/`hwc-server` (the existing `tests/e2e`
suite has the same constraint — it runs in CI on Ubuntu).

Options to generate goldens:
1. **CI** — run the parity job on the Ubuntu runner (where the E2E suite already works).
2. **Local, the right way** — add a `flake.nix` dev shell providing the Playwright
   browsers (or wrap with an FHS env). This fixes local E2E too. Not added yet —
   it's a deliberate Nix artifact for Eric to own. Until then, baselines come from CI.

The harness code is environment-independent; only baseline *generation* needs a
working browser.
