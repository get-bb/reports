#!/bin/sh
# Issue #1120 repro: install bb-app from the npm registry with different npm
# versions, using a clean HOME (no ~/.npmrc) and a private cache, then check
# whether the native add-ons were built.
#
# Env: ROOT (default /tmp/1120; each run downloads ~1 GB into ROOT/cache and
#      unpacks ~300 packages into ROOT/g-<label>; rm -rf ROOT when done),
#      BB_PORT (default 39871; must be free), BB_APP_VERSION (default latest).
#
# usage: 1120-install-matrix.sh <label> <npm-binary> [extra npm args...]
#   e.g. 1120-install-matrix.sh npm11 npm
#        1120-install-matrix.sh npm12 /tmp/1120/npm12/node_modules/.bin/npm
#        1120-install-matrix.sh npm12-allow /tmp/1120/npm12/node_modules/.bin/npm --allow-scripts=better-sqlite3,node-pty,@parcel/watcher,esbuild
set -u
label=$1; shift
npmbin=$1; shift
root=${ROOT:-/tmp/1120}
export HOME="$root/home-$label"
export npm_config_cache="$root/cache"
prefix="$root/g-$label"
rm -rf "$HOME" "$prefix"; mkdir -p "$HOME" "$prefix"
echo "== npm: $($npmbin --version)  node: $(node --version)  HOME=$HOME  prefix=$prefix"
echo "== ~/.npmrc present? $(test -e "$HOME/.npmrc" && echo yes || echo no)"
echo "== \$ $npmbin install -g --prefix $prefix bb-app@${BB_APP_VERSION:-latest} $*"
$npmbin install -g --prefix "$prefix" "bb-app@${BB_APP_VERSION:-latest}" "$@"
echo "== npm exit code: $?"
nm="$prefix/lib/node_modules/bb-app/node_modules"
echo "== installed bb-app version: $(node -p "require('$prefix/lib/node_modules/bb-app/package.json').version")"
for f in better-sqlite3/build/Release/better_sqlite3.node node-pty/build/Release/pty.node; do
  if [ -e "$nm/$f" ]; then echo "== PRESENT $f"; else echo "== MISSING $f"; fi
done
ls "$nm/@parcel/" 2>/dev/null | grep -c "^watcher-" | sed 's/^/== @parcel\/watcher-* prebuilt platform packages: /'
port=${BB_PORT:-39871}
# Refuse to run against a port that is already taken: otherwise curl would hit
# a stale server and the "HTTP 200" below would prove nothing.
if ss -ltn 2>/dev/null | grep -q ":$port "; then
  echo "== ERROR: port $port is already in use; set BB_PORT to a free port"; exit 2
fi
echo "== \$ BB_DATA_DIR=$root/data-$label BB_SERVER_PORT=$port $prefix/bin/bb-server   (background, then curl /api/v1/hosts after 6s)"
mkdir -p "$root/data-$label"
# setsid: bb-server (dist/bb-server.js) forks server/dist/index.js; killing
# only $! would leave the child listening. Kill the whole process group.
setsid env BB_DATA_DIR="$root/data-$label" BB_SERVER_PORT=$port "$prefix/bin/bb-server" >"$root/server-$label.log" 2>&1 &
spid=$!
sleep 6
echo "== curl http://127.0.0.1:$port/api/v1/hosts -> HTTP $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:$port/api/v1/hosts)"
pkill -TERM -g $spid 2>/dev/null; wait $spid 2>/dev/null
echo "== bb-server exit: $?"
pkill -TERM -f "$prefix/lib/node_modules/bb-app/" 2>/dev/null
sleep 1
echo "== still listening on :$port after kill? $(ss -ltn 2>/dev/null | grep -q ":$port " && echo yes || echo no)"
echo "== first 20 lines of bb-server stdout/stderr:"
head -20 "$root/server-$label.log"
