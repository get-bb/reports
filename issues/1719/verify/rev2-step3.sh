. /tmp/bb-reports/issues/1719/verify/rev2-env.sh
R=/tmp/bb-reports/issues/1719/repro
rm -rf /tmp/qa-1719; mkdir -p /tmp/qa-1719 && cd /tmp/qa-1719 && git init -q && echo hi > README.md && git add -A && git -c user.email=qa@x -c user.name=qa commit -qm init
cd $WT
HOST=$($BBCLI machine list --json 2>/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
echo HOST=$HOST
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/qa-1719","hostId":"'$HOST'"}}' | tee $R/project-create.json; echo
PROJ=$(python3 -c 'import json;print(json.load(open("'$R'/project-create.json"))["id"])')
echo PROJ=$PROJ
# Variant 1: opencode write permission (kind edit, title = file path)
$BBCLI thread spawn --project $PROJ --provider acp-fakeopencodewrite --permission-mode accept-edits --title "1719 repro (write permission)" --prompt "opencode-write please" --json 2>/dev/null > $R/spawn.json
cat $R/spawn.json
# Variant 2: opencode external_directory permission (kind other, title = bare parent dir)
$BBCLI thread spawn --project $PROJ --provider acp-fakeopencode --permission-mode accept-edits --title "1719 repro (external_directory permission)" --prompt "opencode-write please" --json 2>/dev/null > $R/spawn-external-directory.json
cat $R/spawn-external-directory.json
