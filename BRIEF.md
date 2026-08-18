# Investigation brief (shared by every issue agent)

You are investigating ONE GitHub issue in get-bb/bb and producing an HTML bug report that lets a reader who knows nothing about the codebase reproduce the bug themselves. Base commit: 16ceb3a540f81c1189efaffb27a39b1d9443abf5 (branch main as of 2026-08-18).

## Your environment
- You are in your OWN git worktree of the bb monorepo (check `pwd`, `git rev-parse HEAD`). Nobody else touches it. You may edit source, add instrumentation, add test files, and check out PR branches (`gh pr checkout <n>`) freely. Return to the base commit (`git checkout 16ceb3a54`) if you need the pristine tree again.
- First run `pnpm install --frozen-lockfile --prefer-offline` (the shared pnpm store makes this fast) and then `pnpm exec turbo run build` (turbo cache is shared across worktrees, so this is usually seconds). Do this before anything else.
- Your OWN dev instance: `scripts/bb-dev-app current` starts a web app + server + host daemon with ports and a data dir derived from YOUR worktree path (it prints App/Server/Host daemon URLs and the data dir). Only start it if you need a running app (CLI-driven repro, browser screenshots, real provider processes). `eval "$(scripts/bb-dev-app env)"` sets BB_SERVER_URL etc.; then use `pnpm bb:dev <cmd>` (or `node packages/scripts/dist/commands/run-cli.js <cmd>` after `pnpm bb:dev` has been run once) for the CLI. Read docs/debugging-and-qa.md. Stop it with `pnpm dev:stop` when done.
- Create a project on your instance with: `curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' -d '{"name":"qa","source":{"type":"local_path","path":"<abs path to a scratch git repo you create under /tmp>","hostId":"<host id from bb machine list>"}}'`.
- Providers available on this machine: codex, claude-code, pi, acp-cursor, acp-grok (see `bb provider list`). Real turns cost real usage; keep prompts tiny ("Reply only with ok.").
- Screenshots / browser driving: load the `dev-browser` skill via the Skill tool. Save PNGs to /tmp/bb-reports/issues/assets/<ISSUE>-<name>.png and reference them as `assets/<ISSUE>-<name>.png`. For visual bugs, capture BEFORE and the moment the bug shows, and a shot of you triggering it (the command/click).
- Unit-level repros: write a vitest file in the owning package (`apps/server/test/...`, `packages/<pkg>/test/...`), run it with `pnpm exec vitest run <path>` from the package dir (or the turbo task). Use in-memory SQLite (`createConnection(":memory:")` + `migrate(db)`) — never mock the DB. A repro test that FAILS on main because the bug exists is ideal; state clearly which assertion fails and why.
- Do NOT touch ~/.bb (the user's real data dir) or the user's real bb instance on :38886. Do NOT push branches or open PRs. Do NOT comment on GitHub. Only write files under /tmp/bb-reports/ and inside your worktree.
- Timebox: if a live repro is impossible (needs hardware/accounts you lack), say so explicitly, do the closest faithful repro (unit test at the exact code path), and mark confidence accordingly. Never fake evidence.

## Method (be skeptical)
1. Read the issue and ALL comments (`gh issue view <n> --comments`). Treat every claim as a hypothesis. Verify each one against code and by running things. Note claims that are wrong or unverifiable.
2. Find the real cause, not the symptom. Trace the code path end to end (server, host daemon, provider plugin, CLI, app). Use `git log -S`/`git blame` for history. Check whether the bug is already fixed on main after the report (compare issue version to HEAD).
3. Build the minimal reproduction. Fewest steps, copy-paste commands, expected vs actual output shown verbatim. A clueless reader must be able to follow it.
4. If a PR is linked (open PRs listed in your prompt): `gh pr view <n>`, `gh pr diff <n>`, `gh pr checkout <n>` in your worktree, run its tests, and try to break it. Review as if the author is hostile and incompetent until proven otherwise: does it fix the ROOT cause or paper over the symptom? Wrong layer (server vs daemon boundary per AGENTS.md)? Missing HOST_DAEMON_PROTOCOL_VERSION bump when wire shapes change? Untested paths? Regressions? Security implications? Cast/`as any`/`unknown` smuggling? Silent behavior changes? Give a verdict: MERGE / REQUEST CHANGES / CLOSE, with concrete file:line findings.
5. Suggest a fix from first principles ONLY if you are confident about the cause. State what changes, where, and what could go wrong. If not confident, say what experiment would settle it.

## Report
Write /tmp/bb-reports/issues/<ISSUE>.html. Self-contained HTML (inline CSS, no JS frameworks). Copy the style of /tmp/bb-reports/issues/1706.html (read it). Required sections, in order:
1. Header: title "#<n> · <title>", pills for Type/Priority/Effort/labels, GitHub link, date, base commit, your verdict line: REPRODUCED / PARTIALLY REPRODUCED / NOT REPRODUCED / ALREADY FIXED, and root-cause confidence (high/medium/low).
2. TL;DR — 3–6 sentences for a clueless reader: what the user sees, what is actually wrong, why.
3. Claims vs findings — table: each claim from the issue → Verified / Refuted / Unverified → evidence.
4. Environment — bb commit, OS, node, provider versions, instance ports/data dir used.
5. Minimal reproduction — numbered steps with exact commands, expected vs actual (verbatim output in <pre>), screenshots for visual bugs (with captions describing what to look at). Include the repro test file inline in <pre> AND save it to /tmp/bb-reports/issues/<ISSUE>/repro/ (relative link).
6. Root cause — the mechanism, with code excerpts and permalinks `https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/<path>#L<n>-L<m>`. Explain why the visible symptom follows from it. Call out any deeper/underlying issue.
7. Proposed fix (first principles) — or "not confident yet; next experiment: …".
8. PR review — one subsection per linked PR: what it changes, does it address root cause, findings (file:line, severity), tests you ran, verdict. Omit section only if no PR.
9. Related issues.
10. Appendix — raw logs, extra evidence, all commands run.
Use relative asset paths. Escape HTML in <pre>. Images must be actual PNGs you produced (or SVGs); no placeholders.

Return (as your final message) ONLY a JSON object matching the schema you were given.
