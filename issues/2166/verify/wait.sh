#!/bin/zsh
for i in $(seq 1 90); do
  if curl -sf http://localhost:22731/api/v1/projects >/dev/null 2>&1; then echo "ready after $i"; break; fi
  sleep 2
done
curl -s http://localhost:22731/api/v1/projects | head -c 300
