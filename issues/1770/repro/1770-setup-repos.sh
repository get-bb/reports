#!/usr/bin/env bash
# Issue #1770 repro, step 1: build a project checkout that is 1 commit behind
# its remote. Creates:
#   /tmp/1770-remote.git  bare "origin"
#   /tmp/1770-qa          local checkout (the bb project source), at commit A
#   /tmp/1770-other       a second clone that pushes commit B to origin/main
# Afterwards /tmp/1770-qa's local main == A, origin/main (on the remote) == B.
set -euo pipefail
rm -rf /tmp/1770-remote.git /tmp/1770-qa /tmp/1770-other
git init -q --bare /tmp/1770-remote.git
git init -q -b main /tmp/1770-qa
git -C /tmp/1770-qa config user.name "BB QA"
git -C /tmp/1770-qa config user.email qa@example.com
echo hello > /tmp/1770-qa/README.md
git -C /tmp/1770-qa add . && git -C /tmp/1770-qa commit -qm "A: initial"
git -C /tmp/1770-qa remote add origin /tmp/1770-remote.git
git -C /tmp/1770-qa push -qu origin main
git -C /tmp/1770-qa remote set-head origin main   # so origin/HEAD -> main like a normal clone

git clone -q /tmp/1770-remote.git /tmp/1770-other
git -C /tmp/1770-other config user.name "Someone Else"
git -C /tmp/1770-other config user.email other@example.com
echo remote > /tmp/1770-other/remote.txt
git -C /tmp/1770-other add . && git -C /tmp/1770-other commit -qm "B: pushed by someone else"
git -C /tmp/1770-other push -q origin main

echo "local  main        $(git -C /tmp/1770-qa rev-parse main)   (A)"
echo "local  origin/main $(git -C /tmp/1770-qa rev-parse origin/main)   (A: stale remote-tracking ref, no fetch yet)"
echo "remote main        $(git -C /tmp/1770-remote.git rev-parse main)   (B)"
