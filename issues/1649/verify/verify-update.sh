#!/usr/bin/env bash
set -uo pipefail
export BB_SERVER_URL=http://localhost:21940
cd /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-60
B="node packages/scripts/dist/commands/run-cli.js"
ID=auto_ro70geba6_u; P=proj_wgc9efuctx
echo "--- update with --script-file"; $B automation update $ID --project $P --script-file /tmp/1649-src/hello.sh | head -3
$B automation run $ID --project $P; sleep 4
RUN=$($B automation runs $ID --project $P --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const r=(Array.isArray(j)?j:(j.runs??j.items))[0];console.log(r.id)})')
echo "--- output after update:"; $B automation runs $ID --project $P --output $RUN | grep -v '^\[bb\]' | tail -3
echo "--- sqlite:"; sqlite3 /home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-60-33959c7c98b0/plugins/automations/data.db "select id, execution from automations"
echo "--- relative path:"; BB_REPO=$PWD PROJECT=$P /tmp/bb-reports/issues/1649/repro/1649-relative-path.sh
