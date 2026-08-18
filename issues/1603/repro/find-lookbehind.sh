#!/usr/bin/env bash
# List production chunks that contain a regex lookbehind ((?<= or (?<!) and are
# NOT Shiki TextMate grammar data (those contain "scopeName" and are strings for
# the oniguruma engine, so they are harmless in old Safari).
# Usage: find-lookbehind.sh <apps/app/dist/assets>
cd "$1" || exit 1
for f in $(grep -l -E '\(\?<[=!]' *.js); do
  if ! grep -q 'scopeName' "$f"; then
    echo "== $f"
    grep -o -E '.{0,80}\(\?<[=!].{0,80}' "$f" | head -5
  fi
done
