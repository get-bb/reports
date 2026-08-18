. /tmp/bb-reports/issues/1719/verify/rev2-env.sh
cp /tmp/bb-reports/issues/1719/repro/config.json $DD/config.json
curl -s -X POST $BB_SERVER_URL/api/v1/system/config/reload; echo
$BBCLI provider list 2>&1 | tail -12
$BBCLI machine list --json 2>/dev/null | head -c 500; echo
