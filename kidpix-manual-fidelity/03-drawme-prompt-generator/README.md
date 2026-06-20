# 03 — DrawMe Prompt Generator

Deterministic, seedable reproduction of the classic 1990s KidPix **DrawMe**
suggestion feature (from the **Switcheroo** menu — see
`docs/reference/kid-pix-2-users-guide.md:483`):

> _DrawMe — Start with a blank screen and a talking computer that suggests a
> fantasy scene to draw (via "Chaos Randomizing" — phrases freshly mixed each
> time, for thousands of suggestions)._

This module ships the **prompt generator only**. It is intentionally scoped
below the full DrawMe tool: no audio, no canvas integration, no tool change —
just a button that produces and displays one silly fantasy-scene prompt.

## Layout

| File | Role |
| --- | --- |
| `schema.ts` | Slot taxonomy (`adjective | subject | action | scene`) and types |
| `corpus.ts` | Original vocabulary fixture (~20 entries per slot, ≥10k combinations) |
| `generator.ts` | Mulberry32 seedable RNG + `generatePrompt(seed)` |
| `ui-hook.ts` | `mountDrawMeButton()` — minimal button → status-bar prompt |
| `generator.test.ts` | Determinism, coverage, non-empty, article correctness |
| `corpus.test.ts` | Fixture invariants (size floor, no dupes, no empties) |
| `ui-hook.test.ts` | Mount + click integration in jsdom |
| `index.ts` | Public re-exports |

## Manual-fidelity criteria (P6 review)

- **Stylistic equivalence**, not verbatim reuse. Fan reproduction; no
  copyrighted KidPix text or assets.
- Slot grammar matches the classic mad-libs feel:
  `Draw a {adjective} {subject} {action} {scene}.`
- ≥10,000 unique combinations (the original advertised "thousands").
- Vocabulary tone: short, silly, kid-friendly, concrete enough to draw.
- Generator is **deterministic under a fixed seed** and isolated from
  `Math.random` (killVector: shared RNG → flaky tests).
- UI surface: **one** button → **one** prompt display. Scope-creep into full
  DrawMe tool integration is explicitly out of bounds.

Acceptance is machine-checkable through `corpus.test.ts` + `generator.test.ts`
+ `ui-hook.test.ts`; subjective tone review is the human gate at P6.

## Wiring

`src/drawme-init.ts` calls `mountDrawMeButton()` on `DOMContentLoaded`,
imported at the end of `src/kidpix-main.js` so the legacy engine has already
built the status bar.
