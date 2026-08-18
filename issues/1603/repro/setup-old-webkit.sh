#!/usr/bin/env bash
# Make an old Playwright WebKit build (jammy-era, e.g. webkit-1724 = Safari 16.0,
# webkit-1837 = Safari 16.4) runnable on a newer Ubuntu without root:
#  - copy the jammy runtime libs (downloaded via fetch-jammy.sh into
#    /tmp/bb-1603-wk/oldroot) into the bundle's sys/lib
#  - move the bundle's own glib 2.70 aside so the system glib is used
#    (system libgudev/libmanette need a newer glib)
# Usage: setup-old-webkit.sh <webkit-NNNN>
set -e
NAME=${1:?webkit dir name, e.g. webkit-1837}
D=$HOME/.cache/ms-playwright/$NAME/minibrowser-wpe
mkdir -p "$D/sys/lib" /tmp/bb-1603-wk/glib-backup-$NAME
cp -a --update=none /tmp/bb-1603-wk/oldroot/usr/lib/x86_64-linux-gnu/. "$D/sys/lib/"
cp -a --update=none /tmp/bb-1603-wk/oldroot/lib/x86_64-linux-gnu/. "$D/sys/lib/"
for f in "$D"/sys/lib/libglib-2.0.so.0* "$D"/sys/lib/libgobject-2.0.so.0* "$D"/sys/lib/libgmodule-2.0.so.0* "$D"/sys/lib/libgio-2.0.so.0*; do
  [ -e "$f" ] && mv "$f" /tmp/bb-1603-wk/glib-backup-$NAME/ || true
done
echo "prepared $D"
echo "run with: PLAYWRIGHT_SKIP_BROWSER_GC=1 PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 __EGL_VENDOR_LIBRARY_DIRS=/tmp/bb-1603-wk/root/usr/share/glvnd/egl_vendor.d LIBGL_ALWAYS_SOFTWARE=1 node <script>"
