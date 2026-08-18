#!/bin/sh
# Issue #1120: does npm 10.9.9 (Node 22.x) choke on --allow-scripts /
# npm_config_allow_scripts, which it does not know? Tests the -g --prefix
# form bb's installer uses, plus a project-scoped install for completeness.
# usage: 1120-npm10-allow-scripts.sh   (env: ROOT, default /tmp/1120)
set -u
root=${ROOT:-/tmp/1120}
export HOME="$root/home-npm10"; export npm_config_cache="$root/cache"
mkdir -p "$HOME"
if [ ! -x "$root/npm10/node_modules/.bin/npm" ]; then
  echo "== \$ npm install --prefix $root/npm10 npm@10.9.9"
  npm install --prefix "$root/npm10" npm@10.9.9 2>&1 | tail -1
fi
npm10="$root/npm10/node_modules/.bin/npm"
echo "== npm10 version: $($npm10 --version)   node: $(node --version)   HOME=$HOME"
run() { echo "== \$ $*"; "$@" >"$root/.npm10-run.out" 2>&1; rc=$?; grep -v -e '^$' -e 'npm fund' -e 'looking for funding' -e 'npm notice' "$root/.npm10-run.out"; echo "== npm exit: $rc"; }
echo "--- global form (what install-machine.sh uses):"
rm -rf "$root/p10g"; mkdir -p "$root/p10g"
run "$npm10" install -g --prefix "$root/p10g" --allow-scripts=better-sqlite3,node-pty,@parcel/watcher better-sqlite3@12.10.0
ls "$root/p10g/lib/node_modules/better-sqlite3/build/Release/" 2>&1 | grep -c better_sqlite3.node | sed 's/^/== better_sqlite3.node present (1=yes): /'
echo "--- env form, global:"
rm -rf "$root/p10g"; mkdir -p "$root/p10g"
run env npm_config_allow_scripts=better-sqlite3,node-pty,@parcel/watcher "$npm10" install -g --prefix "$root/p10g" better-sqlite3@12.10.0
ls "$root/p10g/lib/node_modules/better-sqlite3/build/Release/" 2>&1 | grep -c better_sqlite3.node | sed 's/^/== better_sqlite3.node present (1=yes): /'
echo "--- project-scoped form (not what bb uses; for completeness):"
rm -rf "$root/p10"; mkdir -p "$root/p10"
run "$npm10" install --prefix "$root/p10" --allow-scripts=better-sqlite3 better-sqlite3@12.10.0
ls "$root/p10/node_modules/better-sqlite3/build/Release/" 2>&1 | grep -c better_sqlite3.node | sed 's/^/== better_sqlite3.node present (1=yes): /'
