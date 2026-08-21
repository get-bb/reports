#!/bin/zsh
# Create a scratch git repo and a qa project on the verifier's dev instance.
set -u
cd /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-6
eval "$(scripts/bb-dev-app env)"
echo "BB_SERVER_URL=$BB_SERVER_URL"
mkdir -p /tmp/bb-2166-verify-repo
cd /tmp/bb-2166-verify-repo
[ -d .git ] || (git init -q && echo hi > README.md && git add . && git -c user.email=a@b -c user.name=qa commit -qm init)
cd /Users/sawyerhood/.bb-machines/bee.getbb.app/checkouts/bb/.claude/worktrees/wf_21e66a79-f02-6
pnpm bb:dev machine list 2>&1 | tail -5
HOST=$(curl -s $BB_SERVER_URL/api/v1/hosts | python3 -c "import json,sys; d=json.load(sys.stdin); d=d.get('hosts', d) if isinstance(d,dict) else d; print(d[0]['id'])")
echo "HOST=$HOST"
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' -d "{\"name\":\"qa-2166-verify\",\"source\":{\"type\":\"local_path\",\"path\":\"/tmp/bb-2166-verify-repo\",\"hostId\":\"$HOST\"}}"
echo
