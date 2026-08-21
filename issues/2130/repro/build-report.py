#!/usr/bin/env python3
"""Builds /tmp/bb-reports/issues/2130.html (inlines + escapes the repro tests)."""
import html
import pathlib

ROOT = pathlib.Path("/tmp/bb-reports/issues")
REPRO = ROOT / "2130" / "repro"
SHA = "fcada5a3b88302acb9944aa74b11db4ecaa215a0"
GH = f"https://github.com/get-bb/bb/blob/{SHA}/"


def esc(s: str) -> str:
    return html.escape(s, quote=False)


def pre(s: str) -> str:
    return f"<pre>{esc(s)}</pre>"


def link(path: str, lines: str, label: str | None = None) -> str:
    frag = f"#L{lines.replace('-', '-L')}" if lines else ""
    return f'<a href="{GH}{path}{frag}"><code>{label or path}{":" + lines if lines else ""}</code></a>'


test_app = (REPRO / "issue-2130-stale-file-preview.repro.test.tsx").read_text()
test_docs = (REPRO / "issue-2130-file-opener-stale.repro.test.tsx").read_text()
log_app = (ROOT / "2130" / "logs" / "vitest-app-previews.txt").read_text()
log_docs = (ROOT / "2130" / "logs" / "vitest-docs-opener.txt").read_text()


def strip_ansi(s: str) -> str:
    import re

    s = re.sub(r"\x1b\[[0-9;]*m", "", s)
    return "\n".join(
        l for l in s.splitlines() if "zoxide" not in l and "_ZO_DOCTOR" not in l and "ajeetdsouza" not in l and "shell configuration" not in l and "issue persists" not in l
    ).strip()


log_app = strip_ansi(log_app)
log_docs = strip_ansi(log_docs)

CSS = """
  :root { --canvas:#fafaf8; --ink:#1a1a1a; --muted:#666; --line:#e2e2de; --accent:#0052cc; --high:#b60205; --ok:#0e8a16; --warn:#b26a00; }
  body { margin:0; background:var(--canvas); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; }
  main { max-width:960px; margin:0 auto; padding:40px 24px 80px; }
  h1 { font-size:26px; line-height:1.25; margin:0 0 6px; }
  h2 { font-size:18px; margin:36px 0 10px; padding-top:20px; border-top:1px solid var(--line); }
  h3 { font-size:15px; margin:22px 0 6px; }
  .meta { color:var(--muted); font-size:14px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }
  .pill { display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); }
  .pill.high { background:var(--high); color:#fff; border-color:var(--high); }
  .pill.med { background:var(--warn); color:#fff; border-color:var(--warn); }
  .verdict { font-weight:600; }
  .v-partial { color:var(--warn); }
  table { border-collapse:collapse; width:100%; font-size:14px; } td,th { text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
  code, pre { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; } pre { background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; max-height:520px; }
  a { color:var(--accent); }
  .ok { color:var(--ok); font-weight:600; } .no { color:var(--high); font-weight:600; } .unv { color:var(--warn); font-weight:600; }
  figure { margin:18px 0; } figure img { max-width:100%; border:1px solid var(--line); border-radius:6px; } figcaption { font-size:13px; color:var(--muted); margin-top:6px; }
  details summary { cursor:pointer; color:var(--accent); }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  @media (max-width:700px) { .grid2 { grid-template-columns:1fr; } }
"""

body = f"""
  <p class="meta"><a href="../">&larr; reports</a></p>
  <h1>#2130 &middot; Open file views do not refresh when a file changes on disk</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill med">Priority: Medium</span> <span class="pill">Effort: unset</span> <span class="pill">docs</span> <span class="pill">ui</span>
    <a href="https://github.com/get-bb/bb/issues/2130">open on GitHub</a>
    <span>2026-08-21 &middot; base <code>fcada5a3b</code></span>
  </p>
  <p><strong>Verdict:</strong> <span class="verdict v-partial">PARTIALLY REPRODUCED</span> &middot; <strong>Root-cause confidence:</strong> high</p>
  <p>Partially, because the issue bundles five "surfaces" and two of them are wrong: workspace files and thread-storage files opened in a thread <em>do</em> refresh live (host-daemon file watcher &rarr; realtime invalidation, measured &le;5&nbsp;s, no focus change needed). The real gaps are: (a) the <strong>Docs plugin markdown editor</strong>, which becomes the default opener for every <code>.md</code> the moment the Docs plugin is installed and never re-reads the file; (b) <strong>absolute host paths outside the workspace</strong> opened in a thread, which only refresh on a browser <code>visibilitychange</code>; (c) the <strong>project file preview on the "New thread" view</strong>, which never refreshes at all (not listed in the issue); and (d) the <strong>host-scoped preview used by plugin pages</strong>, which has no invalidation and a 30&nbsp;s stale window (code-verified, unit-tested, not reachable from any built-in UI without a plugin that opens host targets).</p>

  <h2>1. TL;DR</h2>
  <p>bb shows files in a right-hand panel. Whether that panel tracks the file on disk depends entirely on <em>which React Query hook the tab happens to use</em>, and that is decided by where the file lives and which view you opened it from. Files inside the thread's workspace and inside thread storage are wired to the host daemon's filesystem watcher: an outside write arrives as a <code>work-status-changed</code> / <code>thread-storage-changed</code> realtime event and the preview refetches within a few seconds (verified live). Three other previews have no such owner: the <code>threadHostFilePreview</code> query (absolute paths outside the workspace) refetches only when the browser tab is hidden and shown again; the <code>projectFilePreview</code> query (the "New thread" page) and the <code>hostFilePreview</code> query (plugin pages) are never invalidated and do not refetch on focus, so they stay stale until the tab is closed or the Refresh button is clicked. Separately, the Docs plugin registers itself as the file opener for <code>md</code>/<code>mdx</code>/<code>markdown</code>; its <code>DocsFileOpener</code> reads the file once in a <code>useEffect</code>, keeps it in component state, and has no poll, watcher, subscription, focus handler or Refresh button, so installing the Docs plugin silently turns every live markdown preview into a frozen one. Its unmount autosave also swallows a conflict result because the only handler is <code>setConflict</code> on an already-unmounted component.</p>

  <h2>2. Claims vs findings</h2>
  <table><tr><th>Claim from the issue</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>"A file opened in BB keeps showing its old contents after something else writes it ... The view stays stale for as long as it is open."</td><td class="unv">Partially verified</td><td>True for the Docs editor, for absolute host paths in a thread (until a visibility change), for the New-thread project preview, and for plugin-page host previews. False for workspace files and thread-storage files opened in a thread: both refreshed within 3&ndash;5&nbsp;s in the live repro (&sect;4 steps 3 and 6).</td></tr>
    <tr><td>Surface 1: <code>useHostFilePreview</code> &mdash; nothing invalidates <code>hostFilePreviewQueryKey</code>; 30&nbsp;s <code>staleTime</code> makes close/reopen replay the cache.</td><td class="ok">Verified</td><td>{link('apps/app/src/hooks/queries/host-file-preview-query.ts','140-143')} sets <code>staleTime: 30_000</code>; <code>grep -rn hostFilePreviewQueryKey apps/app/src</code> finds only the hook and the key factory &mdash; no <code>invalidateQueries</code>. Unit test <code>useHostFilePreview</code> in &sect;4 fails on main. Only consumer is {link('apps/app/src/components/secondary-panel/ThreadSecondaryPanelTabContent.tsx','481-494','HostScopedFilePreviewTabContent')}, rendered from {link('apps/app/src/components/plugin/PluginPanelRightPanelHost.tsx','721-728','PluginPanelRightPanelHost')} (plugin full-page routes). No built-in plugin opens a <code>{{kind:"host"}}</code> target today, so this was not reproduced live.</td></tr>
    <tr><td>Surface 2: "Built-in preview, workspace paths &mdash; <code>RESUME_REFETCH_QUERY_POLICY</code>. Refetches on focus ... never updates while you sit and watch it."</td><td class="no">Refuted (mislabeled)</td><td>Workspace paths in a thread use {link('apps/app/src/hooks/queries/environment-queries.ts','250-300','useEnvironmentFilePreview')} (<code>EXPENSIVE_MANUAL_QUERY_POLICY</code>), whose key is invalidated by {link('apps/app/src/hooks/cache-owners/realtime-cache-registry.ts','1101-1116','dirtyEnvironmentLiveWorkspaceStateQueries')} on every <code>work-status-changed</code> event, which the daemon emits from its parcel watcher on any content change ({link('apps/host-daemon/src/watch-manager.ts','324-333')}). Live: <code>status.txt</code> updated in &le;3&nbsp;s with the window untouched (figures 1&ndash;2). The hook that actually has <code>RESUME_REFETCH_QUERY_POLICY</code> is {link('apps/app/src/hooks/queries/thread-queries.ts','877-900','useThreadHostFilePreview')} &mdash; absolute paths <em>outside</em> the workspace &mdash; and for that one the described behaviour (stale until a visibility change) is verified (figures 3&ndash;4, &sect;4 step 4).</td></tr>
    <tr><td>Surface 3: thread-storage paths &mdash; "no realtime event invalidates a file preview key. Reopening the tab works; focus does not."</td><td class="no">Refuted</td><td>{link('apps/app/src/hooks/cache-owners/realtime-cache-registry.ts','995-1013','dirtyThreadStorageQueriesForThread')} and {link('apps/app/src/hooks/cache-owners/realtime-cache-registry.ts','1174-1184','dirtyThreadStorageQueriesForEnvironment')} both return <code>threadStorageFilePreviewQueryKeyPrefix</code>; they run on <code>environment-changed</code> and <code>thread-storage-changed</code>, the latter produced by the daemon's thread-storage watcher ({link('packages/host-watcher/src/parcel-host-watcher.ts','77-100')}). Live: <code>queue.txt</code> in thread storage updated in &le;5&nbsp;s (&sect;4 step 6).</td></tr>
    <tr><td>Surface 4: Docs plugin opener loads once via <code>openFile</code> in a <code>useEffect</code>; only reload path is the <code>reloadNonce</code> behind the conflict banner, which only appears when a save fails its sha256 check.</td><td class="ok">Verified</td><td>{link('plugins/docs/app.tsx','1112-1136')} (single fetch keyed on <code>reloadNonce</code>), {link('plugins/docs/app.tsx','1139-1171')} (<code>setConflict(true)</code> only on <code>saveOpenedFile</code> conflict), {link('plugins/docs/app.tsx','1218-1232')} (banner + Reload). Live: <code>NOTES.md</code> stale after 30&nbsp;s and after a visibility cycle (figures 5&ndash;6). Unit test fails on main. Docs registers <code>extensions: ["md","mdx","markdown"]</code> at {link('plugins/docs/app.tsx','2205-2210')} and became the default opener immediately after <code>bb plugin install builtin:docs</code>.</td></tr>
    <tr><td>"<code>refetchOnWindowFocus</code> is not window focus": <code>focusManager</code> is rewired to <code>visibilitychange</code>/<code>pageshow</code>; app-switching on macOS leaves the document visible, so no refetch.</td><td class="ok">Verified (by code)</td><td>{link('apps/app/src/lib/query-client.ts','34-47')}. The <code>window.focus</code> listener at {link('apps/app/src/lib/query-client.ts','76-91')} only resumes suspended fetches; it does not call <code>focusManager</code>. Not exercised on real macOS app switching (headless run); the live repro used a genuine tab hide/show, which is the only trigger that works.</td></tr>
    <tr><td>Related: unmount cleanup calls non-forced <code>save()</code>; a conflict calls <code>setConflict</code> on an unmounted component, so edits inside the 700&nbsp;ms debounce are neither written nor reported.</td><td class="ok">Verified</td><td>{link('plugins/docs/app.tsx','1178-1183')}. Unit test 2 in &sect;4: after typing and unmounting at +150&nbsp;ms the rpc log is exactly <code>["openFile","saveOpenedFile"]</code> with <code>expectedSha256: "sha-1"</code>; the mocked conflict produces no further call and no UI.</td></tr>
    <tr><td>Workarounds: close/reopen; built-in Refresh button; "Open with" per tab; Settings &rarr; File openers; local <code>refetchInterval</code> patch.</td><td class="ok">Verified</td><td>Refresh icon visible in every built-in preview screenshot; Docs editor toolbar has only "Open file externally" (figure 5). <code>FileOpenersSettingsSection.tsx</code> and <code>ExperimentalFileLinkMenu.tsx</code> ("Open with") exist. The patch was not evaluated.</td></tr>
    <tr><td>Not in the issue: the "New thread" (root compose) project file preview.</td><td class="no">New finding</td><td>{link('apps/app/src/hooks/queries/project-queries.ts','197-256','useProjectFilePreview')} uses <code>EXPENSIVE_MANUAL_QUERY_POLICY</code> (<code>refetchOnWindowFocus: false</code>) and <code>projectFilePreviewQueryKey</code> is referenced nowhere in the realtime registry. Live: stale after 30&nbsp;s and after a visibility cycle (figures 7&ndash;8); unit test fails on main.</td></tr>
  </table>

  <h2>3. Environment</h2>
  <ul>
    <li>bb <code>fcada5a3b88302acb9944aa74b11db4ecaa215a0</code> (main, 2026-08-21); <code>git log fcada5a3b..origin/main</code> touches none of the files above (only #2147, #2150), so the findings hold on origin/main.</li>
    <li>macOS 26.5.2 (Darwin 25.5.0), Node v22.23.1, pnpm 9.15.0, codex-cli 0.149.0 (one "Reply only with ok." turn to provision the thread).</li>
    <li>Own dev instance via <code>scripts/bb-dev-app current</code>: app <code>http://localhost:15170</code>, server <code>:23170</code>, host daemon <code>:31170</code>, data dir <code>~/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-5-4b69f8ca9065</code> (deleted at cleanup).</li>
    <li>Browser: headless Chrome driven by <code>doobie</code> in a dedicated profile (<code>-b bb2130</code>) so no other page could change <code>document.visibilityState</code>. (A first attempt in the shared profile produced spurious refreshes because other agents' pages toggled visibility; those runs were discarded.)</li>
    <li>Project <code>proj_sy4khgnq6z</code> ("qa") &rarr; <code>/tmp/bb-2130-repo</code> (git, files <code>status.txt</code>, <code>NOTES.md</code>); thread <code>thr_qdnvnfqkvh</code>, environment <code>env_idq63bcwvv</code> (unmanaged, branch main).</li>
  </ul>

  <h2>4. Minimal reproduction</h2>
  <p>All timed checks below read the rendered text straight out of the DOM (<code>read-preview-text.js</code>) so that nothing touches focus; screenshots were taken afterwards.</p>
  <ol>
    <li>Start a dev instance and create a scratch repo + project:
{pre('''scripts/bb-dev-app current                      # prints App/Server/Host daemon URLs
mkdir /tmp/bb-2130-repo && cd /tmp/bb-2130-repo && git init -q
printf '# Notes\\n\\nversion 1\\n' > NOTES.md; printf 'version 1\\n' > status.txt
git add -A && git commit -qm init
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/bb-2130-repo","hostId":"<host id from bb machine list>"}}'
pnpm bb:dev thread spawn --project <proj id> --environment /tmp/bb-2130-repo --provider codex \\
  --permission-mode accept-edits --title "2130 repro" --prompt "Reply only with ok." --json''')}</li>
    <li>Open the thread in the browser (<code>/projects/&lt;proj&gt;/threads/&lt;thr&gt;</code>) and open a <strong>workspace file</strong> in the panel:
{pre('''pnpm bb:dev thread open <thr> status.txt --json
# -> persisted tab kind "workspace-file-preview" (pnpm bb:dev thread tabs show <thr>)''')}</li>
    <li><strong>Workspace file: refreshes live (claim refuted).</strong> With the window untouched:
{pre('''$ echo "version 3 written at $(date +%T)" > /tmp/bb-2130-repo/status.txt   # 08:16:25
$ sleep 3; doobie --headless -b bb2130 run read-preview-text.js
  "visibility": "visible",
  "codeView": ["1version 3 written at 08:16:25..."]        # time 08:16:31
expected: view shows the new contents           actual: same (PASS, ~3 s)''')}
      <div class="grid2">
      <figure><img src="assets/2130-workspace-before.png" alt="workspace preview before"><figcaption>Fig 1 &mdash; <code>status.txt</code> (workspace-file-preview) showing "version 1".</figcaption></figure>
      <figure><img src="assets/2130-workspace-after.png" alt="workspace preview after"><figcaption>Fig 2 &mdash; six seconds after <code>echo ... &gt; status.txt</code>, no focus change: the view already shows "version 2 written at 08:12:32" and the composer's Uncommitted pill appeared &mdash; the watcher &rarr; <code>work-status-changed</code> path works.</figcaption></figure>
      </div></li>
    <li><strong>Absolute host path outside the workspace: stale until a visibility change.</strong> <code>bb thread open</code> refuses paths outside the workspace, so the tab was persisted directly (this is the tab a timeline link to <code>/tmp/...</code> creates):
{pre('''pnpm bb:dev thread tabs set <thr> --expected-revision <n> --tabs-json '[..., {"environmentId":"env_idq63bcwvv","hostId":null,
  "id":"host-file-preview:/tmp/bb-2130-outside/outside.txt:env_idq63bcwvv","kind":"host-file-preview","lineRange":null,
  "path":"/tmp/bb-2130-outside/outside.txt","threadId":"thr_qdnvnfqkvh"}]'
# activate the tab, then:
$ echo "outside version 4 written at $(date +%T)" > /tmp/bb-2130-outside/outside.txt   # 08:16:56
$ sleep 10; read-preview-text.js  -> "1outside version 3 written at 08:14:20"   (08:17:10)
$ sleep 20; read-preview-text.js  -> "1outside version 3 written at 08:14:20"   (08:17:30)  <- stale after 34 s
$ hide-then-show.js               -> {{ whileAway: "hidden", now: "visible" }}
$ read-preview-text.js            -> "1outside version 4 written at 08:16:56"   (08:17:56)  <- only a visibilitychange refreshes it
expected: updates while visible   actual: frozen until the tab is hidden and shown again''')}
      <div class="grid2">
      <figure><img src="assets/2130-thread-host-before.png" alt="host path preview before"><figcaption>Fig 3 &mdash; the same tab right after it was opened (earlier run, shared profile): "outside version 1".</figcaption></figure>
      <figure><img src="assets/2130-thread-host-after.png" alt="host path preview stale"><figcaption>Fig 4 &mdash; <code>/tmp/bb-2130-outside/outside.txt</code> (host-file-preview, <code>useThreadHostFilePreview</code>) still shows "outside version 3 written at 08:14:20" while the file on disk already says version 4 (08:16:56).</figcaption></figure>
      </div></li>
    <li>Confirm which query each tab uses (dumped from the live React Query cache with <code>list-preview-queries.js</code>; <code>refetchOnWindowFocus: false</code> on the workspace entry is fine because the realtime registry owns it):
{pre('''["threadHostFilePreview","thr_qdnvnfqkvh","env_idq63bcwvv","/tmp/bb-2130-outside/outside.txt"]  observers 0
["threadStorageFilePreview","thr_qdnvnfqkvh","queue.txt"]                                      observers 0
["environmentFilePreview","env_idq63bcwvv","status.txt",{"kind":"working-tree"}]                observers 1  staleTime 2000  refetchOnWindowFocus false''')}</li>
    <li><strong>Thread-storage file: refreshes live (claim refuted).</strong>
{pre('''$ echo "storage version 1 ..." > <data dir>/thread-storage/thr_qdnvnfqkvh/queue.txt
# persist a {"kind":"thread-storage-file-preview","path":"queue.txt",...} tab as in step 4, activate it
$ echo "storage version 2 written at $(date +%T)" > .../queue.txt     # 08:18:42
$ sleep 5; read-preview-text.js -> "1storage version 2 written at 08:18:42"   (08:18:50)  PASS''')}</li>
    <li><strong>Docs plugin editor: never refreshes.</strong>
{pre('''pnpm bb:dev plugin install builtin:docs --yes     # reload the page, then
pnpm bb:dev thread open <thr> NOTES.md --json       # -> tab kind "plugin-panel", pluginId "simple-notes" (Docs is now the default .md opener)
$ echo "version 2 written at $(date +%T)" >> /tmp/bb-2130-repo/NOTES.md   # 08:20:05
$ sleep 10; read-preview-text.js -> docsEditor: "Notes version 1", changedOnDiskBanner: false  (08:20:19)
$ sleep 20; read-preview-text.js -> docsEditor: "Notes version 1", changedOnDiskBanner: false  (08:20:39)
$ hide-then-show.js; read-preview-text.js -> "Notes version 1", banner false                   (08:20:49)
expected: editor shows the appended heading, or a "Changed on disk." banner
actual:   still "version 1"; no banner; no Refresh control (the git pill in the composer did update to "2 files")''')}
      <div class="grid2">
      <figure><img src="assets/2130-docs-before.png" alt="docs editor before"><figcaption>Fig 5 &mdash; <code>NOTES.md</code> opened by the Docs plugin (book icon on the active tab). Toolbar has only the path and "Open file externally"; no Refresh.</figcaption></figure>
      <figure><img src="assets/2130-docs-after.png" alt="docs editor after"><figcaption>Fig 6 &mdash; 45&nbsp;s after appending "## Agent update / version 2 ..." on disk and one hide/show cycle: editor still says "version 1". Note the composer's "Uncommitted &middot; 2 files" pill did update &mdash; the realtime event arrived, the Docs editor just ignores it.</figcaption></figure>
      </div></li>
    <li><strong>"New thread" view project preview: never refreshes (not in the issue).</strong> Go to <code>/</code>, pick project "qa", open the right panel, <code>&#8984;P</code> search "status" and open <code>status.txt</code>. Cache entry: <code>["projectFilePreview","proj_sy4khgnq6z",null,"host_fqcic7dtdr","status.txt"] staleTime 2000 refetchOnWindowFocus false</code>.
{pre('''$ echo "version 5 written at $(date +%T)" > /tmp/bb-2130-repo/status.txt   # 08:30:53
$ sleep 20; hide-then-show.js; read-preview-text.js -> "1version 4 written at 08:23:19"  (08:31:23)
expected: version 5   actual: version 4, even after a visibility cycle''')}
      <div class="grid2">
      <figure><img src="assets/2130-root-project-before.png" alt="root compose preview before"><figcaption>Fig 7 &mdash; New-thread view, project "qa", <code>status.txt</code> showing version 4.</figcaption></figure>
      <figure><img src="assets/2130-root-project-after.png" alt="root compose preview after"><figcaption>Fig 8 &mdash; 30&nbsp;s after writing version 5 plus a hide/show cycle: still version 4.</figcaption></figure>
      </div></li>
  </ol>

  <h3>Unit-level repros</h3>
  <p>Two vitest files; four assertions fail on <code>fcada5a3b</code> (one control passes, proving the focus simulation works). Saved under <a href="2130/repro/">2130/repro/</a> with a <a href="2130/repro/README.md">README</a>.</p>
  <p><code>apps/app/src/hooks/queries/issue-2130-stale-file-preview.repro.test.tsx</code> &mdash; run with <code>cd apps/app &amp;&amp; pnpm exec vitest run src/hooks/queries/issue-2130-stale-file-preview.repro.test.tsx</code>:</p>
  {pre(test_app)}
  <details><summary>vitest output (app)</summary>{pre(log_app)}</details>
  <p><code>plugins/docs/issue-2130-file-opener-stale.repro.test.tsx</code> &mdash; run with <code>cd plugins/docs &amp;&amp; pnpm exec vitest run issue-2130-file-opener-stale.repro.test.tsx</code>:</p>
  {pre(test_docs)}
  <details><summary>vitest output (docs)</summary>{pre(log_docs)}</details>

  <h2>5. Root cause</h2>
  <p><strong>There is no single "file view"; there are five React Query hooks plus one plugin component, and only two of them have a refresh owner.</strong> The tab kind is chosen by where the path lives and which view opened it (thread view: {link('apps/app/src/views/thread-detail/ThreadDetailView.tsx','2652-2735')}; New-thread view: {link('apps/app/src/views/RootComposePanelTabContent.tsx','420-500')}; plugin pages: {link('apps/app/src/components/plugin/PluginPanelRightPanelHost.tsx','710-737')}).</p>
  <table>
    <tr><th>Tab / hook</th><th>Query key</th><th>Policy</th><th>Realtime invalidation</th><th>Observed</th></tr>
    <tr><td>thread &rarr; workspace path<br><code>useEnvironmentFilePreview</code></td><td><code>environmentFilePreview</code></td><td>EXPENSIVE_MANUAL (no focus)</td><td><code>work-status-changed</code> &rarr; {link('apps/app/src/hooks/cache-owners/realtime-cache-registry.ts','1112-1114','invalidate')}; event emitted by the daemon watcher on any content change</td><td class="ok">live (&le;3 s)</td></tr>
    <tr><td>thread &rarr; thread-storage path<br><code>useThreadStorageFilePreview</code></td><td><code>threadStorageFilePreview</code></td><td>REALTIME_OWNED_MOUNT_BASELINE</td><td><code>thread-storage-changed</code> / <code>environment-changed</code></td><td class="ok">live (&le;5 s)</td></tr>
    <tr><td>thread &rarr; absolute path outside workspace<br><code>useThreadHostFilePreview</code></td><td><code>threadHostFilePreview</code></td><td>RESUME_REFETCH (focus + reconnect, 2 s stale)</td><td>none &mdash; the daemon watches only the workspace root and the thread-storage root</td><td class="no">stale until <code>visibilitychange</code></td></tr>
    <tr><td>New-thread view &rarr; project file<br><code>useProjectFilePreview</code></td><td><code>projectFilePreview</code></td><td>EXPENSIVE_MANUAL (no focus)</td><td>none (key not referenced by any dirty function)</td><td class="no">stale forever</td></tr>
    <tr><td>plugin page &rarr; host target<br><code>useHostFilePreview</code></td><td><code>hostFilePreview</code></td><td>default focus + <code>staleTime 30_000</code></td><td>none</td><td class="no">stale; focus only after 30 s (unit test)</td></tr>
    <tr><td>any view &rarr; <code>.md/.mdx/.markdown</code> with Docs installed<br><code>DocsFileOpener</code></td><td>n/a (component state)</td><td>one <code>openFile</code> RPC per <code>[filePath, openerSource, reloadNonce]</code></td><td>none; plugin RPC is request/response</td><td class="no">stale forever, no banner, no Refresh</td></tr>
  </table>
  <p><strong>Why the live path works:</strong> the daemon's {link('apps/host-daemon/src/watch-manager.ts','316-333','WatchManager.queueWorkspaceWatchChange')} forwards every <code>workspace-content-changed</code> event as <code>work-status-changed</code> ("The filesystem event itself is sufficient evidence that live content is stale"), the server relays it via <code>hub.notifyEnvironment</code> ({link('apps/server/src/internal/environment-changes.ts','36-50')}), and the app's registry invalidates <code>environmentFilePreviewQueryKeyPrefix(environmentId)</code>. That was built deliberately in #620 (<code>71de847f6</code>, "Fix file preview refresh") and hardened in #1299 (<code>53ff24930</code>). The issue's surfaces 2 and 3 describe policies that are real but irrelevant, because a realtime-owned query does not need focus refetch.</p>
  <p><strong>Why the others do not:</strong> the watcher is scoped to the environment's workspace root and the thread-storage root; there is no watch for arbitrary host paths, so <code>threadHostFilePreview</code>/<code>hostFilePreview</code> can only rely on focus, and the app deliberately maps "focus" to <code>visibilitychange</code>/<code>pageshow</code> ({link('apps/app/src/lib/query-client.ts','34-47')}). <code>projectFilePreview</code> is the odd one out: its backing data <em>is</em> a workspace (the project's default source path, often the same directory as a thread's environment), but the key carries a <code>projectId</code>, not an <code>environmentId</code>, so the environment-scoped invalidation cannot reach it, and it opted out of focus refetch as well.</p>
  <p><strong>Docs opener:</strong> {link('plugins/docs/app.tsx','1112-1136')} fetches in an effect keyed on <code>[filePath, openerSource, reloadNonce, rpc]</code> and stores the result in <code>useState</code>. The only writer of <code>reloadNonce</code> is the Reload button inside <code>{{conflict ? ... : null}}</code>, and the only writer of <code>conflict</code> is a <code>saveOpenedFile</code> response of <code>outcome: "conflict"</code>. A reader who never edits never saves, so never learns the file moved. Because {link('plugins/docs/app.tsx','2205-2210','app.slots.fileOpener')} claims the three markdown extensions, installing the (official, on-demand) Docs plugin downgrades every markdown file view from the live native preview to this component. The unmount cleanup ({link('plugins/docs/app.tsx','1178-1183')}) runs a non-forced <code>save()</code>; a conflict there reaches <code>setConflict(true)</code> on an unmounted component and is dropped.</p>
  <p><strong>Deeper issue:</strong> the plugin SDK's file-opener contract has no way for the host to tell an opener "your file changed" (no push channel, no <code>experimental_useLiveFile</code> hook), and the built-in previews have no shared "refresh owner" abstraction &mdash; each hook picks a policy by hand, which is how two sibling hooks for the same on-disk directory ended up with opposite behaviour.</p>

  <h2>6. Proposed fix (first principles)</h2>
  <ol>
    <li><strong>Make <code>projectFilePreview</code> realtime-owned.</strong> In {link('apps/app/src/hooks/queries/project-queries.ts','197-256')} resolve the project's default environment(s) and either key the preview by environment when one exists or add a dirty function in the realtime registry that maps <code>work-status-changed</code> for an environment to <code>projectFilePreviewQueryKeyPrefix(projectId)</code> (the registry already has <code>getCachedThreadIdsForEnvironment</code>-style helpers). At minimum switch it to <code>RESUME_REFETCH_QUERY_POLICY</code>. Risk: none beyond extra refetches of a heavy payload; it already has <code>HEAVY_PAYLOAD_QUERY_POLICY</code>.</li>
    <li><strong>Give host-path previews a watcher.</strong> The daemon already exposes policy-free <code>watchPathRoot</code> ({link('packages/host-watcher/src/host-watcher-types.ts','99-118')}). Add a host RPC "watch these absolute paths for this thread/session" whose change event the server relays as a new environment/thread change kind (e.g. <code>host-file-changed</code> with <code>hostId</code>+<code>path</code>), and a dirty function that invalidates <code>threadHostFilePreviewQueryKey</code>/<code>hostFilePreviewQueryKey</code> for that path. This changes wire shapes, so bump <code>HOST_DAEMON_PROTOCOL_VERSION</code>. Until then, the cheap mitigation is <code>staleTime</code> 0&ndash;2 s and <code>refetchOnWindowFocus: true</code> on <code>useHostFilePreview</code> (one-line change at {link('apps/app/src/hooks/queries/host-file-preview-query.ts','141-142')}), and listening to <code>window.focus</code> in addition to <code>visibilitychange</code> in {link('apps/app/src/lib/query-client.ts','34-47')} so a macOS app switch counts (the comment block there explains why resume catch-up was trimmed; a focus-triggered refetch of <em>stale</em> queries only is much cheaper than the removed invalidation wave, but verify on iOS Safari).</li>
    <li><strong>Plugin file openers need a change signal.</strong> Two options that do not require plugin host entrypoints: (a) the app host already receives <code>work-status-changed</code> for the opener's environment &mdash; expose it as <code>experimental_useFileChangeSignal(source, path)</code> (or pass a <code>changeToken</code> prop through <code>PluginFileOpenerProps</code>) that bumps when the owning environment/thread-storage query would be invalidated; (b) let the opener pull: add <code>modifiedAtMs</code>/<code>sha256</code> to the <code>openFile</code> result (already returns <code>sha256</code>) and have <code>DocsFileOpener</code> re-check on the signal, showing the existing "Changed on disk." banner when the editor is dirty and reloading silently when it is not. Either way the Docs opener should also render a Refresh control like the native preview. Risk: reloading replaces <code>TiptapEditor</code> (keyed on <code>initialValue</code>), which drops cursor position; only reload when <code>markdownRef.current === savedRef.current</code>.</li>
    <li><strong>Unmount save:</strong> on conflict during the cleanup save, either force-write to a sidecar / keep the content in a module-level "unsaved edits" map keyed by path and re-offer it on next open, or at least surface a toast via the SDK. Do not force-overwrite silently.</li>
  </ol>

  <h2>7. PR review</h2>
  <p>No open pull requests are linked to this issue.</p>

  <h2>8. Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/615">#615</a> "Add refresh file functionality" (closed) &mdash; same symptom for the native markdown preview; fixed by #620 (<code>71de847f6</code>), which is why workspace previews are live today.</li>
    <li><a href="https://github.com/get-bb/bb/pull/1299">#1299</a> "Fix stale file previews during slow workspace scans" &mdash; made the watcher emit <code>work-status-changed</code> before Git fingerprinting.</li>
    <li><a href="https://github.com/get-bb/bb/issues/2102">#2102</a> "A fileOpener cannot open another file or retitle its tab" &mdash; another gap in the file-opener plugin contract.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1773">#1773</a> "Docs file opener fails tab sync because fileOpenerOwner is rejected" (closed) &mdash; history of the Docs opener tab plumbing.</li>
  </ul>

  <h2>9. Appendix</h2>
  <h3>Commands run</h3>
  {pre('''pnpm install --frozen-lockfile --prefer-offline && pnpm exec turbo run build
scripts/bb-dev-app current                                  # App :15170, Server :23170, Host daemon :31170
pnpm bb:dev machine list                                    # host_fqcic7dtdr
curl -s -X POST http://localhost:23170/api/v1/projects ...  # proj_sy4khgnq6z
pnpm bb:dev thread spawn --project proj_sy4khgnq6z --environment /tmp/bb-2130-repo --provider codex \\
   --permission-mode accept-edits --title "2130 repro" --prompt "Reply only with ok." --json   # thr_qdnvnfqkvh
pnpm bb:dev thread wait thr_qdnvnfqkvh
pnpm bb:dev thread open thr_qdnvnfqkvh status.txt --json
pnpm bb:dev thread open thr_qdnvnfqkvh /tmp/bb-2130-outside/outside.txt   # Error: Absolute path must be inside the target thread workspace.
pnpm bb:dev thread tabs show/set thr_qdnvnfqkvh ...        # added host-file-preview and thread-storage-file-preview tabs
pnpm bb:dev plugin install builtin:docs --yes              # simple-notes@0.2.2 running
pnpm bb:dev thread open thr_qdnvnfqkvh NOTES.md --json     # -> plugin-panel tab owned by simple-notes
doobie --headless -b bb2130 run 2130/repro/browser/<script>.js   # see README
cd apps/app && pnpm exec vitest run src/hooks/queries/issue-2130-stale-file-preview.repro.test.tsx
cd plugins/docs && pnpm exec vitest run issue-2130-file-opener-stale.repro.test.tsx
git fetch origin main && git log --oneline fcada5a3b..origin/main   # 15f21ade7 (#2147), 2ad4bfaae (#2150) only''')}
  <h3>Evidence files</h3>
  <ul>
    <li><a href="2130/logs/thread-preview-queries.json">logs/thread-preview-queries.json</a> &mdash; React Query cache dump from the thread view.</li>
    <li><a href="2130/logs/vitest-app-previews.txt">logs/vitest-app-previews.txt</a>, <a href="2130/logs/vitest-docs-opener.txt">logs/vitest-docs-opener.txt</a> &mdash; raw test output.</li>
    <li><a href="2130/logs/project-create.json">logs/project-create.json</a>, <a href="2130/logs/thread-spawn.json">logs/thread-spawn.json</a>.</li>
    <li><a href="2130/repro/browser/">repro/browser/</a> &mdash; doobie scripts.</li>
  </ul>
  <h3>Things ruled out</h3>
  <ul>
    <li>The watcher missing gitignored directories: a directory added to <code>.gitignore</code> after the watcher started still refreshed (ignore list is computed once at watch start via <code>git status --ignored=matching</code>; a directory ignored <em>before</em> start would be skipped &mdash; not tested, noted as a caveat).</li>
    <li>Headless artefacts: the first run in the shared doobie profile showed the host-path preview "refreshing" &mdash; traced to another page being brought to front (<code>document.visibilityState</code> flipped to hidden/visible). All results above come from the isolated <code>-b bb2130</code> profile.</li>
  </ul>
"""

doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report &middot; #2130 Open file views do not refresh when a file changes on disk</title>
<style>{CSS}</style>
</head>
<body><main>{body}</main></body></html>
"""
(ROOT / "2130.html").write_text(doc)
print("wrote", ROOT / "2130.html", len(doc))
