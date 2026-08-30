#!/usr/bin/env bash
#
# watch.sh — drop-folder front end for the hidden-picture pipeline.
#
# Watches scripts/hidden-pictures/_inbox/. Any image dropped in gets dithered into
# src/assets/img/hidden-pictures/kp-h-<name>.png, the eraser list is re-synced, and the
# original is moved to _inbox/_done/. Uses `fswatch` if available, otherwise polls.
#
# Usage:
#   watch.sh [--engine im|didder] [--size 400] [--interval 2] [--max-done 100]
#
# Then just drag PNG/JPG files into scripts/hidden-pictures/_inbox/ and refresh `yarn dev`.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/config.sh"
INBOX="$HERE/_inbox"
DONE="$INBOX/_done"

ENGINE="im"
SIZE="400"
INTERVAL="2"
MAX_DONE="$HIDDEN_PICTURES_DONE_MAX"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --engine) ENGINE="$2"; shift 2 ;;
    --size)   SIZE="$2"; shift 2 ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    --max-done) MAX_DONE="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: watch.sh [--engine im|didder] [--size 400] [--interval 2] [--max-done 100]"; exit 0 ;;
    *) echo "watch.sh: unknown option $1" >&2; exit 2 ;;
  esac
done

[[ "$MAX_DONE" =~ ^[1-9][0-9]*$ ]] \
  || { echo "watch.sh: --max-done must be a positive integer" >&2; exit 2; }

mkdir -p "$DONE"

is_image() {
  case "${1##*.}" in
    png|PNG|jpg|JPG|jpeg|JPEG|gif|GIF|bmp|BMP|tif|TIF|tiff|TIFF|webp|WEBP) return 0 ;;
    *) return 1 ;;
  esac
}

process_inbox() {
  local changed=0
  shopt -s nullglob
  for f in "$INBOX"/*; do
    [[ -f "$f" ]] || continue
    is_image "$f" || continue
    local done_files=("$DONE"/*)
    if [[ "${#done_files[@]}" -ge "$MAX_DONE" ]]; then
      echo "watch.sh: _done has reached its $MAX_DONE-file limit; move or delete old scratch originals before adding more" >&2
      break
    fi
    if [[ -e "$DONE/$(basename "$f")" ]]; then
      echo "watch.sh: _done already contains $(basename "$f"); move it or rename the inbox file before retrying" >&2
      continue
    fi
    echo "watch.sh: processing $(basename "$f") [engine=$ENGINE]" >&2
    if bash "$HERE/dither.sh" "$f" --engine "$ENGINE" --size "$SIZE" >/dev/null; then
      mv "$f" "$DONE/"
      changed=1
    else
      echo "watch.sh: FAILED on $(basename "$f") — leaving it in _inbox" >&2
    fi
  done
  shopt -u nullglob
  if [[ "$changed" -eq 1 ]]; then
    bash "$HERE/sync-array.sh" || echo "watch.sh: sync-array failed" >&2
  fi
}

echo "watch.sh: watching $INBOX (engine=$ENGINE, size=$SIZE, done-limit=$MAX_DONE). Drop images here. Ctrl-C to stop." >&2
process_inbox # handle anything already sitting in the inbox

if command -v fswatch >/dev/null 2>&1; then
  # Event-driven: re-scan on any change under the inbox (ignore the _done subfolder).
  fswatch -o -e "$DONE" "$INBOX" | while read -r _; do
    process_inbox
  done
else
  echo "watch.sh: fswatch not found — polling every ${INTERVAL}s (brew install fswatch for instant)." >&2
  while true; do
    sleep "$INTERVAL"
    process_inbox
  done
fi
