. /tmp/bb-reports/issues/1719/verify/rev2-env.sh
R=/tmp/bb-reports/issues/1719/repro
for i in $(seq 1 40); do curl -sf $BB_SERVER_URL/api/v1/machines >/dev/null && break; sleep 2; done
# wait for host to reconnect
for i in $(seq 1 40); do curl -s $BB_SERVER_URL/api/v1/machines | grep -q '"connected"' && break; sleep 2; done
curl -s $BB_SERVER_URL/api/v1/machines | grep -o '"status":"[a-z]*"'
$BBCLI provider list 2>/dev/null | grep -c fakeopencode
$BBCLI thread spawn --project proj_eyzm33avat --machine host_7hwmtt9fc5 --provider acp-fakeopencodewrite --permission-mode accept-edits --title "1719 with fix (write permission)" --prompt "opencode-write please" --json 2>/dev/null > $R/spawn-with-fix.json
$BBCLI thread spawn --project proj_eyzm33avat --machine host_7hwmtt9fc5 --provider acp-fakeopencode --permission-mode accept-edits --title "1719 with fix (external_directory permission)" --prompt "opencode-write please" --json 2>/dev/null > $R/spawn-with-fix-external-directory.json
T1=$(python3 -c 'import json;print(json.load(open("'$R'/spawn-with-fix.json"))["id"])')
T2=$(python3 -c 'import json;print(json.load(open("'$R'/spawn-with-fix-external-directory.json"))["id"])')
echo T1=$T1 T2=$T2
sleep 8
curl -s $BB_SERVER_URL/api/v1/threads/$T1/interactions | python3 -m json.tool > $R/interactions-pending-with-fix.json
curl -s $BB_SERVER_URL/api/v1/threads/$T2/interactions | python3 -m json.tool > $R/interactions-pending-with-fix-external-directory.json
curl -s "$BB_SERVER_URL/api/v1/threads/$T1/events" > $R/events-with-fix-before-approval.json
curl -s "$BB_SERVER_URL/api/v1/threads/$T2/events" > $R/events-with-fix-external-directory-before-approval.json
echo "=== write variant"; python3 -c 'import json;print(json.dumps(json.load(open("'$R'/interactions-pending-with-fix.json"))[0]["payload"],indent=1))'
echo "=== external_directory variant"; python3 -c 'import json;print(json.dumps(json.load(open("'$R'/interactions-pending-with-fix-external-directory.json"))[0]["payload"],indent=1))'
$BBCLI thread interactions list $T1 2>/dev/null | tee $R/cli-interactions-list-with-fix.txt
$BBCLI thread interactions list $T2 2>/dev/null | tee $R/cli-interactions-list-with-fix-external-directory.txt
