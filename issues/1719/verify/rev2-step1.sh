. /tmp/bb-reports/issues/1719/verify/rev2-env.sh
for i in $(seq 1 30); do curl -sf $BB_SERVER_URL/api/v1/machines >/dev/null && break; sleep 2; done
ls $DD
echo "--- existing config:"; cat $DD/config.json 2>/dev/null; echo
curl -s $BB_SERVER_URL/api/v1/machines | head -c 600; echo
