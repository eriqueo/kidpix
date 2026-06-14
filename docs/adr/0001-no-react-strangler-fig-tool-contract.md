# ADR-0001: No React base; strangler-fig migration around a data-driven Tool contract

- **Status:** Accepted
- **Date:** 2026-06-14
- **Context owner:** Eric (`eriqueo/kidpix`)
- **Related:** [hexagonal-roadmap.md](../hexagonal-roadmap.md), [ARCHITECTURE.md](../ARCHITECTURE.md)

## Context
This repo was forked from `justinpearson/kidpix`, which had begun a React/TypeScript migration
(upstream issue #62) explicitly *to learn React/TS*. Eric inherited a ~7%-complete React skeleton
(`src/`) sitting beside the working legacy vanilla-JS engine (`js/`, the global `KiddoPaint`).

Eric's goals are different from Justin's: a clean, modular, **TypeScript** core that makes adding
new tools + funny sounds easy, packageable as an offline iPad app for his kids, and a codebase he
contributes to long-term. He explicitly does **not** care about staying mergeable with upstream.

Decision criteria he set: *robust, forward-looking, backwards-compatible, not heavier than it needs
to be, preserve all historical tools' spirits, enable easy migration + expansion.*

## Decision
1. **Do not adopt React (or any UI framework) as the base.** Kid Pix is a canvas app: ~95% of its
   value is imperative pixel-drawing where React contributes nothing, and the chrome (toolbar,
   palette, submenus) is small. React was Justin's *learning* goal, not an architectural need.
2. **The chrome is a data-driven render of the tool registry**, written in plain TypeScript.
   Adopt Lit (~5KB, web-standards) only if/when hand-maintained DOM becomes painful; keep the
   chrome renderer isolated so that swap is cheap (late binding).
3. **Modernize the engine, not the framework.** The real investment is TypeScript + a hexagonal
   `core`/`ports`/`adapters` split + a declarative **Tool contract** + a tool/sound registry.
4. **Strangler-fig, not rewrite.** Wrap legacy behind typed ports via a `LegacyToolAdapter`; route
   new work through the clean core; retire legacy opportunistically, never on a deadline. The
   `KiddoPaint` global becomes one adapter behind a port, not a tax on new code.
5. **The Tool contract keeps the legacy lifecycle shape** (pointer down/move/up) so old tools wrap
   as a mechanical lift (swap globals → injected ports), preserving behavior; parity-gated.

## Consequences
- **Positive:** lightest stack that's still robust/typed; satisfies Eric's principles (data-driven
  rendering, contracts-before-code, hexagonal) across the *whole* app, not just the chrome; kid-value
  ships early (registry in Phase 1); low regression risk; new tools that need new controls extend a
  schema rather than fighting the chrome.
- **Negative / accepted:** we diverge from upstream and give up easy `git merge upstream/main`
  (accepted — not a goal). The existing React `src/` skeleton becomes dead weight to be removed or
  repurposed. We carry the legacy global until its tools are migrated (mitigated: it's confined
  behind a port).
- **Superseded assumption:** roadmap v1's "permanent legacy bridge" → reframed as strangler-fig
  (legacy *can* be fully retired later; the keep-vs-delete decision is deferred ~6 months and made
  on project momentum, since the near-term work is identical either way).

## Alternatives considered
- **Finish the React migration (upstream's path):** rejected — heavy for the chrome, irrelevant for
  the canvas, and chosen by Justin for learning reasons that aren't Eric's.
- **Big-bang rewrite to a pristine modern stack:** rejected — rewriting a working app the kids use
  is the classic project-killer; premortem flagged motivation/dual-maintenance/tail as 🔴.
- **Preact/Solid (lighter React-likes):** rejected — if we don't need the component-tree model, a
  React-like still imposes it. Plain TS + optional Lit is lighter and standards-aligned.
