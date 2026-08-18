import html, pathlib
D = pathlib.Path('/tmp/bb-reports/issues/1302')
def esc(p): return html.escape(pathlib.Path(p).read_text())
send1 = esc(D/'repro/send1-api-log.txt').replace('/home/sawyer/.dev-browser/tmp/1302-thread-after.png','').rstrip()
send3 = esc(D/'repro/send3-concurrent-api-log.txt').replace('/home/sawyer/.dev-browser/tmp/1302-thread-after.png','').rstrip()
test = esc(D/'repro/issue-1302-sidebar-bootstrap-refetch.test.ts')
unit = esc(D/'repro/unit-test.out')
parse = esc(D/'repro/parse-cost.txt')
rvp = esc(D/'repro/refetch-vs-patch-6x.txt')
prof = html.escape('\n'.join(pathlib.Path(D/'repro/profile-send-6x.txt').read_text().splitlines()[:30]))
BASE = "https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/"
def L(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="{BASE}{path}{frag}">{path}{frag}</a>'

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1302 sidebar-bootstrap ships 138KB and refetches wholesale on thread status changes</title>
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
  .pill.medium {{ background:var(--warn); color:#fff; border-color:var(--warn); }}
  .verdict {{ font-weight:600; }}
  .v-yes {{ color:var(--high); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }}
  figure {{ margin:12px 0; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1302 · sidebar-bootstrap ships 138KB and refetches wholesale on thread status changes</h1>
  <p class="meta">
    <span class="pill">Perf</span> <span class="pill medium">Medium</span> <span class="pill">Effort: not set</span>
    <span class="pill">perf</span>
    <a href="https://github.com/get-bb/bb/issues/1302">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-yes">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> The web app's left sidebar (projects and their threads) is loaded with a single request, <code>GET /api/v1/sidebar-bootstrap</code>, which returns <em>every</em> unarchived, visible thread of <em>every</em> project with the full thread record (28 top-level keys, ~1&nbsp;KB per thread). The server pushes "something about thread X changed" notifications over a WebSocket. For a <code>status-changed</code> notification (a thread going idle→active when a turn starts and active→idle when it ends) the app has exactly one thing it can do: throw the whole cached sidebar document away and download it again, because the notification carries no row data and the sidebar lives in one monolithic react-query entry.</p>
  <p>On the base commit with the seeded 1,200-thread database (129 visible unarchived threads) I measured: <b>133,614 bytes</b> (10,770 bytes gzip) per <code>sidebar-bootstrap</code> response; <b>2 full refetches per single message send</b> (one at turn start, one at turn end) inside a <b>19-request fan-out</b>, with 96% of the transferred bytes being the two bootstrap copies; spawning two threads produced 8 refetches (1.09&nbsp;MB; the verifier's re-run: 6 / 819&nbsp;KB); three concurrent one-line turns produced 4 refetches (546&nbsp;KB) in my run and 2 (273&nbsp;KB) in the verifier's, because react-query's in-flight dedupe absorbs transitions that land while a bootstrap fetch is still outstanding, so under concurrency the count is anywhere from 2 to 2×N per batch of N turns depending on timing. All of the issue's numbers reproduce within a few percent. The status change is delivered as a bare "dirty" flag (<code>metadata</code> only carries <code>projectId</code>), the app's <code>status-changed</code> rule invalidates <code>sidebarNavigationQueryKey()</code> globally with an <em>immediate</em> flush, and there is no scoping to the affected project or row.</p>
  <p>Two things the issue gets slightly wrong: JSON parse of the document is cheap (≈1&nbsp;ms even at 6× CPU throttling), and because react-query structural sharing keeps unchanged row identities, the wholesale refetch does <em>not</em> by itself re-render every sidebar row. The expensive re-render I measured (650–930&nbsp;ms at 6× throttle in the dev build) is the reorder that happens whenever a thread becomes active and jumps to the top of its project, and it happens the same way whether the row arrives via refetch or patch. The durable cost of today's design is therefore the wire bytes plus latency per lifecycle event (11&nbsp;KB gzip × 2 per turn × every active thread, on mobile links), one server-side full thread-list read per event, and the O(all threads) deep-compare on the client — not parse or render. Measured: the redundant refetch alone costs 20–45&nbsp;ms of main-thread time at 6× throttle; a <code>setQueryData</code> patch of the same row costs ≈1&nbsp;ms before render.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td><code>sidebar-bootstrap</code> returns ~138&nbsp;KB (11.7&nbsp;KB gzip) for 131 unarchived threads</td><td class="ok">Verified</td><td>133,614 B / 10,770 B gzip for 129 visible unarchived threads on the seeded DB (<a href="1302/repro/bootstrap.json">bootstrap.json</a>). The small delta is the seed's random visible/hidden split.</td></tr>
    <tr><td>~1.1&nbsp;KB per thread across 29 fields; sidebar renders ~8 of them</td><td class="unv">Partially verified</td><td>1,002 B per thread row; 28 top-level keys (20 thread + <code>runtime</code>{{2}} + <code>activity</code>{{5}} + 7 list-entry fields). A grep of <code>apps/app/src/components/sidebar/</code> finds ~16 fields read (id, projectId, parentThreadId, activity, status, environmentId, title, titleFallback, sectionId, hasPendingInteraction, runtime, visibility, updatedAt, pinnedAt, environmentWorkspaceDisplayKind, environmentHostId), so "8" is low, but roughly half the shape is unused by the sidebar (sourceThreadId, originKind, originPluginId, archivedAt, deletedAt, lastReadAt, latestAttentionAt, createdAt, environmentName, environmentBranchName, …), plus per-project <code>sources[]</code> and <code>defaultExecutionOptions</code>.</td></tr>
    <tr><td>Sending one message refetches the entire payload; refires on lifecycle transitions</td><td class="ok">Verified</td><td>Exp. A: two <code>GET /api/v1/sidebar-bootstrap</code> (134,865 B and 134,861 B) 1.36&nbsp;s apart, at turn start and turn end, per single <code>bb thread tell</code>. The unit test below shows the invalidation is unconditional on <code>status-changed</code>.</td></tr>
    <tr><td>With several concurrently active threads every turn start/stop reparses and re-renders the whole sidebar tree</td><td class="unv">Partially verified</td><td>Refetches multiply, but the multiplier is timing dependent (exp. B: 3 concurrent turns → 4 refetches in my run, 2 in the verifier's; spawning 2 threads → 8 in my run, 6 in the verifier's; the ceiling is 2 per turn, the floor is 2 per batch when all transitions land inside one in-flight fetch). Whole-tree re-render is <b>not</b> what happens: rows are <code>memo</code>'d and react-query structural sharing keeps unchanged row identities, so only the changed row and its ancestors re-render; the heavy render is the active-row reorder, which a patch would trigger too (exp. D).</td></tr>
    <tr><td>Multiplies with the drawer mount cost in #1261</td><td class="unv">Not tested</td><td>#1261 was closed by PR #1307 (virtualized sidebar, mobile drawer kept mounted). <code>AppLayout</code> still calls <code>useSidebarNavigation()</code> unconditionally, so the refetches happen with the drawer closed too.</td></tr>
    <tr><td>Server time is fine (~8&nbsp;ms warm); the cost is wire size, JSON parse and re-render on mobile CPUs</td><td class="unv">Partially verified</td><td>curl: 7.4&nbsp;ms total. JSON.parse of the 136&nbsp;KB body: 0.2&nbsp;ms, 1.0&nbsp;ms at 6× CPU throttle (exp. C): parse is negligible. Fetch+parse+structural-share of a redundant refetch: 20–45&nbsp;ms at 6× throttle (exp. D). Wire size (and one server-side thread-list read per event) is the real per-event cost.</td></tr>
    <tr><td>Repro step 1: <code>pnpm seed:perf</code></td><td class="no">Broken while the dev server is running</td><td>The seed inserts 604 environments, 481 of them <code>destroyed</code>; the running server's <code>sweep:destroyed-environment-prune</code> deleted them mid-seed (dev.log: <code>delete from "environments" where id in (…481 args)</code>) and the seed died with <code>SqliteError: FOREIGN KEY constraint failed</code> at <code>seed-perf-fixture.ts:1005</code>. Stop the dev app first (<code>pnpm dev:stop</code>), then <code>pnpm seed:perf -- --reset</code>, then start it. The command's help says the opposite ("Start the dev app once before seeding").</td></tr>
    <tr><td>Comment: production 0.37.0 install with 1,071 unarchived threads (985 idle, 86 error) is affected</td><td class="unv">Unverifiable, consistent</td><td>Nothing in the code path is size-bounded; at ~1&nbsp;KB per row that install downloads ~1&nbsp;MB (≈85&nbsp;KB gzip) twice per turn.</td></tr>
    <tr><td>Push-driven patching would remove most of the ~10-request fan-out after a send</td><td class="unv">Partially verified</td><td>Observed 19 requests after one send (exp. A); the bootstrap is 2 of them but 96% of the bytes. The rest are timeline deltas, child/fork lists, PR state, read receipt; several are project-scoped list invalidations of the same rule (see #1303).</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18), worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-24</code>. Dev instance: app <code>:15464</code>, server <code>:23464</code>, daemon <code>:31464</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-24-3f1b3830f25d</code>. Vite dev build of the app (unminified React dev runtime, so absolute CPU numbers are inflated versus production; ratios are what matter).</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, codex-cli 0.147.0 (provider <code>codex</code>, model gpt-5.6-sol), headless Chromium via <code>dev-browser</code>.</li>
    <li>DB: <code>pnpm seed:perf -- --reset</code> (12 projects, 1,200 threads, 402,298 events; 174 unarchived, 129 visible), plus project <code>proj_qk56xcanay</code> (local path <code>/tmp/1302-qa</code>, host <code>host_eg4qqky6xx</code>) with threads <code>thr_mfe9vetq34</code>, <code>thr_m4e7y5crhi</code>, <code>thr_q93qsjsqnb</code>.</li>
    <li>CLI wrapper: <a href="1302/repro/1302-bb.sh">1302/repro/1302-bb.sh</a> (set <code>BB_REPO</code> to your worktree; it <b>always</b> evaluates <code>scripts/bb-dev-app env</code> from that worktree, after unsetting every inherited <code>BB_*</code> variable). <b>Warning:</b> a shell opened from inside a bb agent thread already exports <code>BB_SERVER_URL</code> (the user's real instance on <code>:38886</code>) and <code>BB_THREAD_ID</code>; the first version of this wrapper honoured a pre-set <code>BB_SERVER_URL</code> and the verifier caught it listing the real instance's hosts. The fixed wrapper (and <code>1302-wait-idle.sh</code>) ignore inherited values and print <code>bb -&gt; &lt;url&gt;</code> on stderr so you can see which server every command hits; use <code>BB_DEV_SERVER_URL=…</code> to override deliberately. Verified after the fix: with <code>BB_SERVER_URL=http://127.0.0.1:38886</code> exported, <code>1302-bb.sh machine list</code> printed <code>bb -&gt; http://localhost:22777</code> and returned only that instance's host (<a href="1302/verify/wrapper-isolation-check.txt">wrapper-isolation-check.txt</a>). Browser scripts are <code>dev-browser</code> QuickJS/Playwright scripts; run them with <code>dev-browser --headless run &lt;file&gt;</code>. In the transcripts below <code>bb</code> means the wrapper.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <ol>
    <li>Build and seed (server must be <b>stopped</b> during seeding, see claims table):
      <pre>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
scripts/bb-dev-app current      # once, so the seed can attach to the real host id
pnpm dev:stop
pnpm seed:perf -- --reset       # 12 projects / 1200 threads / 402k events, ~13 s
scripts/bb-dev-app current      # note App/Server URLs; eval "$(scripts/bb-dev-app env)"</pre></li>
    <li>Measure the payload:
      <pre>$ curl -s $BB_SERVER_URL/api/v1/sidebar-bootstrap -o bootstrap.json -w "http=%{{http_code}} bytes=%{{size_download}} time=%{{time_total}}s\\n"
http=200 bytes=133614 time=0.007403s
$ gzip -k9 bootstrap.json &amp;&amp; ls -l bootstrap.json.gz
-rw-rw-r-- 1 sawyer sawyer  10770 Aug 18 07:45 bootstrap.json.gz
$ jq '{{projects:(.projects|length), threads:([.projects[].threads|length]|add)}}' bootstrap.json
{{ "projects": 12, "threads": 129 }}
$ jq -c '.projects[0].threads[0]' bootstrap.json | wc -c
1002</pre>
      <b>Expected</b> (issue): a sidebar-sized row (title, status, project, unread, pinned, provider, branch, attention time). <b>Actual</b>: the full <code>ThreadListEntry</code> (see <a href="1302/repro/bootstrap.json">bootstrap.json</a>): 28 top-level keys including <code>sourceThreadId</code>, <code>originPluginId</code>, <code>deletedAt</code>, <code>archivedAt</code>, <code>environmentBranchName</code>, the five <code>activity</code> counters, plus each project's <code>sources[]</code> and <code>defaultExecutionOptions</code>.</li>
    <li>Create a scratch project and one idle codex thread (host id from <code>bb machine list --json</code>):
      <pre>mkdir -p /tmp/1302-qa &amp;&amp; cd /tmp/1302-qa &amp;&amp; git init -q &amp;&amp; echo hi &gt; README.md &amp;&amp; git add . &amp;&amp; git commit -qm init
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{{"name":"qa1302","source":{{"type":"local_path","path":"/tmp/1302-qa","hostId":"host_eg4qqky6xx"}}}}'      # -&gt; proj_qk56xcanay
bb thread spawn --project proj_qk56xcanay --machine host_eg4qqky6xx --provider codex --permission-mode accept-edits \\
  --title "1302 target" --prompt "Reply only with ok." --json                                                # -&gt; thr_mfe9vetq34</pre>
      If the spawn returns <code>HTTP 503: Unable to load codex models to resolve the default</code>, that is a transient <code>provider.list_models</code> timeout on a loaded machine (the verifier hit it twice at load 120+); just retry the same command.</li>
    <li><b>Exp. A: one send, count requests.</b> Open the thread in the browser and install a fetch logger (<a href="1302/repro/browser-05-goto-thread.js">browser-05-goto-thread.js</a>; edit the ids at the top), then send one message from the shell and collect (<a href="1302/repro/browser-06-collect.js">browser-06-collect.js</a>):
      <pre>$ dev-browser --headless run 1302/repro/browser-05-goto-thread.js
http://localhost:15464/projects/proj_qk56xcanay/threads/thr_mfe9vetq34
calls in the 3s after install (should be quiet): []
$ bb thread tell thr_mfe9vetq34 "Reply only with ok."
Thread thr_mfe9vetq34 steered
$ 1302/repro/1302-wait-idle.sh thr_mfe9vetq34 &amp;&amp; dev-browser --headless run 1302/repro/browser-06-collect.js</pre>
      <pre>{send1}</pre>
      <b>Expected</b> (issue's suggested behavior): the sidebar row for <code>thr_mfe9vetq34</code> is patched from the push event, no bootstrap refetch. <b>Actual</b>: two full 135&nbsp;KB bootstrap downloads (offset 2&nbsp;ms = turn start, 1364&nbsp;ms = turn end), 19 requests total, 269,726 of 280,470 bytes are the bootstrap (<a href="1302/repro/send1-api-log.txt">send1-api-log.txt</a>). Note the timeline uses <code>?afterSequence=</code> deltas; the sidebar has no equivalent.</li>
    <li><b>Exp. B: concurrency multiplies it.</b> Spawn two siblings (<a href="1302/repro/1302-spawn-siblings.sh">1302-spawn-siblings.sh</a>; the two spawns alone caused 8 bootstrap refetches = 1,091,168 bytes), reset the logger, then tell all three at once (<a href="1302/repro/1302-tell-concurrent.sh">1302-tell-concurrent.sh</a>):
      <pre>$ 1302/repro/1302-tell-concurrent.sh thr_mfe9vetq34 thr_m4e7y5crhi thr_q93qsjsqnb &amp;&amp; dev-browser --headless run 1302/repro/browser-06-collect.js
{send3}</pre>
      Six status transitions in ~2.5&nbsp;s produced 4 bootstrap downloads (546&nbsp;KB, <a href="1302/repro/send3-concurrent-api-log.txt">send3-concurrent-api-log.txt</a>); the two "missing" ones were absorbed by react-query's in-flight dedupe. <b>This number is timing dependent, not a constant.</b> The independent verifier's re-run of the same script produced only 2 bootstrap downloads (273,212&nbsp;B; <a href="1302/verify/send3-concurrent-api-log.txt">verify/send3-concurrent-api-log.txt</a>) because all three turns started within a few ms and all three ended within ~200&nbsp;ms of each other, so each batch of three transitions was absorbed by one in-flight fetch. Spawning two siblings, whose transitions are spread over ~15&nbsp;s, refetched 8× (1.09&nbsp;MB) in my run and 6× (818,776&nbsp;B; <a href="1302/verify/spawn2-api-log.txt">verify/spawn2-api-log.txt</a>) in the verifier's. The rule is: every <code>status-changed</code> push that arrives while no bootstrap fetch is in flight starts a new full download, so N concurrent turns cost between 2 and 2×N downloads. Sibling transitions also refetch the open thread's child/fork lists and PR state (project-scoped list invalidation from the same rule).</li>
    <li><b>Unit-level repro</b> of the invalidation rule (file: <a href="1302/repro/issue-1302-sidebar-bootstrap-refetch.test.ts">issue-1302-sidebar-bootstrap-refetch.test.ts</a>; copy to <code>apps/app/src/hooks/</code>). It passes on main, i.e. it documents current behavior: an active <code>sidebarNavigation</code> observer with <code>staleTime: Infinity</code> is refetched once per <code>status-changed</code> push, including for a thread that is not in the sidebar payload at all. Run with <code>cd apps/app &amp;&amp; pnpm exec vitest run src/hooks/issue-1302-sidebar-bootstrap-refetch.test.ts</code>.
      <pre>{test}</pre>
      <pre>{unit}</pre></li>
  </ol>
  <figure><img src="assets/1302-sidebar-seeded.png" alt="app with seeded sidebar"><figcaption>The app on the seeded database: 129 visible threads across 12 projects behind the (virtualized) sidebar. Every one of these rows is re-downloaded on any thread's status change.</figcaption></figure>
  <figure><img src="assets/1302-thread-after-send.png" alt="thread view after send"><figcaption>Thread <code>thr_mfe9vetq34</code> at the end of the run (after the spawn prompt, the exp. A send and the exp. B concurrent send, hence three "Reply only with ok." exchanges). The fetch logs above were captured on this page.</figcaption></figure>

  <h3>Exp. C: parse cost is not the problem</h3>
  <p><a href="1302/repro/browser-07-parse-cost.js">browser-07-parse-cost.js</a> parses the live payload 20× in the app page with and without CDP <code>Emulation.setCPUThrottlingRate(6)</code>:</p>
  <pre>{parse}</pre>

  <h3>Exp. D: what a redundant refetch costs vs. patching one row</h3>
  <p><a href="1302/repro/browser-09-refetch-vs-patch.js">browser-09-refetch-vs-patch.js</a> pulls the <code>QueryClient</code> out of the React fiber tree, then under 6× CPU throttle (a) changes one seeded row's title via <code>PATCH /threads/:id</code>, waits 1.5&nbsp;s for the realtime-driven refetch to land, and times a further <code>refetchQueries(['sidebarNavigation'])</code> (fetch + parse + structural share; the data is now identical so no render follows), and (b) times a <code>setQueryData</code> patch that flips that row's <code>status</code>/<code>runtime.displayStatus</code> between <code>active</code> and <code>idle</code>, then waits two animation frames:</p>
  <pre>{rvp}</pre>
  <p>Reading: a redundant 136&nbsp;KB refetch costs 20–45&nbsp;ms of main thread at 6× throttle (≈4–8&nbsp;ms unthrottled) and 11&nbsp;KB gzip on the wire; the patch itself costs ≈1&nbsp;ms. The 650–930&nbsp;ms "plusRenderMs" on the idle→active flips is the sidebar reordering the newly active thread to the top of its project (<code>compareStandardThreads</code>) in the dev build; that render happens identically with today's refetch (structural sharing yields the same single changed row), so it is a separate cost, not one the payload causes. A CPU profile of a whole send at 6× throttle (<a href="1302/repro/profile-send-6x.txt">profile-send-6x.txt</a>, <a href="1302/repro/1302-profile.cpuprofile.gz">cpuprofile</a>) shows the same picture: long tasks of 1,045/623/666/661&nbsp;ms dominated by React dev-runtime render, <code>SidebarWindowedItems</code>, <code>height-transition</code> and <code>projectThreadGroups</code>, with fetch/JSON accounting for tens of ms.</p>

  <h2>Root cause</h2>
  <p><b>1. The bootstrap is the full <code>ThreadListEntry</code> for every visible thread of every project.</b> <code>buildSidebarBootstrapResponse</code> ({L("apps/server/src/routes/projects.ts",251,282)}) calls <code>buildProjectsWithThreadsResponseFromRows</code> ({L("apps/server/src/routes/projects.ts",209,249)}), which returns <code>toThreadListEntryResponses(…)</code>, the same shape as <code>GET /threads</code>, plus each project's <code>sources</code> and resolved <code>defaultExecutionOptions</code>. The contract is <code>sidebarBootstrapResponseSchema</code> ({L("packages/server-contract/src/api/projects.ts",539,546)}) → <code>projectWithThreadsResponseSchema</code> → <code>threadListEntrySchema</code> ({L("packages/domain/src/thread.ts",378,414)}). No field selection exists; one wire shape is shared by the sidebar, the thread list views, mentions and settings screens.</p>
  <p><b>2. Realtime thread changes are dirty flags, not row updates.</b> The server calls <code>deps.hub.notifyThread(thread.id, ["status-changed"])</code> at turn start/end and on every runtime transition (e.g. {L("apps/server/src/services/threads/thread-lifecycle.ts",560)}, {L("apps/server/src/services/threads/thread-lifecycle.ts",1652)}, {L("apps/server/src/services/threads/thread-send.ts",620)}). The message metadata ({L("packages/domain/src/change-kinds.ts",171,179)}) can carry only <code>backgroundActivityChanged</code>, <code>eventTypes</code>, <code>hasPendingInteraction</code>, <code>projectId</code>: nothing about the new status/runtime, so a client cannot patch a row from it.</p>
  <p><b>3. The client's rule for <code>status-changed</code> is "invalidate every thread list, immediately".</b> Registry entry ({L("apps/app/src/hooks/cache-owners/realtime-cache-registry.ts",326,332)}):</p>
  <pre>"status-changed": {{
  flush: "immediate",
  dirty: [
    dirtyThreadListQueries, // List rows render status/runtime badges.
    dirtyThreadDetailQueries, // Detail controls and banners depend on status.
  ],
}},</pre>
  <p><code>dirtyThreadListQueries</code> ({L("apps/app/src/hooks/cache-owners/realtime-cache-registry.ts",646,658)}) returns <code>getThreadListInvalidationQueryKeys</code> ({L("apps/app/src/hooks/cache-owners/cache-invalidation-groups.ts",81,96)}), which always includes <code>sidebarNavigationQueryKey()</code> (plus the project's thread lists and the search prefix). <code>executeRealtimeDirtyHandlers</code> then calls <code>queryClient.invalidateQueries({{ queryKey }})</code> ({L("apps/app/src/hooks/cache-owners/realtime-cache-registry.ts",601,612)}) with the default <code>refetchType: "active"</code>, and the sidebar query is always active because <code>AppLayout</code> and <code>ProjectList</code> observe it (<code>useSidebarNavigation</code>, {L("apps/app/src/hooks/queries/sidebar-navigation-query.ts",36,51)}, <code>staleTime: Infinity</code>, so realtime is the only refresh path). Because <code>flush</code> is <code>immediate</code>, <code>handleChanged</code>'s <code>case "thread"</code> branch calls <code>invalidationScheduler.flush()</code> instead of <code>schedule()</code> ({L("apps/app/src/hooks/realtime-cache-effects.ts",256,262)}, predicate <code>shouldFlushThreadChangesImmediately</code> at {L("apps/app/src/hooks/cache-owners/realtime-cache-registry.ts",614,620)}), so the 50&nbsp;ms debounce that batches other change kinds is bypassed, so start and end of a turn never coalesce; only react-query's in-flight dedupe limits the count under concurrency (exp. B).</p>
  <p><b>4. The sidebar has exactly one cache entry, so the finest possible invalidation is "everything".</b> <code>sidebarNavigationQueryKey()</code> is a single key with no project scope ({L("apps/app/src/hooks/queries/query-keys.ts",631,633)}). Even the project-scoped list invalidations elsewhere in the same rule cannot avoid re-downloading the whole document.</p>
  <p><b>Why the symptom follows.</b> Every turn on any thread emits at least two <code>status-changed</code> pushes → two immediate invalidations of the one sidebar key → two full downloads of every visible thread of every project. Payload size scales with fleet size (1&nbsp;KB × unarchived visible threads); refetch count scales with turn activity; the product is what the reporter (and the 1,071-thread production comment) see. The existing test <code>"invalidates sidebar navigation for thread list changes"</code> ({L("apps/app/src/hooks/realtime-cache-effects.test.ts",360,386)}) pins this as intended behavior, so this is a design limitation rather than a regression.</p>
  <p><b>Precedent inside the same registry.</b> <code>interactions-changed</code> already does the incremental thing: the server includes <code>hasPendingInteraction</code> in metadata and the client runs <code>patchThreadListPendingInteractionState</code> → <code>updateCachedThreadListPendingInteractionState</code> ({L("apps/app/src/hooks/cache-owners/realtime-cache-registry.ts",859,872)}, {L("apps/app/src/hooks/cache-owners/query-cache.ts",656,669)}) over both the thread lists and the sidebar cache without any refetch. Status has no such path.</p>
  <p><b>Side finding.</b> <code>pnpm seed:perf</code> (the issue's own repro step) fails with <code>FOREIGN KEY constraint failed</code> if the dev server is running, because the server's destroyed-environment prune sweeps the 481 <code>destroyed</code> seed environments between the environment insert and the event insert (<a href="1302/seed.log">seed.log</a> is the successful run after stopping the server; the failing run's stack pointed at <code>packages/scripts/src/lib/seed-perf-fixture.ts:1005</code>). Either the seed should run in one transaction / mark those environments <code>ready</code>, or the help text should say to stop the app first.</p>

  <h2>Proposed fix (first principles)</h2>
  <ol>
    <li><b>Patch status from the push, do not refetch.</b> Server side (product policy lives in the server; no daemon change, so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump): extend <code>threadChangeMetadataSchema</code> with optional <code>status: threadStatusSchema</code> and <code>runtime: threadRuntimeStateSchema</code>, and have every <code>notifyThread(id, ["status-changed"], …)</code> caller pass the post-transition values (they all have the thread row in hand; the lenient inbound schema means old tabs ignore the new fields). Client side: change the <code>status-changed</code> rule to <code>patchThreadListStatusState</code> (mirror of <code>patchThreadListPendingInteractionState</code>, applied through <code>applyToCachedThreadListsAndSidebarNavigation</code>) plus <code>dirtyThreadDetailQueries</code>; fall back to today's <code>dirtyThreadListQueries</code> only when the metadata is absent (older server) or the thread is not present in the cache (it may need to appear). Keep <code>flush: "immediate"</code> for the patch. Risk: consumers that derive ordering from status (the active bucket in <code>compareStandardThreads</code>) already re-sort from cache data, so they keep working; the case to test is a status push arriving before the <code>thread-created</code> refetch has inserted the row (the fallback handles it).</li>
    <li><b>Trim the wire shape.</b> Introduce <code>sidebarThreadEntrySchema</code> in <code>packages/domain</code> as the subset the sidebar and <code>AppLayout</code>/mentions actually read (id, projectId, parentThreadId, environmentId, providerId, title, titleFallback, sectionId, status, runtime, activity, visibility, pinnedAt, pinSortKey, lastReadAt, latestAttentionAt, updatedAt, hasPendingInteraction, environmentHostId, environmentWorkspaceDisplayKind; environmentName/BranchName only if a row renders them) and make <code>sidebarBootstrapResponseSchema.projects[].threads</code> use it; drop <code>sources[]</code> and <code>defaultExecutionOptions</code> from the bootstrap and let the new-thread composer fetch defaults for the selected project (or keep them only for <code>personalProject</code>). Server↔app contract only; update <code>packages/sdk</code> types and the app's <code>CachedThreadListsAndSidebarNavigationMapper</code> (which currently assumes both caches hold <code>ThreadListEntry</code>). Roughly halves bytes per row; measure with <a href="1302/repro/browser-06-collect.js">browser-06-collect.js</a>.</li>
    <li><b>Scope what still must refetch.</b> For change kinds that legitimately need a re-read (created/deleted/archived/parent/order), key the sidebar per project (<code>["sidebarNavigation", projectId]</code> plus a small project index) so <code>projectId</code> metadata can target one project, or add <code>?projectId=</code> to <code>sidebar-bootstrap</code> and merge the response into the cache. This is the larger refactor; 1 and 2 give most of the win.</li>
    <li>Optionally batch: give <code>status-changed</code> the 50&nbsp;ms debounce (drop <code>immediate</code>) once it is a cache patch instead of a network round trip, so a burst of sibling transitions renders once.</li>
  </ol>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue. Merged PR <a href="https://github.com/get-bb/bb/pull/1307">#1307</a> (sidebar virtualization, closes #1261) and closed PR <a href="https://github.com/get-bb/bb/pull/1481">#1481</a> (thread-open fan-out, #1303) both explicitly leave the bootstrap size/invalidation to this issue.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1300">#1300</a>: the <code>pnpm seed:perf</code> fixture this issue is measured against (fails if the server is running, see above).</li>
    <li><a href="https://github.com/get-bb/bb/issues/1303">#1303</a>: opening a thread fires ~19 API requests, the same fan-out seen in exp. A; the child/fork-list and PR-state refetches on sibling status changes come from the same registry rule.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1261">#1261</a> / <a href="https://github.com/get-bb/bb/pull/1307">#1307</a>: large active thread lists kept all sidebar rows mounted (fixed by virtualization; does not change the payload/refetch invariant).</li>
    <li><a href="https://github.com/get-bb/bb/issues/1131">#1131</a>, <a href="https://github.com/get-bb/bb/pull/1198">#1198</a>: synchronous SQLite thread-list reads on the event loop; every extra bootstrap refetch is one more such read server-side (7–8&nbsp;ms warm here, 100–200&nbsp;ms under the concurrent load of exp. B).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
  <pre># worktree /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-24 at 16ceb3a54; app :15464, server :23464, daemon :31464
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
scripts/bb-dev-app current
pnpm seed:perf                              # FAILED: FOREIGN KEY constraint failed (server prune deleted destroyed envs mid-seed)
pnpm dev:stop &amp;&amp; pnpm seed:perf -- --reset   # ok: 12 projects, 1200 threads, 402298 events in 13.2s
scripts/bb-dev-app current
curl -s http://localhost:23464/api/v1/sidebar-bootstrap -o 1302/repro/bootstrap.json -w "http=%{{http_code}} bytes=%{{size_download}} time=%{{time_total}}s\\n"
curl -s -X POST http://localhost:23464/api/v1/projects -H 'content-type: application/json' -d '{{"name":"qa1302","source":{{"type":"local_path","path":"/tmp/1302-qa","hostId":"host_eg4qqky6xx"}}}}'
bb thread spawn --project proj_qk56xcanay --machine host_eg4qqky6xx --provider codex --permission-mode accept-edits --title "1302 target" --prompt "Reply only with ok." --json   # thr_mfe9vetq34
dev-browser --headless run 1302/repro/browser-01-open.js          # boot; performance entries did not capture cross-origin API calls, hence the fetch logger
dev-browser --headless run 1302/repro/browser-05-goto-thread.js   # open thread + install fetch logger
bb thread tell thr_mfe9vetq34 "Reply only with ok." ; 1302/repro/1302-wait-idle.sh thr_mfe9vetq34
dev-browser --headless run 1302/repro/browser-06-collect.js &gt; 1302/repro/send1-api-log.txt
1302/repro/1302-spawn-siblings.sh proj_qk56xcanay host_eg4qqky6xx 2   # thr_m4e7y5crhi thr_q93qsjsqnb (8 bootstrap refetches, 1,091,168 B)
1302/repro/1302-tell-concurrent.sh thr_mfe9vetq34 thr_m4e7y5crhi thr_q93qsjsqnb
dev-browser --headless run 1302/repro/browser-06-collect.js &gt; 1302/repro/send3-concurrent-api-log.txt
dev-browser --headless run 1302/repro/browser-07-parse-cost.js &gt; 1302/repro/parse-cost.txt
dev-browser --headless --timeout 150 run 1302/repro/browser-08-profile-send.js &gt; 1302/repro/profile-send-6x.txt   # POST /threads/:id/send from the page, CPU profile at 6x
dev-browser --headless --timeout 150 run 1302/repro/browser-09-refetch-vs-patch.js &gt; 1302/repro/refetch-vs-patch-6x.txt
cp 1302/repro/issue-1302-sidebar-bootstrap-refetch.test.ts apps/app/src/hooks/ &amp;&amp; cd apps/app &amp;&amp; pnpm exec vitest run src/hooks/issue-1302-sidebar-bootstrap-refetch.test.ts
pnpm dev:stop</pre>
  <h3>Notes from the run</h3>
  <ul>
    <li><code>bb thread tell</code> from inside another bb thread fails with <code>HTTP 400: Sender thread is invalid</code> because the CLI forwards <code>BB_THREAD_ID</code> from the environment; the wrapper unsets it.</li>
    <li><code>bb thread spawn</code> without <code>--machine</code> failed with <code>HTTP 404: Host not found</code> right after the seed reset (the seed removes host credentials and renames the host to <code>seed-host</code>); passing <code>--machine host_eg4qqky6xx</code> works. Separately, <code>bb thread spawn --provider codex</code> can fail transiently with <code>HTTP 503: Unable to load codex models to resolve the default</code> (dev.log: <code>provider.list_models command_timeout</code>) when the machine is heavily loaded; retry.</li>
    <li>Server timing for the bootstrap under load (exp. B, from the page): 18–168&nbsp;ms per response versus 7&nbsp;ms via curl on an idle server.</li>
    <li>Browser <code>performance.getEntriesByType("resource")</code> did not list the cross-origin API calls in this setup, so request accounting uses a <code>window.fetch</code> wrapper installed after load (<a href="1302/repro/browser-05-goto-thread.js">browser-05-goto-thread.js</a>). The app's API client calls the global <code>fetch</code> at call time, so the wrapper sees every request.</li>
  </ul>
  <h3>CPU profile of one send at 6× throttle (top of <a href="1302/repro/profile-send-6x.txt">profile-send-6x.txt</a>)</h3>
  <pre>{prof}</pre>

  <h2>Verification</h2>
  <p>An independent verifier re-ran the minimal reproduction from a fresh worktree at <code>16ceb3a54</code> (own instance: app <code>:12041</code>, server <code>:20041</code>, daemon <code>:28041</code>) and a reviser then re-checked the findings from a third worktree (server <code>:22777</code>). What was confirmed and what changed:</p>
  <ul>
    <li><b>Confirmed as written:</b> seed (12 projects / 1,200 threads / 402,298 events, server stopped), bootstrap size 133,602&nbsp;B / 10,775&nbsp;B gzip for 12 projects / 129 threads (report: 133,614 / 10,770), first row 1,002&nbsp;B with the same 28 keys, exp. A = exactly 2 <code>sidebar-bootstrap</code> GETs per single <code>bb thread tell</code> (134,860&nbsp;B at turn start, 134,856&nbsp;B at turn end; 269,716 of 281,654 bytes; <a href="1302/verify/send1-api-log.txt">verify/send1-api-log.txt</a>), spawning two siblings = 6 refetches / 818,776&nbsp;B, unit test 1 passed, every root-cause code excerpt matches the tree, <code>git log 16ceb3a54..origin/main</code> touches none of the cited paths (not fixed on main), both screenshots are real 1400×900 PNGs.</li>
    <li><b>Fixed (major):</b> <a href="1302/repro/1302-bb.sh">1302-bb.sh</a> previously only ran <code>scripts/bb-dev-app env</code> when <code>BB_SERVER_URL</code> was unset, so from a shell that inherits <code>BB_SERVER_URL</code> (any bb agent thread) it silently targeted the user's real instance; the verifier's equivalent wrapper listed the real hosts (<code>bee</code>, <code>Sawyer's MacBook Air</code>) instead of <code>seed-host</code>. The wrapper and <a href="1302/repro/1302-wait-idle.sh">1302-wait-idle.sh</a> now unset all inherited <code>BB_*</code>, always evaluate the worktree's <code>bb-dev-app env</code>, and echo the target URL. Re-tested with <code>BB_SERVER_URL=http://127.0.0.1:38886</code> exported: <code>machine list</code> went to <code>:22777</code> and returned only that instance's host (<a href="1302/verify/wrapper-isolation-check.txt">wrapper-isolation-check.txt</a>).</li>
    <li><b>Corrected (minor):</b> exp. B's "3 concurrent turns → 4 refetches" is now stated as a timing-dependent range (verifier measured 2 / 273&nbsp;KB for the tells and 6 / 819&nbsp;KB for the two spawns; <a href="1302/verify/send3-concurrent-api-log.txt">verify/send3-concurrent-api-log.txt</a>, <a href="1302/verify/spawn2-api-log.txt">verify/spawn2-api-log.txt</a>). The TL;DR and claims table were updated to match.</li>
    <li><b>Corrected (minor):</b> the "flush is immediate" permalink pointed at the <code>environment</code>/<code>host</code> branch (L262–L270); it now points at the <code>case "thread"</code> branch <code>realtime-cache-effects.ts#L256-L262</code> and the predicate <code>realtime-cache-registry.ts#L614-L620</code>, re-checked with <code>sed -n</code> at <code>16ceb3a54</code>.</li>
    <li><b>Corrected (minor):</b> the second screenshot's caption now says it was captured at the end of the run (three exchanges visible), and the repro notes mention the transient <code>HTTP 503: Unable to load codex models</code> spawn failure and that a retry is enough.</li>
  </ul>
</main></body></html>
'''
(D.parent/'1302.html').write_text(page)
print(len(page))
