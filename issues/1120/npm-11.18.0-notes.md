## [11.18.0](https://github.com/npm/cli/compare/v11.17.0...v11.18.0) (2026-06-29)
### Features
* [`3021ad6`](https://github.com/npm/cli/commit/3021ad60d9a381ac8c64617843de661b2a0d4620) [#9694](https://github.com/npm/cli/pull/9694) arborist: extend replace-registry-host with URL prefix matching (#6110) (#9694) (@github-actions[bot], @u2mejc)
* [`abd8c6b`](https://github.com/npm/cli/commit/abd8c6b0ce01f2c2c964b1b14e53b37db90be2f5) [#9677](https://github.com/npm/cli/pull/9677) graduate the linked install strategy from experimental to stable (#9677) (@github-actions[bot], @manzoorwanijk)
* [`9420673`](https://github.com/npm/cli/commit/9420673bcdc59c4acb35c406308bb641c2aef635) [#9662](https://github.com/npm/cli/pull/9662) install-scripts: prune unused allowScripts entries (#9662) (@github-actions[bot], @JamieMagee)
* [`fc9d4c7`](https://github.com/npm/cli/commit/fc9d4c72d8ee300a843e8186c5fc39e9c3e874ae) [#9635](https://github.com/npm/cli/pull/9635) namespace install-script approval commands under npm install-scripts (#9635) (@manzoorwanijk)
* [`073253f`](https://github.com/npm/cli/commit/073253f8642d1177000b8d18ebe0abcad2ac9b1a) [#9564](https://github.com/npm/cli/pull/9564) warn when min-release-age blocks an audit fix (#9564) (@github-actions[bot], @JamieMagee)
### Bug Fixes
* [`598ffdb`](https://github.com/npm/cli/commit/598ffdba4495e9b6ad11a830bb874baa49fd8a25) [#9693](https://github.com/npm/cli/pull/9693) sbom: percent-encode vcs_url qualifier in generated purls (#9693) (@github-actions[bot], @ubeddulla)
* [`05793d0`](https://github.com/npm/cli/commit/05793d05230e99421d3611c919ba5ab4c4f49a8a) [#9691](https://github.com/npm/cli/pull/9691) output all the required parameters for npm token list (#9691) (@github-actions[bot], @rijildaniel)
* [`cd57139`](https://github.com/npm/cli/commit/cd5713990b2436950158120a7306f6e7de84e21c) [#9669](https://github.com/npm/cli/pull/9669) arborist: surface undeclared workspaces under the linked strategy (backport release/v11) (#9669) (@manzoorwanijk)
* [`5b6ff9c`](https://github.com/npm/cli/commit/5b6ff9c23e5fbfdfea3bf4c53e3e8094179197c5) [#9667](https://github.com/npm/cli/pull/9667) reify: report added count for fresh linked installs (#9667) (@github-actions[bot], @manzoorwanijk, @owlstronaut)
* [`8f13beb`](https://github.com/npm/cli/commit/8f13beb2cae8582b50ab44ef43154c4c6aaf8a27) [#9664](https://github.com/npm/cli/pull/9664) query: report logical dep location under linked strategy (#9664) (@github-actions[bot], @manzoorwanijk)
* [`168ba30`](https://github.com/npm/cli/commit/168ba30915a844075d9217de46030a8f6ce09903) [#9663](https://github.com/npm/cli/pull/9663) allowScripts: close enforcement gaps (#9652) (backport release/v11) (#9663) (@JamieMagee)
* [`ae64f88`](https://github.com/npm/cli/commit/ae64f883f8345f53cb20f968fafffbb2e6d0c9f6) [#9648](https://github.com/npm/cli/pull/9648) exec: resolve workspace-local bin under the linked install strategy (#9648) (@github-actions[bot], @manzoorwanijk)
* [`784cbe9`](https://github.com/npm/cli/commit/784cbe99c3e35b128ee0a5e6ff569517305a5c33) [#9636](https://github.com/npm/cli/pull/9636) ls: restore 100% coverage on release/v11 after #9633 (#9636) (@manzoorwanijk)
* [`70f0ea5`](https://github.com/npm/cli/commit/70f0ea5a0642919f8d2bee9c3c61490e12846b4e) [#9607](https://github.com/npm/cli/pull/9607) approve-scripts: approve deps with no resolved URL by name (#9607) (@github-actions[bot], @JamieMagee)
* [`b2e6338`](https://github.com/npm/cli/commit/b2e63385c991cfc1430e8e5c347f33a7fd47e0e9) [#9602](https://github.com/npm/cli/pull/9602) arborist: don't flag inert optional deps in strict-allow-scripts (#9602) (@github-actions[bot], @JamieMagee)
* [`6ad5715`](https://github.com/npm/cli/commit/6ad5715c6500b388c64f76826a5038db990aea3a) [#9595](https://github.com/npm/cli/pull/9595) link: scope `npm link  --workspace` to the workspace, not the root (#9595) (@github-actions[bot], @manzoorwanijk)
### Documentation
* [`3658bb5`](https://github.com/npm/cli/commit/3658bb5354f6c72fd9b1c778bba6e933ba7ec4cc) [#9690](https://github.com/npm/cli/pull/9690) recommend install-strategy=linked to catch phantom dependencies (#9690) (@github-actions[bot], @manzoorwanijk)
### Dependencies
* [`54656b6`](https://github.com/npm/cli/commit/54656b60361318204a72aca9409c2dd4ce4a2c20) [#9696](https://github.com/npm/cli/pull/9696) `undici@6.27.0`
* [`31c4773`](https://github.com/npm/cli/commit/31c4773502b8a3bca5d853270d53d46fe9749ce1) [#9696](https://github.com/npm/cli/pull/9696) `brace-expansion@5.0.7`
* [`e773c77`](https://github.com/npm/cli/commit/e773c7792c7611d48a44ef4bb532f627d4e94f7c) [#9696](https://github.com/npm/cli/pull/9696) `tar@7.5.19`
* [`f05f6af`](https://github.com/npm/cli/commit/f05f6afbafaaf46e38ac4cc0d4e8ea76c7d7c330) [#9696](https://github.com/npm/cli/pull/9696) `semver@7.8.5`
* [`804f9ba`](https://github.com/npm/cli/commit/804f9badd99c5c530db0a6c288b18104512d10c3) [#9580](https://github.com/npm/cli/pull/9580) `npm-profile@12.0.2`
### Chores
* [`f79b37f`](https://github.com/npm/cli/commit/f79b37f01b9c624d9dd3806f2f04b3f5e3434e31) [#9696](https://github.com/npm/cli/pull/9696) dev dependency updates (@owlstronaut)
* [`a04cd84`](https://github.com/npm/cli/commit/a04cd845e9784ac8a03c1db721dc7a366eadb4f1) [#9584](https://github.com/npm/cli/pull/9584) add web-login proxy doneUrl regression for npm-profile fix (#9584) (@github-actions[bot], @manzoorwanijk)
* [workspace](https://github.com/npm/cli/releases/tag/arborist-v9.9.0): `@npmcli/arborist@9.9.0`
* [workspace](https://github.com/npm/cli/releases/tag/config-v10.12.0): `@npmcli/config@10.12.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmdiff-v8.1.11): `libnpmdiff@8.1.11`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmexec-v10.3.1): `libnpmexec@10.3.1`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmfund-v7.0.25): `libnpmfund@7.0.25`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmpack-v9.1.11): `libnpmpack@9.1.11`


arborist: 9.9.0

## [9.9.0](https://github.com/npm/cli/compare/arborist-v9.8.0...arborist-v9.9.0) (2026-06-29)
### Features
* [`3021ad6`](https://github.com/npm/cli/commit/3021ad60d9a381ac8c64617843de661b2a0d4620) [#9694](https://github.com/npm/cli/pull/9694) arborist: extend replace-registry-host with URL prefix matching (#6110) (#9694) (@github-actions[bot], @u2mejc)
* [`abd8c6b`](https://github.com/npm/cli/commit/abd8c6b0ce01f2c2c964b1b14e53b37db90be2f5) [#9677](https://github.com/npm/cli/pull/9677) graduate the linked install strategy from experimental to stable (#9677) (@github-actions[bot], @manzoorwanijk)
* [`9420673`](https://github.com/npm/cli/commit/9420673bcdc59c4acb35c406308bb641c2aef635) [#9662](https://github.com/npm/cli/pull/9662) install-scripts: prune unused allowScripts entries (#9662) (@github-actions[bot], @JamieMagee)
* [`073253f`](https://github.com/npm/cli/commit/073253f8642d1177000b8d18ebe0abcad2ac9b1a) [#9564](https://github.com/npm/cli/pull/9564) warn when min-release-age blocks an audit fix (#9564) (@github-actions[bot], @JamieMagee)
### Bug Fixes
* [`774875b`](https://github.com/npm/cli/commit/774875ba675a4b98e39dd0795e6ab2eb6a0ab8b6) [#9686](https://github.com/npm/cli/pull/9686) arborist: keep bin links for allowScripts-denied packages (#9686) (@JamieMagee)
* [`719de1e`](https://github.com/npm/cli/commit/719de1e4677086015f66167f15d0b612438de247) [#9673](https://github.com/npm/cli/pull/9673) arborist: apply overrides across a file: link (backport release/v11) (#9673) (@manzoorwanijk)
* [`cd57139`](https://github.com/npm/cli/commit/cd5713990b2436950158120a7306f6e7de84e21c) [#9669](https://github.com/npm/cli/pull/9669) arborist: surface undeclared workspaces under the linked strategy (backport release/v11) (#9669) (@manzoorwanijk)
* [`ede32d3`](https://github.com/npm/cli/commit/ede32d32be5661c45652614603b634d4e7f8fe4c) [#9668](https://github.com/npm/cli/pull/9668) arborist: forward transitive overrides through linked store links (#9658) (backport release/v11) (#9668) (@manzoorwanijk)
* [`f503b07`](https://github.com/npm/cli/commit/f503b07d7a2a97660a49c9f2b190d0725450c341) [#9666](https://github.com/npm/cli/pull/9666) correct dev/prod dep flags for workspaces under the linked strategy (#9666) (@github-actions[bot], @manzoorwanijk)
* [`f580889`](https://github.com/npm/cli/commit/f580889b488b44fb7c612ae5146bc9a584e0a640) [#9665](https://github.com/npm/cli/pull/9665) arborist: load transitive optional deps into linked actual tree (#9665) (@github-actions[bot], @manzoorwanijk)
* [`8f13beb`](https://github.com/npm/cli/commit/8f13beb2cae8582b50ab44ef43154c4c6aaf8a27) [#9664](https://github.com/npm/cli/pull/9664) query: report logical dep location under linked strategy (#9664) (@github-actions[bot], @manzoorwanijk)
* [`168ba30`](https://github.com/npm/cli/commit/168ba30915a844075d9217de46030a8f6ce09903) [#9663](https://github.com/npm/cli/pull/9663) allowScripts: close enforcement gaps (#9652) (backport release/v11) (#9663) (@JamieMagee)
* [`4c9eacb`](https://github.com/npm/cli/commit/4c9eacb8e3ebf4485cba5734f1aa16060e271cda) [#9649](https://github.com/npm/cli/pull/9649) arborist: clean up stale .store and hoisted dirs on strategy switch (#9649) (@github-actions[bot], @manzoorwanijk)
* [`d2c680e`](https://github.com/npm/cli/commit/d2c680ea687b535b1fa47dd8512b5d3445d1f56f) [#9645](https://github.com/npm/cli/pull/9645) arborist: invalid filterNode crash under the linked strategy (#9645) (@github-actions[bot], @manzoorwanijk)
* [`4e40b1c`](https://github.com/npm/cli/commit/4e40b1c03cfc3a17c04e81717d420631255d21b9) [#9644](https://github.com/npm/cli/pull/9644) arborist: repair wrong-but-existing symlink target in linked strategy (#9644) (@github-actions[bot], @manzoorwanijk)
* [`9d1774e`](https://github.com/npm/cli/commit/9d1774e6fca23ca16a2817068416c92140c1a48d) [#9643](https://github.com/npm/cli/pull/9643) arborist: remove stale .bin shims after uninstall under linked (#9643) (@github-actions[bot], @manzoorwanijk)
* [`ed37d24`](https://github.com/npm/cli/commit/ed37d24c11622c147b69602ba154286acd662d7a) [#9642](https://github.com/npm/cli/pull/9642) arborist: record the linked .store layout in the hidden lockfile (backport #9630) (#9642) (@manzoorwanijk)
* [`e601d4a`](https://github.com/npm/cli/commit/e601d4ad7a8e45e6e2b2f5dcb2bfc264965fbd1b) [#9641](https://github.com/npm/cli/pull/9641) arborist: validate peerOptional conflicts in no-save mutations (#9641) (@owlstronaut, @dale-lakes, @dale-lakes)
* [`03cee43`](https://github.com/npm/cli/commit/03cee437c2c2d6d32ed3a8c28753d02dfbe7f9f0) [#9638](https://github.com/npm/cli/pull/9638) arborist: fix audit-report determinism due to dropped via links (#9638) (@github-actions[bot], @arjun-vegeta)
* [`a30d855`](https://github.com/npm/cli/commit/a30d8559ca4aa26704c2d962c9c4dbcc0366ef67) [#9633](https://github.com/npm/cli/pull/9633) arborist: don't load store packages' devDependencies as required edges (#9633) (@manzoorwanijk)
* [`887ca97`](https://github.com/npm/cli/commit/887ca9720915de0eeb4f1a24eff6b923b8d39c92) [#9631](https://github.com/npm/cli/pull/9631) arborist: audit the non-isolated tree under the linked strategy (#9631) (@github-actions[bot], @manzoorwanijk)
* [`b2e6338`](https://github.com/npm/cli/commit/b2e63385c991cfc1430e8e5c347f33a7fd47e0e9) [#9602](https://github.com/npm/cli/pull/9602) arborist: don't flag inert optional deps in strict-allow-scripts (#9602) (@github-actions[bot], @JamieMagee)
* [`390ebfa`](https://github.com/npm/cli/commit/390ebfa6b89f51259aa2ae1c19b9e13a520b1fb5) [#9593](https://github.com/npm/cli/pull/9593) arborist: symlink workspace file: deps on non-workspace local packages (#9593) (@github-actions[bot], @manzoorwanijk)
* [`aaeb2f1`](https://github.com/npm/cli/commit/aaeb2f19548c47e7bc262e4aa9c76b93376fac82) [#9578](https://github.com/npm/cli/pull/9578) arborist: expose store node_modules via NODE_PATH for linked-strategy install scripts (#9578) (@github-actions[bot], @manzoorwanijk)
* [`05b6f0f`](https://github.com/npm/cli/commit/05b6f0f5bb356891678eb7d3840b6899f04fbfaf) [#9577](https://github.com/npm/cli/pull/9577) arborist: allow-remote exemption for proxy/mirror-fronted registry tarballs (#9577) (@github-actions[bot], @manzoorwanijk)


config: 10.12.0

## [10.12.0](https://github.com/npm/cli/compare/config-v10.11.0...config-v10.12.0) (2026-06-29)
### Features
* [`3021ad6`](https://github.com/npm/cli/commit/3021ad60d9a381ac8c64617843de661b2a0d4620) [#9694](https://github.com/npm/cli/pull/9694) arborist: extend replace-registry-host with URL prefix matching (#6110) (#9694) (@github-actions[bot], @u2mejc)
* [`abd8c6b`](https://github.com/npm/cli/commit/abd8c6b0ce01f2c2c964b1b14e53b37db90be2f5) [#9677](https://github.com/npm/cli/pull/9677) graduate the linked install strategy from experimental to stable (#9677) (@github-actions[bot], @manzoorwanijk)
* [`073253f`](https://github.com/npm/cli/commit/073253f8642d1177000b8d18ebe0abcad2ac9b1a) [#9564](https://github.com/npm/cli/pull/9564) warn when min-release-age blocks an audit fix (#9564) (@github-actions[bot], @JamieMagee)
### Bug Fixes
* [`b2e6338`](https://github.com/npm/cli/commit/b2e63385c991cfc1430e8e5c347f33a7fd47e0e9) [#9602](https://github.com/npm/cli/pull/9602) arborist: don't flag inert optional deps in strict-allow-scripts (#9602) (@github-actions[bot], @JamieMagee)
### Documentation
* [`3658bb5`](https://github.com/npm/cli/commit/3658bb5354f6c72fd9b1c778bba6e933ba7ec4cc) [#9690](https://github.com/npm/cli/pull/9690) recommend install-strategy=linked to catch phantom dependencies (#9690) (@github-actions[bot], @manzoorwanijk)


libnpmdiff: 8.1.11

### Dependencies

* [workspace](https://github.com/npm/cli/releases/tag/arborist-v9.9.0): `@npmcli/arborist@9.9.0`


libnpmexec: 10.3.1

## [10.3.1](https://github.com/npm/cli/compare/libnpmexec-v10.3.0...libnpmexec-v10.3.1) (2026-06-29)
### Bug Fixes
* [`f3f2465`](https://github.com/npm/cli/commit/f3f246580c8fa136ec90c5b7d96b940a6f6a90b0) [#9692](https://github.com/npm/cli/pull/9692) exec: prevent shared binPaths pollution across workspace runs (#9692) (@github-actions[bot], @arjun-vegeta)
* [`b2e6338`](https://github.com/npm/cli/commit/b2e63385c991cfc1430e8e5c347f33a7fd47e0e9) [#9602](https://github.com/npm/cli/pull/9602) arborist: don't flag inert optional deps in strict-allow-scripts (#9602) (@github-actions[bot], @JamieMagee)


### Dependencies

* [workspace](https://github.com/npm/cli/releases/tag/arborist-v9.9.0): `@npmcli/arborist@9.9.0`


libnpmfund: 7.0.25

### Dependencies

* [workspace](https://github.com/npm/cli/releases/tag/arborist-v9.9.0): `@npmcli/arborist@9.9.0`


libnpmpack: 9.1.11

### Dependencies

* [workspace](https://github.com/npm/cli/releases/tag/arborist-v9.9.0): `@npmcli/arborist@9.9.0`
