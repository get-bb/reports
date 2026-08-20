#!/usr/bin/env bash
# Build an "umbrella" workspace: a git repo whose untracked subdirectories are
# nested git checkouts with big node_modules trees. Mirrors the shape in #1779
# (/home/uje/agentics) at a small, safe scale.
#   usage: build-umbrella.sh <root> [nested-repos=4] [packages-per-repo=2500]
set -euo pipefail
ROOT="${1:?root}"; N="${2:-4}"; P="${3:-2500}"
rm -rf "$ROOT"; mkdir -p "$ROOT"
git -C "$ROOT" init -q -b main
git -C "$ROOT" -c user.name=t -c user.email=t@t commit -q --allow-empty -m init
for i in $(seq 0 $((N-1))); do
  c="$ROOT/apps/child-$i"; mkdir -p "$c"
  git -C "$c" init -q -b main
  printf 'node_modules/\n' > "$c/.gitignore"
  git -C "$c" add .gitignore && git -C "$c" -c user.name=t -c user.email=t@t commit -q -m init
  # one mkdir call per repo: node_modules/pkg-N/lib
  mkdir -p $(for p in $(seq 0 $((P-1))); do printf '%s/node_modules/pkg-%d/lib ' "$c" "$p"; done)
done
echo "dirs under root: $(find "$ROOT" -type d | wc -l)"
echo "root-level git status ignored entries (what bb's ignore discovery sees):"
git -C "$ROOT" --no-optional-locks status --porcelain=v1 -z --ignored=matching --untracked-files=normal | tr '\0' '\n'
