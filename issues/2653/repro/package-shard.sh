#!/usr/bin/env bash
set -euo pipefail

pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
pnpm exec turbo run test \
  --filter='!@bb/server' \
  --filter='!@bb/app' \
  --filter='!@bb/integration-tests' \
  --cache-dir=.turbo/repro-cache \
  --output-logs=errors-only \
  --force
