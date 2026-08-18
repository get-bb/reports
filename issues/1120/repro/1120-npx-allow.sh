#!/bin/sh
# Issue #1120: `npx bb-app@latest` under npm 12 WITH the allow-scripts flag.
set -u
label=npx12-allow; npxbin=${1:-/tmp/1120/npm12/node_modules/.bin/npx}
root=${ROOT:-/tmp/1120}
export HOME="$root/home-$label"; export npm_config_cache="$root/cache-$label"
rm -rf "$HOME" "$npm_config_cache" "$root/data-$label"; mkdir -p "$HOME" "$root/data-$label"
echo "== npx: $($npxbin --version)  node: $(node --version)  HOME=$HOME"
echo "== \$ BB_DATA_DIR=$root/data-$label BB_SERVER_PORT=39872 BB_HOST_DAEMON_PORT=39873 $npxbin --yes --allow-scripts=better-sqlite3,node-pty,@parcel/watcher bb-app@latest   (40s timeout)"
BB_DATA_DIR="$root/data-$label" BB_SERVER_PORT=39872 BB_HOST_DAEMON_PORT=39873 timeout 40 $npxbin --yes --allow-scripts=better-sqlite3,node-pty,@parcel/watcher bb-app@latest 2>&1 | grep -v deprecated | head -30
echo "== exit: $?"
