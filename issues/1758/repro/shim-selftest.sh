#!/usr/bin/env bash
# Sanity check for the gh shim: offline mode must fail auth status, online must pass.
set -u
chmod +x /tmp/bb-reports/issues/1758/repro/fakebin/gh
export PATH=/tmp/bb-reports/issues/1758/repro/fakebin:$PATH
echo "which gh -> $(command -v gh)"
echo "== OFFLINE =="
touch /tmp/bb-reports/issues/1758/repro/gh-offline
gh auth status; echo "exit=$?"
echo "== ONLINE =="
rm -f /tmp/bb-reports/issues/1758/repro/gh-offline
gh auth status | head -2; echo "exit=${PIPESTATUS[0]}"
echo "== call log =="
cat /tmp/bb-reports/issues/1758/repro/gh-calls.log
