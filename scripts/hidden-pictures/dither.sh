#!/usr/bin/env bash
#
# dither.sh — turn any image into a Kid-Pix-style "hidden picture".
#
# Produces a 1-bit black-on-white dithered PNG named kp-h-<slug>.png in
# src/assets/img/hidden-pictures/, matching the look the Hidden Pictures eraser reveals.
#
# Why these steps (see js/util/utils.js makePatternFromImage + js/util/dither.js):
#   - The reveal draws the source at 2x with imageSmoothingEnabled=false and treats
#     WHITE as "erased paper", so we flatten transparency onto white and keep it 1-bit.
#   - The app's own reveal uses Floyd-Steinberg / Atkinson dithering; we mirror that here
#     so generated art sits next to the originals seamlessly.
#   - Source is sized to ~400px long-side: at the app's fixed 2x draw that fills the
#     1300x650 canvas like the bundled engravings.
#
# Usage:
#   dither.sh <input-image> [--engine im|didder] [--size 400] [--name slug]
#
# Engines:
#   im      ImageMagick Floyd-Steinberg (default; matches Dither.floydsteinberg). No extra deps.
#   didder  true Atkinson via the `didder` binary (matches Dither.atkinson most faithfully).
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: dither.sh <input-image> [--engine im|didder] [--size 400] [--name slug] [--output-dir path]
  --engine im      ImageMagick Floyd-Steinberg (default, no extra deps)
  --engine didder  true Atkinson via the `didder` binary
  --size N         long-side pixels for the source (default 400)
  --name slug      override the output name (default: input filename)
  --output-dir DIR write somewhere other than the app asset folder (for preview/checks)
Output: src/assets/img/hidden-pictures/kp-h-<slug>.png
EOF
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$REPO_ROOT/src/assets/img/hidden-pictures"
source "$REPO_ROOT/scripts/hidden-pictures/config.sh"

ENGINE="im"
SIZE="400"
NAME=""
INPUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --engine) ENGINE="$2"; shift 2 ;;
    --size)   SIZE="$2"; shift 2 ;;
    --name)   NAME="$2"; shift 2 ;;
    --output-dir) OUT_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "dither.sh: unknown option $1" >&2; usage >&2; exit 2 ;;
    *)  INPUT="$1"; shift ;;
  esac
done

[[ -n "$INPUT" ]] || { echo "dither.sh: no input image given" >&2; exit 2; }
[[ -f "$INPUT" ]] || { echo "dither.sh: no such file: $INPUT" >&2; exit 2; }

# Pick the ImageMagick entrypoint (v7 = magick, v6 = convert).
if command -v magick >/dev/null 2>&1; then IM="magick"
elif command -v convert >/dev/null 2>&1; then IM="convert"
else echo "dither.sh: ImageMagick not found (need 'magick' or 'convert')" >&2; exit 3; fi

# Derive a clean slug: lowercase, alnum-only, hyphen-separated, no leading/trailing/repeat '-'.
if [[ -z "$NAME" ]]; then
  base="$(basename "$INPUT")"
  NAME="${base%.*}"
fi
slug="$(printf '%s' "$NAME" \
  | tr '[:upper:]' '[:lower:]' \
  | tr -c 'a-z0-9' '-' \
  | tr -s '-')"
slug="${slug#-}"; slug="${slug%-}"
[[ -n "$slug" ]] || { echo "dither.sh: could not derive a name from '$INPUT'" >&2; exit 2; }

mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/kp-h-$slug.png"

# The runtime rotation is intentionally bounded. Replacing an existing slug is
# allowed at the limit; a new slug blocks before writing any generated asset.
if [[ "$OUT_DIR" == "$REPO_ROOT/src/assets/img/hidden-pictures" && ! -e "$OUT" ]]; then
  shopt -s nullglob
  current_pictures=("$OUT_DIR"/kp-h-*.png)
  shopt -u nullglob
  if [[ "${#current_pictures[@]}" -ge "$HIDDEN_PICTURES_MAX" ]]; then
    echo "dither.sh: reveal rotation is at its $HIDDEN_PICTURES_MAX-picture limit; remove an asset and sync before adding another" >&2
    exit 4
  fi
fi

# Shared preprocess: flatten onto white, drop alpha, grayscale, shrink-only to long-side SIZE.
# (Shrink-only avoids upscaling small inputs into mush before dithering.)
PRE_ARGS=(-background white -alpha remove -alpha off -colorspace Gray -resize "${SIZE}x${SIZE}>")

# Same filesystem as OUT makes the final rename atomic. The EXIT trap removes it;
# a stale .kidpix-hidden.* directory means the process was killed and is safe to delete.
TMPDIR_KP="$(mktemp -d "$OUT_DIR/.kidpix-hidden.XXXXXX")"
trap 'rm -rf "$TMPDIR_KP"' EXIT
GENERATED="$TMPDIR_KP/generated.png"

case "$ENGINE" in
  im)
    # Real Floyd-Steinberg to pure black/white: remap onto a 2-colour palette with the
    # FS dither active (-monochrome would ignore -dither and apply its own thresholding).
    PAL="$TMPDIR_KP/bw.png"
    "$IM" -size 1x1 xc:black xc:white +append "$PAL"
    "$IM" "$INPUT" "${PRE_ARGS[@]}" -dither FloydSteinberg -remap "$PAL" "$GENERATED"
    ;;
  didder)
    command -v didder >/dev/null 2>&1 || {
      echo "dither.sh: didder not installed — see scripts/hidden-pictures/README.md (brew install didder)" >&2
      exit 3; }
    TMP="$TMPDIR_KP/pre.png"
    "$IM" "$INPUT" "${PRE_ARGS[@]}" "$TMP"
    didder --palette 'black white' -i "$TMP" -o "$GENERATED" edm --serpentine Atkinson
    ;;
  *)
    echo "dither.sh: unknown engine '$ENGINE' (use im or didder)" >&2; exit 2 ;;
esac

# Publish only a completely generated PNG. The slug is the idempotency key; an
# existing asset with that slug is atomically replaced after generation succeeds.
mv -f "$GENERATED" "$OUT"

echo "dither.sh: wrote $OUT" >&2
printf '%s\n' "$OUT"
