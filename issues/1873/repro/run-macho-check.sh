#!/bin/bash
# Regenerates macho-weak-syms-output.log.
# Usage: run-macho-check.sh <repo-root> <dir containing package/watcher.node and node-pty-beta/package>
#   (prepare that dir with: npm pack @parcel/watcher-darwin-arm64@2.5.6 && tar xzf parcel-watcher-darwin-arm64-2.5.6.tgz
#                           mkdir node-pty-beta && cd node-pty-beta && npm pack node-pty@1.2.0-beta.15 && tar xzf node-pty-1.2.0-beta.15.tgz)
set -u
repo="${1:?repo root}"
packdir="${2:?pack dir}"
here="$(cd "$(dirname "$0")" && pwd)"
cd "$packdir" || exit 2
{
  python3 "$here/macho-weak-syms.py" 'CallbackData.*Wrapper' \
    "$repo/apps/host-daemon/node_modules/node-pty/prebuilds/darwin-arm64/pty.node" \
    package/watcher.node
  python3 "$here/macho-weak-syms.py" 'CallbackData.*Wrapper' \
    node-pty-beta/package/prebuilds/darwin-arm64/pty.node
} 2>&1 | sed "s#$repo#<repo>#g" > "$here/macho-weak-syms-output.log"
cat "$here/macho-weak-syms-output.log"
