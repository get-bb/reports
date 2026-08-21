#!/bin/bash
# Usage: wait-server.sh <server-url>
for i in $(seq 1 60); do
  if curl -sf "$1/api/v1/hosts" | grep -q '"connected"'; then echo "server+host up after $i polls"; exit 0; fi
  sleep 2
done
echo "server not up"; exit 1
