#!/bin/sh
# Usage: query-paths.sh <server-url> <project-id>
# Queries the project path search (which goes through host.list_paths) for a few
# strings and prints what comes back. Expected after the fix: ".github/workflows/ci.yml"
# shows up for "ci.yml" and "workflows".
SERVER="$1"
PROJECT="$2"
for q in ci.yml workflows .env AGENTS.md; do
  printf 'query=%-10s -> ' "\"$q\""
  curl -s "$SERVER/api/v1/projects/$PROJECT/paths?query=$q&limit=10&includeFiles=true&includeDirectories=true" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d["paths"]), "results:", [p["path"] for p in d["paths"]], "truncated=%s" % d["truncated"])'
done
printf 'no query (full listing) -> '
curl -s "$SERVER/api/v1/projects/$PROJECT/paths?limit=10&includeFiles=true&includeDirectories=true" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(len(d["paths"]), "results:", [p["path"] for p in d["paths"]], "truncated=%s" % d["truncated"])'
printf 'read .github/workflows/ci.yml via files.read -> '
curl -s -X POST "$SERVER/api/v1/files/read" -H 'content-type: application/json' \
  -d '{"hostId":"'"$3"'","path":"/tmp/bb-2093-qa-repo/.github/workflows/ci.yml"}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print("OK" if "content" in d else d, "sizeBytes=%s" % d.get("sizeBytes"), "sha256=%s" % str(d.get("sha256"))[:12])'
