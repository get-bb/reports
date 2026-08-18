#!/usr/bin/env bash
# Lists every JS file the built HTML shell loads eagerly (entry script +
# <link rel="modulepreload">), with sizes, and the total.
# Usage: bash boot-preload-sizes.sh <apps/app/dist dir>
set -euo pipefail
dist="${1:-dist}"
total=0
for f in $(grep -o 'assets/[^"]*\.js' "$dist/index.html" | sort -u); do
  sz=$(stat -c %s "$dist/$f")
  total=$((total + sz))
  printf "%9d  %s\n" "$sz" "$f"
done | sort -rn
for f in $(grep -o 'assets/[^"]*\.js' "$dist/index.html" | sort -u); do
  stat -c %s "$dist/$f"
done | paste -sd+ | bc | sed 's/^/TOTAL eager bytes: /'
