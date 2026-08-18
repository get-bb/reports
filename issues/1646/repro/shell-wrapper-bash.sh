#!/bin/bash
# Login-shell wrapper so the bb host daemon's user-shell PATH probe (which runs
# `$SHELL -ilc '...'` and REPLACES the inherited PATH with the result) reports
# the #1646 codex shim directory first. Install as /tmp/bb-1646/shell/bash and
# start the dev instance with SHELL=/tmp/bb-1646/shell/bash.
args=("$@")
last="${args[${#args[@]}-1]}"
unset 'args[${#args[@]}-1]'
exec /bin/bash "${args[@]}" "export PATH=/tmp/bb-1646/bin:\$PATH; $last"
