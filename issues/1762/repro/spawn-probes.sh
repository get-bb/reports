#!/usr/bin/env bash
# Spawns one thread per provider that calls the image_probe tool and reports
# what it received. Usage: spawn-probes.sh <bb-cli.js path> [providers...]
set -u
BB="$1"; shift
PROVIDERS=("$@")
[ ${#PROVIDERS[@]} -eq 0 ] && PROVIDERS=(claude-code codex pi)
P="Call the image_probe tool exactly once with no arguments. Then reply with ONLY the exact raw content of the tool result you received: if it was text, quote it verbatim; if it was an image, say IMAGE and name its dominant colour. Do not call any other tools."
node "$BB" plugin reload imageprobe 2>&1 | tail -2
for prov in "${PROVIDERS[@]}"; do
  id=$(node "$BB" thread spawn --project proj_personal --provider "$prov" --permission-mode accept-edits \
       --title "1762 $prov image_probe" --prompt "$P" --json 2>&1 | grep -m1 '"id"' | sed 's/.*"id": "\([^"]*\)".*/\1/')
  echo "$prov $id"
done
