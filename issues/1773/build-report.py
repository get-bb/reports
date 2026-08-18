import html, pathlib, re
R = pathlib.Path('/tmp/bb-reports/issues/1773/repro')
WT = pathlib.Path('/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-28')
def esc(p): return html.escape(pathlib.Path(p).read_text())
def strip_ansi(s): return re.sub(r'\x1b\[[0-9;]*m', '', s)
test1 = esc(WT/'apps/app/src/components/plugin/file-opener-tabs.issue-1773.test.ts')
test2 = esc(WT/'apps/app/src/lib/fixed-panel-tabs-sync.issue-1773.test.ts')
fixdiff = esc(R/'proposed-fix.diff')
vmain = html.escape(strip_ansi((R/'vitest-output-main.txt').read_text()))
watch = esc(R/'browser-watch-fast-output.txt')
diffclick = esc(R/'browser-diff-click2-output.txt')
diffclickfix = esc(R/'browser-diff-click2-fix-output.txt')
tabsfix = esc(R/'tabs-after-fix.json')
diffscript = esc(R/'browser-diff-click2.js')

BASE = 'https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/'
def L(path, a, b=None, text=None):
    frag = f'#L{a}' + (f'-L{b}' if b else '')
    t = text or f'{path}:{a}' + (f'-{b}' if b else '')
    return f'<a href="{BASE}{path}{frag}"><code>{t}</code></a>'

doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1773 Docs file opener fails tab sync because fileOpenerOwner is rejected</title>
<style>
  :root {{ --canvas:#fafaf8; --ink:#1a1a1a; --muted:#666; --line:#e2e2de; --accent:#0052cc; --high:#b60205; --ok:#0e8a16; --warn:#b26a00; }}
  body {{ margin:0; background:var(--canvas); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; }}
  main {{ max-width:900px; margin:0 auto; padding:40px 24px 80px; }}
  h1 {{ font-size:26px; line-height:1.25; margin:0 0 6px; }}
  h2 {{ font-size:18px; margin:36px 0 10px; padding-top:20px; border-top:1px solid var(--line); }}
  h3 {{ font-size:15px; margin:22px 0 6px; }}
  .meta {{ color:var(--muted); font-size:14px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }}
  .pill {{ display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); }}
  .pill.high {{ background:var(--high); color:#fff; border-color:var(--high); }}
  .pill.low {{ background:#eef; }}
  .verdict {{ font-weight:600; }}
  .v-repro {{ color:var(--high); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:14px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1773 · Docs file opener fails tab sync because <code>fileOpenerOwner</code> is rejected</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill low">Low</span> <span class="pill">Effort: Small</span>
    <span class="pill">docs</span> <span class="pill">plugin file openers</span> <span class="pill">thread tabs</span>
    <a href="https://github.com/get-bb/bb/issues/1773">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> The right-hand panel of a bb thread has a strip of tabs (file previews, terminals, plugin panels…). That strip is <em>persisted on the server</em> per thread (<code>PUT /api/v1/threads/:id/tabs</code>) so it survives reloads and follows you across clients. A plugin can register a <em>file opener</em>: the Docs plugin claims <code>.md</code> files, so opening a Markdown file from a thread creates a <code>plugin-panel</code> tab that hosts the Docs editor instead of the built-in preview.</p>
  <p>PR <a href="https://github.com/get-bb/bb/pull/1708">#1708</a> (shipped in desktop 0.38.0) made those opener tabs remember the native preview they replaced (an <code>Original</code> toggle) by adding a <code>fileOpenerOwner</code> object to the tab in the app-side model ({L('apps/app/src/components/plugin/file-opener-tabs.ts',37,51)}), and it taught the app's <em>local</em> zod schema about it ({L('apps/app/src/lib/fixed-panel-tabs-state.ts',197)}). It did <b>not</b> touch the shared server contract {L('packages/server-contract/src/api/thread-tabs.ts',37,46)}, whose <code>plugin-panel</code> branch is <code>.strict()</code>. Before every write, the app runs the whole tab list through that strict contract schema ({L('apps/app/src/lib/thread-tabs-sync.ts',155)}); zod throws <code>unrecognized_keys: fileOpenerOwner</code>, the PUT is never sent, and the catch handler shows the toast <code>Couldn't sync tabs</code> with the raw <code>ZodError.message</code> as description ({L('apps/app/src/lib/thread-tabs-sync.ts',193,196)}). The issue's quoted text "unrecognized code: [fileOpenerOwner]" is a paraphrase of that JSON.</p>
  <p>Consequence beyond the toast (not stated in the issue, verified here): as long as a Docs opener tab is in the strip, <b>none</b> of that thread's tab changes are persisted — the entire list fails validation. Depending on how the open was triggered, the opener tab either survives locally until the next reload/reconcile and then vanishes (click in the Diff panel, screenshots below), or is reconciled away against the server list within the same render pass and never appears at all (<code>bb thread open &lt;id&gt; README.md</code>, screenshots below). The reporter's "the file still opens and edits save" describes the first variant only.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Opening a Markdown workspace file with the Docs opener shows a "Couldn't sync tabs … fileOpenerOwner" toast</td><td class="ok">Verified</td><td>Reproduced twice on a dev instance at 16ceb3a54 (via <code>bb thread open</code> and via a Diff-panel click). Toast text: <code>Couldn’t sync tabs</code> / <code>[ {{ "code": "unrecognized_keys", "keys": [ "fileOpenerOwner" ], … }} ]</code>. See <a href="assets/1773-09-docs-open-toast.png">screenshot</a>. The wording "unrecognized code: [fileOpenerOwner]" in the issue is a paraphrase; the real description is the zod issue JSON.</td></tr>
    <tr><td>The file still opens and Docs edits save correctly</td><td class="unv">Partially verified</td><td>Docs editor renders (Diff-panel click path, <a href="assets/1773-09-docs-open-toast.png">screenshot</a>). Saving edits not exercised (independent of tab sync — Docs writes files via its own plugin routes). <b>But</b> via <code>bb thread open</code> the tab never appears at all (reconciled away in the same render pass, <a href="1773/repro/browser-watch-fast-output.txt">log</a>).</td></tr>
    <tr><td>Failure is limited to persisted thread-tab state</td><td class="ok">Verified, with a bigger blast radius</td><td>Only <code>PUT /threads/:id/tabs</code> is affected — but it is skipped for the <em>whole tab list</em>. After reload the Docs tab is gone (<a href="assets/1773-11-after-reload.png">screenshot</a>) and any other tab opened while it existed is also not persisted. No PUT is sent at all (browser network log in <a href="1773/repro/browser-diff-click2-output.txt">browser-diff-click2-output.txt</a>).</td></tr>
    <tr><td>Likely cause: strict <code>plugin-panel</code> branch of <code>threadTabSchema</code> lacks <code>fileOpenerOwner</code>; app-side schema accepts it</td><td class="ok">Verified</td><td>{L('packages/server-contract/src/api/thread-tabs.ts',37,46)} vs {L('apps/app/src/lib/fixed-panel-tabs-state.ts',194,204)}; unit repro <a href="1773/repro/file-opener-tabs.issue-1773.test.ts">file-opener-tabs.issue-1773.test.ts</a> fails on main with exactly that key.</td></tr>
    <tr><td>Related to #1708</td><td class="ok">Verified</td><td><code>git log -S fileOpenerOwner</code> → only 564090dfb (#1708), which is contained in tag <code>desktop-v0.38.0</code> (reporter's version). No commit on <code>origin/main</code> after 16ceb3a54 touches the four relevant files (checked 2026-08-18).</td></tr>
    <tr><td>Environment: bb desktop 0.38.0, Docs plugin 0.2.2, macOS</td><td class="ok">Consistent</td><td><code>plugins/docs/package.json</code> is version 0.2.2 (plugin id <code>simple-notes</code>, display name "Docs"). Repro here is the web app on Linux; the code path is platform-independent.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-28</code> at <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (detached; the worktree was initially created at a108fa7ef = origin/main tip, checked out to the base commit before the repro; <code>git diff 16ceb3a54 a108fa7ef</code> touches none of the relevant files).</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, pnpm workspace, vitest 4.1.1, zod ^4.3.6, codex-cli 0.147.0 (provider used for the one tiny turn).</li>
    <li>Dev instance via <code>scripts/bb-dev-app current</code>: App <code>http://localhost:18477</code>, Server <code>http://localhost:26477</code>, Host daemon <code>127.0.0.1:34477</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-28-1500173586fd</code>. Docs plugin installed with <code>bb plugin install builtin:docs --yes</code> (it is not enabled by default in a fresh dev data dir). Browser: headless Chromium via <code>dev-browser</code>.</li>
    <li>Scratch repo <code>/tmp/bb-1773-qa</code> (one <code>README.md</code>), project <code>proj_xmkmev8xtf</code>, thread <code>thr_vrsxemryh5</code>, environment <code>env_c7azq43dne</code>.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. Unit level (no running app): the contract rejects what the app builds</h3>
  <p>File: <a href="1773/repro/file-opener-tabs.issue-1773.test.ts">1773/repro/file-opener-tabs.issue-1773.test.ts</a> (copy to <code>apps/app/src/components/plugin/</code>). It builds an opener tab with the real <code>buildFileOpenerPanelTab</code> and feeds it to the real <code>threadTabsSchema</code> — exactly what <code>persistThreadTabs</code> does. Run from <code>apps/app</code>: <code>pnpm exec vitest run src/components/plugin/file-opener-tabs.issue-1773.test.ts</code>.</p>
  <pre>{test1}</pre>
  <p><b>Expected:</b> <code>result.success === true</code>. <b>Actual on main</b> (<a href="1773/repro/vitest-output-main.txt">full output</a>) — the second assertion fails and the printed message is verbatim what the toast shows:</p>
  <pre>{vmain}</pre>

  <h3>B. Hook level: the write is never attempted, the user gets the toast</h3>
  <p>File: <a href="1773/repro/fixed-panel-tabs-sync.issue-1773.test.ts">1773/repro/fixed-panel-tabs-sync.issue-1773.test.ts</a> (copy to <code>apps/app/src/lib/</code>; same mocking style as the neighbouring <code>fixed-panel-tabs-sync.test.ts</code>). It renders <code>useFixedPanelTabsState</code>/<code>useUpdateFixedPanelTabsState</code> for a thread whose server list is <code>[thread-info]</code>, adds the Docs opener tab the way <code>openTab()</code> does, and asserts that a PUT happens and no error toast fires. On main: <code>appToast.error("Couldn’t sync tabs", …)</code> is called once and <code>sdk.threads.tabs.update</code> is called <b>zero</b> times (the failure is client-side, before any HTTP).</p>
  <pre>{test2}</pre>

  <h3>C. Live app, path 1: <code>bb thread open</code> — toast, and the tab never even appears</h3>
  <ol>
    <li><code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code>; note App/Server URLs. <code>eval "$(scripts/bb-dev-app env)"</code>; also <code>unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE</code> if you run this from inside a bb thread.</li>
    <li><code>mkdir /tmp/bb-1773-qa &amp;&amp; cd /tmp/bb-1773-qa &amp;&amp; git init &amp;&amp; printf '# Hello 1773\\n\\nThis is a markdown file.\\n' &gt; README.md &amp;&amp; git add . &amp;&amp; git commit -m init</code></li>
    <li><code>pnpm bb:dev machine list</code> → host id; <code>curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/bb-1773-qa","hostId":"&lt;host id&gt;"}}}}'</code> → project id.</li>
    <li><code>pnpm bb:dev plugin install builtin:docs --yes</code> (Docs plugin id is <code>simple-notes</code>). Leave the file-opener preference at Automatic (default) — with a single <code>.md</code> opener registered, Automatic already routes <code>.md</code> to Docs ({L('apps/app/src/lib/plugin-slot-resolvers.ts',299,329)}).</li>
    <li><code>pnpm bb:dev thread spawn --project &lt;proj&gt; --provider codex --permission-mode accept-edits --title "1773 repro" --prompt "Reply only with ok." --json</code> → thread id; wait until idle.</li>
    <li>Open <code>http://localhost:&lt;app port&gt;/projects/&lt;proj&gt;/threads/&lt;thread&gt;</code> in a browser, then run <code>pnpm bb:dev thread open &lt;thread&gt; README.md --json</code>.</li>
  </ol>
  <p>Script used to record the browser side while step 6 ran: <a href="1773/repro/browser-reload-and-watch-fast.js">browser-reload-and-watch-fast.js</a> (+ <a href="1773/repro/run-thread-open.sh">run-thread-open.sh</a>). Output (<a href="1773/repro/browser-watch-fast-output.txt">browser-watch-fast-output.txt</a>): the tab strip, sampled every 150 ms, never contains a README tab; the toast appears; only GETs hit <code>/tabs</code>, no PUT.</p>
  <pre>{watch}</pre>
  <figure><img src="assets/1773-06-toast.png" alt="toast after bb thread open"><figcaption>Right after <code>bb thread open … README.md</code>: the toast at bottom-right reads "Couldn’t sync tabs" with the zod JSON; the panel strip (Info, Diff, +) has no README tab — the opener tab was reconciled away in the same render pass.</figcaption></figure>

  <h3>D. Live app, path 2: click in the Diff panel — Docs editor opens, toast, tab lost on reload</h3>
  <ol start="7">
    <li><code>echo "extra line" &gt;&gt; /tmp/bb-1773-qa/README.md</code> so the Diff panel lists README.md.</li>
    <li>In the thread, press <kbd>Ctrl+D</kbd> (Show diff panel) and click the <code>README.md</code> file header in the diff.</li>
    <li>Reload the page.</li>
  </ol>
  <p>Script: <a href="1773/repro/browser-diff-click2.js">browser-diff-click2.js</a>; output <a href="1773/repro/browser-diff-click2-output.txt">browser-diff-click2-output.txt</a>:</p>
  <pre>{diffclick}</pre>
  <p><b>Expected:</b> the Docs tab opens, a PUT persists it, no toast, the tab is still there after reload. <b>Actual:</b> the tab opens (discrete click → React commits the local state before the write queue rejects), the toast appears, <b>no PUT is sent</b>, and after reload the tab is gone.</p>
  <figure><img src="assets/1773-08-diff-panel.png" alt="diff panel"><figcaption>Step 8, before the click: Diff panel showing README.md (+1). The click target is the <code>README.md</code> file header.</figcaption></figure>
  <figure><img src="assets/1773-09-docs-open-toast.png" alt="docs open with toast"><figcaption>The moment the bug shows: the Docs editor (Docs icon on the tab, rendered Markdown, no Preview/Raw switch of the built-in viewer) is open in the right panel and the "Couldn’t sync tabs" toast is at bottom-right. This is the reporter's exact scenario.</figcaption></figure>
  <figure><img src="assets/1773-11-after-reload.png" alt="after reload"><figcaption>Step 9, after reload: the README.md tab is gone; the strip only has the persisted Info/Diff tabs. The server row never received the opener tab.</figcaption></figure>

  <h2>Root cause</h2>
  <p><b>Mechanism.</b> {L('apps/app/src/components/plugin/file-opener-tabs.ts',37,51,'buildFileOpenerPanelTab')} spreads a normal <code>plugin-panel</code> tab and adds <code>fileOpenerOwner: owner</code> (added in #1708 so the tab can render "Original", i.e. the diverted native preview):</p>
  <pre>export function buildFileOpenerPanelTab(opener, file, owner): PluginPanelFixedPanelTab {{
  return {{
    ...createPluginPanelFixedPanelTab({{ actionId: `file-opener:${{opener.id}}`, paramsJson: …, pluginId: opener.pluginId, title: … }}),
    fileOpenerOwner: owner,
  }};
}}</pre>
  <p>The app's <em>local</em> tab model knows the field ({L('apps/app/src/lib/fixed-panel-tabs-state.ts',197)} schema, {L('apps/app/src/lib/fixed-panel-tabs-state.ts',272)} type; <code>stripTransientFixedPanelTabForStorage</code> even normalises it for storage at {L('apps/app/src/lib/fixed-panel-tabs-state.ts',844,852)}). The <em>shared</em> contract that the sync layer and the server both use does not:</p>
  <pre>// packages/server-contract/src/api/thread-tabs.ts:37-46 (unchanged by #1708)
  z.object({{
      actionId: z.string().min(1).max(THREAD_TAB_PATH_MAX_LENGTH),
      id: threadTabIdSchema,
      kind: z.literal("plugin-panel"),
      paramsJson: z.string().max(THREAD_TAB_PARAMS_MAX_LENGTH).nullable(),
      pluginId: z.string().min(1).max(THREAD_TAB_PATH_MAX_LENGTH),
      title: z.string().min(1).max(THREAD_TAB_TITLE_MAX_LENGTH),
    }})
    .strict(),</pre>
  <p>Every persisted write goes through {L('apps/app/src/lib/thread-tabs-sync.ts',144,158,'persistThreadTabs')}, which calls <code>threadTabsSchema.parse(tabs)</code> on the whole list <em>before</em> <code>sdk.threads.tabs.update</code>. <code>.strict()</code> + an unknown key → <code>ZodError</code> → the promise rejects → {L('apps/app/src/lib/thread-tabs-sync.ts',178,207,'enqueueThreadTabsWrite')} shows <code>appToast.error("Couldn’t sync tabs", {{ description: error.message }})</code> (hence the JSON in the toast) and invalidates the cached tabs. TypeScript does not catch this: <code>FixedPanelTab</code>'s plugin-panel variant is a structural superset of the contract's, so passing it where <code>readonly ThreadTab[]</code> is expected compiles fine; only the runtime schema disagrees.</p>
  <p><b>Why the tab sometimes vanishes immediately.</b> {L('apps/app/src/lib/fixed-panel-tabs.ts',217,240,'useFixedPanelTabsState')}'s effect reconciles local tabs to the server list whenever <code>state.secondary.tabs</code> or the query data changes, unless a write is pending. When the open is triggered outside a discrete React event (websocket message from <code>bb thread open</code>), the write queue rejects in microtasks (cached GET → synchronous parse throw → <code>finally</code> decrements the pending count) before React's scheduled render/effect runs; the effect then sees "no pending write" and replaces the local list with the server list, so the opener tab never renders. From a discrete click, React commits synchronously, the effect runs while the write is still pending, and the tab stays until the next reconcile (reload). Both branches are visible in the repro logs. Nothing in the app strips <code>fileOpenerOwner</code> before the contract parse, and the server route ({L('apps/server/src/routes/threads/tabs.ts',18,24)}) parses stored JSON with the same strict schema, so an app-side workaround that sent the field anyway would get a 400 instead.</p>
  <p><b>Deeper issue.</b> Two schemas describe the same persisted object (app <code>fixedPanelTabsStateSchema</code> for localStorage, contract <code>threadTabSchema</code> for the server) and nothing ties them together; #1708 extended one and not the other, and no test parses an opener tab with the contract. Also note that <code>fileOpenerOwner</code> is derivable from <code>paramsJson</code> for the workspace/host/thread-storage cases (path + source; <code>lineRange</code> is nulled for storage anyway and <code>statusLabel</code>/<code>source</code> are fixed to non-deleted working-tree by <code>ownerRequestForOpenRequest</code>), so persisting it at all is a design choice worth revisiting. Side observation (not this bug): the New-tab file search and Recent items open files through <code>selectFileSearchResult</code> ({L('apps/app/src/components/secondary-panel/useThreadFileTabs.ts',517,544)}), which does <em>not</em> apply opener diversion, contradicting the "every file-open flow funnels through here" comment on <code>openTab</code>; that is why my first attempt via "Search files" got the built-in preview.</p>

  <h2>Proposed fix (first principles)</h2>
  <p>Teach the shared contract the field, mirroring the app schema, so the app-side parse, the PUT body validation and the server's read-back all accept it. Optional-ness is semantic here (present only on opener tabs, absent on plain plugin-panel action tabs), which is allowed by the repo's contract rules. Diff (<a href="1773/repro/proposed-fix.diff">proposed-fix.diff</a>, applied and reverted in my worktree):</p>
  <pre>{fixdiff}</pre>
  <p>Verified with the fix applied: both repro tests pass, the existing <code>fixed-panel-tabs-*</code>, <code>useThreadFileTabs</code> and <code>apps/server/test/public/public-thread-tabs.test.ts</code> suites pass (<a href="1773/repro/vitest-with-fix.txt">vitest-with-fix.txt</a>), <code>turbo typecheck</code> for <code>@bb/server-contract</code>, <code>@bb/app</code>, <code>@bb/server</code> passes (<a href="1773/repro/typecheck-with-fix.txt">log</a>), and the live Diff-panel flow now sends <code>PUT … =&gt; 200</code>, shows no toast, and the tab survives reload (<a href="1773/repro/browser-diff-click2-fix-output.txt">output</a>, <a href="assets/1773-12-fixed-after-reload.png">screenshot</a>; persisted row in <a href="1773/repro/tabs-after-fix.json">tabs-after-fix.json</a>):</p>
  <pre>{diffclickfix}</pre>
  <figure><img src="assets/1773-12-fixed-after-reload.png" alt="fixed: tab survives reload"><figcaption>With the contract fix applied: after a page reload the README.md Docs tab is still in the strip and the Docs editor is showing (compare with the "after reload" screenshot above).</figcaption></figure>
  <p><b>What else must move with it / what could go wrong.</b> (1) The plugin-sdk bundles the contract's zod types: <code>packages/plugin-sdk/bundled-types/bb-plugin-sdk.d.ts</code> and <code>packages/templates/src/generated/plugin-sdk-dts.generated.ts</code> are committed build outputs and change when this schema changes — regenerate them in the same PR (turbo build did it automatically in my worktree). (2) Delete the now-redundant app-side <code>fileOpenerOwnerRequestSchema</code> in <code>fixed-panel-tabs-state.ts</code> in favour of the contract's, or at least add a test that parses <code>buildFileOpenerPanelTab(...)</code> output with <code>threadTabsSchema</code> (test A above) so the two cannot drift again. (3) No <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump is needed: this is app↔server, not server↔daemon. (4) Rows written by a fixed client are readable only by a fixed server (same release), which is the normal app+server pairing; an old server would 400 the PUT rather than corrupt anything. (5) Alternative, smaller-wire design: do not persist <code>fileOpenerOwner</code>; rebuild it from <code>paramsJson</code> on read. More code, and it changes what "Original" can restore for the host/thread-storage variants, so I would ship the contract fix first.</p>
  <p>Secondary robustness suggestion: <code>enqueueThreadTabsWrite</code> should not surface <code>ZodError.message</code> (a JSON dump) as the toast description; and the app could avoid dropping local-only tabs during reconcile when the last write failed for a client-side reason. Both are separate from the root cause.</p>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue (searched GitHub for <code>fileOpenerOwner</code> / "1773"; nothing).</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/pull/1708">#1708 Unify plugin app slot resolution and replacement hosts</a> — merged 2026-08-17, in <code>desktop-v0.38.0</code>; introduced <code>fileOpenerOwner</code> (the regression source).</li>
    <li>No other issue mentions "sync tabs" or file openers (GitHub search 2026-08-18).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Files</h3>
  <ul>
    <li><a href="1773/repro/file-opener-tabs.issue-1773.test.ts">file-opener-tabs.issue-1773.test.ts</a>, <a href="1773/repro/fixed-panel-tabs-sync.issue-1773.test.ts">fixed-panel-tabs-sync.issue-1773.test.ts</a> — repro tests (fail on main, pass with the fix). Outputs: <a href="1773/repro/vitest-output-main.txt">main</a>, <a href="1773/repro/vitest-with-fix.txt">with fix</a>.</li>
    <li><a href="1773/repro/browser-reload-and-watch-fast.js">browser-reload-and-watch-fast.js</a> + <a href="1773/repro/run-thread-open.sh">run-thread-open.sh</a> → <a href="1773/repro/browser-watch-fast-output.txt">output</a> (path C).</li>
    <li><a href="1773/repro/browser-diff-click.js">browser-diff-click.js</a> (opens Diff panel, lists candidate buttons), <a href="1773/repro/browser-diff-click2.js">browser-diff-click2.js</a> → <a href="1773/repro/browser-diff-click2-output.txt">output</a> (path D); <a href="1773/repro/browser-diff-click2-fix.js">browser-diff-click2-fix.js</a> → <a href="1773/repro/browser-diff-click2-fix-output.txt">output</a> (with fix).</li>
    <li><a href="1773/repro/proposed-fix.diff">proposed-fix.diff</a>, <a href="1773/repro/typecheck-with-fix.txt">typecheck-with-fix.txt</a>, <a href="1773/repro/tabs-after-fix.json">tabs-after-fix.json</a>.</li>
  </ul>
  <h3>Diff-panel browser script (path D)</h3>
  <pre>{diffscript}</pre>
  <h3>Persisted row after the fix (<code>GET /api/v1/threads/thr_vrsxemryh5/tabs</code>)</h3>
  <pre>{tabsfix}</pre>
  <h3>Commands run (chronological, abridged)</h3>
  <pre>pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
git checkout 16ceb3a54            # worktree had been created at a108fa7ef (origin/main tip)
scripts/bb-dev-app current        # App :18477, Server :26477, daemon :34477
pnpm bb:dev machine list          # host_qp4juc9h25
curl -s -X POST http://localhost:26477/api/v1/projects -H 'content-type: application/json' \\
  -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/bb-1773-qa","hostId":"host_qp4juc9h25"}}}}'   # proj_xmkmev8xtf
pnpm bb:dev thread spawn --project proj_xmkmev8xtf --provider codex --permission-mode accept-edits --title "1773 repro" --prompt "Reply only with ok." --json  # thr_vrsxemryh5
curl -s http://localhost:26477/api/v1/plugins    # docs not installed by default
pnpm bb:dev plugin install builtin:docs --yes    # simple-notes@0.2.2 running
# (dead end) New tab "Search files" -> built-in preview: file search does not apply opener diversion
curl -s -X PUT …/tabs -d '{{"expectedRevision":N,"tabs":[{{"id":"thread-info:thread-info:none","kind":"thread-info"}}]}}'  # reset strip between runs
dev-browser --browser bb1773 --headless run browser-reload-and-watch-fast.js &amp; ./run-thread-open.sh   # path C
pnpm bb:dev thread tell thr_vrsxemryh5 "Look at README.md and reply only with ok."   # (dead end: no clickable link rendered)
echo "extra line" &gt;&gt; /tmp/bb-1773-qa/README.md
dev-browser … run browser-diff-click.js; dev-browser … run browser-diff-click2.js   # path D
cd apps/app &amp;&amp; pnpm exec vitest run src/components/plugin/file-opener-tabs.issue-1773.test.ts src/lib/fixed-panel-tabs-sync.issue-1773.test.ts
# apply proposed-fix.diff; scripts/bb-dev-app current; run browser-diff-click2-fix.js; vitest + turbo typecheck; git checkout -- packages/server-contract
pnpm dev:stop</pre>
  <h3>Git evidence</h3>
  <pre>$ git log --oneline -S fileOpenerOwner -- apps/app/src packages/server-contract
564090dfb Unify plugin app slot resolution and replacement hosts (#1708)
$ git tag --contains 564090dfb
desktop-v0.38.0
$ git log 16ceb3a54..origin/main --oneline -- packages/server-contract/src/api/thread-tabs.ts apps/app/src/lib/fixed-panel-tabs-state.ts apps/app/src/lib/thread-tabs-sync.ts apps/app/src/components/plugin/file-opener-tabs.ts
(empty — not fixed on origin/main as of 2026-08-18)</pre>
</main></body></html>
'''
pathlib.Path('/tmp/bb-reports/issues/1773.html').write_text(doc)
print(len(doc))
