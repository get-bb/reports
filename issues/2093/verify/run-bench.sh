#!/bin/sh
# Verifier: run both benches from the host-daemon package dir of worktree $1.
cd "$1/apps/host-daemon" || exit 2
echo "# walker"
pnpm exec tsx /tmp/bb-reports/issues/2093/verify/bench-list-paths.mts ~/podcast ~/browser-use ~/mcp-client
echo "# listHostPaths(~/browser-use, config)"
pnpm exec tsx /tmp/bb-reports/issues/2093/verify/bench-list-host-paths.mts ~/browser-use config
