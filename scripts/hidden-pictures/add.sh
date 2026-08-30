#!/usr/bin/env bash
# Add one ordinary image to the Hidden Pictures reveal rotation.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -eq 0 ]]; then
  echo "Usage: add.sh <input-image> [--engine im|didder] [--size 400] [--name slug]" >&2
  exit 2
fi

output="$(bash "$HERE/dither.sh" "$@")"
bash "$HERE/sync-array.sh"

echo "add.sh: added $output to the Hidden Pictures rotation" >&2
printf '%s\n' "$output"
