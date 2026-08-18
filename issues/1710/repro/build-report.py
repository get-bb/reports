import html
R='/tmp/bb-reports/issues/1710/repro/'
def esc(p): return html.escape(open(R+p).read())
test=esc('issue-1710-archived-thread-dead-end.test.ts')
out1=esc('1710-unarchive-after-destroy.out')
out2=esc('1710-control-grace-unarchive.out')
poll=esc('1710-env-status-poll.log')
fork=esc('1710-fork-after-destroy.out')
envjson=esc('1710-env-after-destroy.json')
B='https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/'
def L(path,a,b=None,label=None):
    frag=f'#L{a}' + (f'-L{b}' if b else '')
    return f'<a href="{B}{path}{frag}">{label or (path.split("/")[-1]+frag)}</a>'

doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1710 archived threads cannot resume in the original chat</title>
<style>
  :root {{ --canvas:#fafaf8; --ink:#1a1a1a; --muted:#666; --line:#e2e2de; --accent:#0052cc; --high:#b60205; --ok:#0e8a16; --warn:#b26a00; --med:#d4a72c; }}
  body {{ margin:0; background:var(--canvas); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; }}
  main {{ max-width:900px; margin:0 auto; padding:40px 24px 80px; }}
  h1 {{ font-size:26px; line-height:1.25; margin:0 0 6px; }}
  h2 {{ font-size:18px; margin:36px 0 10px; padding-top:20px; border-top:1px solid var(--line); }}
  h3 {{ font-size:15px; margin:22px 0 6px; }}
  .meta {{ color:var(--muted); font-size:14px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }}
  .pill {{ display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); }}
  .pill.high {{ background:var(--high); color:#fff; border-color:var(--high); }}
  .pill.med {{ background:var(--med); color:#000; border-color:var(--med); }}
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
  <h1>#1710 · Archived threads cannot resume in the original chat</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill med">Medium</span> <span class="pill">Effort: not set</span>
    <span class="pill">threads</span>
    <a href="https://github.com/get-bb/bb/issues/1710">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> A bb thread that runs in its own git <em>worktree</em> owns a "managed environment" (a checkout on disk plus a branch). When you archive the <em>last</em> live thread of such an environment, bb schedules the worktree for deletion. Since PR #1016 (v0.37.0, 2026-08-12) there is a 5-minute grace window during which <b>Unarchive</b> (or the 10-second toast <b>Undo</b>) restores everything losslessly. When the window elapses the host daemon runs <code>git worktree remove --force</code>, the environment row becomes <code>destroyed</code> (a terminal state; the branch itself survives in the main repo, uncommitted changes do not), and the thread page replaces the composer with the banner <b>"Environment archived"</b>.</p>
  <p>I reproduced the reporter's state end to end on a real instance: archive a worktree thread, wait 5&nbsp;min&nbsp;+&nbsp;one 10&nbsp;s sweep tick, and the thread shows <code>Environment archived</code> with no button at all. What is actually wrong is that from that state <em>every</em> path back into the conversation is closed: the in-thread banner deliberately hides <b>Unarchive</b> once the environment is gone; the "..." menu / archived-threads settings still offer <b>Unarchive</b>, and it returns 200, but it only clears <code>archivedAt</code> and the thread becomes a live-but-dead thread (composer hidden, <code>send</code> → <code>409 thread_environment_unavailable</code>, CLI <code>bb thread tell</code> → <code>HTTP 409</code>); <b>fork</b> is rejected (<code>Source thread must have a ready environment to fork</code>); the "Handoff to new thread" action lives inside the hidden composer; and no route/CLI command can attach a fresh workspace to an existing thread. PR #1016 explicitly deferred a "Continue in new thread" action for destroyed environments and never shipped it. Root cause is therefore a design gap rather than a crash: <code>destroyed</code> is terminal for the thread as well as for the environment, and no re-provisioning path exists although all the ingredients (surviving branch name on the environment row, <code>updateThread({{environmentId}})</code>, and <code>resolveForkEnvironment</code> which already builds a new worktree from a source branch) are in the codebase.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Accidentally archived thread then shows <code>Environment archived</code></td><td class="ok">Verified</td><td>Reproduced 5&nbsp;min 6&nbsp;s after archiving a worktree thread (screenshot 3, poll log). Before v0.37.0 the destroy was immediate (PR #1016 description); after it, only after the grace window.</td></tr>
    <tr><td>User cannot continue the original chat</td><td class="ok">Verified</td><td>Composer hidden (<code>shouldHideComposer</code>), <code>POST /threads/:id/send</code> → 409 <code>thread_environment_unavailable</code>, <code>bb thread tell</code> → <code>HTTP 409</code>, fork → 400. Transcript <a href="1710/repro/1710-unarchive-after-destroy.out">1710-unarchive-after-destroy.out</a>.</td></tr>
    <tr><td>"No direct recovery path in that conversation"</td><td class="ok">Verified</td><td>Banner hides the Unarchive action when <code>environmentGoneSection</code> is set (screenshot 3); the "..." menu Unarchive succeeds but produces a thread that is unarchived and still unwritable (screenshots 4-5).</td></tr>
    <tr><td>Expected: unarchive/recover and continue without losing context</td><td class="unv">Not implemented</td><td>The route comment says the user "can hand its context and surviving branch off to a new thread instead", but the handoff action is inside the hidden composer and fork is blocked; PR #1016 deferred the destroyed-environment "Continue in new thread" action.</td></tr>
    <tr><td>Substantial work is lost</td><td class="unv">Partially</td><td>Committed work survives on the branch (<code>bb/1710-accidental-archive-thr_3wbj638q94</code> still at <code>716a568 work</code> after destroy); uncommitted changes are deleted by <code>git worktree remove --force</code>. Conversation context (events, provider session) is retained in bb's data dir, but is unreachable for continuation.</td></tr>
    <tr><td>Recovery inside the grace window works</td><td class="ok">Verified (control)</td><td>Archive → unarchive a few seconds later → environment <code>retiring</code> → <code>ready</code>, follow-up answered (<a href="1710/repro/1710-control-grace-unarchive.out">control transcript</a>). The UI gives no hint that a 5-minute deadline exists.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18), worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-10</code>; dev instance app <code>:12728</code>, server <code>:20728</code>, host daemon <code>:28728</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-10-fe38788052a6</code>.</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, provider <code>codex</code> (codex-cli 0.147.0, model gpt-5.6-sol), host <code>host_58mkech586</code>.</li>
    <li>Project <code>proj_kwhvshvxma</code> (local path <code>/tmp/1710-qa</code>, a scratch git repo). Threads: <code>thr_3wbj638q94</code> (repro, env <code>env_r4czunz9nt</code>), <code>thr_754fzrrkut</code> (control).</li>
    <li>CLI wrapper used below: <a href="1710/repro/1710-bb.sh">1710/repro/1710-bb.sh</a> (<code>BB_REPO=&lt;your bb worktree&gt;</code>; it evaluates <code>scripts/bb-dev-app env</code> and runs <code>packages/scripts/dist/commands/run-cli.js</code>). <code>bb</code> below means this wrapper. Origin/main at report time (<code>a108fa7ef</code>) contains no change to the involved files (checked with <code>git log 16ceb3a54..origin/main -- …</code>).</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <ol>
    <li>Build and start your dev instance: <code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code>. <code>export BB_REPO=/abs/path/to/bb/worktree</code>.</li>
    <li>Create a scratch repo and a project on it:
<pre>mkdir /tmp/1710-qa &amp;&amp; cd /tmp/1710-qa &amp;&amp; git init -q -b main &amp;&amp; echo "# qa" &gt; README.md &amp;&amp; git add . &amp;&amp; git commit -qm init
eval "$(scripts/bb-dev-app env)"
bb machine list                                   # note the host id
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{{"name":"qa-1710","source":{{"type":"local_path","path":"/tmp/1710-qa","hostId":"&lt;host id&gt;"}}}}'   # → proj_…</pre></li>
    <li>Spawn a thread in a <b>new worktree</b> and let it do some work:
<pre>bb thread spawn --project proj_kwhvshvxma --new-environment worktree --provider codex --permission-mode accept-edits \\
  --title "1710 accidental archive" --prompt "Create a file named WORK.md containing the single line 'substantial work' and commit it with message 'work'. Then reply only with ok." --json
bb thread wait thr_3wbj638q94 --timeout 180        # Thread thr_3wbj638q94 reached status idle.
bb thread show thr_3wbj638q94 --json | jq '.environment | {{id,status,path,branchName}}'
# "env_r4czunz9nt", "ready", ".../worktrees/env_r4czunz9nt/1710-qa", "bb/1710-accidental-archive-thr_3wbj638q94"</pre>
      <figure><img src="assets/1710-before.png" alt="thread before archive"><figcaption>1. Before: the worktree thread is idle, the composer is available, the banner shows the committed change (<code>Committed · 1 file, +1 -0</code>) and branch <code>bb/1710-accidental-archive-thr_3wbj638q94</code>.</figcaption></figure></li>
    <li>Archive it (this is the "accident"; the "..." menu → Archive in the app does the same thing) and observe the environment enter the grace window:
<pre>$ bb thread archive thr_3wbj638q94
Thread thr_3wbj638q94 archived
$ sqlite3 &lt;data dir&gt;/bb.db "select status,retire_requested_at,path from environments where id='env_r4czunz9nt';"
retiring|1787037567625|/home/sawyer/.bb-dev/.../worktrees/env_r4czunz9nt/1710-qa</pre>
      <figure><img src="assets/1710-archived-grace.png" alt="archived thread inside grace window"><figcaption>2. Inside the 5-minute grace window the banner says <b>Thread is archived</b> and offers <b>Unarchive</b> (lossless, see control below). Nothing tells the user that this offer expires in 5 minutes.</figcaption></figure></li>
    <li>Do nothing for 5 minutes (a poller: <a href="1710/repro/1710-env-status-poll.log">1710-env-status-poll.log</a>). The periodic sweep (every 10&nbsp;s) destroys the worktree once <code>now - retireRequestedAt ≥ 5 min</code>:
<pre>{poll}</pre>
      <figure><img src="assets/1710-env-archived-no-recovery.png" alt="Environment archived banner"><figcaption>3. <b>The reported state.</b> The banner now says <b>Environment archived</b>, there is no Unarchive button, no composer, no "continue" action. Info panel: "Workspace no longer exists."</figcaption></figure></li>
    <li>Try every recovery path the product exposes (script <a href="1710/repro/1710-unarchive-after-destroy.sh">1710-unarchive-after-destroy.sh</a>, output <a href="1710/repro/1710-unarchive-after-destroy.out">.out</a>):
<pre>{out1}</pre>
      <p><b>Expected</b> (issue): the user can unarchive/recover the thread and continue the conversation. <b>Actual</b>: <code>unarchive</code> returns success and clears <code>archivedAt</code>, but the thread stays read-only forever; every send returns <code>409 thread_environment_unavailable</code>. Fork is rejected too:</p>
<pre>$ bb thread fork thr_3wbj638q94 --workspace isolated --prompt "Reply only with ok." --json
{fork}</pre>
      <figure><img src="assets/1710-actions-menu-unarchive.png" alt="actions menu offering Unarchive"><figcaption>4. The thread's "..." menu (and Settings → Archived threads) still offers <b>Unarchive</b> for the archived thread…</figcaption></figure>
      <figure><img src="assets/1710-unarchived-still-dead.png" alt="unarchived thread still shows Environment archived"><figcaption>5. …and after clicking it the thread is back in the sidebar as a live thread but still shows <b>Environment archived</b> with no composer: a zombie thread. The environment row is terminal (<code>status: destroyed, path: null</code>) while its <code>branchName</code> is still recorded and the branch still exists in <code>/tmp/1710-qa</code> (<code>716a568 work</code>).</figcaption></figure></li>
  </ol>

  <h3>Control: recovery inside the grace window is lossless</h3>
  <p>Script <a href="1710/repro/1710-control-grace-unarchive.sh">1710-control-grace-unarchive.sh</a>, output <a href="1710/repro/1710-control-grace-unarchive.out">.out</a>. This is what the reporter would have gotten had they noticed within 5 minutes:</p>
<pre>{out2}</pre>

  <h3>Unit-level repro (server harness, in-memory SQLite)</h3>
  <p>File: <a href="1710/repro/issue-1710-archived-thread-dead-end.test.ts">1710/repro/issue-1710-archived-thread-dead-end.test.ts</a> (copy to <code>apps/server/test/public/</code>; run <code>cd apps/server &amp;&amp; pnpm exec vitest run test/public/issue-1710-archived-thread-dead-end.test.ts</code>). It <b>passes on main</b>: it documents the dead end, walking the exact production code path (archive route → <code>retiring</code> → grace-gated sweep → <code>destroy.started</code> → daemon success → <code>destroyed</code> → unarchive 200 → send 409). If a fix lands, the last assertion (send → 409) is the one that should flip.</p>
<pre>{test}</pre>
<pre>$ cd apps/server &amp;&amp; pnpm exec vitest run test/public/issue-1710-archived-thread-dead-end.test.ts
 Test Files  1 passed (1)
      Tests  1 passed (1)</pre>

  <h2>Root cause</h2>
  <p><b>1. Archiving the last live thread of a managed worktree retires the environment; after the grace window it is destroyed.</b> The archive route computes <code>wouldCleanupEnvironment</code> (managed and zero other live threads, {L('apps/server/src/services/environments/environment-cleanup-internal.ts',286,303)}) and, if true, applies <code>retire.requested</code> ({L('apps/server/src/routes/threads/actions.ts',672,698)}). The 10-second periodic sweep ({L('apps/server/src/services/system/periodic-sweeps.ts',376,398)}) calls <code>advanceEnvironmentCleanup</code>, which waits only while <code>now - retireRequestedAt &lt; managedEnvironmentRetireGraceMs</code> (<code>MANAGED_ENVIRONMENT_RETIRE_GRACE_MS = 5 * 60_000</code>, {L('apps/server/src/constants.ts',15)}) and a revivable archived thread exists ({L('apps/server/src/services/environments/environment-cleanup-internal.ts',402,424)}), then dispatches <code>environment.destroy</code>. The daemon runs <code>git worktree remove &lt;path&gt; --force</code> ({L('packages/host-workspace/src/provisioning.ts',713,753)}): the checkout and any uncommitted changes are deleted, the branch survives. On success the row goes to <code>destroyed</code> with <code>path = null</code>; the branch name stays on the row (see <a href="1710/repro/1710-env-after-destroy.json">env JSON</a>).</p>
<pre>{envjson}</pre>
  <p><b>2. <code>destroyed</code> is terminal for the thread too ("Decision B*").</b> <code>requireThreadCommandEnvironment</code> rejects any work request when the environment is <code>destroying</code>/<code>destroyed</code> with 409 <code>thread_environment_unavailable</code> and never re-provisions ({L('apps/server/src/services/threads/thread-command-environment.ts',43,62)}, {L('apps/server/src/services/lib/lifecycle-api-errors.ts',74,98)}). The unarchive route is a pure record op: it emits <code>retire.cancelled</code> only if the environment is still <code>retiring</code>; from <code>destroyed</code> it does nothing and its own comment says the thread "remains read-only" ({L('apps/server/src/routes/threads/actions.ts',717,745)}). Fork requires a <code>ready</code> environment with a path ({L('apps/server/src/services/threads/thread-fork.ts',48,63)}). No route or CLI command can attach a new environment to an existing thread (<code>updateThreadRequestSchema</code> has no <code>environmentId</code>; the <code>bb environment</code> command set has no restore/reprovision).</p>
  <p><b>3. The UI removes every affordance in that state.</b> <code>ThreadDetailView</code> derives <code>threadEnvironmentGoneStatus</code> from the environment status ({L('apps/app/src/views/thread-detail/ThreadDetailView.tsx',2489,2495)}); <code>ThreadDetailPromptArea</code> hides the composer (and with it the footer action "Handoff to new thread", {L('apps/app/src/views/thread-detail/ThreadDetailPromptArea.tsx',628,629)}, {L('apps/app/src/views/thread-detail/ThreadDetailPromptArea.tsx',1078,1081)}); and the banner renders the read-only row with the Unarchive action only when the environment is <em>not</em> gone ({L('apps/app/src/components/promptbox/banner/ThreadPromptContextBanner.tsx',907,931)}):</p>
<pre>statusAction={{
  archivedSection?.onUnarchive &amp;&amp; !environmentGone ? (
    &lt;ThreadUnarchiveTextAction … /&gt;
  ) : null
}}</pre>
  <p>Hiding the button is deliberate (unarchive would only make a zombie), but nothing replaces it. PR #1016 states: "There is no destroyed-environment <b>Continue in new thread</b> action in this PR; that workflow will be handled separately." It was not handled: nothing on main or origin/main adds it. Meanwhile the "..." menu and Settings → Archived threads still expose Unarchive, which yields the live-but-dead thread in screenshot 5.</p>
  <p><b>Why the symptom follows.</b> The reporter archived, did not notice within 5 minutes (or was on ≤ v0.36.0 where destroy was immediate), the worktree was removed, and every remaining control path is either hidden or rejects with 409/400. Conversation history and the provider session are still stored, and the branch still exists, so the context is recoverable in principle; the product just has no operation that does it.</p>
  <p><b>Deeper issues.</b> (a) The 5-minute deadline is invisible: the "Thread is archived" banner and the archived-threads list do not show that the worktree will be deleted, and the archive toast disappears after 10&nbsp;s. (b) The wording <b>Environment archived</b> is misleading — nothing was archived, the workspace was deleted. (c) Unarchive on a destroyed-environment thread should either be refused with a clear message or perform a recovery; today it silently produces an unusable live thread. (d) The <code>Handoff to new thread</code> location state carries <code>reuseEnvironmentId</code> even for a destroyed environment ({L('apps/app/src/lib/thread-handoff-request.ts',20,30)}); if that action were simply re-exposed it would try to reuse a destroyed environment.</p>

  <h2>Proposed fix (first principles)</h2>
  <p>Two layers; both are needed for "continue in the original chat".</p>
  <ol>
    <li><b>Server: a re-provision path for a thread whose managed environment is <code>destroyed</code>.</b> Add <code>POST /threads/:id/restore-environment</code> (and call it from the unarchive route when the environment is destroyed, or keep unarchive pure and let the UI call it explicitly). Preconditions: thread not deleted, environment <code>managed</code> + <code>workspaceProvisionType = managed-worktree</code> + <code>status = destroyed</code>. Behavior: create a new managed-worktree environment on the same host with <code>baseBranch = {{kind:"named", name: oldEnvironment.branchName}}</code> when the branch still exists (else default base) — exactly what <code>resolveForkEnvironment</code> already computes ({L('apps/server/src/services/threads/thread-fork.ts',66,94)}) — then <code>updateThread(tx, hub, threadId, {{environmentId: newEnvironment.id}})</code> (supported by the DB layer, emits <code>environment-changed</code>) and let the normal thread provisioning create the worktree. Leave the old row <code>destroyed</code>. Provider resume: the stored provider session/rollout is cwd-independent for codex; verify <code>dispatchThreadUnarchiveCommand</code>/session resume tolerate a changed workspace path, and fall back to a fresh session seeded from the thread's history (as fork does) if resume fails. Bump <code>HOST_DAEMON_PROTOCOL_VERSION</code> only if any daemon command shape changes (none should).</li>
    <li><b>App/CLI/SDK:</b> in the environment-gone banner replace the empty right slot with <b>Restore workspace from branch &lt;branch&gt;</b> (calls the new route) and <b>Continue in new thread</b> (existing handoff, but with <code>reuseEnvironmentId</code> omitted when the environment is gone). Show the same in the "..." menu instead of a bare Unarchive for destroyed-environment threads. Add <code>bb thread restore-environment &lt;id&gt;</code> / <code>sdk.threads.restoreEnvironment</code>. Also show the deadline in the archived banner ("worktree is deleted in 4:32") and rename <b>Environment archived</b> to <b>Workspace deleted</b>.</li>
    <li><b>Cheap intermediate step</b> if the full restore is too big: relax <code>requireSourceEnvironment</code> so fork is allowed from a <code>destroyed</code> environment when <code>branchName</code> is set (isolated mode only; reuse must stay rejected), and expose "Continue in new thread (fork)" in the gone banner. That already gives context + branch continuity in a new thread.</li>
  </ol>
  <p><b>What could go wrong:</b> the branch may have been deleted or merged (fall back to default base and say so); the project's source repo may be gone (fail with the existing provisioning error); uncommitted work is unrecoverable no matter what — the restore UI must say "committed work on branch X is restored; uncommitted changes were lost"; plugins that keyed on the old <code>environmentId</code> see a new id (the <code>environment-changed</code> notification exists for this); the destroyed row is pruned after 7 days, so <code>branchName</code> should be captured before pruning or the thread should store it.</p>

  <h2>Related issues</h2>
  <ul>
    <li>PR <a href="https://github.com/get-bb/bb/pull/1016">#1016</a> "feat(environments): add a lossless archive grace period" (merged 2026-08-11, first in desktop-v0.37.0) — introduced the 5-minute window and the <b>Environment archived</b> banner; explicitly deferred the destroyed-environment "Continue in new thread" action.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1624">#1624</a> "Support discovered worktrees and continuing existing branches" — a generic "start a thread on an existing branch" would be the building block for restoring from the surviving branch.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1660">#1660</a> mentions orphaned processes in deleted managed worktrees (same destroy path, different symptom).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Timing</h3>
  <p><code>retire_requested_at = 1787037567625</code> (07:19:27.625Z) → <code>destroy.completed</code> at <code>updated_at = 1787037873054</code> (07:24:33.054Z): 305.4&nbsp;s = 5&nbsp;min grace + one 10&nbsp;s sweep tick. Server/daemon logs contain no line about the retire/destroy (<a href="1710/repro/1710-devlog-excerpt.txt">note</a>).</p>
  <h3>Artifacts</h3>
  <ul>
    <li><a href="1710/repro/1710-spawn.out">1710-spawn.out</a> — spawn JSON</li>
    <li><a href="1710/repro/1710-thread-log.txt">1710-thread-log.txt</a> — <code>bb thread log</code> of the repro thread</li>
    <li><a href="1710/repro/1710-env-status-poll.log">1710-env-status-poll.log</a> — environment status every 15&nbsp;s during the grace window</li>
    <li><a href="1710/repro/1710-env-after-destroy.json">1710-env-after-destroy.json</a>, <a href="1710/repro/1710-env-row-after.txt">1710-env-row-after.txt</a>, <a href="1710/repro/1710-thread-row-after.txt">1710-thread-row-after.txt</a></li>
    <li><a href="1710/repro/1710-unarchive-after-destroy.sh">1710-unarchive-after-destroy.sh</a> / <a href="1710/repro/1710-unarchive-after-destroy.out">.out</a>, <a href="1710/repro/1710-fork-after-destroy.out">1710-fork-after-destroy.out</a></li>
    <li><a href="1710/repro/1710-control-grace-unarchive.sh">1710-control-grace-unarchive.sh</a> / <a href="1710/repro/1710-control-grace-unarchive.out">.out</a></li>
    <li><a href="1710/repro/issue-1710-archived-thread-dead-end.test.ts">issue-1710-archived-thread-dead-end.test.ts</a> / <a href="1710/repro/1710-unit-test.out">1710-unit-test.out</a></li>
    <li><a href="1710/repro/build-report.py">build-report.py</a> — generator for this page</li>
  </ul>
  <h3>Commands run (chronological)</h3>
<pre>git checkout 16ceb3a54 &amp;&amp; pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
scripts/bb-dev-app current
mkdir /tmp/1710-qa; git init -b main; commit README.md
bb machine list                                            # host_58mkech586
curl -X POST $BB_SERVER_URL/api/v1/projects … /tmp/1710-qa # proj_kwhvshvxma
bb thread spawn --project proj_kwhvshvxma --new-environment worktree --provider codex --permission-mode accept-edits --title "1710 accidental archive" --prompt "…commit WORK.md…" --json   # thr_3wbj638q94 / env_r4czunz9nt
bb thread wait thr_3wbj638q94 --timeout 180
dev-browser (headless) screenshot → assets/1710-before.png
bb thread archive thr_3wbj638q94                          # 07:19:27Z
sqlite3 bb.db "select status,retire_requested_at,path from environments where id='env_r4czunz9nt'"   # retiring
dev-browser screenshot → assets/1710-archived-grace.png
poll sqlite every 15 s → 1710-env-status-poll.log         # destroyed at 07:24:33Z
dev-browser screenshot → assets/1710-env-archived-no-recovery.png
git -C /tmp/1710-qa branch -a; git log bb/1710-accidental-archive-thr_3wbj638q94   # branch survives, 716a568 work
1710-unarchive-after-destroy.sh thr_3wbj638q94            # unarchive 200, tell 409, send 409
bb thread fork thr_3wbj638q94 --workspace isolated …      # 400
bb thread archive thr_3wbj638q94; dev-browser screenshot of "..." menu → assets/1710-actions-menu-unarchive.png
dev-browser screenshot after unarchive → assets/1710-unarchived-still-dead.png
1710-control-grace-unarchive.sh proj_kwhvshvxma           # thr_754fzrrkut, lossless
cd apps/server &amp;&amp; pnpm exec vitest run test/public/issue-1710-archived-thread-dead-end.test.ts
pnpm dev:stop</pre>
</main></body></html>
'''
open('/tmp/bb-reports/issues/1710.html','w').write(doc)
print(len(doc))
