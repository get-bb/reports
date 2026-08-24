# bb reports

HTML reports for [get-bb/bb](https://github.com/get-bb/bb) issues and PRs, published with GitHub Pages at https://get-bb.github.io/reports/.

- `issues/<number>.html` — one self-contained report per issue (repro test, output, root cause, fix, PR review all inline)
- `prs/<number>.html` — one report per PR
- screenshots only under `issues/assets/`, `prs/assets/`, or `assets/`, linked relatively
- no logs, recordings, scripts, dumps, or other artifacts — see [AGENTS.md](AGENTS.md)
- `index.html` is generated from `issues/summary-*.json` by the publish script; post the Pages URL as a comment on the issue
