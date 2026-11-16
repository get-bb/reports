# Request environment discovery probe

Trusted source: get-bb/bb at da3e60b81d560e114a2bec724bb59c997aaaae7f.

The test calls the real Claude bridge JSON-RPC handler and the real host command
validator. It does not mock the provider, SDK, filesystem, or database. A temporary
executable implements only the version probe; it is not Claude Code and does not
prove model discovery, login, or thread execution.

This machine already has a global Claude executable. To avoid using it, each test
sets the process-level executable override to a nonexistent temporary path, then
supplies a different, executable path through the request environment. This is a
controlled unavailable-fallback case, not the exact clean-machine scenario in the
issue. The control points the process-level override at the same fixture and
successfully discovers its version. Every test restores environment and deletes
its temporary directory.

## Repeat

Download `issue-7614.repro.test.ts` from this directory to a local directory and
set `REPORT_DIR` to that absolute directory. Then:

```sh
git clone https://github.com/get-bb/bb.git bb-7614-repro
cd bb-7614-repro
git checkout --detach da3e60b81d560e114a2bec724bb59c997aaaae7f
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build --filter=@get-bb/plugin-sdk
pnpm exec turbo run build
cp "$REPORT_DIR/issue-7614.repro.test.ts" plugins/provider-claude-code/src/bridge/issue-7614.repro.test.ts
pnpm exec turbo run test --filter=bb-plugin-provider-claude-code --force -- src/bridge/issue-7614.repro.test.ts --silent=false
```

Expected on this trusted base: exit 1, two intended assertion failures and two
passing controls. Installation status returns `installed: false` and
`installSource: "notInstalled"`; health returns `status: "not_installed"`.
The schema diagnostic accepts contributions for models and rejects them for
installation and health. The same agent repeated this in a second clean checkout
with fresh fixture directories and forced Turbo execution. Both logs are saved.

No server, browser, live bb data directory, real plugin, or network-dependent
provider turn is necessary. This test is for Unix-like systems.
