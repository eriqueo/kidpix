# Sources & licensing posture

This entry is a **fan reproduction** of a Kid Pix 2 Mixer effect, built per
the project's standing fan-build policy:

> Build from known classic 1990s Kid Pix behavior; do not block on locating
> the original assets/ROM/manual. Produce faithful stylistic equivalents.
> Fan reproduction only — stylistic equivalents, never verbatim copyrighted
> text/assets.

## Reference material

- **Manual page:** The original Kid Pix 2 manual entry for the Mixer ("Wacky
  Brush" / "Jumble") includes "Snowflakes & Rain Drops" with a short
  description: snowflakes fall on the picture; Option melts them into
  raindrops. The verbatim text and scans are **not committed** to this repo
  to avoid asset-licensing concerns.
- **Behavioral source:** the behavior described in [`../spec.md`](../spec.md)
  is reconstructed from common community recollection of the classic tool
  plus the in-source comment in
  [`js/tools/mixer-snowflakes.js`](../../../js/tools/mixer-snowflakes.js).

## Comparison artifacts

A side-by-side still + short clip vs. the original manual scan is **deferred**
pending license-clean reference material. Verification today is by:

1. Running the dev server (`yarn dev-app`) and exercising the tool by hand.
2. The repo's automated checks (`yarn typecheck`, `yarn test`, `yarn build`).

If/when license-clean artifacts become available, drop them in this folder
(e.g. `still.png`, `demo.gif`) and link them from
[`../README.md`](../README.md).
