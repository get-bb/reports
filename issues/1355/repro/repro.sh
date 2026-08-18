set -e
cd /home/sawyer/projects/bb/.claude/worktrees/wf_debcf606-e4a-37
eval "$(scripts/bb-dev-app env)"
HOST=$(pnpm --silent bb:dev machine list --json 2>/dev/null | jq -r '.[0].id')
echo "HOST=$HOST"
PROJECT=$(curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/bb-1355-repo","hostId":"'$HOST'"}}' | jq -r '.id')
echo "PROJECT=$PROJECT"
SPAWN=$(pnpm --silent bb:dev thread spawn --project $PROJECT --provider claude-code --permission-mode accept-edits \
  --title "1355 stop hook C" \
  --prompt "Without using any tools, answer in about 6 short bullet points: what are the trade-offs between SQLite and Postgres for a single-user desktop app? End with one explicit question for me to decide." --json 2>/dev/null)
echo "$SPAWN"
THREAD=$(echo "$SPAWN" | jq -r '.thread.id // .id // .threadId')
echo "THREAD=$THREAD"
for i in $(seq 1 60); do
  if curl -s $BB_SERVER_URL/api/v1/threads/$THREAD | grep -q '"status":"idle"'; then break; fi
  sleep 2
done
echo "===== minimal"
node packages/scripts/dist/commands/run-cli.js thread log $THREAD | tee /tmp/bb-reports/issues/1355/repro/thread-c-log-minimal.txt
echo "===== verbose"
node packages/scripts/dist/commands/run-cli.js thread log $THREAD --format verbose | tee /tmp/bb-reports/issues/1355/repro/thread-c-log-verbose.txt
node packages/scripts/dist/commands/run-cli.js thread log $THREAD --format json > /tmp/bb-reports/issues/1355/repro/thread-c-events.json
echo "$PROJECT $THREAD" > /tmp/1355-ids.txt
