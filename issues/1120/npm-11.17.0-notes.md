## [11.17.0](https://github.com/npm/cli/compare/v11.16.0...v11.17.0) (2026-06-11)
### Features
* [`ae8ac4e`](https://github.com/npm/cli/commit/ae8ac4ea39776f74551fc850f4a5e766b81c5545) [#9534](https://github.com/npm/cli/pull/9534) add min-release-age-exclude config (@JamieMagee, @caseyjhol)
* [`8ff3e48`](https://github.com/npm/cli/commit/8ff3e48113a53576a8d450d7d5a1cb190a1986e1) [#9483](https://github.com/npm/cli/pull/9483) allowScripts tooling and inBundle hardening (#9483) (@github-actions[bot], @JamieMagee)
### Bug Fixes
* [`847cdf8`](https://github.com/npm/cli/commit/847cdf8d2277bc56f6aaef3957f0b9c06fed20e5) [#9541](https://github.com/npm/cli/pull/9541) match dotted and versioned args in approve-scripts/deny-scripts (@owlstronaut)
* [`d99f7cb`](https://github.com/npm/cli/commit/d99f7cb1112d311b1f7fc885fb4f692ead8c8e2c) [#9535](https://github.com/npm/cli/pull/9535) emit valid JSON from approve-scripts/deny-scripts --json (@owlstronaut)
* [`351a309`](https://github.com/npm/cli/commit/351a309e7c625b79cfb0c9fbaa2dc9a544509f70) [#9499](https://github.com/npm/cli/pull/9499) pass script-shell to publish lifecycle hooks (#9499) (@github-actions[bot])
* [`4fa81df`](https://github.com/npm/cli/commit/4fa81dfedab4bf39e85d828f217a70210afd6dac) [#9497](https://github.com/npm/cli/pull/9497) recognize allowScripts for local link targets (#9497) (@github-actions[bot], @cyphercodes, @cyphercodes)
* [`95cf2e9`](https://github.com/npm/cli/commit/95cf2e9efea892023387f3aec6062b8a7e8f1a60) [#9489](https://github.com/npm/cli/pull/9489) validate registry path for allow-remote tarballs (@Abhinav-143x)
* [`9dd219b`](https://github.com/npm/cli/commit/9dd219b20ec3a1c7e46b23209b4619b872f1b604) [#9462](https://github.com/npm/cli/pull/9462) respect allowScripts policy in prune, dedupe, uninstall, audit, and link (#9462) (@github-actions[bot], @JamieMagee)
* [`cd8d18a`](https://github.com/npm/cli/commit/cd8d18a66832856c5cc2ba90dc7c8b0f3dbe476b) [#9482](https://github.com/npm/cli/pull/9482) list pending scripts in approve-scripts when ignore-scripts is set (#9482) (@github-actions[bot], @JamieMagee)
* [`c14e87c`](https://github.com/npm/cli/commit/c14e87c5d84a81ebe14ebe9c68e050ee6ec0fded) [#9481](https://github.com/npm/cli/pull/9481) suggest --allow-scripts for global installs in unreviewed-scripts warnings (#9481) (@github-actions[bot], @JamieMagee)
* [`7ade52e`](https://github.com/npm/cli/commit/7ade52ea4059ca75e83f10e892b24581624acef9) [#9465](https://github.com/npm/cli/pull/9465) invalid issue template YAML indentation (#9465) (@github-actions[bot], @fallintoplace)
* [`c069622`](https://github.com/npm/cli/commit/c0696225d8792e461989214ba7d8886dfd862b4a) [#9464](https://github.com/npm/cli/pull/9464) show full parent command path in subcommand usage errors (#9464) (@owlstronaut)
* [`1bb62bb`](https://github.com/npm/cli/commit/1bb62bb639d1f791a0c51d236fba01c25c58992e) [#9454](https://github.com/npm/cli/pull/9454) config: clarify --all help so it's accurate for approve-scripts and deny-scripts (@JamieMagee)
* [`84eeb5f`](https://github.com/npm/cli/commit/84eeb5fe9db14e01ebc44999ebe126224a78eb83) [#9431](https://github.com/npm/cli/pull/9431) audit: don't apply min-release-age before filter when verifying installed signatures (@JamieMagee)
* [`3bd3377`](https://github.com/npm/cli/commit/3bd3377f207732b47655ea3a896d53046df199c4) [#9426](https://github.com/npm/cli/pull/9426) block forbidden keys in Queryable setter to prevent prototype pollution (@12122J, @claude)
### Documentation
* [`a86a7a9`](https://github.com/npm/cli/commit/a86a7a9e3c9ca840d4e7f5f3bb043ec5b9c7e154) [#9522](https://github.com/npm/cli/pull/9522) approve-scripts only throws EGLOBAL when run with -g (@JamieMagee)
* [`693bb3d`](https://github.com/npm/cli/commit/693bb3de834f4611bf41785be357dc4598a2aaae) [#9508](https://github.com/npm/cli/pull/9508) clarify package.json override value specs (#9508) (@github-actions[bot], @ded-furby)
* [`ccffe4a`](https://github.com/npm/cli/commit/ccffe4a917e1b9faf6e8fa9ab3a2856819e29e3a) [#9501](https://github.com/npm/cli/pull/9501) use the latest version for global update and outdated's `wanted` (#9501) (@github-actions[bot], @liangmiQwQ)
* [`66e97c2`](https://github.com/npm/cli/commit/66e97c20003b43d80c464b89fb1e1c8c6b5c9433) [#9478](https://github.com/npm/cli/pull/9478) update minimum npm required for npm trust (@meeech)
### Dependencies
* [`bd09b87`](https://github.com/npm/cli/commit/bd09b87b50fd7a2051cdfedf3c491dbf133e05b6) [#9542](https://github.com/npm/cli/pull/9542) `postcss-selector-parser@7.1.4`
* [`95bfc4c`](https://github.com/npm/cli/commit/95bfc4c69593cc85f783c164716d7bca0b453b4b) [#9542](https://github.com/npm/cli/pull/9542) `tinyglobby@0.2.17`
* [`8c0d5fd`](https://github.com/npm/cli/commit/8c0d5fd2d72d544267b41f65ee576cc26b080d7c) [#9542](https://github.com/npm/cli/pull/9542) `tar@7.5.16`
* [`967d377`](https://github.com/npm/cli/commit/967d3775434dc4d9659aa9d9c3b81771d12be3df) [#9542](https://github.com/npm/cli/pull/9542) `semver@7.8.4`
* [`cdaac1b`](https://github.com/npm/cli/commit/cdaac1bed03a0f6aff1115ed7cb0745ca9e9f238) [#9542](https://github.com/npm/cli/pull/9542) `pacote@21.5.1`
* [`25c8a9e`](https://github.com/npm/cli/commit/25c8a9ec04fed7f5941af004f7de5ad9b5775bde) [#9542](https://github.com/npm/cli/pull/9542) `node-gyp@12.4.0`
### Chores
* [`2922fa4`](https://github.com/npm/cli/commit/2922fa45f1145c14d7eb0e5796a6854217dd8922) [#9542](https://github.com/npm/cli/pull/9542) dev dependency updates (@owlstronaut)
* [workspace](https://github.com/npm/cli/releases/tag/arborist-v9.8.0): `@npmcli/arborist@9.8.0`
* [workspace](https://github.com/npm/cli/releases/tag/config-v10.11.0): `@npmcli/config@10.11.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmdiff-v8.1.10): `libnpmdiff@8.1.10`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmexec-v10.3.0): `libnpmexec@10.3.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmfund-v7.0.24): `libnpmfund@7.0.24`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmpack-v9.1.10): `libnpmpack@9.1.10`
