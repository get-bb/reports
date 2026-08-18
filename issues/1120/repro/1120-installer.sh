#!/bin/sh
# Issue #1120: run the real "Add machine" installer (GET <server>/install.sh)
# against a bb server, with a chosen npm first on PATH, clean HOME, and no
# service installation (BB_INSTALL_SKIP_SERVICE=1). The daemon that the
# installer starts is killed at the end.
#
# usage: BB_SERVER_URL=http://localhost:24167 1120-installer.sh <label> <dir-containing-npm-binary>
#   e.g. ... 1120-installer.sh inst-npm12 /tmp/1120/npm12/node_modules/.bin
#        ... 1120-installer.sh inst-npm11 "$(dirname "$(command -v npm)")"
set -u
label=$1; npmdir=$2
root=${ROOT:-/tmp/1120}
server=${BB_SERVER_URL:?set BB_SERVER_URL}
export HOME="$root/home-$label"; export npm_config_cache="$root/cache-$label"
export BB_DATA_DIR="$root/machine-$label"; export BB_INSTALL_SKIP_SERVICE=1
export PATH="$npmdir:$PATH"; export NO_COLOR=1
rm -rf "$HOME" "$BB_DATA_DIR" "$npm_config_cache"; mkdir -p "$HOME" "$BB_DATA_DIR"
echo "== npm on PATH: $(command -v npm) -> $(npm --version); node $(node --version); HOME=$HOME; BB_DATA_DIR=$BB_DATA_DIR"
jc=$(curl -s -X POST "$server/api/v1/hosts/join-codes" -H 'content-type: application/json' -d '{}')
echo "== join code response: $jc"
join_code=$(printf '%s' "$jc" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).joinCode')
host_id=$(printf '%s' "$jc" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).hostId')
echo "== \$ curl -fsSL $server/install.sh | sh -s -- --join-code <code> --host-id $host_id --server $server"
curl -fsSL "$server/install.sh" | sh -s -- --join-code "$join_code" --host-id "$host_id" --server "$server"
echo "== installer exit: $?"
nm="$BB_DATA_DIR/npm/lib/node_modules/bb-app/node_modules"
for f in better-sqlite3/build/Release/better_sqlite3.node node-pty/build/Release/pty.node; do
  if [ -e "$nm/$f" ]; then echo "== PRESENT $f"; else echo "== MISSING $f"; fi
done
echo "== install-join.log:"; sed -n 1,12p "$BB_DATA_DIR/install-join.log" 2>/dev/null
if [ -f "$BB_DATA_DIR/install-daemon.pid" ]; then kill "$(cat "$BB_DATA_DIR/install-daemon.pid")" 2>/dev/null; echo "== killed temporary daemon"; fi
echo "== host status on server:"; curl -s "$server/api/v1/hosts/$host_id" | head -c 300; echo
