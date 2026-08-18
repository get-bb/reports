import html, pathlib
R = pathlib.Path('/tmp/bb-reports/issues/1761/repro')
test_src = html.escape((R/'issue-1761.test.ts').read_text())
test_out = html.escape((R/'issue-1761-test.out').read_text())
session = html.escape((R/'1761-cli-session.txt').read_text())
BASE = 'https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/'
def L(path, a, b=None):
    frag = f'#L{a}' + (f'-L{b}' if b else '')
    return f'<a href="{BASE}{path}{frag}">{path}{frag}</a>'

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1761 task thread attachments are append-only and list a dead thread first</title>
<style>
  :root {{ --canvas:#fafaf8; --ink:#1a1a1a; --muted:#666; --line:#e2e2de; --accent:#0052cc; --high:#b60205; --ok:#0e8a16; --warn:#b26a00; --low:#5a6b7d; }}
  body {{ margin:0; background:var(--canvas); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; }}
  main {{ max-width:900px; margin:0 auto; padding:40px 24px 80px; }}
  h1 {{ font-size:26px; line-height:1.25; margin:0 0 6px; }}
  h2 {{ font-size:18px; margin:36px 0 10px; padding-top:20px; border-top:1px solid var(--line); }}
  h3 {{ font-size:15px; margin:22px 0 6px; }}
  .meta {{ color:var(--muted); font-size:14px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }}
  .pill {{ display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); }}
  .pill.high {{ background:var(--high); color:#fff; border-color:var(--high); }}
  .pill.low {{ background:var(--low); color:#fff; border-color:var(--low); }}
  .verdict {{ font-weight:600; }}
  .v-partial {{ color:var(--warn); }} .v-repro {{ color:var(--high); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:14px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1761 · Task thread attachments are append-only, and the list returns a dead thread first</h1>
  <p class="meta">
    <span class="pill">Feature gap / UX bug</span> <span class="pill low">Low</span> <span class="pill">Effort: Small</span>
    <span class="pill">cli</span> <span class="pill">tasks</span>
    <a href="https://github.com/get-bb/bb/issues/1761">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> The built-in <em>tasks</em> plugin keeps a table <code>task_threads</code> that records which bb agent threads are working on which task ("attachments"; not to be confused with file attachments, which are a different table and a different <code>bb tasks attachment</code> command). <code>bb tasks attach &lt;key&gt; --thread &lt;id&gt;</code> inserts a row; <code>bb tasks threads &lt;key&gt;</code> and the task detail page in the app list those rows.</p>
  <p>The reporter is right on every point. The store's list query is <code>ORDER BY attached_at, id</code> (oldest first) and nothing in the CLI, the plugin RPC contracts, or the UI ever deletes a row: the store does have a <code>deleteTaskThread</code> function, but it is dead code that no RPC, CLI command, or UI control reaches. So an orchestrator that respawns a worker and attaches the new thread each time builds up a list whose first row is the oldest, usually dead, thread; and a thread that moves on to a new task keeps its row on the old task. I reproduced all of this on a fresh dev instance at the base commit with real codex threads (transcript and screenshot below), and wrote a small vitest file whose "BUG" assertions fail on main. Nothing on <code>origin/main</code> after the base commit touches <code>plugins/tasks</code>, so this is still open. This is a small, self-contained plugin change (store already has the delete; add an RPC + CLI + optional UI button, and change one <code>ORDER BY</code>).</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td><code>bb tasks attach</code> appends; a task accumulates every thread ever attached</td><td class="ok">Verified</td><td><code>upsertTaskThread</code> is <code>INSERT … ON CONFLICT (task_id, thread_id) DO UPDATE</code> ({L('plugins/tasks/db/store.ts',1590,1629)}); one row per (task, thread), never removed. Live repro: 3 attaches → 3 rows (transcript below).</td></tr>
    <tr><td>There is no <code>detach</code>; <code>attachment remove</code> is for files</td><td class="ok">Verified</td><td><code>bb tasks detach</code> → <code>unknown command: detach</code>. Root help ({L('plugins/tasks/cli/index.ts',59,78)}) has no inverse. <code>tasksRpcContract</code> and <code>delegationRpcContract</code> have no detach operation (grep for <code>detach|deleteTaskThread</code> across <code>api/</code>, <code>shared/contract.ts</code>, <code>delegate/contract.ts</code> = 0 hits). <code>attachment remove &lt;task_threads row id&gt;</code> → <code>attachment not found</code>. The UI thread card has only "Open thread" ({L('plugins/tasks/views/detail/threads.tsx',71,116)}).</td></tr>
    <tr><td><code>bb tasks threads</code> returns oldest-first, so the first row is usually a dead thread after respawns</td><td class="ok">Verified</td><td><code>listTaskThreads</code> is <code>SELECT * FROM task_threads WHERE task_id = ? ORDER BY attached_at, id</code> ({L('plugins/tasks/db/store.ts',1631,1640)}); the CLI table and the app render rows in that order. Repro output: first row <code>thr_fy32f8grbs  failed</code>, live threads last.</td></tr>
    <tr><td>A thread respawned onto new work keeps its old attachment (SC-187 thread shown under SC-202)</td><td class="ok">Verified</td><td>Attaching <code>thr_estd3atd82</code> to SC-2 left its SC-1 row in place; the SC-2 row shows the SC-1 title (title is snapshotted at attach time from <code>thread.title ?? titleFallback</code>, {L('plugins/tasks/delegate/index.ts',405,423)}).</td></tr>
    <tr><td>"Self-worsening": re-attaching on every respawn makes ordering worse each time</td><td class="ok">Verified (one nuance)</td><td>Each respawn is a new thread id → new row appended after the dead ones. Nuance: re-attaching the <em>same</em> thread is idempotent (UNIQUE) and does not refresh <code>attached_at</code>, so it also cannot move a live thread to the front.</td></tr>
    <tr><td>Reproduced on bb 0.38.0, macOS 26</td><td class="unv">Version unverifiable, behavior confirmed</td><td>I reproduced on Linux at <code>16ceb3a54</code> (tasks plugin 0.1.1). The relevant code has been unchanged since the plugins merge (<code>git log -S"ORDER BY attached_at"</code> → e6be57e76 only).</td></tr>
    <tr><td>"The Active view answers with a corpse"</td><td class="unv">Partly</td><td>The Tasks sidebar "Active" filter and the list-row agent chips only count <code>starting</code>/<code>working</code> threads ({L('plugins/tasks/views/list/data.ts',93,99)}), so dead threads do not make a task look active there. The corpse-first problem is in the per-task thread list (CLI table, <code>--json</code> array order, <code>bb tasks show</code>, and the "Agent threads" section of the detail page).</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18), tasks plugin <code>0.1.1</code> installed with <code>bb plugin install builtin:tasks</code>. Worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-30</code>.</li>
    <li>Dev instance: app <code>:13758</code>, server <code>:21758</code>, host daemon <code>:29758</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-30-4235fe46eb15</code> (tasks DB under <code>plugins/tasks/</code> in that dir).</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, codex-cli 0.147.0 (provider <code>codex</code>). Host <code>host_uihn4w7euz</code>, bb project <code>proj_92hz2xp5u3</code> on <code>/tmp/1761-qa</code>.</li>
    <li>CLI wrapper: <a href="1761/repro/1761-bb.sh">1761/repro/1761-bb.sh</a> (<code>BB_REPO=&lt;worktree&gt; ./1761-bb.sh …</code>; evaluates <code>scripts/bb-dev-app env</code> and runs <code>packages/scripts/dist/commands/run-cli.js</code>). Below, <code>bb</code> means this wrapper.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. Unit test (fastest; no running instance)</h3>
  <p>File: <a href="1761/repro/issue-1761.test.ts">1761/repro/issue-1761.test.ts</a>. Copy it to <code>plugins/tasks/cli/</code> in your worktree and run it from <code>plugins/tasks</code>. It drives the real plugin CLI through <code>createFakePluginHost</code> with a stub <code>threads.get</code> that reports one thread as <code>error</code> and one as <code>idle</code>. All three tests fail on main at the assertions marked <code>BUG</code>: (1) the first listed thread is <code>thr_dead_predecessor</code> not <code>thr_live_worker</code>; (2) root help contains no <code>detach</code>; (3) <code>bb tasks detach</code> exits 1 with <code>unknown command</code>.</p>
  <pre>{test_src}</pre>
  <pre>$ cd plugins/tasks &amp;&amp; pnpm exec vitest run cli/issue-1761.test.ts
{test_out}</pre>
  <p>Full output: <a href="1761/repro/issue-1761-test.out">1761/repro/issue-1761-test.out</a>.</p>

  <h3>B. Live CLI repro against a dev instance (mirrors the issue's transcript)</h3>
  <ol>
    <li><code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code>; <code>export BB_REPO=$PWD</code>.</li>
    <li>Create a scratch git repo (<code>/tmp/1761-qa</code>) and a bb project on it (curl in the Appendix), then <code>bb plugin install builtin:tasks --yes</code> (the fresh dev data dir has no plugins installed).</li>
    <li>Create a tasks project + task, spawn a worker with a bogus model so it lands in <code>status: error</code>, attach it; spawn two healthy workers, attach each; list.</li>
  </ol>
  <p><b>Expected</b> (issue): the thread holding the work is listed first, or a way exists to remove the dead one. <b>Actual</b>: first row is <code>failed</code>, no detach command, and the thread later attached to SC-2 remains on SC-1. Full transcript (<a href="1761/repro/1761-cli-session.txt">1761/repro/1761-cli-session.txt</a>):</p>
  <pre>{session}</pre>
  <figure>
    <img src="assets/1761-task-detail-ui.png" alt="Task SC-1 detail page: Agent threads section lists Failed thread first, then two Idle threads; each card only offers Open thread">
    <figcaption>App, Tasks → SC-1 after the three attaches. Look at "Agent threads": the <b>Failed</b> predecessor is the first card and the live worker is last (same <code>attached_at</code> order as the CLI). Each card offers only "Open thread": there is no remove/detach control. Right rail "Agents: none active" shows why the sidebar Active count is unaffected.</figcaption>
  </figure>

  <h2>Root cause</h2>
  <p><b>1. Oldest-first ordering.</b> The single read path for a task's threads is the store query in {L('plugins/tasks/db/store.ts',1631,1640)}:</p>
  <pre>function listTaskThreads(taskId: string): TaskThread[] {{
  return db
    .prepare&lt;[string], TaskThreadRow&gt;(
      `
      SELECT * FROM task_threads WHERE task_id = ? ORDER BY attached_at, id
    `,
    )
    .all(taskId)
    .map(taskThreadFromRow);
}}</pre>
  <p>The plugin RPC <code>listTaskThreads</code> ({L('plugins/tasks/api/index.ts',990,992)}) returns that array unchanged; the CLI <code>runThreads</code> ({L('plugins/tasks/cli/index.ts',1816,1840)}) and <code>bb tasks show</code> print it in that order; the detail view maps it to cards in that order ({L('plugins/tasks/views/detail/threads.tsx',71,116)}). Nothing sorts by liveness or recency, so after N respawns the first N-1 rows are the terminal ones.</p>
  <p><b>2. Attach has no inverse anywhere above the store.</b> <code>upsertTaskThread</code> ({L('plugins/tasks/db/store.ts',1590,1629)}) is append-or-refresh keyed on <code>UNIQUE (task_id, thread_id)</code> ({L('plugins/tasks/db/schema.ts',85,96)}). The store exports <code>deleteTaskThread</code> ({L('plugins/tasks/db/store.ts',1674,1679)}) but it is unreferenced outside the store: neither <code>tasksRpcContract</code> ({L('plugins/tasks/shared/contract.ts',616,619)} is the only thread-related entry) nor <code>delegationRpcContract</code> ({L('plugins/tasks/delegate/contract.ts',20,25)}: <code>delegate</code> and <code>taskThreadsAttach</code> only) exposes it, so neither the CLI (<code>runAttach</code>, {L('plugins/tasks/cli/index.ts',1786,1814)}) nor the app can call it. The only deletion path is <code>ON DELETE CASCADE</code> when the task itself is deleted.</p>
  <p><b>3. Why the "wrong task" row appears.</b> <code>taskThreadsAttach</code> snapshots <code>thread.title ?? titleFallback</code> into the row at attach time ({L('plugins/tasks/delegate/index.ts',405,423)}) and never rewrites it, and attaching to task B does not touch the row on task A. A long-lived orchestrator thread that is pointed at successive tasks therefore shows up on every one of them, under the title it had when first attached.</p>
  <p><b>Adjacent behavior worth knowing (not the reported bug).</b> Once a row reaches <code>failed</code>/<code>completed</code>, the reconcile service never revisits it ({L('plugins/tasks/lifecycle/index.ts',60,70)} and {L('plugins/tasks/lifecycle/index.ts',123,134)} filter terminal rows out). A thread that errored and was later resumed successfully stays <code>failed</code> in the task list unless it is explicitly re-attached (the upsert refreshes <code>live_status</code>). Combined with append-only rows and oldest-first order, that makes the stale <code>failed</code> row on top even stickier.</p>
  <p><b>Already fixed?</b> No. <code>git log 16ceb3a54..origin/main -- plugins/tasks</code> is empty as of 2026-08-18.</p>

  <h2>Proposed fix (first principles)</h2>
  <ol>
    <li><b>Add the inverse (root cause).</b> Add <code>taskThreadsDetach: {{ input: {{ taskId, threadId }}, output: {{ removed: boolean }} }}</code> to <code>delegationRpcContract</code> next to <code>taskThreadsAttach</code>, implement it in <code>delegate/index.ts</code> with the existing <code>store.tasks.getTaskThreadByThreadId</code> + <code>deleteTaskThread</code>, then <code>publishThreadsChanged</code>/<code>publishTasksChanged</code> so the app refreshes. Add <code>bb tasks detach &lt;key&gt; [--thread &lt;id&gt;]</code> (same <code>--thread</code>/<code>BB_THREAD_ID</code>/<code>ctx.threadId</code> resolution as <code>runAttach</code>), a <code>DETACH_HELP</code>, a root-help line, and a "Remove" affordance on the thread card in <code>views/detail/threads.tsx</code>. Per AGENTS.md, update the README command table and <code>skills/tasks/SKILL.md</code> in the same change (step 6 of the skill tells agents to attach; it should also say to detach when handing off). Plugin-internal only: no <code>HOST_DAEMON_PROTOCOL_VERSION</code> concern. Risk: a live thread's system comments ("Thread … completed") still reference the thread id after detach, which is fine, but decide whether detach should also stop the reconcile service from tracking it (it will, since <code>trackedThreads</code> reads the table).</li>
    <li><b>Order live threads first (cheap legibility fix, independent of 1).</b> Change the store query to something like <code>ORDER BY CASE WHEN live_status IN ('failed','completed') THEN 1 ELSE 0 END, attached_at DESC, id DESC</code> (or plain <code>attached_at DESC</code> if you want strict recency). Because <code>listTaskThreads</code> is the only read path, CLI, <code>--json</code>, <code>show</code>, the detail cards, and the PR resolution all follow. Check the existing test at <code>plugins/tasks/cli/cli.test.ts</code> and <code>views/detail/threads.test.tsx</code> for order assumptions. Risk: consumers that assumed chronological order (the activity/comment feed does not use this list, so I found none).</li>
    <li>Optional: on <code>taskThreadsAttach</code>, refresh <code>attached_at</code> too, so re-attaching a revived thread moves it to the front under the recency ordering; and let the reconcile service revisit terminal rows when the thread reappears as <code>idle</code>/<code>active</code>.</li>
  </ol>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1144">#1144</a>: task dependencies (same plugin; another "task model lacks an edge type" gap).</li>
    <li>Tasks plugin origin: <a href="https://github.com/get-bb/bb/pull/728">#728</a>; the <code>task_threads</code> query has been unchanged since <a href="https://github.com/get-bb/bb/commit/e6be57e76">e6be57e76</a> (plugins merge).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
  <pre># worktree /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-30 (was ahead of base; checked out 16ceb3a54)
git checkout 16ceb3a54
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
scripts/bb-dev-app current                                     # app :13758, server :21758, daemon :29758
mkdir -p /tmp/1761-qa &amp;&amp; git -C /tmp/1761-qa init &amp;&amp; git -C /tmp/1761-qa commit --allow-empty -m init
curl -s -X POST http://localhost:21758/api/v1/projects -H 'content-type: application/json' \\
  -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/1761-qa","hostId":"host_uihn4w7euz"}}}}'   # -&gt; proj_92hz2xp5u3 (hostId from `bb machine list --json`)
export BB_REPO=$PWD; bb=/tmp/bb-reports/issues/1761/repro/1761-bb.sh
$bb plugin install builtin:tasks --yes
$bb tasks project create --name Scani --prefix SC --link-bb-project proj_92hz2xp5u3 --json
$bb tasks create --project SC --title "OSS divergence audit" --json
$bb thread spawn --project proj_92hz2xp5u3 --provider codex --model totally-bogus-model-xyz --permission-mode accept-edits --title "SC-1 · OSS divergence audit (phase 1)" --prompt "Reply only with ok." --json
$bb thread show thr_fy32f8grbs --json | grep '"status"'
$bb tasks attach SC-1 --thread thr_fy32f8grbs
$bb thread spawn … --title "Resuming SC-1 after a machine crash killed your predecessor" --prompt "Reply only with ok." --json ; $bb thread wait thr_xiwb5bxu5x --timeout 90 ; $bb tasks attach SC-1 --thread thr_xiwb5bxu5x
$bb thread spawn … --title "Take SC-1 — the private repo has diverged from its own upstream" --prompt "Reply only with ok." --json ; $bb thread wait thr_estd3atd82 --timeout 90 ; $bb tasks attach SC-1 --thread thr_estd3atd82
$bb tasks threads SC-1 ; $bb tasks threads SC-1 --json ; $bb tasks show SC-1
$bb tasks detach SC-1 --thread thr_fy32f8grbs ; $bb tasks attach --help ; $bb tasks attachment remove 01M09XQHXM4FZ79XQCMETVB6KC
$bb tasks create --project SC --title "PaymentFormPage strings" ; $bb tasks attach SC-2 --thread thr_estd3atd82 ; $bb tasks threads SC-2
sqlite3 &lt;data dir&gt;/plugins/tasks/*.db "select thread_id, live_status, attached_at from task_threads order by attached_at"
dev-browser --browser bb1761 --headless run /tmp/bb-reports/issues/1761/repro/shot1.js     # screenshot of Tasks -&gt; SC-1
cp plugins/tasks/cli/issue-1761.test.ts … ; cd plugins/tasks &amp;&amp; pnpm exec vitest run cli/issue-1761.test.ts
git fetch origin main ; git log 16ceb3a54..origin/main --oneline -- plugins/tasks     # (empty)
pnpm dev:stop</pre>
  <h3>Code-search evidence</h3>
  <pre>$ grep -rn "deleteTaskThread" plugins/tasks --include=*.ts --include=*.tsx | grep -v node_modules
plugins/tasks/db/store.ts:1674:  function deleteTaskThread(id: string): boolean {{
plugins/tasks/db/store.ts:1857:    deleteTaskThread,
$ grep -n "detach\\|deleteTaskThread" plugins/tasks/api/index.ts plugins/tasks/shared/contract.ts plugins/tasks/delegate/contract.ts | wc -l
0
$ git log -S"ORDER BY attached_at" --oneline -- plugins/tasks
e6be57e76 Merge official-plugins into plugins (#1079)</pre>
  <h3>Screenshot script</h3>
  <p><a href="1761/repro/shot1.js">1761/repro/shot1.js</a> (dev-browser; navigates to <code>/plugins/tasks/tasks</code>, clicks "Open SC-1: OSS divergence audit", screenshots).</p>
</main></body></html>
'''
pathlib.Path('/tmp/bb-reports/issues/1761.html').write_text(page)
print(len(page))
