#!/bin/bash
# Simulates the environment bb hands to an agent shell when the host daemon
# inherited _VOLTA_TOOL_RECURSION=1 from a Volta-launched bb-app:
#   PATH = <host-daemon dist dir> : <user login-shell PATH>
#   BB_CLI = <host-daemon dist dir>/bb  (a "#!/usr/bin/env node" script)
# Requires the scratch Volta install from the report (VOLTA_HOME=/tmp/bb-1545-volta).
D="${1:?usage: $0 <path to apps/host-daemon/dist>}"
export VOLTA_HOME=/tmp/bb-1545-volta
export _VOLTA_TOOL_RECURSION=1
export PATH="$D:/tmp/bb-1545-volta/bin:/usr/local/bin:/usr/bin:/bin"
export BB_CLI="$D/bb"
run() { echo "\$ $*"; "$@"; echo "exit=$?"; echo; }
run head -1 "$BB_CLI"
run node --version
run "$BB_CLI" --version
run bb --version
run env -u _VOLTA_TOOL_RECURSION bb --version
