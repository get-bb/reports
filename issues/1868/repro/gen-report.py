import html, pathlib
R = pathlib.Path("/tmp/bb-reports/issues/1868")
def esc(p): return html.escape(pathlib.Path(p).read_text())
test_src = esc(R/"repro/timeline-workflow-progress-window.test.ts")
vitest = esc(R/"repro/vitest-base-clean.txt")
walk = esc(R/"repro/live-timeline-walk.txt")
walk_after = esc(R/"repro/live-timeline-walk-after-prune.txt")
unit_dump = esc(R/"repro/page-walk-dump.txt")
proto = esc(R/"repro/prototype-fix.diff")
BASE="b33abbff098ac4c857578e7350d492dcaa65d489"
def L(path, a, b=None):
    return f'https://github.com/get-bb/bb/blob/{BASE}/{path}#L{a}' + (f'-L{b}' if b else '')
page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1868 Timeline stacks one "Worked for" row per byte page while a large Workflow streams progress snapshots</title>
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
  .verdict {{ font-weight:600; }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; max-height:520px; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
  details summary {{ cursor:pointer; font-weight:600; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1868 · Timeline stacks one "Worked for" row per byte page while a large Workflow streams progress snapshots</h1>
  <p class="meta">
    <span class="pill">Type: Bug</span> <span class="pill">Priority: untriaged (issue suggests Medium)</span> <span class="pill">Effort: Low–Medium (suggested)</span> <span class="pill">perf</span> <span class="pill">threads</span>
    <a href="https://github.com/get-bb/bb/issues/1868">open on GitHub</a>
    <span>2026-08-19 · base <code>b33abbff0</code></span>
  </p>
  <p><strong>Verdict:</strong> <span class="verdict">REPRODUCED</span> · <strong>Root-cause confidence:</strong> high</p>

  <h2>1. TL;DR</h2>
  <p>When a finished turn started a long-running <code>Workflow</code> background task and that workflow keeps streaming large progress snapshots, opening the thread shows the finished turn's "Worked for 7m 19s" summary several times, stacked above "Working…". Both halves of the issue's explanation check out. (a) Every <code>item/backgroundTask/progress</code> event stores the full workflow snapshot; the timeline byte budget (4 MiB) counts all of them although only the latest per task matters, so a still-running workflow forces the timeline into byte-window paging with pages that hold nothing but superseded snapshots. (b) On each such byte-window page, the progress rows' <code>parentToolCallId</code> pulls in the <code>Workflow</code> tool call from the finished turn, the lifecycle closure adds that turn's <code>turn/started</code>/<code>turn/completed</code>, and the projection emits a completed turn row for it. <code>buildSequencePageTimelineRows</code> only clamps a turn row when its range overlaps the window; here it does not, so the row is emitted verbatim with a page-unique id, and the client rightly keeps one row per id. I reproduced this three ways: the issue's unit test (fails as described), the HTTP API on a dev instance seeded with the same shape (4 pages, 4 distinct turn-1 rows), and the web app (screenshot below shows four "Worked for 7m 19s"). Pruning the superseded snapshots makes it disappear (control screenshot).</p>

  <h2>2. Claims vs findings</h2>
  <table><tr><th>Claim from the issue</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Thread with a running Workflow after a finished turn shows "Loading older messages…" and stacks "Worked for 7m 19s" 6–7 times above "Working…"</td><td class="ok">Verified</td><td>Web app screenshot <a href="assets/1868-app-stacked-worked-for.png">1868-app-stacked-worked-for.png</a>: 4× "Worked for 7m 19s" with my seed of 45 × 300 KB snapshots (count = number of byte pages, so 4 here vs 6–7 with the reporter's 125 × 262 KB). On localhost the older pages load within ~1 s so the "Loading older messages…" state was too brief to capture.</td></tr>
    <tr><td>Both unit tests in the issue fail today</td><td class="ok">Verified</td><td><code>vitest</code> at b33abbff0: <code>expected [ …(4) ] to have a length of 1 but got 4</code> and <code>expected true to be false</code> (hasOlderRows). See §4.</td></tr>
    <tr><td>Superseded progress snapshots spend the byte budget; the byte floor is computed over every non-excluded row</td><td class="ok">Verified</td><td><code>storedTimelineWindowConditions</code> only excludes <code>THREAD_TIMELINE_EXCLUDED_EVENT_TYPES</code> (thread/started, identity, contextWindowUsage, tokenUsage, turn/diff, turn/plan) — progress rows are counted. Latest page reports <code>eventDataBytes=3906463</code> = 13 snapshots and <code>hasOlderRows=true</code>.</td></tr>
    <tr><td>Only the latest snapshot per task is load-bearing; the pruner deletes the rest, but only every 250 sequences / 30 s on an active thread</td><td class="ok">Verified</td><td><code>pruneBackgroundTaskProgressEvents</code> keeps only the newest per <code>item_id</code>; <code>maybePruneActiveThreadEventHistory</code> requires <em>both</em> <code>ACTIVE_THREAD_EVENT_PRUNE_MIN_SEQUENCE_DELTA = 250</code> and <code>ACTIVE_THREAD_EVENT_PRUNE_MIN_INTERVAL_MS = 30_000</code>. Between prunes up to ~250 snapshots accumulate.</td></tr>
    <tr><td>Each byte-window page emits a phantom summary row for the spawning turn via parent closure + turn lifecycle closure + cleared <code>contextOnlyToolCallIds</code></td><td class="ok">Verified</td><td>Per-page dump: pages 2 and 3 (windows starting at seq 29 / 16) each return exactly one row, <code>…:turn-1:turn:sequence-page:29</code> / <code>:16</code>, with <code>seq 2-8</code> — entirely below the window. Code path in §5.</td></tr>
    <tr><td><code>buildSequencePageTimelineRows</code> clamps only overlapping turn rows; non-overlapping rows are returned verbatim with a page-unique id</td><td class="ok">Verified</td><td><a href="{L('apps/server/src/services/threads/timeline.ts',1524,1566)}">timeline.ts#L1524-L1566</a>: <code>sourceSeqStart &lt;= sourceSeqEnd ? clamp : {{ ...row, id: `${{row.id}}${{suffix}}` }}</code>.</td></tr>
    <tr><td>Client keeps one row per id, so it is right to keep them all</td><td class="ok">Verified (by behavior)</td><td>The app rendered exactly as many rows as distinct ids the API returned (4).</td></tr>
    <tr><td>Does not reproduce once the snapshots are pruned / turn 2 completed</td><td class="ok">Verified</td><td>After deleting the 44 superseded snapshots on the dev DB (and bumping maxSeq to bypass the timeline cache), the latest page fits: 1 page, 1 turn row (<a href="assets/1868-app-after-prune-control.png">control screenshot</a>).</td></tr>
    <tr><td>Still happens on main at b33abbff0</td><td class="ok">Verified</td><td>All repros run at b33abbff0; <code>git log b33abbff0..origin/main -- timeline.ts events.ts event-pruning.ts</code> is empty (no later fix).</td></tr>
    <tr><td>Reporter's real thread ids / 206-agent workflow / 7m 19s duration</td><td class="unv">Unverified</td><td>Lives in the reporter's ~/.bb; not touched. My seed reproduces the same shape with a synthetic 7m 19s turn.</td></tr>
  </table>

  <h2>3. Environment</h2>
  <ul>
    <li>bb <code>b33abbff098ac4c857578e7350d492dcaa65d489</code> (main, 0.39.0), Linux 7.0.0-29-generic, Node v24.18.0, vitest 4.1.1</li>
    <li>Provider: none needed — thread events are seeded directly (providerId <code>claude-code</code> on the thread row only)</li>
    <li>Own dev instance from <code>scripts/bb-dev-app current</code>: App <code>http://localhost:13806</code>, Server <code>http://localhost:21806</code>, Host daemon <code>127.0.0.1:29806</code>, data dir <code>~/.bb-dev/projects-bb-.claude-worktrees-wf_880dc823-33c-1-3d54d936a1fc</code> (deleted at cleanup)</li>
    <li>Browser: dev-browser (headless Chromium), viewport 1280×900</li>
  </ul>

  <h2>4. Minimal reproduction</h2>
  <h3>4a. Unit test (server only, in-memory SQLite) — fails on b33abbff0</h3>
  <ol>
    <li>Save the test below as <code>apps/server/test/services/threads/timeline-workflow-progress-window.test.ts</code> (copy at <a href="1868/repro/timeline-workflow-progress-window.test.ts">1868/repro/timeline-workflow-progress-window.test.ts</a>).</li>
    <li>Run <code>cd apps/server &amp;&amp; pnpm exec vitest run test/services/threads/timeline-workflow-progress-window.test.ts</code>.<pre>expected: 2 passed
actual:
{vitest}</pre></li>
  </ol>
  <p>Per-page dump from an instrumented copy of the same test (the latest page and two older byte pages each return one turn-1 row whose events, seq 2–8, are entirely below the window that starts at seq 42 / 29 / 16):</p>
  <pre>{unit_dump}</pre>
  <details><summary>timeline-workflow-progress-window.test.ts (verbatim from the issue)</summary><pre>{test_src}</pre></details>

  <h3>4b. Live: dev server + web app</h3>
  <ol>
    <li>Start your own dev instance: <code>scripts/bb-dev-app current</code>; note the Server URL and data dir. Create a project (host id from <code>GET /api/v1/hosts</code>): <pre>curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{{"name":"qa1868","source":{{"type":"local_path","path":"/tmp/bb-1868-qa","hostId":"&lt;host id&gt;"}}}}'</pre></li>
    <li>Seed a thread with the issue's shape directly into the dev DB (finished turn 1 with a <code>Workflow</code> tool call + workflow background task, pending turn 2, 45 thread-scoped ~300 KB progress snapshots): <pre>cd apps/server &amp;&amp; pnpm exec tsx seed-1868.ts &lt;data dir&gt;/bb.db &lt;project id&gt;
# =&gt; {{"threadId":"thr_mfus3sx7bg","events":54}}</pre> Script: <a href="1868/repro/seed-1868.ts">1868/repro/seed-1868.ts</a>.</li>
    <li>Walk the timeline through the HTTP API (<a href="1868/repro/walk-timeline-pages.py">walk-timeline-pages.py</a>): <pre>python3 walk-timeline-pages.py http://localhost:21806 thr_mfus3sx7bg

expected: 1 page, hasOlderRows=False, one turn-1 row
actual:
{walk}</pre></li>
    <li>Open <code>http://localhost:13806/projects/&lt;project&gt;/threads/thr_mfus3sx7bg</code>. The client auto-loads the older pages and renders one "Worked for 7m 19s" per byte page:</li>
  </ol>
  <figure><img src="assets/1868-app-stacked-worked-for.png" alt="Thread view with four Worked for 7m 19s rows"><figcaption>BUG: after the older pages load, "Worked for 7m 19s" appears four times — one real (above the assistant message, from the page holding turn 1's events) plus three phantoms (from the latest page and the two byte-window pages that contain only superseded snapshots) — above "Working…".</figcaption></figure>
  <ol start="5">
    <li>Control: delete the superseded snapshots (what <code>pruneBackgroundTaskProgressEvents</code> eventually does), append one event so <code>maxSeq</code> changes (the timeline response cache is keyed on it), reload: <pre>{walk_after}</pre></li>
  </ol>
  <figure><img src="assets/1868-app-after-prune-control.png" alt="Thread view with a single Worked for row"><figcaption>CONTROL: same thread with only the newest snapshot kept — one page, one "Worked for 7m 19s", then "Working…". This is the expected rendering.</figcaption></figure>
  <p>Repro files: <a href="1868/repro/">1868/repro/</a></p>

  <h2>5. Root cause</h2>
  <p><strong>Part 1 — the byte budget counts superseded snapshots.</strong> <code>applyTimelineWindowByteBudget</code> (<a href="{L('apps/server/src/services/threads/timeline.ts',1052,1069)}">timeline.ts#L1052-L1069</a>) asks <code>findStoredTimelineWindowByteBudgetFloor</code> (<a href="{L('packages/db/src/data/events.ts',2877,2946)}">events.ts#L2877-L2946</a>) for the oldest row that fits in <code>THREAD_TIMELINE_EVENT_DATA_BYTE_LIMIT</code> = 4 MiB. Its WHERE clause (<code>storedTimelineWindowConditions</code>, <a href="{L('packages/db/src/data/events.ts',2828,2842)}">events.ts#L2828-L2842</a>) excludes only <code>THREAD_TIMELINE_EXCLUDED_EVENT_TYPES</code>; <code>item/backgroundTask/progress</code> is not in that list, and each such row carries the entire workflow snapshot. The system already declares those rows disposable — <code>pruneBackgroundTaskProgressEvents</code> (<a href="{L('packages/db/src/data/events.ts',3660,3704)}">events.ts#L3660-L3704</a>) keeps only the newest per <code>item_id</code> — but the pruner is opportunistic: <code>maybePruneActiveThreadEventHistory</code> runs only when both 250 sequences and 30 s have elapsed since the last prune (<a href="{L('apps/server/src/services/system/event-pruning.ts',62,63)}">event-pruning.ts#L62-L63</a>, <a href="{L('apps/server/src/services/system/event-pruning.ts',240,252)}">#L240-L252</a>). A workflow with hundreds of agents emits a snapshot every few seconds, so between prunes tens of MB of superseded snapshots sit at the top of the thread, and the latest page is cut into ~4 MiB windows that contain nothing renderable.</p>
  <p><strong>Part 2 — each byte-window page manufactures the spawning turn.</strong> In <code>selectStandardTimelineEventRows</code>, a byte window's rows are the progress snapshots. Then:</p>
  <ol>
    <li><code>ensureTimelineWindowParentedRows</code> (<a href="{L('apps/server/src/services/threads/timeline.ts',463,545)}">timeline.ts#L463-L545</a>) collects <code>parentToolCallId</code> from those rows (the <code>Workflow</code> call in turn 1) and fetches the tool-call rows via <code>listStoredToolCallRowsByItemIds</code>. It flags them as <code>contextOnlyToolCallIds</code>, but…</li>
    <li>…byte-window mode discards that set: <code>contextOnlyToolCallIds: window.byteWindowSequenceStart === null ? … : new Set()</code> (<a href="{L('apps/server/src/services/threads/timeline.ts',1479,1482)}">timeline.ts#L1479-L1482</a>), so the projection treats the tool call as a real root message of turn 1 (see <code>isRootSuppressedContext</code> in <code>packages/thread-view/src/normalize-event-projection.ts</code>).</li>
    <li><code>ensureTimelineWindowTurnStartedRows</code> adds turn 1's <code>turn/started</code>, and because this is a byte window <code>ensureSequenceWindowTurnCompletedRows</code> (<a href="{L('apps/server/src/services/threads/timeline.ts',754,782)}">timeline.ts#L754-L782</a>) adds its <code>turn/completed</code>. The projection now sees a complete turn 1 with one message and builds a <code>turn</code> row with <code>startedAt/completedAt</code> = the real 7 m 19 s.</li>
    <li><code>buildSequencePageTimelineRows</code> (<a href="{L('apps/server/src/services/threads/timeline.ts',1524,1566)}">timeline.ts#L1524-L1566</a>) suffixes ids with <code>:sequence-page:&lt;byteWindowSequenceStart&gt;</code> and clamps <code>sourceSeq*</code> to the window — but only when <code>max(rowStart, windowStart) &lt;= min(rowEnd, windowEnd)</code>. Turn 1 (seq 2–8) never overlaps a window starting at 16/29/42, so the row is passed through unchanged, with a page-unique id.</li>
  </ol>
  <p>Result: N byte pages ⇒ N distinct turn-1 row ids ⇒ N "Worked for" rows in the client, which merges by id. The latest page's copy has no suffix and is the fourth one. This is a regression surface introduced with byte paging in PR #1199 (<code>eaa55fa84</code>, fixes #1129); its tests only cover windows that really slice a large finished turn.</p>
  <p><strong>Deeper issue.</strong> The paging layer has no notion of "superseded" events; correctness currently depends on the pruner having run recently. Also, the timeline response cache comment (<code>timeline-cache.ts</code>, "pruning is output-preserving") is not true for pagination: pruning changes <code>hasOlderRows</code>/cursors, as the control step showed (I had to bump <code>maxSeq</code> to see the pruned result). Not user-visible on its own, but worth knowing when fixing.</p>

  <h2>6. Proposed fix (first principles)</h2>
  <p>Two independent changes; each fixes one failing assertion. I prototyped both (diff: <a href="1868/repro/prototype-fix.diff">prototype-fix.diff</a>) and ran the existing <code>apps/server/test/services/threads/timeline*</code> suites (42 tests pass) plus the issue's tests.</p>
  <ol>
    <li><strong>Server, <code>buildSequencePageTimelineRows</code>:</strong> on a byte-window page, drop any <code>turn</code> row whose <code>[sourceSeqStart, sourceSeqEnd]</code> does not intersect <code>[byteWindowSequenceStart, byteWindowSequenceEnd]</code> instead of returning it verbatim. Such a row only exists because of parent/lifecycle closure and belongs to the page that holds the turn's own events. With this, the issue's first test passes. Risk: a turn row that legitimately spans a page boundary still overlaps and is clamped as today; a completed turn wholly inside a page is untouched. Alternative at the source: keep <code>contextOnlyToolCallIds</code> in byte-window mode (why it is cleared for byte pages is not documented; that likely was to let a large sliced turn keep its tool calls, so the row-level filter is the safer, more targeted change).</li>
    <li><strong>DB, timeline window reads:</strong> make superseded progress snapshots invisible to the timeline reads that decide and materialize a window — <code>storedTimelineWindowConditions</code> (byte floor, byte count, <code>listStoredTimelineWindowEventRows</code>) and the full-read path (<code>listRecentStoredEventRows</code> used by <code>selectFullTimelineEventRows</code>) — with a condition equivalent to the pruner's: <code>type &lt;&gt; 'item/backgroundTask/progress' OR id IN (SELECT id … WHERE item_id = events.item_id ORDER BY sequence DESC LIMIT 1)</code>. My prototype in <code>storedTimelineWindowConditions</code> alone makes the latest page fit (<code>hasOlderRows=false</code>, one turn row); the remaining failing assertion (<code>profile.eventDataBytes</code>) is because the fits-everything path then reads through <code>listRecentStoredEventRows</code>, which needs the same exclusion. Check the query plan against the existing event indexes; the pruner already runs an equivalent correlated subquery. Also worth tightening: run <code>pruneBackgroundTaskProgressEvents</code> on progress ingestion with only the 30 s guard (drop the 250-sequence gate for that step) so accumulation is bounded in time.</li>
  </ol>

  <h2>7. PR review</h2>
  <p>No linked open PRs at investigation time.</p>

  <h2>8. Related issues</h2>
  <ul>
    <li>#1129 (closed) Large finished turns can OOM bb-server during timeline projection — origin of byte paging; PR #1199 "Page large finished turns by stored byte size" (merged, <code>eaa55fa84</code>) introduced <code>buildSequencePageTimelineRows</code> and the byte-window lifecycle closure.</li>
    <li>#1517 (closed) Give the timeline whole-item closure a byte budget — same subsystem.</li>
    <li>#1714 (open) / #1201 (closed) — cross-turn tool call state in turn details; different symptom (item state, not duplicated turn rows), as the issue says.</li>
  </ul>

  <h2>9. Appendix</h2>
  <h3>Prototype fix diff (not committed; reverted after testing)</h3>
  <pre>{proto}</pre>
  <h3>Commands run</h3>
  <pre>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
git fetch origin main; git log b33abbff0..origin/main --oneline -- apps/server/src/services/threads/timeline.ts packages/db/src/data/events.ts apps/server/src/services/system/event-pruning.ts   # empty
cd apps/server &amp;&amp; pnpm exec vitest run test/services/threads/timeline-workflow-progress-window.test.ts   # 2 failed
scripts/bb-dev-app current
curl -s -X POST http://localhost:21806/api/v1/projects ... (project proj_ks8z3m2awr)
cd apps/server &amp;&amp; pnpm exec tsx seed-1868.ts ~/.bb-dev/.../bb.db proj_ks8z3m2awr   # thr_mfus3sx7bg
python3 walk-timeline-pages.py http://localhost:21806 thr_mfus3sx7bg
dev-browser --browser bb1868 --headless run browser-b.js / browser-c.js / browser-d.js
sqlite3 bb.db "DELETE FROM events WHERE thread_id='thr_mfus3sx7bg' AND type='item/backgroundTask/progress' AND id NOT IN (SELECT id ... ORDER BY sequence DESC LIMIT 1)"  # control
# prototype fix: applied, ran vitest on timeline* suites (42 pass + issue test 1 pass), saved diff, reverted
pnpm dev:stop; rm -rf data dir; ss -ltn   # cleanup</pre>
  <h3>Files</h3>
  <ul>
    <li><a href="1868/repro/vitest-base.log">vitest-base.log</a> — raw vitest output at b33abbff0</li>
    <li><a href="1868/repro/page-walk-dump.txt">page-walk-dump.txt</a> — per-page rows from the unit test</li>
    <li><a href="1868/repro/live-timeline-page1.txt">live-timeline-page1.txt</a>, <a href="1868/repro/live-timeline-walk.txt">live-timeline-walk.txt</a>, <a href="1868/repro/live-timeline-walk-after-prune.txt">live-timeline-walk-after-prune.txt</a> — HTTP API output</li>
    <li><a href="1868/repro/browser-b.js">browser-b.js</a>, <a href="1868/repro/browser-c.js">browser-c.js</a>, <a href="1868/repro/browser-d.js">browser-d.js</a> — dev-browser scripts used for the screenshots</li>
    <li><a href="1868/build.log">build.log</a>, <a href="1868/1868-install.log">install log</a></li>
  </ul>
</main></body></html>
'''
(R.parent/"1868.html").write_text(page)
print("ok", len(page))
