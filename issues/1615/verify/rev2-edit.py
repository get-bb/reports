p='/tmp/bb-reports/issues/1615.html'; s=open(p).read()
def rep(old,new):
    global s
    assert s.count(old)==1, ("count", s.count(old), old[:80])
    s=s.replace(old,new)

# TL;DR numbers + CommandList wording
rep("blocking the main thread for 2.3–2.9&nbsp;s on this desktop and 8–14&nbsp;s under 4× CPU throttling",
    "blocking the main thread for 2.0–2.8&nbsp;s on this desktop and 8–11&nbsp;s under 4× CPU throttling")
rep("a container primitive that maps nothing and has no consumers (<code>CommandList</code>)",
    "a container primitive that maps nothing (<code>CommandList</code>; its only consumers are the tasks plugin's small cmdk pickers)")
# Claims table CSV row
rep("Main thread blocked 2.3&nbsp;s (prod build, 1×), 8.1&nbsp;s (prod build, 4× CPU throttle); DOM Nodes 46k → 183k; JS heap +29&nbsp;MB.",
    "Main thread blocked 2.0&nbsp;s (prod build, 1×), 8.4&nbsp;s (prod build, 4× CPU throttle); DOM Nodes 34k → 184k; JS heap +33&nbsp;MB.")
rep("Upstream, <code>WorkspaceStatus.workingTree.files</code> is unbounded on the wire (425&nbsp;KB for 5,000 files).",
    "Upstream, <code>WorkspaceStatus.workingTree.files</code> (JSON path <code>workspace.workingTree.files</code> in the status response) is unbounded on the wire (425&nbsp;KB for 5,000 files).")
rep("<code>CommandList</code> is a <code>max-h-[300px]</code> container wrapper; it maps nothing, and no file in <code>apps/app</code> imports it.",
    "<code>CommandList</code> is a <code>max-h-[300px]</code> container wrapper; it maps nothing. Nothing in <code>apps/app</code> imports it; its only consumers are the tasks plugin's cmdk pickers (<code>plugins/tasks/views/detail/rail.tsx:283</code>, <code>plugins/tasks/views/manage/new-task-dialog.tsx:569,634</code>), which hold small lists.")
rep("Chromium at 4× CPU throttle blocks 8–14&nbsp;s on the CSV preview", "Chromium at 4× CPU throttle blocks 8–11&nbsp;s on the CSV preview")

# Environment
rep("worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-17</code>", "worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-7</code>")
rep("Dev instance: app <code>:15271</code> (Vite dev), server <code>:23271</code>, host daemon <code>:31271</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-17-dae163ef21fd</code>. Production build served with <code>vite preview</code> on <code>:15272</code> proxying <code>/api</code> and <code>/ws</code> to <code>:23271</code>",
    "Dev instance: app <code>:17792</code> (Vite dev), server <code>:25792</code>, host daemon <code>:33792</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_570fde41-63f-7-8a03094805ce</code> (all from <code>scripts/bb-dev-app current</code>). Production build served with <code>vite preview</code> on <code>:17793</code> proxying <code>/api</code> and <code>/ws</code> to <code>:25792</code>")
rep("Project <code>proj_drg6kwky3m</code> → <code>/tmp/1615-qa</code>, thread <code>thr_5e4dmaajwp</code>, environment <code>env_hd3zgfggci</code>.",
    "Host <code>host_5tsbbs2tfu</code>, project <code>proj_uzvv6df4kw</code> → <code>/tmp/1615-qa</code>, thread <code>thr_6isgdy7qwz</code>, environment <code>env_665hugj7gq</code>.")

# Fixture note
rep("<p>Fixture: a scratch git repo with a 600×120 CSV (committed) and 5,000 untracked files.</p>",
    "<p>Fixture: a scratch git repo with a 600×120 CSV (committed) and 5,000 untracked files. It can live anywhere the host daemon can read (any absolute path); note that it creates ~5,000 inodes, so avoid a nearly-full tmpfs <code>/tmp</code> (<code>df -i /tmp</code>) — under <code>$HOME</code> is fine.</p>")

# Steps 1-3
rep("""    <li><code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code> (note App/Server ports and host id from <code>curl -s $BB_SERVER_URL/api/v1/hosts</code>).</li>
    <li>Create the project and a thread (one tiny codex turn provisions the local workspace):
<pre>curl -s -X POST http://localhost:23271/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/1615-qa","hostId":"host_uhq5uwxsbj"}}'   # → proj_drg6kwky3m
BB_SERVER_URL=http://localhost:23271 pnpm bb:dev thread spawn --project proj_drg6kwky3m --provider codex \\
  --permission-mode accept-edits --title "1615 qa" --prompt "Reply only with ok." --json                # → thr_5e4dmaajwp</pre></li>
    <li>Edit the URL/ids at the top of the scripts in <a href="1615/repro/">1615/repro/</a> and run them with <code>dev-browser --browser bb1615 --headless --timeout 120 run &lt;script&gt;</code>.</li>""",
"""    <li><code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code>. Note the App/Server/Host-daemon ports it prints, then <code>eval "$(scripts/bb-dev-app env)"</code> — this sets <b>both</b> <code>BB_SERVER_URL</code> and <code>BB_HOST_DAEMON_PORT</code> for your instance. Get the host id of <em>your</em> instance from <code>curl -s $BB_SERVER_URL/api/v1/hosts</code>.</li>
    <li>Create the project and a thread (one tiny codex turn provisions the local workspace):
<pre>eval "$(scripts/bb-dev-app env)"     # BB_SERVER_URL=http://localhost:25792 BB_HOST_DAEMON_PORT=33792 on my instance
curl -s $BB_SERVER_URL/api/v1/hosts                                                                   # → host_5tsbbs2tfu
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/1615-qa","hostId":"host_5tsbbs2tfu"}}'   # → proj_uzvv6df4kw
pnpm bb:dev thread spawn --project proj_uzvv6df4kw --provider codex \\
  --permission-mode accept-edits --title "1615 qa" --prompt "Reply only with ok." --json                # → thr_6isgdy7qwz</pre>
    <b>Pitfall</b>: setting only <code>BB_SERVER_URL=…</code> in front of <code>pnpm bb:dev thread spawn</code> is not enough if your shell already carries a <code>BB_HOST_DAEMON_PORT</code> (every shell launched from a bb thread does; it points at the user's real daemon). The CLI then resolves the local host id from the wrong daemon and the server answers <code>HTTP 404: Host not found</code>. Real output of both forms is in <a href="1615/repro/step3-spawn.out">step3-spawn.out</a>:
<pre># outer shell: BB_HOST_DAEMON_PORT=38887
$ BB_SERVER_URL=http://localhost:25792 pnpm bb:dev thread spawn --project proj_uzvv6df4kw --provider codex --permission-mode accept-edits --title "1615 qa" --prompt "Reply only with ok." --json
Error: Failed to create thread: HTTP 404: Host not found
 ELIFECYCLE  Command failed with exit code 1.

$ eval "$(scripts/bb-dev-app env)"   # sets BB_SERVER_URL and BB_HOST_DAEMON_PORT for THIS instance
# now BB_SERVER_URL=http://localhost:25792 BB_HOST_DAEMON_PORT=33792
$ pnpm bb:dev thread spawn --project proj_uzvv6df4kw --provider codex --permission-mode accept-edits --title "1615 qa" --prompt "Reply only with ok." --json
{
  "id": "thr_6isgdy7qwz",
  "projectId": "proj_uzvv6df4kw",
  ...</pre></li>
    <li>Edit the URL/ids at the top of the scripts in <a href="1615/repro/">1615/repro/</a> and run them with <code>dev-browser --browser bb1615 --headless --timeout 180 run &lt;script&gt;</code>. Each script uses its own named page (<code>banner</code>, <code>csv</code>) or a fresh anonymous page, so they can be run independently and in any order. Wait until the thread's turn has finished (thread status <code>idle</code>) before running them.</li>""")

# A: step4 output
rep("""  <pre>before opening csv: {"nodes":20529,"tds":0}
csv preview: {"totalNodes":121845,"tableNodes":101306,"td":50000,"th":601,"bodyRows":500,"columns":100,
              "scrollBox":{"w":507,"h":744},"scrollSize":{"w":28848,"h":14529},
              "note":"Showing the first 500 rows and 100 columns."}
ms from Enter to table in DOM: 3643</pre>""",
"""  <pre>before opening csv: {"nodes":20541,"tds":0}
csv preview: {"totalNodes":121845,"tableNodes":101306,"td":50000,"th":601,"bodyRows":500,"columns":100,
              "scrollBox":{"w":507,"h":744},"scrollSize":{"w":28848,"h":14529},
              "note":"Showing the first 500 rows and 100 columns."}
ms from Enter to table in DOM: 3228</pre>
  <p class="meta">Script note: the script first clears <code>localStorage</code> and reloads so the secondary-panel tab layout (persisted per thread) starts clean. In one of my runs Enter created the <code>big.csv</code> tab but the panel kept the info tab active; the script therefore falls back to clicking the <code>big.csv</code> tab if the table is not visible after 8&nbsp;s (it prints a "note:" line when it does; the run above did not need it). Clicking the tab mounted the same 50,000 cells in 3.6&nbsp;s.</p>""")

# A: measurement block
rep("""  <pre># dev build (React dev mode)
cpuThrottle=1x {"longTasksMs":[2914,227,1644],"longTaskTotalMs":4785,"maxLongTaskMs":2914,"td":50000}
cpuThrottle=4x {"longTasksMs":[13721,905,215,69,75,9002,233],"longTaskTotalMs":24220,"maxLongTaskMs":13721,"td":50000}
# production build (vite preview :15272 → server :23271)
cpuThrottle=1x {"longTasksMs":[519,149,2344],"longTaskTotalMs":3012,"maxLongTaskMs":2344,"td":50000}
cpuThrottle=4x {"longTasksMs":[1092,2605,70,627,8080,89,190],"longTaskTotalMs":12753,"maxLongTaskMs":8080,"td":50000}
CDP metrics before: {"Nodes":46037,"LayoutCount":0,"RecalcStyleCount":1,"JSHeapUsedSize":60445508}
             after: {"Nodes":182615,"LayoutCount":4,"RecalcStyleCount":19,"JSHeapUsedSize":90912052}  heap delta MB: 29</pre>
  <p>Opening one 570&nbsp;KB CSV in the production build blocks the main thread for 2.3&nbsp;s on this desktop and 8.1&nbsp;s in a single task at 4× throttle (a rough phone stand-in), adds 136k DOM nodes and 29&nbsp;MB of JS heap. (The 46k "before" node count is the 5,000-file banner from experiment B already being mounted.)</p>""",
"""  <pre># dev build (React dev mode) — one invocation of step5-measure-csv.js: measure(1) then measure(4), each on its own fresh page
cpuThrottle=1x {"longTasksMs":[2812,200,1733,52],"longTaskTotalMs":4797,"maxLongTaskMs":2812,"heapBeforeMB":169,"heapAfterMB":169,"td":50000}
cpuThrottle=4x {"longTasksMs":[11179,767,190,79,64,5290,764],"longTaskTotalMs":18333,"maxLongTaskMs":11179,"heapBeforeMB":169,"heapAfterMB":169,"td":50000}
# production build (vite preview :17793 → server :25792) — one invocation of step5b-measure-csv-prod.js
cpuThrottle=1x {"longTasksMs":[475,135,2024],"longTaskTotalMs":2634,"maxLongTaskMs":2024,"heapBeforeMB":69,"heapAfterMB":69,"td":50000}
CDP metrics before: {"Nodes":34424,"LayoutCount":0,"RecalcStyleCount":0,"JSHeapUsedSize":60499448}
             after: {"Nodes":183880,"LayoutCount":3,"RecalcStyleCount":14,"JSHeapUsedSize":94790076}  heap delta MB: 33
cpuThrottle=4x {"longTasksMs":[8403,807,159,54,54,5515,191],"longTaskTotalMs":15183,"maxLongTaskMs":8403,"heapBeforeMB":111,"heapAfterMB":111,"td":50000}
CDP metrics before: {"Nodes":199025,"LayoutCount":0,"RecalcStyleCount":1,"JSHeapUsedSize":105950632}
             after: {"Nodes":182608,"LayoutCount":3,"RecalcStyleCount":15,"JSHeapUsedSize":85531060}  heap delta MB: -19</pre>
  <p>Opening one 570&nbsp;KB CSV in the production build blocks the main thread for 2.0&nbsp;s on this desktop and 8.4&nbsp;s in a single task at 4× throttle (a rough phone stand-in), adds ~150k DOM nodes and 33&nbsp;MB of JS heap. (The 34k "before" node count is the 5,000-file banner from experiment B already being mounted. In the 4× run the CDP <code>Nodes</code>/heap "before" values are inflated because the just-closed 1× page had not been garbage-collected yet in the same renderer — <code>Performance.getMetrics</code> counts the whole renderer process — so only the 1× CDP delta is meaningful; the Long Tasks numbers, which are per page, are valid for both.) <code>performance.memory.usedJSHeapSize</code> shows no delta because it is coarse-grained in headless Chromium; the CDP figure is the real one.</p>""")

# B
rep("""  <pre>DOM nodes before expanding banner: 20584
after expand: {"totalNodes":20584,"listRows":5000,""", """  <pre>DOM nodes before expanding banner: 20587
after expand: {"totalNodes":20587,"listRows":5000,""")
rep("element count is identical before and after expanding (20,584)", "element count is identical before and after expanding (20,587)")
rep("""<code>GET /api/v1/environments/env_hd3zgfggci/status</code> → 425,343 bytes, <code>workingTree.files.length = 5000</code> (<a href="1615/repro/env-status.json">env-status.json</a>).""",
    """<code>GET /api/v1/environments/env_665hugj7gq/status</code> → HTTP 200, 425,343 bytes; JSON path <code>workspace.workingTree.files</code> has length 5000, one <code>{"path":"manyfiles/file_00000.txt","status":"??","insertions":null,"deletions":null}</code> per untracked file (<a href="1615/repro/env-status.json">env-status.json</a>).""")

# C
rep("""  <pre>path browser: {"nodesBefore":122048,"totalNodes":141896,"rows":5000,"boxH":224,"scrollH":132821,"boxNodes":20001} ms: 2089</pre>""",
    """  <pre>input count 1
path browser: {"nodesBefore":537,"totalNodes":20385,"rows":5000,"boxH":224,"scrollH":132821,"boxNodes":20001} ms: 1747</pre>
  <p class="meta">The script opens a fresh anonymous page at the app root, so it does not depend on step 4's heavy CSV tab (an earlier version reused the CSV page and could time out waiting for <code>networkidle</code>).</p>""")

# unit test
rep("   Duration  5.63s (tests 2.75s)</pre>", "   Duration  5.03s (tests 2.49s)</pre>")

# root cause not-root-causes CommandList
rep("""command.tsx#L54-L64</a>) is an unused container.</p>""", """command.tsx#L54-L64</a>) is a container primitive that maps nothing (used only by the tasks plugin's small cmdk pickers).</p>""")

# Appendix commands
rep("""scripts/bb-dev-app current                                   # app :15271, server :23271, daemon :31271
# fixture repo: see "Minimal reproduction"
curl -s http://localhost:23271/api/v1/hosts                  # host_uhq5uwxsbj
curl -s -X POST http://localhost:23271/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/1615-qa","hostId":"host_uhq5uwxsbj"}}'
BB_SERVER_URL=http://localhost:23271 pnpm bb:dev thread spawn --project proj_drg6kwky3m --provider codex \\
  --permission-mode accept-edits --title "1615 qa" --prompt "Reply only with ok." --json
dev-browser --browser bb1615 --headless --timeout 90  run 1615/repro/step1-open-thread.js
dev-browser --browser bb1615 --headless --timeout 90  run 1615/repro/step2-changed-files-banner.js   &gt; step2.out
dev-browser --browser bb1615 --headless --timeout 90  run 1615/repro/step3-open-panel.js
dev-browser --browser bb1615 --headless --timeout 120 run 1615/repro/step4-open-csv.js              &gt; step4.out
dev-browser --browser bb1615 --headless --timeout 240 run 1615/repro/step5-measure-csv.js           &gt; step5.out   # dev build, 1x then 4x
cp 1615/repro/vite.preview-1615.config.ts apps/app/ &amp;&amp; (cd apps/app &amp;&amp; pnpm exec vite preview --config vite.preview-1615.config.ts &amp;)   # :15272
dev-browser --browser bb1615 --headless --timeout 300 run 1615/repro/step5b-measure-csv-prod.js     &gt; step5b.out  # prod build, 1x then 4x + CDP metrics
dev-browser --browser bb1615 --headless --timeout 120 run 1615/repro/step6-path-browser.js          &gt; step6.out
curl -s http://localhost:23271/api/v1/environments/env_hd3zgfggci/status -o 1615/repro/env-status.json -w "%{http_code} %{size_download}\\n"   # 200 425343""",
"""scripts/bb-dev-app current                                   # app :17792, server :25792, daemon :33792
eval "$(scripts/bb-dev-app env)"                             # BB_SERVER_URL + BB_HOST_DAEMON_PORT for THIS instance (required for `thread spawn`)
# fixture repo: see "Minimal reproduction"
curl -s $BB_SERVER_URL/api/v1/hosts                          # host_5tsbbs2tfu
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/1615-qa","hostId":"host_5tsbbs2tfu"}}'  # proj_uzvv6df4kw
pnpm bb:dev thread spawn --project proj_uzvv6df4kw --provider codex \\
  --permission-mode accept-edits --title "1615 qa" --prompt "Reply only with ok." --json               # thr_6isgdy7qwz (see step3-spawn.out for the 404 you get without BB_HOST_DAEMON_PORT)
curl -s $BB_SERVER_URL/api/v1/threads/thr_6isgdy7qwz | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'], d['environmentId'])"   # idle env_665hugj7gq
dev-browser --browser bb1615r --headless --timeout 120 run 1615/repro/step2-changed-files-banner.js   &gt; step2.out
dev-browser --browser bb1615r --headless --timeout 180 run 1615/repro/step4-open-csv.js              &gt; step4.out
dev-browser --browser bb1615r --headless --timeout 300 run 1615/repro/step5-measure-csv.js           &gt; step5.out   # dev build, 1x then 4x (single invocation)
cp 1615/repro/vite.preview-1615.config.ts apps/app/ &amp;&amp; (cd apps/app &amp;&amp; pnpm exec vite preview --config vite.preview-1615.config.ts &amp;)   # :17793
dev-browser --browser bb1615r --headless --timeout 400 run 1615/repro/step5b-measure-csv-prod.js     &gt; step5b.out  # prod build, 1x then 4x + CDP metrics (single invocation)
dev-browser --browser bb1615r --headless --timeout 120 run 1615/repro/step6-path-browser.js          &gt; step6.out
curl -s $BB_SERVER_URL/api/v1/environments/env_665hugj7gq/status -o 1615/repro/env-status.json -w "%{http_code} %{size_download}\\n"   # 200 425343""")

# Verification subsection at the end
rep("""</main></body></html>""", """  <h2>Verification</h2>
  <p>An independent verifier followed the "Minimal reproduction" in a separate worktree at <code>16ceb3a54</code> with its own dev instance and fresh fixture. All three surfaces reproduced with identical numbers (CSV: td=50000, th=601, 101,306 table elements, 28,848×14,529&nbsp;px scroll size, longest 4× task 14.0&nbsp;s on the dev build; banner: 5,000 <code>&lt;li&gt;</code> in the 128&nbsp;px box, DOM count unchanged by expanding, status payload 425,343 bytes with 5,000 files; path browser: 5,000 <code>&lt;li&gt;</code>, scrollHeight 132,821 in a 224&nbsp;px box); the jsdom test passed 2/2; code excerpts and permalinks matched; nothing on <code>origin/main</code> after the base fixes this. Verifier findings and what changed in this revision:</p>
  <ul>
    <li><b>Major — thread spawn step failed as written</b> (<code>HTTP 404: Host not found</code> when the shell inherits <code>BB_HOST_DAEMON_PORT</code> from the user's real instance). Fixed: step 2 now uses <code>eval "$(scripts/bb-dev-app env)"</code> before <code>pnpm bb:dev thread spawn</code>, explains the pitfall, and shows the real failing and succeeding output (<a href="1615/repro/step3-spawn.out">step3-spawn.out</a>, reproduced again on this revision's instance).</li>
    <li><b>Minor — step5/step5b scripts and outputs</b> did not correspond to one clean run (scripts ended in <code>measure(4)</code> only; .out files contained interleaved timeout traces). Fixed: both scripts run <code>measure(1)</code> then <code>measure(4)</code>, were re-run once each on the new instance, and <a href="1615/repro/step5.out">step5.out</a> / <a href="1615/repro/step5b.out">step5b.out</a> are the verbatim single-run outputs. The report's numbers were updated to these runs (dev 2.8/11.2&nbsp;s, prod 2.0/8.4&nbsp;s max long task; +33&nbsp;MB heap).</li>
    <li><b>Minor — step6 page reuse</b> could time out after step4. Fixed: step6 opens a fresh anonymous page at the app root; step4 uses its own named page and starts from a cleared <code>localStorage</code> with a fallback that clicks the <code>big.csv</code> tab if the panel keeps the info tab active. Re-run outputs (<a href="1615/repro/step4.out">step4.out</a>, <a href="1615/repro/step6.out">step6.out</a>) and all five screenshots were regenerated on this revision's instance.</li>
    <li><b>Minor — <code>CommandList</code> "no consumers"</b> was inaccurate: <code>plugins/tasks</code> uses it (rail.tsx:283, new-task-dialog.tsx:569,634). Wording corrected in TL;DR, claims table and root-cause section; the refutation stands (it maps nothing).</li>
    <li><b>Minor — readability</b>: the status field is now given as the JSON path <code>workspace.workingTree.files</code>; the fixture section notes the ~5,000-inode footprint and that any daemon-readable absolute path works.</li>
  </ul>
</main></body></html>""")
open(p,'w').write(s)
print("ok", len(s))
