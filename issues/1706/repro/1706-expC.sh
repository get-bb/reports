#!/bin/bash
# Experiment C: 3 concurrent queue-mode tells to an idle thread
# Usage: BB_REPO=<bb worktree root> ./1706-expC.sh <thread id>   (originally run on thr_p4k2xuzmqk)
T="${1:?usage: BB_REPO=<worktree> $0 <thread id>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
BB="${BB:-$HERE/1706-bb.sh}"; export BB_REPO="${BB_REPO:?set BB_REPO to your bb worktree root}"
$BB thread show $T --json | grep -E '"status"' | head -1
for i in 1 2 3; do
  ( $BB thread tell $T "MARKER_C$i concurrent queue send; reply only with ok" --mode queue > /tmp/1706-expC-$i.out 2>&1; echo "exit=$?" >> /tmp/1706-expC-$i.out ) &
done
wait
for i in 1 2 3; do echo "--- sender $i ---"; cat /tmp/1706-expC-$i.out; done
sleep 3
echo "=== queue right after ==="; $BB thread queue list $T
sleep 45
echo "=== log ==="; $BB thread log $T | tail -30
echo "=== queue ==="; $BB thread queue list $T
echo "=== events json (types) ==="; $BB thread log $T --format json --limit 40 | grep -E '"type"|MARKER_C' 
