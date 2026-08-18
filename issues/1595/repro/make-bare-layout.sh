#!/usr/bin/env bash
# Builds the "bare clone + sibling worktrees" layout from get-bb/bb#1595 under
# /tmp/bb-1595/cosmos and prints what git itself thinks about the root.
set -euo pipefail
ROOT=${1:-/tmp/bb-1595}
rm -rf "$ROOT" && mkdir -p "$ROOT/origin" "$ROOT/cosmos"
git -C "$ROOT/origin" init -q -b main
git -C "$ROOT/origin" -c user.email=a@b.c -c user.name=t commit -q --allow-empty -m init
git -C "$ROOT/origin" branch feature-a
git -C "$ROOT/origin" branch feature-b
git -C "$ROOT/cosmos" clone -q --bare "$ROOT/origin" .bare
echo "gitdir: ./.bare" > "$ROOT/cosmos/.git"
git -C "$ROOT/cosmos" worktree add -q feature-a feature-a
git -C "$ROOT/cosmos" worktree add -q feature-b feature-b
cd "$ROOT/cosmos"
echo "--- git worktree list";            git worktree list
echo "--- rev-parse --is-inside-work-tree"; git rev-parse --is-inside-work-tree; echo "exit=$?"
echo "--- rev-parse --is-bare-repository";  git rev-parse --is-bare-repository
echo "--- rev-parse --is-inside-git-dir";   git rev-parse --is-inside-git-dir
echo "--- rev-parse --git-dir";             git rev-parse --git-dir
echo "--- symbolic-ref --short HEAD";       git symbolic-ref --quiet --short HEAD
echo "--- rev-parse --verify HEAD";         git rev-parse --verify HEAD
echo "--- status --porcelain (fails in a bare repo)"; git status --porcelain || echo "exit=$?"
