#!/bin/bash
T=$1
until /tmp/1647-bb.sh thread show $T --json 2>/dev/null | grep -q '"environmentId": "env'; do sleep 2; done
ENV=$(/tmp/1647-bb.sh thread show $T --json | grep -o '"environmentId": "env_[a-z0-9]*"' | head -1 | cut -d'"' -f4)
echo "ENV=$ENV"
until [ -n "$(pgrep -f 'sleep 90')" ]; do sleep 2; done
WS=$(/tmp/1647-bb.sh environment show $ENV --json | grep '"path"' | head -1 | cut -d'"' -f4)
echo "WS=$WS"
/tmp/1647-procs.sh "$WS"
