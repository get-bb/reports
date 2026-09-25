set -eu
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
pnpm exec turbo run test --force --filter=@bb/host-daemon -- src/server-connection.test.ts
pnpm exec turbo run test --force --filter=@bb/server -- test/internal/background-task-reconciliation.test.ts
