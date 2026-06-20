# Build report — DrawMe prompt generator (kidpix-manual-fidelity/03-drawme-prompt-generator)

## UNDERSTANDING

**Spec.** Ship a deterministic, seedable reproduction of the classic 1990s
KidPix DrawMe "Chaos Randomizing" suggester (Switcheroo menu → DrawMe) as a
new module at `kidpix-manual-fidelity/03-drawme-prompt-generator`, exposed via
a minimal button → prompt-display UI hook. Scope is the **prompt generator
only**, not the full DrawMe tool.

**Amendments.** Authorized to build unattended; source = my own knowledge of
classic KidPix (no ROM/manual hunt); acceptance is machine-checkable
(determinism, category coverage, non-empty, repo tests/build green); create
the module path if missing; fan reproduction = stylistic equivalence, no
verbatim copyrighted text.

**Repo dialect.** Hexagonal: `core/` holds pure TS modules with port-based
I/O; `adapters/` translate; `src/kidpix-main.js` is the legacy ESM entry that
walks the script-tag-style `js/*` modules and ends by importing tiny TS
"bridge" init files (`src/registry-init.ts`, `src/core-tools-init.ts`). The
existing pattern is: small TS bridge that runs after the legacy DOM is built
and additively wires new behavior into the global `KiddoPaint` engine. The
DrawMe hook follows the same pattern via `src/drawme-init.ts`. No mention of
"kidpix-manual-fidelity" existed previously in the tree (only DrawMe's lone
line in `docs/reference/kid-pix-2-users-guide.md:483`), so the module was
created from scratch and `tsconfig.app.json` was extended to typecheck it.

## WHAT-I-CHANGED

Six new files in the spec's named module path:

- `kidpix-manual-fidelity/03-drawme-prompt-generator/schema.ts` — `CATEGORIES`
  (`adjective | subject | action | scene`) and types.
- `kidpix-manual-fidelity/03-drawme-prompt-generator/corpus.ts` — original
  vocabulary, ~20 entries per slot → 160,000 unique combinations.
- `kidpix-manual-fidelity/03-drawme-prompt-generator/generator.ts` —
  Mulberry32 seedable RNG (`createSeededRng`) isolated from `Math.random`;
  `generatePrompt({seed})` deterministic; `generateRandomPrompt()` for UI.
- `kidpix-manual-fidelity/03-drawme-prompt-generator/ui-hook.ts` —
  `mountDrawMeButton()`: idempotent; mounts a `<button id="drawme-button">`
  into `#statusbar` and writes the generated prompt into `#statusbar-text` on
  click. Falls back to `window.alert` if the display node is absent.
- `kidpix-manual-fidelity/03-drawme-prompt-generator/index.ts` — public
  re-exports.
- `kidpix-manual-fidelity/03-drawme-prompt-generator/README.md` — fidelity
  criteria + file map (the P6 review anchor).

Three new tests (13 cases total): `corpus.test.ts`, `generator.test.ts`,
`ui-hook.test.ts` — cover the spec's required invariants (category coverage,
determinism under fixed seed, non-empty output) plus article correctness,
vocabulary-sweep, and UI mount/click integration.

Two small wiring edits in the existing tree (blast radius):

- `src/drawme-init.ts` (new) — DOMContentLoaded bridge that calls
  `mountDrawMeButton()`. Mirrors `src/registry-init.ts` style.
- `src/kidpix-main.js` (+3 lines) — import `./drawme-init` after
  `./core-tools-init` so it runs last.
- `tsconfig.app.json` — added `"kidpix-manual-fidelity/**/*"` to `include`
  and excluded its `*.test.ts` from typecheck (mirrors how `core/**/*.test.ts`
  is excluded today). No behavior change to existing typecheck scope.

Nothing in `core/`, `js/`, `adapters/`, or any other tool was touched.

## HOW-VERIFIED

- `yarn typecheck` → green (`tsc -p tsconfig.app.json --noEmit`, 0 errors).
- `yarn test` → **102 tests passing across 10 files**, including the 13 new
  DrawMe tests (`corpus.test.ts` 4, `generator.test.ts` 7, `ui-hook.test.ts`
  2). Pre-existing suites (`core/tools/{pencil,line}`, `core/sound`,
  `js/util/*`, `js/stamps/*`) unchanged and still pass.
- `yarn build` → green; both `dist/` and `dist-gh/` (GitHub Pages base
  `/kidpix/`) emit; bundle size `339.53 kB` (the DrawMe module is small and
  tree-shakes well).

Acceptance criteria from the amendments — all met:
- ✅ Deterministic under a fixed seed (`generator.test.ts`, "is deterministic
  under a fixed seed").
- ✅ Every defined category represented (`generator.test.ts`, "fills every
  category (coverage invariant)").
- ✅ Non-empty output (`generator.test.ts`, "never emits empty output").
- ✅ Existing repo tests + build pass.

## WHAT-REMAINS

- **P6 human review** of corpus tone vs. the original DrawMe feel — the
  README documents this as the explicit gate; tests can't decide it.
- Optional: surface DrawMe somewhere more visible than the status-bar button
  (e.g., a real Switcheroo menu mirroring `docs/reference/kid-pix-2-users-guide.md:478`).
  Out of scope per the "minimal button → prompt-display" contract; would be a
  follow-up.
- Optional: audio playback of the prompt (the original used a "talking
  computer"). Also out of scope; would be a follow-up that depends on the
  TTS/sound-pack work in `core/sound/`.

## BUILD-VERDICT: success
