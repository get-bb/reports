## [12.0.0](https://github.com/npm/cli/compare/v12.0.0-pre.3...v12.0.0) (2026-07-08)
### ⚠️ BREAKING CHANGES
* npm view --json now always returns an array.
* `npm sbom --sbom-format=cyclonedx` now reports the `name` field from each package's `package.json` instead of the on-disk directory name. The `name`, `bom-ref`, and `purl` of the root component and of aliased dependencies may change.
* npm no longer registers man pages with the system when installed globally. `man npm-install` will no longer work, but `npm help install` is unaffected.
* The `npm pkg` output is no longer forced to json.  This means you can get single values without having to worry about wrapping of the values.  It also outputs non-json content more similarly to `npm view`.
* `npm shrinkwrap` is removed, the `shrinkwrap` config alias is removed, and `npm-shrinkwrap.json` is no longer loaded or honored at the project root or from inside dependency tarballs. Rename project-root `npm-shrinkwrap.json` to `package-lock.json`; use `bundleDependencies` if you need to ship a locked dependency tree.
* The Twitter and Freenode profile fields have been removed from the npm registry. This means that users will no longer be able to set or view these fields in their npm profiles.
* npm will no longer attempt to resolve the path to node via whichnode. process.execPath is already set by Node to the resolved real path of the node binary, so the lookup was redundant. Scripts that expected npm to override process.execPath with a PATH-resolved (potentially symlinked) node path may be affected.
* the --json output of `npm pack` and `npm publish` have changed. They are now always consistent, and in the same format.
* the `star`, `stars` and `unstar` commands have been removed
* The `npm adduser` command has been removed. Create and manage user accounts on the npm website, and use `npm login` to authenticate on the command line.
* Preserve https protocol when working with git (#8703)
* The default license for `npm init` has been changed from "ISC" to an empty string. If not set, the license field will be omitted from new packages.
* `npm` now supports node `^22.22.2 || ^24.15.0 || >=26.0.0`
* allow-git and allow-remote now default to "none"; set them to "all" (or "root") to install git or user-supplied tarball-URL dependencies.
* root \`preinstall\` now runs before dependencies are installed.
* unknown configs in .npmrc, unknown CLI flags, abbreviated flags, and single-hyphen multi-char shorthands now throw instead of warning.
* Dependency lifecycle scripts are now blocked by default unless allowed by the root package's `allowScripts` policy. After installing, run `npm install-scripts approve` to record approvals and `npm rebuild` to execute newly approved scripts.
### Chores
* [`b77b532`](https://github.com/npm/cli/commit/b77b5321bd6dc8d4c028b89f3e4bc9c9a2209f8f) [#9735](https://github.com/npm/cli/pull/9735) remove pre-release mode from npm 12 and workspaces (#9735) (@reggi, @Copilot)


### Dependencies

* [workspace](https://github.com/npm/cli/releases/tag/arborist-v10.0.0): `@npmcli/arborist@10.0.0`
* [workspace](https://github.com/npm/cli/releases/tag/config-v11.0.0): `@npmcli/config@11.0.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmaccess-v11.0.0): `libnpmaccess@11.0.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmdiff-v9.0.0): `libnpmdiff@9.0.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmexec-v11.0.0): `libnpmexec@11.0.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmfund-v8.0.0): `libnpmfund@8.0.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmorg-v9.0.0): `libnpmorg@9.0.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmpack-v10.0.0): `libnpmpack@10.0.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmpublish-v12.0.0): `libnpmpublish@12.0.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmsearch-v10.0.0): `libnpmsearch@10.0.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmteam-v9.0.0): `libnpmteam@9.0.0`
* [workspace](https://github.com/npm/cli/releases/tag/libnpmversion-v9.0.0): `libnpmversion@9.0.0`

