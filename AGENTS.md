# AGENTS.md

This repository is the public GitHub Pages site https://get-bb.github.io/reports/. It holds reproduction and root-cause reports for [get-bb/bb](https://github.com/get-bb/bb) issues and reviews of pull requests. Everything committed here is public.

## What goes in the repository

- `issues/<number>.html` — one self-contained report per issue.
- `prs/<number>.html` — one self-contained report per pull request.
- Screenshots only, under `issues/assets/`, `prs/assets/`, or `assets/`. Link them with relative paths.
- `index.html` — generated. Do not edit it by hand. Rebuild it with the publish script from `issues/summary-*.json`.
- `issues/summary-*.json` — the small per-batch metadata (verdict, confidence, one-line cause) that the index is built from.

## What must not go in the repository

- No logs, build output, transcripts, provider recordings (`*.ndjson`, `*.jsonl`), repro scripts, test files, diffs, JSON or API dumps, crash reports, data directories, or compressed archives.
- No `issues/<number>/` or `prs/<number>/` directories at all. `.gitignore` blocks them; do not work around it.
- No agent briefs, target lists, run journals, or other process scratch files.
- No PII and no secrets. See below.

Put the repro test, script, and the exact expected-vs-actual output inline in the report inside `<pre>` blocks. A reader must be able to reproduce the bug from the HTML alone. Keep raw evidence outside this repository (the thread storage or a local backup), never in git.

## Privacy and secrets

The site is public and indexed. Before you commit, scrub every report and screenshot:

- OS usernames and home directories (`/Users/<name>`, `/home/<name>`), temp-dir ids, machine and host names, `*.getbb.app` handles, `*.local` names, LAN/VPN IP addresses, MAC addresses, machine or install ids.
- Real names, emails, GitHub handles used as account identity (public issue attribution may stay), account or organization names and plan tiers, personal connector or MCP server names.
- Tokens, cookies, join codes, session ids, signed URLs, and any process-environment dump. A crash report that embeds `environmentVariables` is a secret leak: strip the object or do not commit the file.
- Other people's data quoted from logs or API responses (reporter names, emails, home paths).
- Text that is visible inside screenshots. OCR or view every image you add; black out the line, or re-capture the screenshot.

Use the placeholders `USER` (OS account), `OWNER` (the maintainer), `HOST` / `HOST.getbb.app` (machines), `user@example.com`, and documentation IP ranges (`192.0.2.x`, `100.64.0.x`, `10.0.0.x`). Model identifiers must be public model ids only.

## Publishing

1. Run the publish script with `--no-push` first. It lints the reports, sweeps known secret shapes, rebuilds `index.html`, and refreshes the local backup.
2. Review the diff. Check `git status` for anything that is not an `.html`, a screenshot, or a summary JSON.
3. Push, wait for the Pages build, then post one comment per issue with the report link and apply the repro label.
