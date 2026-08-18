#!/usr/bin/env bash
# Build the old-WebKit test harness used by every wk-*.mjs / webkit-*.mjs script in
# this directory FROM SCRATCH (no root needed). Tested on Ubuntu 26.04 (resolute),
# Node 24. Takes ~5 min and ~1.2 GB (two WebKit builds + libs).
#
#   HARNESS   (env BB1603_HARNESS,           default /tmp/bb-1603-wk)        - npm deps, libs, scripts
#   BROWSERS  (env PLAYWRIGHT_BROWSERS_PATH,  default ~/.cache/ms-playwright) - Playwright browser cache
#
# What it does:
#   1. npm-installs playwright@1.27.1 (+ acorn, acorn-walk) into $HARNESS         -> webkit-1724 (Safari 16.0-era JSC)
#      npm-installs playwright@1.33.0 into $HARNESS/pw132                          -> webkit-1837 (Safari 16.4-era WebKit trunk)
#   2. `npx playwright install webkit` for both versions
#   3. Those builds were compiled for Ubuntu 22.04 (jammy). On a newer Ubuntu their
#      minibrowser-wpe binaries lack some shared libraries, so we download (a) the
#      host distro's own packages for the newer sonames via `apt-get download` and
#      (b) six jammy-only packages from archive.ubuntu.com, extract them with dpkg-deb
#      and copy the .so files into each build's minibrowser-wpe/sys/lib.
#   4. Moves the bundle's own glib 2.70 aside (system glib is needed by the system
#      libgudev/libmanette that get pulled in) - same as setup-old-webkit.sh.
#   5. Smoke-launches both engines and prints their user agents + feature support.
#
# Afterwards run scripts with:  bash run-old-webkit160.sh <script.mjs> [args]  (webkit-1724)
#                               bash run-webkit164.sh    <script.mjs> [args]  (webkit-1837)
# Both accept absolute or relative script paths (they copy the script next to the
# right node_modules so `import "playwright"` resolves to the right version).
set -euo pipefail
HARNESS=${BB1603_HARNESS:-/tmp/bb-1603-wk}
export PLAYWRIGHT_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
mkdir -p "$HARNESS/pw132" "$HARNESS/run" "$HARNESS/pw132/run" "$HARNESS/debs" "$HARNESS/olddebs" "$HARNESS/root" "$HARNESS/oldroot"
echo "== harness: $HARNESS   browsers: $PLAYWRIGHT_BROWSERS_PATH"

echo "== 1. npm deps"
( cd "$HARNESS" && { [ -f package.json ] || npm init -y >/dev/null; } && npm i --no-audit --no-fund playwright@1.27.1 acorn@8 acorn-walk@8 )
( cd "$HARNESS/pw132" && { [ -f package.json ] || npm init -y >/dev/null; } && npm i --no-audit --no-fund playwright@1.33.0 )
node -e 'const d=process.argv[1];console.log("playwright@"+require(d+"/node_modules/playwright/package.json").version, "webkit rev", require(d+"/node_modules/playwright-core/browsers.json").browsers.find(b=>b.name==="webkit").revision)' "$HARNESS"
node -e 'const d=process.argv[1];console.log("playwright@"+require(d+"/node_modules/playwright/package.json").version, "webkit rev", require(d+"/node_modules/playwright-core/browsers.json").browsers.find(b=>b.name==="webkit").revision)' "$HARNESS/pw132"

echo "== 2. download the two WebKit builds"
( cd "$HARNESS" && npx playwright install webkit )
( cd "$HARNESS/pw132" && npx playwright install webkit )
ls -d "$PLAYWRIGHT_BROWSERS_PATH"/webkit-1724 "$PLAYWRIGHT_BROWSERS_PATH"/webkit-1837

echo "== 3a. host-distro packages (newer sonames the old builds also need)"
# Package names as of Ubuntu 26.04; on another release adjust to whatever provides the same sonames.
HOST_PKGS="libabsl20260107 libavif16 libbacktrace0 libcairo-script-interpreter2 libegl-mesa0 libegl1 libenchant-2-2 libevent-2.1-7t64 libgav1-2 libgles2 libgraphene-1.0-0 libgstreamer-gl1.0-0 libgstreamer-plugins-bad1.0-0 libgstreamer-plugins-base1.0-0 libgstreamer-plugins-extra1.0-0 libgtk-4-1 libharfbuzz-icu0 libharfbuzz-subset0 libhidapi-hidraw0 libhyphen0 libmanette-0.2-0 liborc-0.4-0t64 libsecret-1-0 libsoup-3.0-0 libwayland-server0 libwebpdemux2 libyuv0"
( cd "$HARNESS/debs" && for p in $HOST_PKGS; do ls "$p"_*.deb >/dev/null 2>&1 || apt-get download "$p" || echo "WARN: could not download $p"; done )
for d in "$HARNESS"/debs/*.deb; do dpkg-deb -x "$d" "$HARNESS/root"; done

echo "== 3b. jammy-only packages (old sonames: libicu70, libsoup-2.4, libxml2.so.2 (2.9), libvpx7, libwoff1, libpcre3)"
JAMMY_PKGS="libicu70 libpcre3 libsoup2.4-1 libvpx7 libwoff1 libxml2"
[ -f "$HARNESS/jammy-Packages" ] || curl -sSL http://archive.ubuntu.com/ubuntu/dists/jammy/main/binary-amd64/Packages.gz | gunzip > "$HARNESS/jammy-Packages"
for pkg in $JAMMY_PKGS; do
  path=$(awk -v p="$pkg" '$1=="Package:"{cur=$2} $1=="Filename:" && cur==p {print $2}' "$HARNESS/jammy-Packages" | head -1)
  [ -n "$path" ] || { echo "NOT FOUND in jammy: $pkg"; exit 1; }
  f="$HARNESS/olddebs/$(basename "$path")"
  [ -f "$f" ] || curl -sSL -o "$f" "http://archive.ubuntu.com/ubuntu/$path"
  dpkg-deb -x "$f" "$HARNESS/oldroot"
  echo "ok $pkg -> $path"
done
mkdir -p "$HARNESS/oldroot/usr/lib/x86_64-linux-gnu" "$HARNESS/oldroot/lib/x86_64-linux-gnu"
cp -a --update=none "$HARNESS/root/usr/lib/x86_64-linux-gnu/." "$HARNESS/oldroot/usr/lib/x86_64-linux-gnu/"

echo "== 4. drop the libs into both WebKit bundles, move bundled glib 2.70 aside"
for NAME in webkit-1724 webkit-1837; do
  D=$PLAYWRIGHT_BROWSERS_PATH/$NAME/minibrowser-wpe
  mkdir -p "$D/sys/lib" "$HARNESS/glib-backup-$NAME"
  cp -a --update=none "$HARNESS/oldroot/usr/lib/x86_64-linux-gnu/." "$D/sys/lib/"
  cp -a --update=none "$HARNESS/oldroot/lib/x86_64-linux-gnu/." "$D/sys/lib/"
  for f in "$D"/sys/lib/libglib-2.0.so.0* "$D"/sys/lib/libgobject-2.0.so.0* "$D"/sys/lib/libgmodule-2.0.so.0* "$D"/sys/lib/libgio-2.0.so.0*; do
    [ -e "$f" ] && mv "$f" "$HARNESS/glib-backup-$NAME/" || true
  done
  echo "prepared $D ($(ls "$D/sys/lib" | wc -l) files in sys/lib)"
done

echo "== 5. smoke test both engines"
cat > "$HARNESS/run/ua.mjs" <<'JS'
import { webkit } from "playwright";
const b = await webkit.launch(); const p = await b.newPage();
console.log(await p.evaluate(() => navigator.userAgent), "| lookbehind:", await p.evaluate(() => { try { new RegExp("(?<=a)"); return "yes"; } catch { return "no"; } }), "| v flag:", await p.evaluate(() => { try { new RegExp("[a]", "v"); return "yes"; } catch { return "no"; } }));
await b.close();
JS
BB1603_HARNESS=$HARNESS bash "$HERE/run-old-webkit160.sh" "$HARNESS/run/ua.mjs"
BB1603_HARNESS=$HARNESS bash "$HERE/run-webkit164.sh" "$HARNESS/run/ua.mjs"
echo "== done. Use: BB1603_HARNESS=$HARNESS PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH bash run-old-webkit160.sh <script.mjs> ..."
