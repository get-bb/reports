#!/usr/bin/env bash
# Repro for get-bb/bb#1747, claim 1: "npx bb-app@latest pins to ^0.35.1 and can
# never reach a newer minor". Uses an isolated npm cache so ~/.npm is untouched.
# Expected (npm 7+, verified on npm 11.16.0 / node 24.18.0): the second
# `npx bb-app@latest` re-resolves the `latest` dist-tag and reinstalls 0.38.0
# even though the cache entry says "^0.35.1".
set -euo pipefail
export npm_config_cache=/tmp/bb-1747-npx/npm-cache npm_config_update_notifier=false
HASH=$(node -e 'console.log(require("crypto").createHash("sha512").update("bb-app@latest").digest("hex").slice(0,16))')
DIR="$npm_config_cache/_npx/$HASH"
mkdir -p /tmp/bb-1747-npx && cd /tmp/bb-1747-npx

echo "== 1. fresh: npx bb-app@latest (writes the cache entry)"
npx -y bb-app@latest help >/dev/null
cat "$DIR/package.json"; grep '"version"' "$DIR/node_modules/bb-app/package.json"

echo "== 2. simulate a cache created when latest was 0.35.1 (exactly the reporter's entry)"
npm install --prefix "$DIR" --no-audit --no-fund bb-app@0.35.1 >/dev/null 2>&1
cat "$DIR/package.json"; grep '"version"' "$DIR/node_modules/bb-app/package.json"

echo "== 3. run npx bb-app@latest again against that entry"
npx -y --loglevel=http bb-app@latest help > /tmp/bb-1747-npx/step3.log 2>&1; grep -E "http (fetch|cache) .*registry.npmjs.org/bb-app " /tmp/bb-1747-npx/step3.log
cat "$DIR/package.json"; grep '"version"' "$DIR/node_modules/bb-app/package.json"
echo "If step 3 shows 0.38.0 the 'hard pin' claim is refuted for this npm."
