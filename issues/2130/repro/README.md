# Repro artifacts for get-bb/bb#2130

Base commit: fcada5a3b88302acb9944aa74b11db4ecaa215a0

## Unit-level repros (fail on main because the bug exists)

Copy the two test files into the repo and run them:

```bash
cp issue-2130-stale-file-preview.repro.test.tsx <repo>/apps/app/src/hooks/queries/
cp issue-2130-file-opener-stale.repro.test.tsx <repo>/plugins/docs/
cd <repo>/apps/app   && pnpm exec vitest run src/hooks/queries/issue-2130-stale-file-preview.repro.test.tsx
cd <repo>/plugins/docs && pnpm exec vitest run issue-2130-file-opener-stale.repro.test.tsx
```

Expected on main: 4 failures (+1 passing control test). Logs of the runs used for the
report are in `../logs/vitest-app-previews.txt` and `../logs/vitest-docs-opener.txt`.

## Live repro (dev instance + headless Chrome via `doobie`)

`browser/` holds the doobie scripts used for the screenshots. They assume:

- a dev instance started with `scripts/bb-dev-app current` (app on :15170 in this run),
- a project `qa` backed by `/tmp/bb-2130-repo` (git repo with `status.txt`, `NOTES.md`),
- a thread `thr_qdnvnfqkvh` on that project, and
- a dedicated browser profile: `doobie --headless -b bb2130 run browser/<script>.js`.

Key scripts:

- `01-open-thread.js` — open the thread route.
- `click-tab.js` — activate a panel tab by name (edit `TAB_NAME`).
- `read-preview-text.js` — print the text rendered by the code view (`<diffs-container>` shadow root) or the Docs editor, plus `document.visibilityState`. Used instead of screenshots for the timed polls so nothing nudges focus.
- `hide-then-show.js` — bring another tab to the front and back, i.e. a real `visibilitychange` cycle.
- `list-preview-queries.js` — dump the React Query cache entries whose key contains `FilePreview`, with each observer's `staleTime`/`refetchOnWindowFocus`.
- `root-pick-project.js`, `root-search-file.js` — open a project file from the "New thread" view.
