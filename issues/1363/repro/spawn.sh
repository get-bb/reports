#!/bin/bash
# Usage: (cd <bb worktree> && bash spawn.sh <provider> <count> <name-prefix>)
# Spawns <count> threads on the "qa" project of THIS worktree's dev instance
# with a tiny prompt and waits for each to go idle. Creates the qa project on
# first use (local path /tmp/bb-1363-qa, a scratch git repo).
source "$(dirname "$0")/env.sh" || exit 1
PROVIDER=$1; COUNT=$2; PREFIX=$3
HOST=$(bb_host_id)
if [ -z "$HOST" ]; then echo "no host enrolled on $BB_SERVER_URL (is the dev instance running?)" >&2; exit 1; fi
find_project() { curl -s "$BB_SERVER_URL/api/v1/projects" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const p=JSON.parse(s).find(p=>p.name==="qa");console.log(p?p.id:"")})'; }
PROJECT=$(find_project)
if [ -z "$PROJECT" ]; then
  if [ ! -d /tmp/bb-1363-qa/.git ]; then
    mkdir -p /tmp/bb-1363-qa
    git -C /tmp/bb-1363-qa init -q
    git -C /tmp/bb-1363-qa commit -q --allow-empty -m init
  fi
  curl -s -X POST "$BB_SERVER_URL/api/v1/projects" -H 'content-type: application/json' \
    -d "{\"name\":\"qa\",\"source\":{\"type\":\"local_path\",\"path\":\"/tmp/bb-1363-qa\",\"hostId\":\"$HOST\"}}" >/dev/null
  PROJECT=$(find_project)
fi
echo "server=$BB_SERVER_URL host=$HOST project=$PROJECT"
for i in $(seq ${START:-1} $COUNT); do
  echo "== spawn $PREFIX-$i ($PROVIDER) $(date -u +%H:%M:%S)"
  bb thread spawn --project $PROJECT --provider $PROVIDER --permission-mode accept-edits --machine $HOST --title "$PREFIX-$i" --prompt "Reply only with ok." 2>&1 | head -c 400; echo
done
# wait for all threads idle
for n in $(seq 1 60); do
  ACTIVE=$(curl -s "$BB_SERVER_URL/api/v1/threads?limit=100" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const t=JSON.parse(s);console.log(t.filter(x=>x.status!=="idle"&&x.status!=="error"&&!x.archivedAt).map(x=>x.id+":"+x.status).join(","))})')
  if [ -z "$ACTIVE" ]; then echo "all idle at $(date -u +%H:%M:%S)"; break; fi
  echo "waiting: $ACTIVE"; sleep 5
done
