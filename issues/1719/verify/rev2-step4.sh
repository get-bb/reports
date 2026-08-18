. /tmp/bb-reports/issues/1719/verify/rev2-env.sh
R=/tmp/bb-reports/issues/1719/repro
sleep 6
T1=thr_aqrjgmjtqa; T2=thr_isrbv6ddiw
curl -s $BB_SERVER_URL/api/v1/threads/$T1/interactions | python3 -m json.tool > $R/interactions-pending.json
curl -s $BB_SERVER_URL/api/v1/threads/$T2/interactions | python3 -m json.tool > $R/interactions-pending-external-directory.json
curl -s "$BB_SERVER_URL/api/v1/threads/$T1/events" > $R/events-before-approval.json
curl -s "$BB_SERVER_URL/api/v1/threads/$T2/events" > $R/events-external-directory-before-approval.json
echo "=== write variant"; python3 -c 'import json;print(json.dumps(json.load(open("'$R'/interactions-pending.json"))[0]["payload"],indent=1))'
echo "=== external_directory variant"; python3 -c 'import json;print(json.dumps(json.load(open("'$R'/interactions-pending-external-directory.json"))[0]["payload"],indent=1))'
$BBCLI thread interactions list $T1 2>/dev/null > $R/cli-interactions-list-bug.txt; cat $R/cli-interactions-list-bug.txt
$BBCLI thread interactions list $T2 2>/dev/null > $R/cli-interactions-list-external-directory-bug.txt; cat $R/cli-interactions-list-external-directory-bug.txt
