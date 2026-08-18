#!/usr/bin/env bash
# Adjacent finding for #1649: plugin CLI code runs server-side and cli.ts does not
# resolve --script-file against the invoking CLI's cwd (ctx.cwd), so the
# documented form `--script-file ./watch.sh` fails with ENOENT.
# Usage: BB_REPO=... PROJECT=... ./1649-relative-path.sh
set -uo pipefail
: "${BB_REPO:?}"; : "${PROJECT:?}"
eval "$(cd "$BB_REPO" && scripts/bb-dev-app env)"
mkdir -p /tmp/1649-src && cd /tmp/1649-src
printf '#!/bin/sh\necho REL\n' > rel.sh
echo '$ cd /tmp/1649-src && bb automation create --project '"$PROJECT"' --name rel-test --cron "0 0 1 1 *" --timezone UTC --script-file ./rel.sh'
node "$BB_REPO/packages/scripts/dist/commands/run-cli.js" automation create --project "$PROJECT" --name rel-test --cron "0 0 1 1 *" --timezone UTC --script-file ./rel.sh
echo "exit=$?"
