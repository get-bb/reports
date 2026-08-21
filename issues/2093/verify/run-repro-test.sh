#!/bin/sh
# Verifier: run the report's repro test from the host-daemon package dir.
cd "$1/apps/host-daemon" || exit 2
pnpm exec vitest run src/command-handlers/file-list.issue-2093.test.ts
