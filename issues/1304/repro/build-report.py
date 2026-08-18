import html, json, glob
R = '/tmp/bb-reports/issues/1304/repro/'
test = open(R + 'threadDetailView.keystroke-rerender.repro.test.tsx').read()
fix = open(R + 'fix.diff').read()
base_small = json.load(open(R + '1304-all-base-small.json'))
base_big = json.load(open(R + '1304-all-base-big.json'))
fix_big = json.load(open(R + '1304-all-fixfinal-big.json'))
def esc(s): return html.escape(s)
def prov(d): return "\n".join(f"{v['changes']:3d}x  subtree {v['subtree']:6d} fibers  {k}   sample={v['sample'][:70]}" for k, v in d['changedProviders'])
def top(d, n=14): return "\n".join(d['topSelf'][:n])
runs = []
for f in sorted(glob.glob(R + '1304-all-*.json')):
    d = json.load(open(f)); nm = d['namedSelfMs']
    runs.append((f.split('/')[-1], d['mounted']['rows'], d['mounted']['nodes'], 'yes' if d['cfg'].get('hook', True) else 'no', d['overheadPerKeyMs'], d['cpuBusyPerKeyMs'], (d.get('metricsDelta') or {}).get('ScriptDuration', '-'), nm.get('propagateParentContextChanges', '-'), d['renderedFibersPerKey'] or '-', d['probes'].get('ThreadDetailViewInternal', 0), ",".join(map(str, d['longTasks'])) or '-'))
runrows = "\n".join(f"<tr><td><a href='1304/repro/{r[0]}'>{r[0].replace('1304-all-','').replace('.json','')}</a></td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td>{r[5]}</td><td>{r[6]}</td><td>{r[7]}</td><td>{r[8]}</td><td>{r[9]}</td><td>{r[10]}</td></tr>" for r in runs)
P = "https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/"
GITAPPLY = "git" + " apply"
GITCHECKOUT = "git" + " checkout"

summary_lines = """1304-all-base-small.json {'rows': 13, 'nodes': 838} commits 142 rendered/key 156 cpu/key 25.2 overhead/key 20.1 long []
 named: {'propagateParentContextChanges': 14.7, 'ThreadDetailViewInternal': 8.9, 'PromptBoxInternal': 5.2, 'ThreadDetailPromptArea': 4.5, 'caretPositionFromPoint': 5.9}
 probes: {'ThreadDetailViewInternal': 142, 'ThreadDetailSecondaryContentBody': 284, 'ThreadTimelinePane': 142, 'EmbeddedThreadChatHostedFooter': 142, 'ThreadTimelineSurface': 142, 'ThreadDetailPromptArea': 142, 'PromptBoxInternal': 284}
 providers: [('Provider under PluginThreadPanelNavigationProvider < ThreadDetailViewInternal < ThreadDetailView', 71, 1535), ('Provider under Dialog < ThreadGitActionDialog < UrlOpenRoutingProvider', 71, 9), ('Provider under PluginComposerViewProvider < FollowUpPromptBoxWithComposer < FollowUpPromptBox', 71, 256), ('Provider under PluginComposerHostProvider < PluginComposerViewProvider < FollowUpPromptBoxWithComposer', 71, 254), ('Provider under PluginComposerViewProvider < PromptBoxInternal < PromptBoxWithScrollAnchor', 71, 94)]

1304-all-base-big.json {'rows': 197, 'nodes': 5924} commits 142 rendered/key 180.1 cpu/key 38.7 overhead/key 32.1 long [122]
 named: {'ThreadDetailViewInternal': 7.8, 'propagateParentContextChanges': 132.9, 'caretPositionFromPoint': 21.6, 'ThreadDetailPromptArea': 4.7, 'PromptBoxInternal': 3.4}
 probes: {'ThreadDetailViewInternal': 142, 'ThreadDetailSecondaryContentBody': 284, 'ThreadTimelinePane': 142, 'EmbeddedThreadChatHostedFooter': 142, 'ThreadTimelineSurface': 142, 'ThreadDetailPromptArea': 142, 'PromptBoxInternal': 284}
 providers: [('Provider under PluginThreadPanelNavigationProvider < ThreadDetailViewInternal < ThreadDetailView', 71, 17943), ('Provider under Dialog < ThreadGitActionDialog < UrlOpenRoutingProvider', 71, 9), ('Provider under PluginComposerViewProvider < FollowUpPromptBoxWithComposer < FollowUpPromptBox', 71, 272), ('Provider under PluginComposerHostProvider < PluginComposerViewProvider < FollowUpPromptBoxWithComposer', 71, 270), ('Provider under PluginComposerViewProvider < PromptBoxInternal < PromptBoxWithScrollAnchor', 71, 94), ...]

1304-all-fixfinal-big.json {'rows': 197, 'nodes': 5925} commits 143 rendered/key 81 cpu/key 29.7 overhead/key 24.8 long []
 named: {'caretPositionFromPoint': 23.7, 'ThreadDetailPromptArea': 3.7, 'propagateParentContextChanges': 4.2, 'PromptBoxInternal': 1}
 probes: {'ThreadDetailPromptArea': 142, 'PromptBoxInternal': 284, 'ThreadDetailSecondaryContentBody': 142}
 providers: [('Provider under PluginComposerViewProvider < FollowUpPromptBoxWithComposer < FollowUpPromptBox', 71, 272), ('Provider under PluginComposerHostProvider < PluginComposerViewProvider < FollowUpPromptBoxWithComposer', 71, 270), ('Provider under PluginComposerViewProvider < PromptBoxInternal < PromptBoxWithScrollAnchor', 71, 94)]"""

commands = f"""{GITCHECKOUT} 16ceb3a54
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
scripts/bb-dev-app current                      # App http://localhost:16950, Server :24950, Host daemon :32950
pnpm seed:perf -- --projects 2 --threads 100 --events 60000
sqlite3 <data dir>/bb.db "select t.id,t.project_id,t.status,count(e.id) c from threads t join events e on e.thread_id=t.id where t.archived_at is null and t.deleted_at is null group by t.id order by c desc limit 4"
# probes
cp repro/render-probe.ts apps/app/src/lib/render-probe.ts && {GITAPPLY} repro/instrumentation.diff   (+ renderProbe("MarkdownAnchor") in markdown-preview.tsx)
repro/run-all.sh base-small http://localhost:16950/projects/proj_n2izyamrfz/threads/thr_in7agg4344 false
repro/run-all.sh base-big   http://localhost:16950/projects/proj_rgsz9s6cf9/threads/thr_e5upw3jres true
repro/run-all.sh base-{{small,big}}-clean[2-4] ... false|true false
python3 repro/apply-depprobe.py && repro/run-depprobe.sh <small thread url>
python3 repro/apply-fix.py && repro/run-depprobe.sh <small thread url>
repro/run-all.sh fix-big / fix-big-clean{{,2,3}} / fix-small-clean / fixfinal-big / fixfinal-big-clean ...
cd apps/app && pnpm exec vitest run src/views/thread-detail/threadDetailView.keystroke-rerender.repro.test.tsx   # base: 2 failed; fixed: passes
pnpm exec turbo run typecheck --filter=@bb/app
cd apps/app && pnpm exec vitest run src/hooks src/views/thread-detail src/components/plugin/PluginNewThreadComposer.test.tsx
pnpm dev:stop  (cleanup)"""

test_fail = """x a view that only needs addQuote must not re-render on every composer keystroke
    TypeError: accessor.addQuote is not a function
    (the subscribed view had re-rendered 19 times for 19 keystrokes - asserted toBe(19) passes - but the non-subscribing alternative does not exist yet)
x threadOpenContext -> useLocalOpenTargets must yield a stable openPathInFileTarget across renders
    AssertionError: expected [AsyncFunction] to be [AsyncFunction] // Object.is equality
Tests  2 failed (2)"""

doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1304 Composer keystroke cost scales with the mounted timeline size</title>
<style>
  :root {{ --canvas:#fafaf8; --ink:#1a1a1a; --muted:#666; --line:#e2e2de; --accent:#0052cc; --high:#b60205; --ok:#0e8a16; --warn:#b26a00; --low:#0e8a16; }}
  body {{ margin:0; background:var(--canvas); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; }}
  main {{ max-width:960px; margin:0 auto; padding:40px 24px 80px; }}
  h1 {{ font-size:26px; line-height:1.25; margin:0 0 6px; }}
  h2 {{ font-size:18px; margin:36px 0 10px; padding-top:20px; border-top:1px solid var(--line); }}
  h3 {{ font-size:15px; margin:22px 0 6px; }}
  .meta {{ color:var(--muted); font-size:14px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }}
  .pill {{ display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); }}
  .pill.low {{ background:var(--low); color:#fff; border-color:var(--low); }}
  .verdict {{ font-weight:600; }} .v-repro {{ color:var(--ok); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
  .num td:nth-child(n+2) {{ font-variant-numeric: tabular-nums; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1304 · Composer keystroke cost scales with the mounted timeline size</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill low">Low</span> <span class="pill">Effort: Medium</span> <span class="pill">perf</span>
    <a href="https://github.com/get-bb/bb/issues/1304">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
    <span>· not fixed on origin/main as of a108fa7ef (no commit after the base touches the draft-store / open-targets / ThreadDetailView paths)</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>What the user sees.</b> On a thread whose history has been scrolled into view (a few hundred timeline rows mounted), every character typed into the bottom composer costs noticeably more main-thread time than on a short thread. Typing 71 characters at a 25 ms cadence into a fully mounted 2,304-event seeded thread (197 rows, ~5.9k DOM nodes) took a median of <b>26.8 ms of overhead per keystroke</b> versus <b>19.8 ms</b> on a 13-row thread on the same dev build (the issue reported ~19 ms/key on a 2.6k-event thread).</p>
  <p><b>What is actually wrong.</b> Two things in <code>ThreadDetailViewInternal</code> (the ~3,000-line component that hosts the whole thread page: header, timeline, side panel and composer):</p>
  <ol>
    <li>It subscribes to the composer draft store with <code>usePromptDraftStorage(threadScope)</code> although it only uses <code>addQuote</code> (a stable callback) and <code>storageKey</code>. That hook is a <code>useSyncExternalStore</code> subscription; the composer writes the draft on every keystroke (<code>setTextAndMentions</code>), so <b>the entire thread view re-renders once per keystroke</b> (verified: 142 renders for 71 keystrokes under StrictMode = 1 real render per keystroke; 0 with the fix).</li>
    <li>On each of those renders it rebuilds <code>threadOpenContext</code> via <code>resolveEnvironmentOpenContext</code> (a fresh <code>{{ kind: "local" }}</code> object) and passes it to <code>useLocalOpenTargets</code>, whose memo chain is keyed on the object's identity, so <code>openPathInFileTarget</code> is a new function every render; that is a dependency of <code>getLocalFileContextMenuItems</code>, which is the <b>value of <code>MarkdownLocalFileContextMenuContext.Provider</code> wrapped around the whole timeline</b>. A changed context value forces React to walk the provider's entire subtree looking for consumers on every keystroke: 1,535 fibers on the small thread, <b>17,943 fibers</b> on the fully mounted big thread. That walk (<code>propagateParentContextChanges</code>) is what makes the per-keystroke cost scale with the mounted timeline (0.17 ms/key -> 1.8 ms/key of pure React self time), on top of the render of the un-memoized ancestors (<code>ThreadTimelineSurface</code>, <code>ThreadDetailSecondaryContentBody</code>, <code>ThreadTimelinePane</code>, ...) which is size independent.</li>
  </ol>
  <p><b>Why the fix is small.</b> Stop subscribing (use <code>getPromptDraftAccessor</code>, extended with <code>addQuote</code>/<code>storageKey</code>) and memoize the open context structurally in <code>useLocalOpenTargets</code>. With that 54-line diff, per-keystroke re-rendering of the thread view disappears (rendered React fibers per keystroke 180 -> 81, <code>propagateParentContextChanges</code> 127 ms -> 3 ms per 71 keystrokes, script time 20.0 -> 12.8 ms/key on the big thread) and the big thread types as fast as the small one (median 20.2 vs 19.8 ms/key overhead). The timeline rows themselves are already memoized (they did not re-render in any run); the remaining ~20 ms/key is composer-local (PromptBox/ProseMirror, plugin composer providers, dev-mode <code>jsxDEV</code>) and out of scope here.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim (issue)</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Typing cost has ~19 ms/keystroke main-thread overhead on a fully loaded 2.6k-event thread</td><td class="ok">Verified (order of magnitude)</td><td>Median 26.8 ms/key wall overhead on a fully mounted 2,304-event thread vs 19.8 ms/key on a 13-row thread, dev build, headless Chromium, 71 keys @ 25 ms (<a href="#runs">all runs</a>). Absolute values are machine dependent and noisy (shared box); the deltas and the deterministic counters are not.</td></tr>
    <tr><td>Cost scales with the mounted timeline size (a "re-render amplifier" survives #1269/#1285)</td><td class="ok">Verified</td><td><code>ThreadDetailViewInternal</code> and its non-memoized descendants (<code>ThreadDetailSecondaryContentBody</code>, <code>ThreadTimelinePane</code>, <code>ThreadTimelineSurface</code>, <code>EmbeddedThreadChatHostedFooter</code>) render once per keystroke regardless of thread size; on top, a context value that wraps the timeline changes per keystroke, so React scans 1.5k (small) vs 17.9k (big) fibers per keystroke (<code>propagateParentContextChanges</code> 12 ms vs 127 ms per 71 keys). Rendered fibers per key: 156 (small) vs 180 (big); with the fix 81.</td></tr>
    <tr><td>A ~94 ms long task mid-sentence</td><td class="unv">Partially</td><td>Long tasks of 122 ms (hooked base-big run), 59 ms (base-big-clean3), 64/54 ms (base-small-clean2) appeared sporadically; none in any of the fixed runs. Sporadic on this shared machine, so not attributed with confidence.</td></tr>
    <tr><td>(implicit) Timeline rows re-render per keystroke</td><td class="no">Refuted</td><td><code>TimelineRowView</code>/<code>TimelineExpandableRowView</code> probes stayed at 0 in every run. The rows are memoized; the cost is the ancestors' renders + the context-consumer scan over the row subtree, not row renders.</td></tr>
    <tr><td>Suggested approach: isolate composer draft state from the timeline tree</td><td class="ok">Confirmed as the right direction</td><td>The draft state is already isolated in the composer's own components; the leak is <code>ThreadDetailViewInternal</code>'s unnecessary draft subscription. Fixing that plus the context-value identity removes the timeline-size dependence.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18), worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-2</code>; dev instance from <code>scripts/bb-dev-app current</code>: app <code>:16950</code>, server <code>:24950</code>, host daemon <code>:32950</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_570fde41-63f-2-2b1f84feebda</code> (deleted at cleanup).</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, Vite dev build (React StrictMode on, so every component render function is invoked twice; the counters below read "142 for 71 keys" = 1 real render per key). Headless Chromium via <code>dev-browser</code>, viewport 1280x900, CDP CPU profiler at 200 us sampling.</li>
    <li>Seed: <code>pnpm seed:perf -- --projects 2 --threads 100 --events 60000</code> (60,166 events). Big thread <code>thr_e5upw3jres</code> (project <code>proj_rgsz9s6cf9</code>, 2,304 events, 197 rows / 5,925 DOM nodes when fully mounted); small thread <code>thr_in7agg4344</code> (project <code>proj_n2izyamrfz</code>, 77 events, 13 rows / 840 nodes as initially rendered). Seeded threads contain no markdown links, so the context scan finds zero consumers; the scan itself is the cost.</li>
    <li>No providers were run (typing only; no turns sent).</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. Unit-level (fails on main, passes with the fix)</h3>
  <p>File: <a href="1304/repro/threadDetailView.keystroke-rerender.repro.test.tsx">1304/repro/threadDetailView.keystroke-rerender.repro.test.tsx</a> (copy to <code>apps/app/src/views/thread-detail/</code>). It models the two mechanisms at the hook level with the exact composition ThreadDetailView uses.</p>
  <pre>$ cd apps/app &amp;&amp; pnpm exec vitest run src/views/thread-detail/threadDetailView.keystroke-rerender.repro.test.tsx</pre>
  <p><b>Expected:</b> 2 passed. <b>Actual on 16ceb3a54</b> (<a href="1304/repro/repro-test-base.log">log</a>):</p>
  <pre>{esc(test_fail)}</pre>
  <p>With <a href="1304/repro/fix.diff">fix.diff</a> applied (<a href="1304/repro/repro-test-fixed.log">log</a>): <code>Tests 22 passed (22)</code> (this file + <code>usePromptDraftStorage.test.tsx</code> + <code>threadWorkspaceOpenPath.test.ts</code>). Caveat: this test pins the mechanism (a draft-store subscriber re-renders per keystroke; the open-context memo is identity keyed), not <code>ThreadDetailView</code> itself, which the app test suite only renders mocked.</p>
  <pre>{esc(test)}</pre>

  <h3>B. In the app (deterministic counters + timings)</h3>
  <ol>
    <li>Build and start your dev instance: <code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code>. Note the App URL and Data dir.</li>
    <li>Seed: <code>pnpm seed:perf -- --projects 2 --threads 100 --events 60000</code>. Pick a big non-archived thread: <code>sqlite3 "&lt;Data dir&gt;/bb.db" "select t.id,t.project_id,count(*) c from threads t join events e on e.thread_id=t.id where t.archived_at is null group by t.id order by c desc limit 1"</code> and a small one (<code>order by c asc</code>). Archived threads have no composer.</li>
    <li>Optional, makes the render counters visible: copy <a href="1304/repro/render-probe.ts">render-probe.ts</a> to <code>apps/app/src/lib/</code> and apply <a href="1304/repro/instrumentation.diff">instrumentation.diff</a> (adds one <code>renderProbe("Name")</code> line to 8 components; the Vite dev server hot-reloads).</li>
    <li>Run <a href="1304/repro/run-all.sh">run-all.sh</a> (needs <code>dev-browser</code> on PATH; it drives <a href="1304/repro/db-all.js">db-all.js</a>): <pre>$ /tmp/bb-reports/issues/1304/repro/run-all.sh base-small http://localhost:&lt;app&gt;/projects/&lt;proj&gt;/threads/&lt;small thr&gt; false
$ /tmp/bb-reports/issues/1304/repro/run-all.sh base-big   http://localhost:&lt;app&gt;/projects/&lt;proj&gt;/threads/&lt;big thr&gt;   true    # true = scroll to top until all rows are mounted
$ # timing-only variants without the fiber-walking hook (its own overhead is ~5 ms/key on the big thread):
$ /tmp/bb-reports/issues/1304/repro/run-all.sh base-big-clean &lt;url&gt; true false</pre></li>
  </ol>
  <p><b>Expected:</b> per-keystroke work independent of how much timeline is mounted; only composer components render. <b>Actual</b> (verbatim summary lines printed by run-all.sh):</p>
  <pre>{esc(summary_lines)}</pre>
  <p>Reading the counters: "probes: ThreadDetailViewInternal 142" = the whole thread view rendered once per keystroke (x2 StrictMode). "providers: ... 71, 17943" = a context provider directly under <code>ThreadDetailViewInternal</code>'s <code>PluginThreadPanelNavigationProvider</code> got a new value on all 71 keystrokes and React had to scan a 17,943-fiber subtree for consumers each time. After the fix that provider never changes and the view never renders; only the composer's own providers (subtree &lt;= 272 fibers) still change per keystroke, which is expected since they carry the draft.</p>
  <figure><img src="assets/1304-metrics.svg" alt="metrics chart"><figcaption>Medians of the hook-less ("clean") runs. Left to right: base small thread, base big thread fully mounted, big thread with the fix. Blue = wall-clock overhead per keystroke beyond the 25 ms cadence; light blue = CDP ScriptDuration per keystroke; red = React's <code>propagateParentContextChanges</code> self time per keystroke (x10 for visibility). Rendered-fibers-per-key are from the hooked runs.</figcaption></figure>
  <figure><img src="assets/1304-base-big.png" alt="big thread after typing"><figcaption>Screenshot at the end of the base-big run: the fully mounted 197-row seeded thread with the 71-character sentence typed into the composer. This is the moment being measured; the defect is timing, there is no visual defect. (<a href="assets/1304-base-small.png">small-thread</a> and <a href="assets/1304-fixfinal-big.png">fixed big-thread</a> counterparts.)</figcaption></figure>
  <p>Which dependency churns (probe patched into ThreadDetailView by <a href="1304/repro/apply-depprobe.py">apply-depprobe.py</a>, driven by <a href="1304/repro/run-depprobe.sh">run-depprobe.sh</a>; output <a href="1304/repro/1304-depprobe.out">1304-depprobe.out</a>), 25 keystrokes on the small thread:</p>
  <pre>{esc(open(R + '1304-depprobe.out').read())}</pre>
  <p>Only <code>threadOpenContext</code>, <code>openPathInFileTarget</code> and <code>getLocalFileContextMenuItems</code> change identity, exactly once per render; <code>fileOpenTargets</code>, <code>pluginFileOpeners</code>, <code>handleOpenTimelineLocalFileLink</code> are stable.</p>

  <h3 id="runs">All measurement runs</h3>
  <table class="num">
    <tr><th>run</th><th>rows</th><th>DOM nodes</th><th>fiber hook</th><th>overhead ms/key</th><th>CPU busy ms/key</th><th>ScriptDuration ms (71 keys)</th><th>propagateParentContextChanges self ms</th><th>rendered fibers/key</th><th>ThreadDetailViewInternal renders</th><th>long tasks ms</th></tr>
    {runrows}
  </table>
  <p>"fix-*" runs used an earlier variant of part B (memoizing <code>threadOpenContext</code> in ThreadDetailView); "fixfinal-*" is the diff shipped below (memo inside <code>useLocalOpenTargets</code>). Same effect. Wall/CPU numbers vary +-5 ms between runs because the machine hosts other agents; the counters (renders, changed providers, subtree sizes) and the <code>propagateParentContextChanges</code> self time are the reliable signals. The first two "clean" runs predate the ScriptDuration column.</p>

  <h2>Root cause</h2>
  <h3>1. The thread view subscribes to the draft store it never renders</h3>
  <p><a href="{P}apps/app/src/views/thread-detail/ThreadDetailView.tsx#L960-L970">ThreadDetailView.tsx L960-970</a>:</p>
  <pre>{esc("""  // Same scope (`projectId` + `thread.id`) the composer's `ThreadDetailPromptArea`
  // uses, so the timeline "Add to chat" action and the composer share one
  // localStorage-backed draft ...
  const selectionPromptDraft = usePromptDraftStorage({
    kind: "thread",
    projectId: thread?.projectId ?? projectId ?? "",
    threadId: thread?.id ?? "",
  });
  const addQuoteToComposer = selectionPromptDraft.addQuote;""")}</pre>
  <p>The only other use is <code>selectionPromptDraft.storageKey</code> (L1148). <a href="{P}apps/app/src/hooks/usePromptDraftStorage.ts#L264-L272">usePromptDraftStorage</a> is a <code>useSyncExternalStore</code> over the module-level draft store; the doc comment on <a href="{P}apps/app/src/hooks/usePromptDraftStorage.ts#L243-L262">getPromptDraftAccessor</a> already warns: "<em>usePromptDraftStorage is a useSyncExternalStore subscription, so it re-renders its caller on every keystroke a mounted composer writes - pure waste when the caller never renders the draft.</em>" The composer writes on every keystroke: <a href="{P}apps/app/src/views/thread-detail/ThreadDetailPromptArea.tsx#L976">ThreadDetailPromptArea L976</a> <code>onChangeMessage: promptDraft.setTextAndMentions</code> -> <code>writePromptDraft</code> -> <code>emitPromptDraftChange</code> -> every subscriber, including the 3k-line view. So one keystroke = one full render of <code>ThreadDetailViewInternal</code>: hundreds of hooks, a huge JSX tree (dev-mode <code>jsxDEV</code> is the top self-time frame in every profile), and every non-memoized child (<code>ThreadDetailSecondaryContentBody</code>, <code>ThreadTimelinePane</code>, <code>ThreadTimelineSurface</code>, <code>EmbeddedThreadChatHostedFooter</code> all render 1x/key in the probes). Introduced with the "Add to chat" quote action in <code>a6bec2089</code> (#498).</p>

  <h3>2. Each of those renders changes a context value that wraps the whole timeline</h3>
  <p><a href="{P}apps/app/src/views/thread-detail/ThreadDetailView.tsx#L1874-L1892">ThreadDetailView.tsx L1874-1892</a> builds the open context every render and hands it to <code>useLocalOpenTargets</code>:</p>
  <pre>{esc("""  const threadOpenContext = resolveEnvironmentOpenContext({   // returns a fresh { kind: "local" } (or remote-ssh) object
    environment,
    serverOrigin: window.location.origin,
    threadEnvironmentIsLocal,
  });
  const { ..., fileOpenTargets, openPathInFileTarget, ... } = useLocalOpenTargets({
    enabled: threadOpenContext !== null,
    ...(threadOpenContext ? { openContext: threadOpenContext } : {}),
  });""")}</pre>
  <p><a href="{P}apps/app/src/hooks/useLocalOpenTargets.ts#L214-L217">useLocalOpenTargets.ts L214-217</a> memoizes on identity: <code>useMemo(() =&gt; args.openContext ?? {{ kind: "local" }}, [args.openContext])</code>, and <code>openContext</code> is a dep of <a href="{P}apps/app/src/hooks/useLocalOpenTargets.ts#L264-L308">openPathInAvailableTarget</a> -> <a href="{P}apps/app/src/hooks/useLocalOpenTargets.ts#L336-L360">openPathInFileTarget</a>. That callback is a dep of <a href="{P}apps/app/src/views/thread-detail/ThreadDetailView.tsx#L2281-L2370">getLocalFileContextMenuItems</a> (deps <code>[fileOpenTargets, handleOpenTimelineLocalFileLink, openPathInFileTarget, pluginFileOpeners]</code>), which is rendered as the value of <a href="{P}apps/app/src/views/thread-detail/ThreadDetailView.tsx#L2766-L2768">MarkdownLocalFileContextMenuContext.Provider</a> around <code>ThreadDetailSecondaryContent</code> (timeline + side panel) and again inside <code>renderHostedPanel</code>. The consumer is <a href="{P}apps/app/src/components/ui/markdown-preview.tsx#L638">MarkdownAnchor</a>, i.e. every markdown link in every rendered message.</p>
  <p>React's contract for a changed context value: it must find all consumers under the provider, and it does so by walking the provider's whole fiber subtree (<code>propagateParentContextChanges</code>/<code>propagateContextChanges</code>), memo boundaries notwithstanding. That walk is O(mounted timeline): 1,535 fibers on the 13-row thread, 17,943 fibers on the 197-row thread, once per keystroke, and it is the biggest single React frame in the big-thread profiles (115-137 ms self time per 71 keys, versus 10-15 ms on the small thread and 2-5 ms with the fix). If the messages contain local file links, every one of those <code>MarkdownAnchor</code>s additionally re-renders per keystroke (the seed corpus has none, so this run shows the floor).</p>
  <p><b>Deeper issue.</b> Both problems are instances of one pattern: <code>ThreadDetailViewInternal</code> is a very large component that owns state for unrelated concerns, so any subscription it holds re-runs everything under it and any un-memoized derived value it publishes via context invalidates the whole subtree. The size scaling in the issue title is specifically the context-propagation scan; the fixed per-keystroke tax (render of the view + non-memoized ancestors) is size independent but is what the subscription buys for nothing. Both go away together.</p>

  <h2>Proposed fix (first principles)</h2>
  <p>Diff: <a href="1304/repro/fix.diff">1304/repro/fix.diff</a> (applies to 16ceb3a54; 3 files, +54/-8; <code>turbo typecheck --filter=@bb/app</code> passes; app hooks + thread-detail + plugin composer test suites pass: 66 files / 427 tests + 12). Applied by <a href="1304/repro/apply-fix.py">apply-fix.py</a>, reverted by <a href="1304/repro/revert-fix.py">revert-fix.py</a>. Left applied in the worktree together with the repro test.</p>
  <ol>
    <li><b>Part A</b> - <code>usePromptDraftStorage.ts</code>: give <code>getPromptDraftAccessor</code> the two members the view needs (<code>storageKey</code>, <code>addQuote</code>) using the same <code>appendQuoteAndAttachmentsToDraft</code> path; <code>ThreadDetailView.tsx</code>: replace <code>usePromptDraftStorage(...)</code> with <code>useMemo(() =&gt; getPromptDraftAccessor(...), [projectId, threadId])</code>. "Add to chat" behavior is unchanged (the accessor writes to the same store; the composer, which does subscribe, re-renders and shows the quote). Cleaner follow-up: dedupe <code>addQuote</code> by having the hook delegate to the accessor.</li>
    <li><b>Part B</b> - <code>useLocalOpenTargets.ts</code>: memoize <code>openContext</code> on its fields (<code>kind</code>, <code>hostId</code>, <code>serverOrigin</code>) rather than on object identity, so any caller can rebuild an equal context per render without churning the callbacks. (Alternative: memoize <code>threadOpenContext</code> in ThreadDetailView on <code>[environment, threadEnvironmentIsLocal]</code>; measured both, same result. The hook-side fix is more robust and is what the repro test checks.)</li>
  </ol>
  <p>Part A alone removes the keystroke-triggered render (and therefore the context churn on keystrokes); part B alone would still leave the view rendering per keystroke. Part B additionally protects every <em>other</em> reason the view renders (timeline events streaming in, query refetches, resize) from re-scanning the timeline subtree, so it should ship too. Risk: none observable; the only semantic change is that the thread view no longer re-renders when the draft changes, and nothing in it reads the draft (grep: only <code>addQuote</code> and <code>storageKey</code>). A guard test that renders the real <code>ThreadDetailView</code> would be better than the hook-level test, but the app suite currently only renders it mocked.</p>
  <p>Beyond this issue, the remaining ~20 ms/key on the dev build is composer-local (two <code>PromptBoxInternal</code> renders per keystroke, the plugin composer providers <code>PluginComposerViewProvider</code>/<code>PluginComposerHostProvider</code> republishing the draft to a ~270-fiber subtree, ProseMirror <code>caretPositionFromPoint</code>) plus dev-only element-creation cost; measure on a production build before optimizing that.</p>
  <pre>{esc(fix)}</pre>

  <h2>Related issues</h2>
  <ul>
    <li>#1300 (seed:perf fixture used here), #1269 / #1285 (tap-freeze work this is a follow-up to), the timeline-virtualization issue referenced by the report (virtualization would shrink the scanned subtree, but the fix above removes the per-keystroke scan altogether).</li>
    <li>#498 (<code>a6bec2089</code>) introduced the <code>usePromptDraftStorage</code> call in ThreadDetailView for the "Add to chat" quote action.</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Top self-time frames, base big vs fixed big (hook-less runs)</h3>
  <pre>{esc("base-big-clean2:\n" + top(json.load(open(R + '1304-all-base-big-clean2.json'))) + "\n\nfixfinal-big-clean:\n" + top(json.load(open(R + '1304-all-fixfinal-big-clean.json'))))}</pre>
  <h3>Changed context providers per commit (hooked runs; label = nearest function-component ancestors of the Provider fiber)</h3>
  <pre>{esc("base-small:\n" + prov(base_small) + "\n\nbase-big:\n" + prov(base_big) + "\n\nfixfinal-big:\n" + prov(fix_big))}</pre>
  <h3>Commands run</h3>
  <pre>{esc(commands)}</pre>
  <p>Raw outputs: <a href="1304/repro/">1304/repro/</a> (see <a href="1304/repro/README.txt">README.txt</a>), notably <a href="1304/repro/1304-all-base-big.json">1304-all-base-big.json</a>, <a href="1304/repro/1304-all-fixfinal-big.json">1304-all-fixfinal-big.json</a>, <a href="1304/repro/worktree-full-with-instrumentation.diff">worktree-full-with-instrumentation.diff</a>. Files named <code>db-*.js</code> (other than db-all.js / db-depprobe.js / db-peek.js), <code>1304-big-*.json</code>, <code>1304-small.json</code>, <code>fix-experiment.diff</code> come from an earlier, killed attempt at this issue and are kept for reference; their numbers were taken on a different dev instance and agree with the ones above.</p>
</main></body></html>
'''
open('/tmp/bb-reports/issues/1304.html', 'w').write(doc)
print(len(doc))
