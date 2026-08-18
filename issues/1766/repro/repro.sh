#!/usr/bin/env bash
# CLI-level repro for get-bb/bb#1766 against a bb dev instance.
# Usage: BB_SERVER_URL=http://localhost:19232 bash /tmp/bb1766/repro.sh
set -u
cd /home/sawyer/projects/bb/.claude/worktrees/wf_debcf606-e4a-1
BB="node packages/scripts/dist/commands/run-cli.js"
run() { echo "\$ bb $*"; $BB "$@"; echo "[exit $?]"; echo; }

echo "=== 1. Install the local plugin from checkout A and tune its settings ==="
run plugin install --yes path:/tmp/bb1766/checkout-a
run plugin config watchdog set alertFloorMinutes 1
run plugin config watchdog set staleWindowMinutes 3
run plugin config watchdog set token s3cret
run plugin config watchdog

echo "=== 2. Reload keeps settings (control) ==="
run plugin reload watchdog
run plugin config watchdog

echo "=== 3. Try to install the same plugin id from a NEW checkout (B): refused ==="
run plugin install --yes path:/tmp/bb1766/checkout-b

echo "=== 4. Follow the error's advice: remove, then install from B ==="
run plugin remove watchdog
run plugin install --yes path:/tmp/bb1766/checkout-b

echo "=== 5. Settings are back to defaults; plugin reports healthy ==="
run plugin config watchdog
run plugin list
