#!/bin/bash
# Usage: BB_REPO=<bb worktree root> ./1706-expA.sh <thread id>   (originally run on thr_p4k2xuzmqk)
T="${1:?usage: BB_REPO=<worktree> $0 <thread id>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BB="${BB:-$HERE/1706-bb.sh}"; export BB_REPO="${BB_REPO:?set BB_REPO to your bb worktree root}"
$BB thread tell $T "MARKER_A_IDLE_QUEUE reply only with ok" --mode queue
sleep 25
echo "=== log ==="; $BB thread log $T
echo "=== queue ==="; $BB thread queue list $T
