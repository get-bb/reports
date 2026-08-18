#!/bin/sh
# Issue #1120: the `npx bb-app@latest` path under a given npm, clean HOME.
# usage: 1120-npx.sh <label> <npx-binary>
set -u
label=$1; npxbin=$2
root=${ROOT:-/tmp/1120}
export HOME="$root/home-$label"; export npm_config_cache="$root/cache-$label"
rm -rf "$HOME" "$npm_config_cache" "$root/data-$label"; mkdir -p "$HOME" "$root/data-$label"
echo "== npx: $($npxbin --version)  node: $(node --version)  HOME=$HOME"
echo "== \$ BB_DATA_DIR=$root/data-$label BB_SERVER_PORT=39872 BB_HOST_DAEMON_PORT=39873 $npxbin --yes bb-app@latest   (30s timeout)"
BB_DATA_DIR="$root/data-$label" BB_SERVER_PORT=39872 BB_HOST_DAEMON_PORT=39873 timeout 30 $npxbin --yes bb-app@latest 2>&1 | grep -v deprecated | head -30
echo "== exit: $?"
