#!/usr/bin/env bash
set -u
V=/tmp/bb-reports/issues/1758/verify
export PATH=$V/fakebin:$PATH
echo "which gh -> $(command -v gh)"
echo "== OFFLINE =="
touch $V/gh-offline
time gh auth status; echo "exit=$?"
echo "== ONLINE =="
rm -f $V/gh-offline
time gh auth status 2>&1 | head -2
echo "== call log =="
cat $V/gh-calls.log
