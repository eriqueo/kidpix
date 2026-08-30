#!/usr/bin/env bash
#
# sync-array.sh — mirror src/assets/img/hidden-pictures/kp-h-*.png into the eraser list.
#
# The bundledPictures array in js/tools/eraser-hidden-pictures.js is the runtime list for
# repository-owned assets (a static site can't list a directory at load time). Browser-local
# custom records are appended separately. This script regenerates the bundled entries BETWEEN
# the marker comments:
#       // <hidden-pictures:auto>
#       ...entries...
#       // </hidden-pictures:auto>
# from whatever kp-h-*.png files are present — sorted, deduped, idempotent. It only ever
# touches the marked block, so the rest of the file is left exactly as-is. awk does the
# rewrite (no sed). If the markers are missing it refuses to guess and exits non-zero.
set -euo pipefail
export LC_ALL=C

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PIC_DIR="$REPO_ROOT/src/assets/img/hidden-pictures"
TARGET="$REPO_ROOT/js/tools/eraser-hidden-pictures.js"
source "$REPO_ROOT/scripts/hidden-pictures/config.sh"
MODE="write"

if [[ "${1:-}" == "--check" ]]; then
  MODE="check"
  shift
fi
[[ $# -eq 0 ]] || { echo "Usage: sync-array.sh [--check]" >&2; exit 2; }

[[ -f "$TARGET" ]] || { echo "sync-array.sh: target not found: $TARGET" >&2; exit 1; }

grep -q '<hidden-pictures:auto>' "$TARGET" \
  || { echo "sync-array.sh: open marker // <hidden-pictures:auto> missing in $TARGET" >&2; exit 1; }
grep -q '</hidden-pictures:auto>' "$TARGET" \
  || { echo "sync-array.sh: close marker // </hidden-pictures:auto> missing in $TARGET" >&2; exit 1; }

# Build the entry lines from the folder (basename, sorted). nullglob => empty if none.
shopt -s nullglob
entries=""
for f in "$PIC_DIR"/kp-h-*.png; do
  entries+="    \"img/hidden-pictures/$(basename "$f")\","$'\n'
done
shopt -u nullglob
entries="${entries%$'\n'}" # trim trailing newline (printf below re-adds one)

count="$(printf '%s' "$entries" | grep -c . || true)"
if [[ "$count" -eq 0 ]]; then
  echo "sync-array.sh: no kp-h-*.png found in $PIC_DIR — refusing to empty the list" >&2
  exit 1
fi
if [[ "$count" -gt "$HIDDEN_PICTURES_MAX" ]]; then
  echo "sync-array.sh: $count pictures exceed the $HIDDEN_PICTURES_MAX-picture rotation limit; remove assets before syncing" >&2
  exit 1
fi

# Rewrite only the marked block. Pass entries via the environment to dodge quoting issues.
export KP_ENTRIES="$entries"
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
awk '
  /<hidden-pictures:auto>/ { print; printf "%s\n", ENVIRON["KP_ENTRIES"]; inblock=1; next }
  /<\/hidden-pictures:auto>/ { inblock=0 }   # falls through to print the close marker
  !inblock { print }
' "$TARGET" > "$tmp"

if [[ "$MODE" == "check" ]]; then
  if ! cmp -s "$tmp" "$TARGET"; then
    echo "sync-array.sh: generated list is stale; run scripts/hidden-pictures/sync-array.sh" >&2
    diff -u "$TARGET" "$tmp" >&2 || true
    exit 1
  fi
  echo "sync-array.sh: $count generated entries are current" >&2
  exit 0
fi

cp "$tmp" "$TARGET"
echo "sync-array.sh: wrote $count entr$([[ "$count" -eq 1 ]] && echo y || echo ies) to $TARGET" >&2
