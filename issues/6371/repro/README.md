# Cross-bundle touch-menu ownership reproduction

Trusted source: get-bb/bb main at b6743a36bd9eae1408c35cfc2c7ab1d2419dc79d.

From a clean checkout of that commit with Node 22 and pnpm 9:

1. Run `pnpm install --frozen-lockfile --prefer-offline`.
2. Copy the adjacent `issue-6371-repro.test.tsx` to `apps/app/src/components/ui/issue-6371-repro.test.tsx`.
3. Run `cp packages/shared-ui/src/components/ui/compact-long-press-menu.tsx packages/shared-ui/src/components/ui/compact-long-press-menu-repro-copy.tsx`.
4. Run `pnpm exec turbo run test --filter=@bb/app -- src/components/ui/issue-6371-repro.test.tsx`.

Expected: both cases pass; only the inner menu opens in either module arrangement.

Actual on the trusted base: same-module case passes; separate-module case fails because the outer menu also calls `onOpenChange(true)`. Exit status is 1, with 1 failed and 1 passed test. This is the intended bug signal, not a setup failure.

The copied module is byte-identical production source in a distinct file. Its imports still resolve to the real shared dropdown/drawer implementation. No menu or drawer behavior is mocked. This models separate evaluation of the shared component by the plugin bundle and host. The test does not execute a pull request branch or import any code from the issue.

The existing control suite is `pnpm exec turbo run test --filter=@bb/app -- src/components/ui/compact-long-press-menu.test.tsx` (10 passing tests on this base).

Two separate clean checkouts at this exact commit gave the same reproduction failure. See `first-run.log` and `second-run.log`; absolute temporary paths have been redacted. `existing-suite.log` records the passing control suite.

This is a DOM/component reproduction with fake timers, not an iOS Safari session. Screenshot capture was attempted through BB Browser Automation, but the host has no Chrome/Chromium executable. No image or hardware verification is claimed.
