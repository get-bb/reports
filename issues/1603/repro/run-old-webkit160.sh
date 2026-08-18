#!/usr/bin/env bash
# Run a node script against Playwright 1.27.1 + webkit-1724 (Safari 16.0-era JSC:
# no regex lookbehind, no class static blocks, no RegExp v flag).
# Usage: bash run-old-webkit160.sh <script.mjs> [args...]
# The harness comes from setup-harness.sh (env BB1603_HARNESS, default /tmp/bb-1603-wk;
# set PLAYWRIGHT_BROWSERS_PATH too if the browsers are not in ~/.cache/ms-playwright).
# The script may be an absolute path: it is copied into $HARNESS/run/ so that
# `import "playwright"` resolves to the harness's playwright@1.27.1.
HARNESS=${BB1603_HARNESS:-/tmp/bb-1603-wk}
SCRIPT=${1:?script.mjs}; shift
if [ -f "$SCRIPT" ]; then mkdir -p "$HARNESS/run"; [ "$(realpath "$SCRIPT")" = "$(realpath -m "$HARNESS/run/$(basename "$SCRIPT")")" ] || cp -f "$SCRIPT" "$HARNESS/run/"; SCRIPT="$HARNESS/run/$(basename "$SCRIPT")"; fi
cd "$HARNESS"
export PLAYWRIGHT_SKIP_BROWSER_GC=1
export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1
export __EGL_VENDOR_LIBRARY_DIRS=$HARNESS/root/usr/share/glvnd/egl_vendor.d
export LIBGL_ALWAYS_SOFTWARE=1
node "$SCRIPT" "$@" 2>&1 | grep -v "libEGL debug\|libproxy"
