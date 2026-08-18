# Source this from the bb repo root before running the other scripts:
#   source /tmp/bb-reports/issues/1768/repro/00-env.sh
# It clears thread-scoped env vars that a shell inherits when it runs inside
# another bb thread (BB_THREAD_ID, BB_ENVIRONMENT_ID, ...) -- with those set,
# `bb thread spawn` fails with "HTTP 404: Host not found" against a different
# server -- and points the CLI at YOUR dev instance (edit the ports to match
# what `scripts/bb-dev-app current` printed; `eval "$(scripts/bb-dev-app env)"`
# does the same thing).
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_PROJECT_ID BB_CLI
export BB_SERVER_URL="${BB_SERVER_URL_1768:-http://localhost:20608}"
export BB_HOST_DAEMON_PORT="${BB_HOST_DAEMON_PORT_1768:-28608}"
export CLI="node $(pwd)/packages/scripts/dist/commands/run-cli.js"
export OUT_DIR=/tmp/bb-reports/issues/1768/repro
