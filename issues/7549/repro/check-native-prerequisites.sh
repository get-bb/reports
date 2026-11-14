#!/bin/sh
set -eu

printf 'base=%s\n' "$(git rev-parse HEAD)"
if git diff --quiet HEAD --; then
  printf 'tracked_tree_clean=yes\n'
else
  printf 'tracked_tree_clean=no\n'
  exit 1
fi
printf 'os=%s\n' "$(uname -s)"
missing_tools=0
for tool in xcodebuild xcrun maestro; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf '%s=available\n' "$tool"
  else
    printf '%s=missing\n' "$tool"
    missing_tools=1
  fi
done
if [ "$missing_tools" -ne 0 ]; then
  printf 'SKIP: Native keyboard reproduction cannot start; Apple tooling is unavailable.\n'
  exit 77
fi
xcrun simctl list devices available
printf 'MANUAL: Verify a suitable physical device and OS before attempting native split-screen focus.\n'
exit 77
