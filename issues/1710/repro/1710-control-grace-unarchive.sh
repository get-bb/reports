#!/bin/bash
# Control for #1710: archive + unarchive INSIDE the 5-minute grace window is
# lossless (environment retiring -> ready, follow-up works).
# Usage: BB_REPO=... ./1710-control-grace-unarchive.sh <project id>
set -u
: "${BB_REPO:?set BB_REPO}"
PROJECT="${1:?project id}"
BB="$(dirname "$0")/1710-bb.sh"
eval "$("$BB_REPO/scripts/bb-dev-app" env)"
T=$("$BB" thread spawn --project "$PROJECT" --new-environment worktree --provider codex --permission-mode accept-edits --title "1710 control" --prompt "Reply only with ok." --json | jq -r .id)
echo "thread=$T"
"$BB" thread wait "$T" --timeout 180 | tail -1
ENV=$("$BB" thread show "$T" --json | jq -r .environment.id)
echo "\$ bb thread archive $T"; "$BB" thread archive "$T"
echo "env status after archive: $(curl -s "$BB_SERVER_URL/api/v1/environments/$ENV" | jq -r .status)"
echo "\$ bb thread unarchive $T   (a few seconds later, inside the grace window)"; "$BB" thread unarchive "$T"
echo "env status after unarchive: $(curl -s "$BB_SERVER_URL/api/v1/environments/$ENV" | jq -r .status)"
echo "\$ bb thread tell $T 'Reply only with ok again.'"; "$BB" thread tell "$T" "Reply only with ok again."; echo "exit=$?"
"$BB" thread wait "$T" --timeout 180 | tail -1
"$BB" thread log "$T" | tail -6
