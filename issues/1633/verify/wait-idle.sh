#!/bin/bash
T=$1
for i in $(seq 1 60); do
  n=$(curl -s "http://localhost:24406/api/v1/threads/$T/events?limit=200" | python3 -c "import json,sys;d=json.load(sys.stdin);evs=d.get('events',d) if isinstance(d,dict) else d;print(sum(1 for e in evs if e['type']=='turn/started'))")
  s=$(curl -s "http://localhost:24406/api/v1/threads/$T" | python3 -c "import json,sys;print(json.load(sys.stdin)['status'])")
  echo "$(date -u +%T) turns=$n status=$s"
  if [ "$n" = "2" ] && [ "$s" = "idle" ]; then echo IDLE_AFTER_TWO_TURNS; exit 0; fi
  sleep 3
done
echo TIMEOUT
