# kidpix-manual-fidelity

Per-effect fidelity notes for classic Kid Pix tools reproduced in this fork.

Each `NN-<effect-slug>/` entry documents one Kid Pix feature as a fan
reproduction: a stylistic equivalent of the classic 1990s behavior, not a
verbatim port of any copyrighted asset. The actual implementation lives in
`js/tools/` (or the appropriate subsystem); these folders are documentation +
references that pin behavior expectations and source attribution.

## Layout convention

```
NN-<slug>/
  README.md       human-readable summary, links to the live source files
  spec.md         behavior spec (inputs, outputs, scope, out-of-scope)
  references/
    SOURCES.md    citation + licensing posture for any reference material
    *.png|*.gif   optional comparison artifacts (commit only if license-clean)
```

## Entries

- [06-mixer-snowflakes-raindrops](06-mixer-snowflakes-raindrops/) — Mixer:
  Snow Flakes & Rain Drops
