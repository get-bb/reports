#!/usr/bin/env bash
# Usage: run-all.sh <label> <thread url> <loadAll true|false> [hook true|false]
# Runs db-all.js on a fresh dev-browser page and copies the JSON next to this script.
set -euo pipefail
label="$1"; url="$2"; loadAll="$3"; hook="${4:-true}"
here="$(cd "$(dirname "$0")" && pwd)"
tmp="$HOME/.dev-browser/tmp"
mkdir -p "$tmp"
page="a-${label}-$(date +%s)"
printf '{"pageName":"%s","url":"%s","loadAll":%s,"hook":%s,"text":"The quick brown fox jumps over the lazy dog and keeps typing more words","out":"1304-all-%s.json","shot":"1304-all-%s.png"}\n' "$page" "$url" "$loadAll" "$hook" "$label" "$label" > "$tmp/1304-cfg.json"
dev-browser --browser wf1304v --headless --idle-timeout 30m --timeout 600 run "$here/db-all.js" > "$here/1304-all-${label}.log" 2>&1 || true
cp "$tmp/1304-all-${label}.json" "$here/1304-all-${label}.json" 2>/dev/null && cp "$tmp/1304-all-${label}.png" "$here/1304-${label}.png" 2>/dev/null || { echo "no output"; tail -20 "$here/1304-all-${label}.log"; exit 1; }
python3 - "$here/1304-all-${label}.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
print(sys.argv[1].split('/')[-1], d['mounted'], 'commits',d['commits'],'rendered/key',d['renderedFibersPerKey'],'cpu/key',d['cpuBusyPerKeyMs'],'overhead/key',d['overheadPerKeyMs'],'long',d['longTasks'],'metrics',d.get('metricsDelta'))
print(' named:',d['namedSelfMs'])
print(' probes:',d['probes'])
print(' providers:',[(k,v['changes'],v['subtree']) for k,v in d['changedProviders']])
print(' markdown/timeline rendered:',d['renderedMarkdown'][:12])
PY
