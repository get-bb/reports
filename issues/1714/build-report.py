import html, json, re, pathlib

R = pathlib.Path("/tmp/bb-reports/issues/1714/repro")
def esc(p):
    return html.escape(p if isinstance(p, str) else p.read_text())
def strip_ansi(s):
    return re.sub(r"\x1b\[[0-9;]*m", "", s)

test_src = esc(R / "timeline-cross-turn-item-details.regression.test.ts")
seed_src = esc(R / "seed-1714-dev-db.mts")
patch_src = esc(R / "prototype-fix.patch")
reg_log = esc(strip_ansi((R / "regression-test-run.log").read_text()).split("\n", 1)[1])
issue_log = esc(strip_ansi((R / "issue-test-run.log").read_text()))
proto_log = esc(strip_ansi((R / "prototype-fix-full-threads-run.log").read_text()))
main_log = esc("\n".join(l for l in strip_ansi((R / "regression-test-run-origin-main-a108fa7ef.log").read_text()).splitlines() if "×" in l or "Tests " in l or "AssertionError" in l or "Test Files" in l))
api_details = esc(json.dumps(json.loads((R / "api-turn-summary-details-idle.json").read_text()), indent=2))
nested = json.loads((R / "api-timeline-nested-idle.json").read_text())
turn1 = [r for r in nested["rows"] if r["kind"] == "turn" and r["turnId"] == "turn-1"][0]
api_nested = esc(json.dumps({"turnRow": {k: turn1[k] for k in ("id","turnId","sourceSeqStart","sourceSeqEnd","status")}, "children": turn1["children"]}, indent=2))
cli_log = esc(R / "cli-thread-log-verbose.txt")

BASE = "https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/"
def L(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    label = f"{path.split('/')[-1]}{frag}"
    return f'<a href="{BASE}{path}{frag}">{label}</a>'

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1714 tool call completing in a later turn shows as pending/interrupted in its spawning turn's details</title>
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
  .pill.low {{ background:#eee; }}
  .verdict {{ font-weight:600; }}
  .v-repro {{ color:var(--ok); }}
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
  <h1>#1714 · A tool call that completes in a later turn shows as pending in its spawning turn's details</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill low">Low</span> <span class="pill">Effort: not set</span>
    <span class="pill">threads</span>
    <a href="https://github.com/get-bb/bb/issues/1714">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
    <span>· still present on origin/main <code>a108fa7ef</code></span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> A bb thread's history is a list of persisted events. Each event is tagged with the <em>turn</em> it belongs to (a turn is one "user asks, agent works, agent answers" cycle). Tool calls (a shell command, a file edit) are <em>items</em>: an <code>item/started</code> event and, later, an <code>item/completed</code> event with the same item id. Normally both events are tagged with the same turn. But a tool can outlive its turn: the agent answers, the turn ends, a new turn starts, and only then does the tool's result arrive. The Claude Code translator tags that late <code>item/completed</code> with whichever turn is <em>currently open</em> (turn-2), and since it has forgotten the tool by then, it emits it as a generic <code>toolCall</code>. The main timeline builder was taught (PR #447) to merge such a lifecycle by bare item id, so the collapsed turn-1 row spans seq 1–6 and its inline children show the command as <code>completed</code> with its output.</p>
  <p>The app never renders those inline children. When you click a finished turn ("Worked for …") it calls a separate <em>turn-summary-details</em> route with the row's <code>turnId</code> and sequence range. That route re-reads the events in the range and then <em>drops every turn-scoped row whose turn id differs from the requested one</em> (a deliberate fix from #164 for overlapping turns), which throws away the turn-2 completion. The whole-item closure added in #1510 cannot rescue it because it keys items by <code>scopeKind+turnId+itemId</code>, so <code>turn-1/call-1</code> and <code>turn-2/call-1</code> are different items, and its backfill only looks <em>backwards</em>. The re-projection therefore holds an <code>item/started</code> with no end and the row renders as unfinished. Because the response is a normal 200, nothing errors or logs.</p>
  <p>I reproduced this three ways on <code>16ceb3a54</code>: (1) a vitest asserting <code>details.rows</code> equals the row's inline <code>children</code>, which fails; (2) the real HTTP routes on my dev instance, where <code>GET …/timeline?includeNestedRows=true</code> returns <code>completed</code>/<code>"dev server exited with code 0"</code> and <code>GET …/timeline/turn-summary-details?turnId=turn-1&amp;sourceSeqStart=1&amp;sourceSeqEnd=6</code> returns the same row id as <code>interrupted</code>/<code>"Tool execution interrupted"</code>; (3) the app UI, where expanding the turn shows "Ran npm run dev <b>interrupted</b>", while <code>bb thread log --format verbose</code> on the same thread prints the completed command with its output. One correction to the issue: on a real <em>idle</em> thread the wrong row reads <code>interrupted</code>, not <code>pending</code> (the projection interrupts pending calls once the thread is not active); the issue's <code>pending</code> comes from its test thread being in the default <code>starting</code> status. Same defect, arguably worse wording. A 20-line prototype fix in the details filter (keep another turn's <code>item/*</code> rows for item ids the requested turn started, unless the id was restarted in between) makes the invariant test pass and leaves the other 115 server thread tests green.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Turn row's inline <code>children</code> render the item <code>completed</code> with output while the details route renders the same row id unfinished</td><td class="ok">Verified</td><td>Regression test diff below (<code>status completed→pending</code>, <code>output→""</code>, <code>sourceSeqEnd 6→2</code>, <code>completedAt→null</code>); same via HTTP on the dev instance.</td></tr>
    <tr><td>Details row is <code>status: "pending"</code></td><td class="unv">Verified only for a <code>starting</code>/<code>active</code> thread</td><td>Unit test (thread created by <code>createThread</code> defaults to <code>starting</code>, {L('packages/db/src/data/threads.ts',311)}) shows <code>pending</code>. On the real idle thread the route and the app show <code>interrupted</code> / "Tool execution interrupted" because <code>finalizePendingMessages</code> interrupts pending calls when the thread is not active ({L('packages/thread-view/src/event-projection-state.ts',176,192)}, {L('packages/thread-view/src/tool-activity-projection.ts',681,693)}). The divergence is the same.</td></tr>
    <tr><td>Response is a silent 200, no error/log</td><td class="ok">Verified</td><td><code>curl</code> to the route returned 200 with rows; nothing in dev.log. The exact-bounds matcher still matches because <code>resolveTurnSummaryDetailsSourceRange</code> shrinks the range in lockstep with the completion-less re-projection.</td></tr>
    <tr><td>Turn-1 row spans <code>[1,6]</code>, past its own <code>turn/completed</code> at 4</td><td class="ok">Verified</td><td>Test log: <code>TURN ROW {{"turnId":"turn-1","sourceSeqStart":1,"sourceSeqEnd":6}}</code>; API timeline row identical.</td></tr>
    <tr><td><code>onExecEnd</code>/<code>upsertRunningExecCall</code> merge cross-turn by bare call id, keeping the first scope (#447)</td><td class="ok">Verified</td><td>{L('packages/thread-view/src/tool-activity-projection.ts',1075,1095)}, {L('packages/thread-view/src/tool-activity-projection.ts',497,550)}; <code>git log -S"outlive its spawning turn"</code> → <code>5b5e7dcee</code> (#447).</td></tr>
    <tr><td><code>filterExactEventRowsForRequestedTurn</code> drops other-turn rows (#164 fix)</td><td class="ok">Verified</td><td>{L('apps/server/src/services/threads/timeline.ts',629,654)}. Introduced by <code>6217768bb</code> "Optimize timeline feed pipeline (#135)"; hardened later. Prototype fix relaxing exactly this filter cures the symptom.</td></tr>
    <tr><td><code>ensureSequenceWindowWholeItemRows</code> keys by scoped identity and only backfills rows below the window start</td><td class="ok">Verified</td><td>{L('apps/server/src/services/threads/timeline.ts',838,940)} (<code>scopedItemRefKey</code> at {L('packages/db/src/data/events.ts',1452,1454)}; backfill filter <code>row.sequence &lt; args.sequenceStart</code> at {L('apps/server/src/services/threads/timeline.ts',914)}).</td></tr>
    <tr><td>Claude Code translator scopes a late <code>tool_result</code> to the open turn and degrades it to <code>toolCall</code>/<code>unknown</code> after <code>toolItemsByCallId</code> is cleared</td><td class="ok">Verified (path differs from the issue)</td><td>{L('plugins/provider-claude-code/src/event-translation.ts',1325,1351)} uses <code>state.currentTurnId</code>; <code>clearTransientTurnState</code> clears the map at {L('packages/provider-bridge-protocol/src/bridge-kit/turn-state.ts',129,133)}; fallback <code>tool: args.toolName ?? "unknown"</code> at {L('packages/provider-bridge-protocol/src/bridge-kit/tool-item-translation.ts',253,261)}. The issue's path <code>packages/agent-runtime/src/shared/tool-item-translation.ts</code> does not exist at base.</td></tr>
    <tr><td>Item kind / accepted input / assistant message make no difference</td><td class="unv">Not re-checked</td><td>Mechanism is kind-agnostic (filter is on <code>scopeKind</code>/<code>turnId</code>), so plausible; I only ran the base fixture.</td></tr>
    <tr><td>In the app, expansion is the only place a finished turn's work rows are readable</td><td class="ok">Verified</td><td>No <code>includeNestedRows</code> use in <code>apps/app/src</code>; only <code>bb thread log --format verbose</code> ({L('apps/cli/src/commands/thread/show.ts',471,474)}) requests nested rows. Screenshots below.</td></tr>
    <tr><td>Historical rows are the main carriers; new claude-code occurrences rare since #633</td><td class="unv">Unverified</td><td>I did not provoke a real late <code>tool_result</code> from a live provider (would need a tool to finish after the turn's <code>result</code>). Repro seeds the persisted shape directly.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18); re-checked on origin/main <code>a108fa7ef</code> (bug still present). Worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-35</code>.</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, pnpm 9.15.0, vitest 4.1.1.</li>
    <li>Dev instance: app <code>:17600</code>, server <code>:25600</code>, host daemon <code>:33600</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-35-2d6d9e086b6f</code>. Project <code>proj_zw32hwfcnb</code> (local path <code>/tmp/bb-1714-qa</code>), seeded thread <code>thr_babit2hcwx</code>.</li>
    <li>No provider process was needed: the persisted event shape is seeded directly (unit test via in-memory SQLite; dev instance via <code>@bb/db</code> against its <code>bb.db</code>).</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. Unit-level (fails on 16ceb3a54 and on a108fa7ef)</h3>
  <ol>
    <li>Copy <a href="1714/repro/timeline-cross-turn-item-details.regression.test.ts">1714/repro/timeline-cross-turn-item-details.regression.test.ts</a> to <code>apps/server/test/services/threads/</code>.</li>
    <li>From <code>apps/server</code>: <code>pnpm exec vitest run test/services/threads/timeline-cross-turn-item-details.regression.test.ts</code></li>
  </ol>
  <p><b>Expected:</b> the details rows for turn-1 equal the turn-1 row's inline children (one command row, <code>completed</code>, output <code>dev server exited with code 0</code>). <b>Actual</b> (<a href="1714/repro/regression-test-run.log">full log</a>):</p>
  <pre>{reg_log}</pre>
  <p>The test file:</p>
  <pre>{test_src}</pre>
  <p>The issue's own test file (<a href="1714/repro/timeline-cross-turn-item-details.test.ts">1714/repro/timeline-cross-turn-item-details.test.ts</a>) documents the wrong behavior and therefore <em>passes</em> on base (<a href="1714/repro/issue-test-run.log">log</a>): <code>Tests 2 passed (2)</code>. Its control (same completion scoped to turn-1) confirms the completion row's turn scope is the causal variable.</p>

  <h3>B. Real routes and UI on a dev instance</h3>
  <ol>
    <li><code>scripts/bb-dev-app current</code>; note Server/App URLs and Data dir. Create a project (see Appendix) and note its id.</li>
    <li>Seed the seven-event shape into that instance's DB (creates a claude-code thread and prints its id): <a href="1714/repro/seed-1714-dev-db.mts">1714/repro/seed-1714-dev-db.mts</a> copied to <code>apps/server/test/services/threads/</code>, then from <code>apps/server</code>:
      <pre>BB_DB=&lt;Data dir&gt;/bb.db BB_PROJECT_ID=&lt;proj id&gt; pnpm exec tsx test/services/threads/seed-1714-dev-db.mts
thr_babit2hcwx</pre>
      The server notices the new <code>starting</code> thread and appends a "Provisioning thread failed" system row and marks it <code>error</code>; to mimic a normally finished thread I ran <code>sqlite3 &lt;Data dir&gt;/bb.db "DELETE FROM events WHERE thread_id='thr_babit2hcwx' AND sequence=9; UPDATE threads SET status='idle' WHERE id='thr_babit2hcwx';"</code>. (Before that step the details row already read <code>interrupted</code>; see <a href="1714/repro/api-turn-summary-details.json">api-turn-summary-details.json</a>.)</li>
    <li>Inline children (what the projection believes; <a href="1714/repro/api-timeline-nested-idle.json">raw</a>):
      <pre>$ curl -s "$BB_SERVER_URL/api/v1/threads/thr_babit2hcwx/timeline?includeNestedRows=true"   # turn-1 row + children
{api_nested}</pre></li>
    <li>Details route with the row's own identity (what the app fetches on expansion; <a href="1714/repro/api-turn-summary-details-idle.json">raw</a>):
      <pre>$ curl -s "$BB_SERVER_URL/api/v1/threads/thr_babit2hcwx/timeline/turn-summary-details?turnId=turn-1&amp;sourceSeqStart=1&amp;sourceSeqEnd=6"
{api_details}</pre>
      Same row id <code>thr_babit2hcwx:command:call-1</code>; <code>sourceSeqEnd</code> is pinned to the <code>item/started</code> row (2), status <code>interrupted</code>, output is the synthetic "Tool execution interrupted", <code>completedAt: null</code>. HTTP 200.</li>
    <li>CLI, which uses inline children (<a href="1714/repro/cli-thread-log-verbose.txt">raw</a>): <pre>$ pnpm bb:dev thread log thr_babit2hcwx --format verbose
{cli_log}</pre></li>
  </ol>
  <figure><img src="assets/1714-idle-before.png" alt="thread page before expanding"><figcaption>App, thread <code>thr_babit2hcwx</code> before expansion. The collapsed turn-1 row is "Worked for 0ms" (top). Nothing about the command is visible yet.</figcaption></figure>
  <figure><img src="assets/1714-idle-expanded.png" alt="turn expanded shows Ran npm run dev interrupted"><figcaption>After clicking "Worked for 0ms" the app calls the details route and renders "Ran npm run dev <b>interrupted</b>", even though seq 6 persists <code>status: "completed"</code> with a result.</figcaption></figure>
  <figure><img src="assets/1714-idle-work-open.png" alt="command row opened shows Tool execution interrupted"><figcaption>Clicking the command row shows the synthetic output "Tool execution interrupted"; the real result "dev server exited with code 0" is never reachable from the app. Compare the CLI output above for the same thread.</figcaption></figure>
  <figure><img src="assets/1714-expanded-interrupted.png" alt="same expansion while thread was in error status"><figcaption>Same expansion before I flipped the thread to <code>idle</code> (thread in <code>error</code> after the provisioning failure): identical wrong row.</figcaption></figure>

  <h2>Root cause</h2>
  <p><b>Two ownership models.</b> The projection that builds the timeline (and the inline children) attaches an item to the turn it <em>started</em> in, keyed by bare call id: <code>onExecEnd</code> looks the running call up in thread-level <code>runningCallsById</code> ({L('packages/thread-view/src/tool-activity-projection.ts',1075,1095)}) and <code>upsertRunningExecCall</code> keeps the first scope while merging terminal state, output and stretching <code>sourceSeqEnd</code> ({L('packages/thread-view/src/tool-activity-projection.ts',497,550)}):</p>
  <pre>// keep first: provider background work can outlive its spawning turn, and a
// late terminal event for the same call id may arrive scoped to a later turn.
// Preserve the original placement while still merging terminal state/output.
mergeRunningExecutionMetadata(existing, incoming);
mergeExecutionCompletion(existing, incoming);
…
existing.sourceSeqEnd = Math.max(existing.sourceSeqEnd, meta.seq);</pre>
  <p>The turn draft's bounds stretch over its members' ends ({L('packages/thread-view/src/group-event-projection-turns.ts',115,157)}), so the turn-1 summary row spans <code>[1,6]</code>.</p>
  <p><b>The details route uses the other model.</b> <code>buildTimelineTurnSummaryDetails</code> ({L('apps/server/src/services/threads/timeline.ts',1948,2135)}) fetches the window <code>[1,7)</code>, which does contain seq 6, then runs <code>filterExactEventRowsForRequestedTurn</code> ({L('apps/server/src/services/threads/timeline.ts',629,654)}):</p>
  <pre>for (const row of args.exactEventRows) {{
  if (row.scopeKind === "turn" &amp;&amp; row.turnId !== args.turnId) {{
    removedRows = true;
    continue;          // ← seq 6 (turn-2, item/completed call-1) is dropped here
  }}
  …</pre>
  <p>Because rows were removed, <code>resolveTurnSummaryDetailsSourceRange</code> ({L('apps/server/src/services/threads/timeline.ts',657,676)}) re-derives the range from the surviving rows, so the later exact-bounds match in <code>buildThreadTimelineTurnDetailsFromEvents</code> ({L('packages/thread-view/src/build-thread-timeline.ts',1381,1420)}, matcher at {L('packages/thread-view/src/build-thread-timeline.ts',1202,1214)}) still succeeds and the route answers 200 instead of throwing <code>missing-match</code>. <code>ensureSequenceWindowWholeItemRows</code> ({L('apps/server/src/services/threads/timeline.ts',838,940)}) — #1510's fix for the byte-cut sibling #1201 — cannot repair it: it keys items by <code>scopeKind^turnId^itemId</code> ({L('packages/db/src/data/events.ts',1452,1454)}, hardened in #1398 for ACP item-id reuse), so <code>turn-2/call-1</code> is a different identity from <code>turn-1/call-1</code>, and its lifecycle backfill keeps only rows <code>&lt; sequenceStart</code> ({L('apps/server/src/services/threads/timeline.ts',914)}). None of the other closure helpers (parented rows, turn-started, background-task state) select this row class.</p>
  <p><b>Why the symptom follows.</b> The re-projection holds <code>item/started call-1</code> and no terminal row. With <code>threadStatus</code> <code>starting</code>/<code>active</code> the call stays <code>pending</code>; otherwise <code>finalizePendingMessages</code> → <code>interruptPendingToolActivity</code> marks it <code>interrupted</code> with output "Tool execution interrupted" ({L('packages/thread-view/src/event-projection-state.ts',176,192)}, {L('packages/thread-view/src/tool-activity-projection.ts',681,693)}). That row is returned as the expansion result and cached by the app; every expansion of that turn is wrong for as long as the events persist.</p>
  <p><b>Where the shape comes from.</b> The Claude Code translator scopes a <code>tool_result</code> to <code>state.currentTurnId</code> ({L('plugins/provider-claude-code/src/event-translation.ts',1325,1351)}); at a turn boundary <code>clearTransientTurnState</code> empties <code>toolItemsByCallId</code> ({L('packages/provider-bridge-protocol/src/bridge-kit/turn-state.ts',129,133)}), so a result arriving in the next turn is emitted as <code>{{ type: "toolCall", tool: "unknown", … }}</code> ({L('packages/provider-bridge-protocol/src/bridge-kit/tool-item-translation.ts',253,261)}) scoped to that next turn — exactly the seeded seq 6. The projection merge in <code>5b5e7dcee</code> (#447) exists because this happened on real threads, so any thread that persisted it renders wrong on expansion today.</p>
  <p><b>Deeper issue.</b> Two independent code paths (timeline window closure in <code>apps/server</code>, cross-turn merge in <code>packages/thread-view</code>) each define "which turn owns an item" and disagree. Any future rule change on one side (e.g. more whole-item closure) will keep drifting unless the details route is derived from the same ownership definition the projection uses, or a test pins <code>details.rows === row.children</code> for every summary row the timeline emits.</p>

  <h2>Proposed fix (first principles)</h2>
  <p>Direction 2 from the issue (scope-aware filtering) is the smallest change and I prototyped it: in <code>filterExactEventRowsForRequestedTurn</code>, track item ids the requested turn <code>item/started</code> inside the window; keep another turn's <code>item/*</code> rows (non-<code>backgroundTask</code>) for those ids; and drop ownership when another turn emits its own <code>item/started</code> for the same id (preserves #1398's id-reuse isolation, mirroring the projection's <code>runningCallsById</code> delete-on-end semantics). Patch: <a href="1714/repro/prototype-fix.patch">1714/repro/prototype-fix.patch</a>:</p>
  <pre>{patch_src}</pre>
  <p>Result: the regression test passes and the rows are byte-equal to the inline children (<code>toEqual</code> over the full row); the other 115 tests in <code>apps/server/test/services/threads</code> pass; the only failure is the issue's own "documents the defect" test, which now sees <code>completed</code> (<a href="1714/repro/prototype-fix-full-threads-run.log">log</a>). The exact-bounds match trap the issue warns about did not bite here because the re-admitted seq 6 stretches the re-projected turn back to the requested <code>sourceSeqEnd</code> while <code>resolveTurnSummaryDetailsSourceRange</code> now sees seq 6 as its last surviving row.</p>
  <p>Caveats to handle before shipping: (a) the prototype only re-admits rows already inside the fetched window; if the late completion sits beyond <code>sourceSeqEnd</code> (a byte-cut turn per #1199/#1510) it must be fetched, and then the requested range vs. re-projected range must be reconciled or the route will 500 with <code>missing-match</code>; (b) the retained turn-2 row is then also fed to <code>ensureSequenceWindowWholeItemRows</code> as identity <code>turn-2/call-1</code>, whose span is inside the window so it is not disowned, but a test should pin that; (c) add the invariant test next to #1510's in <code>timeline-in-turn-window.test.ts</code>; (d) consider the alternative of asking the projection itself which item ids a turn owns instead of re-deriving it in the server, so the two models cannot drift again. Server-only change; no wire shape changes, so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump.</p>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1201">#1201</a> (closed): the cross-<em>page</em> sibling — straddling tool call shows as pending in the oldest timeline slice's details; fixed by #1510.</li>
    <li><a href="https://github.com/get-bb/bb/pull/1510">#1510</a>: gave turn details the whole-item ownership rule (<code>ensureSequenceWindowWholeItemRows</code>), keyed per scoped identity.</li>
    <li><a href="https://github.com/get-bb/bb/pull/447">#447</a>: introduced the cross-turn merge in <code>upsertRunningExecCall</code> that makes the inline path correct.</li>
    <li><a href="https://github.com/get-bb/bb/pull/164">#164</a>: turn-detail hydration for overlapping turns (why other-turn rows are filtered).</li>
    <li><a href="https://github.com/get-bb/bb/pull/1398">#1398</a>: scoped item identity for ACP item-id reuse.</li>
    <li><a href="https://github.com/get-bb/bb/pull/633">#633</a>: keeps Claude child threads active while subagents run (reduces new occurrences).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
  <pre>git checkout 16ceb3a54
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
# unit repro
cp /tmp/bb-reports/issues/1714/repro/timeline-cross-turn-item-details*.test.ts apps/server/test/services/threads/
cd apps/server &amp;&amp; pnpm exec vitest run test/services/threads/timeline-cross-turn-item-details.test.ts          # issue's file: 2 passed (documents defect)
cd apps/server &amp;&amp; pnpm exec vitest run test/services/threads/timeline-cross-turn-item-details.regression.test.ts # 1 failed (invariant)
# dev instance
scripts/bb-dev-app current      # App :17600 Server :25600 daemon :33600
curl -s http://localhost:25600/api/v1/hosts
mkdir -p /tmp/bb-1714-qa &amp;&amp; git -C /tmp/bb-1714-qa init -q
curl -s -X POST http://localhost:25600/api/v1/projects -H 'content-type: application/json' -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/bb-1714-qa","hostId":"host_cd3y947m9k"}}}}'   # proj_zw32hwfcnb
cd apps/server &amp;&amp; BB_DB=&lt;datadir&gt;/bb.db BB_PROJECT_ID=proj_zw32hwfcnb pnpm exec tsx test/services/threads/seed-1714-dev-db.mts   # thr_babit2hcwx
sqlite3 &lt;datadir&gt;/bb.db "SELECT sequence,type,turn_id,item_id,item_kind FROM events WHERE thread_id='thr_babit2hcwx' ORDER BY sequence"
sqlite3 &lt;datadir&gt;/bb.db "DELETE FROM events WHERE thread_id='thr_babit2hcwx' AND sequence=9; UPDATE threads SET status='idle' WHERE id='thr_babit2hcwx';"
curl -s "http://localhost:25600/api/v1/threads/thr_babit2hcwx/timeline?includeNestedRows=true"
curl -s "http://localhost:25600/api/v1/threads/thr_babit2hcwx/timeline/turn-summary-details?turnId=turn-1&amp;sourceSeqStart=1&amp;sourceSeqEnd=6"
BB_SERVER_URL=http://localhost:25600 node packages/scripts/dist/commands/run-cli.js thread log thr_babit2hcwx --format verbose
dev-browser --browser bb1714 --headless   # goto http://localhost:17600/projects/proj_zw32hwfcnb/threads/thr_babit2hcwx, click "Worked for", click "npm run dev"
# prototype fix
(apply 1714/repro/prototype-fix.patch) ; cd apps/server &amp;&amp; pnpm exec vitest run test/services/threads
git checkout apps/server/src/services/threads/timeline.ts
# origin/main check
git fetch origin main; git checkout a108fa7ef; pnpm install …; pnpm exec turbo run build --filter=@bb/server; vitest run …regression.test.ts   # still fails
git checkout 16ceb3a54
pnpm dev:stop</pre>
  <h3>Seeded events (sqlite)</h3>
  <pre>1|turn/started|turn-1||
2|item/started|turn-1|call-1|commandExecution
3|item/completed|turn-1|msg-1|agentMessage
4|turn/completed|turn-1||
5|turn/started|turn-2||
6|item/completed|turn-2|call-1|toolCall
7|item/completed|turn-2|msg-2|agentMessage
8|turn/completed|turn-2||
9|system/error|||          (appended by the server: "Provisioning thread failed"; deleted before the idle-thread run)</pre>
  <h3>Seed script</h3>
  <pre>{seed_src}</pre>
  <h3>Regression test on origin/main a108fa7ef</h3>
  <pre>{main_log}</pre>
  <h3>Prototype fix: apps/server/test/services/threads run</h3>
  <pre>{proto_log}</pre>
  <h3>Issue's test on base</h3>
  <pre>{issue_log}</pre>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/1714.html").write_text(page)
print(len(page))
