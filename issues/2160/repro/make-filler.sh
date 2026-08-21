#!/usr/bin/env bash
# Usage: make-filler.sh [out-file]
# Writes ~150 KB (>20k tokens) of filler so that a manual /compact actually
# compacts. Pi's default keepRecentTokens is 20k; with a smaller history the
# compaction is a no-op and the "does /compact resync the model" test is moot.
OUT="${1:-/tmp/bb-2160-qa/filler.txt}"
mkdir -p "$(dirname "$OUT")"
python3 - "$OUT" <<'PY'
import sys
out = sys.argv[1]
lines = ["Do not reply to the text below, it is filler for a compaction test. Reply only with ok."]
for i in range(2000):
    lines.append(f"filler line {i:04d}: the quick brown fox jumps over the lazy dog near the river bank")
data = "\n".join(lines) + "\n"
open(out, "w").write(data)
print(out, "bytes:", len(data))
PY
