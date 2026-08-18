#!/usr/bin/env bash
# PATH shim for reproducing get-bb/bb#1646: `codex app-server` is replaced by a
# scripted fake; every other codex invocation goes to the real binary.
# Install as /tmp/bb-1646/bin/codex and prepend /tmp/bb-1646/bin to PATH before
# starting the bb dev instance.
if [[ "${1:-}" == "app-server" ]]; then
  exec node /tmp/bb-reports/issues/1646/repro/fake-codex-app-server.mjs /tmp/bb-reports/issues/1646/repro/script-1646.json
fi
exec /home/sawyer/.local/bin/codex "$@"
