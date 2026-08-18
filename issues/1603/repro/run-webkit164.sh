#!/usr/bin/env bash
# Run a node script against Playwright 1.33.0 + webkit-1837 (Safari 16.4-era WebKit
# trunk: has lookbehind and, unlike shipping Safari 16.4-16.6, already the RegExp v flag).
# Usage: bash run-webkit164.sh <script.mjs> [args...]
# The harness comes from setup-harness.sh (env BB1603_HARNESS, default /tmp/bb-1603-wk;
# set PLAYWRIGHT_BROWSERS_PATH too if the browsers are not in ~/.cache/ms-playwright).
# The script may be an absolute path: it is copied into $HARNESS/pw132/run/ so that
# `import "playwright"` resolves to playwright@1.33.0.
HARNESS=${BB1603_HARNESS:-/tmp/bb-1603-wk}
SCRIPT=${1:?script.mjs}; shift
if [ -f "$SCRIPT" ]; then mkdir -p "$HARNESS/pw132/run"; [ "$(realpath "$SCRIPT")" = "$(realpath -m "$HARNESS/pw132/run/$(basename "$SCRIPT")")" ] || cp -f "$SCRIPT" "$HARNESS/pw132/run/"; SCRIPT="$HARNESS/pw132/run/$(basename "$SCRIPT")"; fi
cd "$HARNESS/pw132"
export PLAYWRIGHT_SKIP_BROWSER_GC=1
export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1
export __EGL_VENDOR_LIBRARY_DIRS=$HARNESS/root/usr/share/glvnd/egl_vendor.d
export LIBGL_ALWAYS_SOFTWARE=1
node "$SCRIPT" "$@" 2>&1 | grep -v "libEGL debug\|libproxy"
