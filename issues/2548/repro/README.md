# Issue 2548 reproduction

Use Node 24.18.0 with ABI 137. Save the adjacent patch links in the repository root.

## Base failure

Run these commands from a clean bb checkout:

```sh
git checkout --detach ad79bbb5ec909524f8f281e62d860c588a86f332
git apply --check issue-2548-repro.patch
git apply issue-2548-repro.patch
pnpm install --frozen-lockfile --prefer-offline --package-import-method=copy
pnpm exec turbo run test --filter=@bb/cli -- --run src/__tests__/plugin-new.test.ts
```

The test fails. The warning does not contain `npm error code EPERM`.

## PR #2550 hostile test

Run these commands from a clean bb checkout:

```sh
git checkout --detach 0ee3c8bae68a8473a3b82e1c1b9f76686b26a2a4
git apply --check pr2550-noisy-stdout.patch
git apply pr2550-noisy-stdout.patch
pnpm install --frozen-lockfile --prefer-offline --package-import-method=copy
pnpm exec turbo run test --filter=@bb/cli -- --run src/__tests__/plugin-new.test.ts
```

The hostile test fails. Nine stdout lines remove the stderr diagnosis from the eight-line tail.
