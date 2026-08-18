#!/usr/bin/env python3
"""Builds /tmp/bb-reports/issues/1650.html from the repro artifacts."""
import html, pathlib

R = pathlib.Path("/tmp/bb-reports/issues/1650/repro")
def esc(s): return html.escape(s, quote=False)
def inc(name, clean=None):
    p = R / name
    s = p.read_text()
    if clean:
        s = "\n".join(l for l in s.splitlines() if not any(k in l for k in clean))
    return esc(s.strip("\n"))
NOISE = ["turbo", "Packages in scope", "Running build", "Remote caching", "Tasks:", "Cached:", "Time:", "FULL TURBO"]
BASE = "16ceb3a540f81c1189efaffb27a39b1d9443abf5"
def L(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="https://github.com/get-bb/bb/blob/{BASE}/{path}{frag}"><code>{path}:{a}{"-"+str(b) if b else ""}</code></a>'

repro_test = inc("issue-1650-blocked-thread-message-loss.test.ts")
probe_test = inc("pr1699-probe.test.ts")

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1650 messages to a thread blocked on AskUserQuestion are dropped</title>
<style>
  :root {{ --canvas:#fafaf8; --ink:#1a1a1a; --muted:#666; --line:#e2e2de; --accent:#0052cc; --high:#b60205; --ok:#1a7f37; --warn:#9a6700; }}
  body {{ margin:0; background:var(--canvas); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; }}
  main {{ max-width:900px; margin:0 auto; padding:40px 24px 80px; }}
  h1 {{ font-size:26px; line-height:1.25; margin:0 0 6px; }}
  h2 {{ font-size:18px; margin:36px 0 10px; padding-top:20px; border-top:1px solid var(--line); }}
  h3 {{ font-size:16px; margin:22px 0 8px; }}
  .meta {{ color:var(--muted); font-size:14px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }}
  .pill {{ display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); }}
  .pill.high {{ background:var(--high); color:#fff; border-color:var(--high); }}
  .pill.ok {{ background:var(--ok); color:#fff; border-color:var(--ok); }}
  .pill.warn {{ background:var(--warn); color:#fff; border-color:var(--warn); }}
  .verdict {{ font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; background:#fff; }}
  figcaption {{ font-size:13px; color:var(--muted); margin-top:6px; }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .grid {{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }} @media (max-width:700px){{ .grid{{grid-template-columns:1fr;}} }}
  details summary {{ cursor:pointer; color:var(--accent); }}
  .sev-high {{ color:var(--high); font-weight:600; }} .sev-med {{ color:var(--warn); font-weight:600; }} .sev-low {{ color:var(--muted); font-weight:600; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1650 · Messages to a thread blocked on AskUserQuestion are dropped, and only the sender is told</h1>
  <p class="meta">
    <span class="pill">Type: Bug (untyped on GitHub)</span> <span class="pill">Priority: unset</span> <span class="pill">Effort: unset</span>
    <span class="pill">threads</span> <span class="pill">ask-user-question</span>
    <a href="https://github.com/get-bb/bb/issues/1650">open on GitHub</a>
    <span>report · 2026-08-18</span>
    <span>base commit <code>16ceb3a54</code></span>
  </p>
  <p class="meta">
    <span class="pill high">REPRODUCED</span>
    <span class="verdict">Root-cause confidence: high</span>
    <span>Linked PRs: <a href="#pr1699">#1699</a> (REQUEST CHANGES), <a href="#pr1698">#1698</a> (REQUEST CHANGES, does not target this issue)</span>
  </p>

  <h2 id="tldr">1. TL;DR</h2>
  <p>While a bb thread is parked on a pending interaction (an <code>AskUserQuestion</code> card, a command approval, a permission grant), the server treats it as unable to accept prompts. Every <code>POST /api/v1/threads/:id/send</code> — which is what <code>bb thread tell</code> uses in all three modes (<code>steer</code>, <code>queue</code>, <code>auto</code>) — is rejected with <code>HTTP 409 awaiting_user_interaction</code> and nothing is persisted, so the <em>recipient</em> never learns a message was addressed to it. Only the sender sees the failure. This is deliberate server behaviour (added in PR #112, June 2026), not an accident, but it has no counterpart on the recipient side.</p>
  <p>Worse, and not visible from the CLI at all: bb's own <em>child-thread completion notices</em> take a different code path (<code>queueParentSystemMessage</code>) that <strong>silently returns <code>false</code></strong> when the parent is blocked. No log line, no queued row, no retry. A blocked orchestrator therefore never hears that its worker finished, which is exactly the "worker went silent for 3.5 hours" outcome the reporter describes. Both drops were reproduced live on a dev instance with a real Claude Code thread and confirmed with a failing vitest at the exact server code paths.</p>
  <p>A partial workaround exists on <code>main</code> today: <code>bb thread queue create &lt;id&gt; "…"</code> (the <code>POST /queued-messages</code> route) is <em>not</em> guarded, and its message drains after the interaction is answered and the turn ends. <code>bb thread tell --mode queue</code>, confusingly, is guarded and fails.</p>

  <h2 id="claims">2. Claims vs findings</h2>
  <table>
    <tr><th style="width:38%">Claim (from the issue)</th><th style="width:12%">Status</th><th>Evidence</th></tr>
    <tr><td>Sending to a thread blocked on <code>AskUserQuestion</code> returns <code>HTTP 409: Thread is awaiting user interaction…</code></td><td><span class="pill high">Verified</span></td><td>Live: all three <code>bb thread tell</code> modes 409 (<a href="1650/repro/01-tell-while-blocked.txt">01-tell-while-blocked.txt</a>). Code: {L("apps/server/src/services/threads/thread-send.ts",147,160)} thrown from {L("apps/server/src/services/threads/thread-send.ts",394,396)} and {L("apps/server/src/routes/threads/actions.ts",325,327)}.</td></tr>
    <tr><td>The refusal is only reported to the sender; the recipient's inbox loses the message with no trace</td><td><span class="pill high">Verified</span></td><td>No <code>queued_thread_messages</code> row, no <code>client/turn/requested</code> event, nothing in <code>server.log</code> for the target thread (<a href="1650/repro/02-child-completion-dropped.txt">02</a>, <a href="1650/repro/04-parent-turn-requests-after-resolve.txt">04</a>). After the question was answered, the target timeline shows none of the three tells (<a href="assets/1650-after-answer.png">screenshot</a>).</td></tr>
    <tr><td>Messages "were stored in the bus room (#2780…)" and "wake failures: … HTTP 409"</td><td><span class="pill">Unverifiable</span></td><td>The "bus", "wake" and "watchdog" are the reporter's own tooling outside bb; the 409 they surface is bb's. Nothing in the bb repo stores or replays these messages.</td></tr>
    <tr><td>"the sender saw success" (watchdog message)</td><td><span class="pill warn">Partly refuted</span></td><td>bb's <code>tell</code> exits non-zero with the 409, so a sender using bb directly sees the failure. Whether the reporter's bus reported success is outside bb. However bb <em>itself</em> is a sender that swallows failure: child completion notices to a blocked parent return <code>false</code> with no log ({L("apps/server/src/services/threads/parent-system-messages.ts",422,424)}), so from the worker's point of view "the sender saw success" is literally true for bb's own system messages.</td></tr>
    <tr><td>Fix option 1: queue the message and deliver when the interaction resolves</td><td><span class="pill">Feasible</span></td><td>The queue machinery exists and already works when driven through <code>bb thread queue create</code> (<a href="1650/repro/03-queue-create-and-answer.txt">03</a>). PR #1699 wires <code>send</code> to it; see review.</td></tr>
    <tr><td>Fix option 2: let the blocked thread see that something was addressed to it</td><td><span class="pill">Feasible</span></td><td>Nothing on main does this. PR #1699 leaves queued rows visible in <code>bb thread queue list</code>, which is a form of it.</td></tr>
    <tr><td>Threads ending in <code>status=error</code> produce no completion notification (side note)</td><td><span class="pill">Not investigated</span></td><td>Out of scope per the reporter. Note {L("apps/server/src/services/threads/child-thread-notifications.ts",395,410)} does handle a <code>failed</code> turn status, so a plain "no notification" claim looks unlikely at the code level.</td></tr>
    <tr><td>Reproduced on 0.37.0</td><td><span class="pill high">Still present on main</span></td><td>Reproduced on <code>16ceb3a54</code> (CLI reports 0.38.0). Both guards are unchanged since PR #112 (<code>git log -S ensureThreadIsNotAwaitingUserInteraction</code>).</td></tr>
  </table>

  <h2 id="env">3. Environment</h2>
  <table>
    <tr><td>bb</td><td>worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_debcf606-e4a-8</code> at <code>16ceb3a54</code> (main, 2026-08-18); CLI reports 0.38.0</td></tr>
    <tr><td>OS / Node</td><td>Linux 7.0.0-29-generic, Node v24.18.0, pnpm workspace, vitest 4.1.1</td></tr>
    <tr><td>Providers</td><td>claude-code (Claude Code 2.1.234, model <code>claude-haiku-4-5</code>, native AskUserQuestion), codex-cli 0.147.0 (unused)</td></tr>
    <tr><td>Dev instance</td><td><code>scripts/bb-dev-app current</code> → App <code>http://localhost:13503</code>, Server <code>http://localhost:21503</code>, Host daemon <code>127.0.0.1:29503</code>, data dir <code>~/.bb-dev/projects-bb-.claude-worktrees-wf_debcf606-e4a-8-c808c747b48c</code>. Project <code>proj_dd42ck6esj</code> ("qa") on scratch repo <code>/tmp/bb-1650-qa</code>, host <code>host_yu5777zekj</code>.</td></tr>
    <tr><td>Threads used</td><td>orchestrator <code>thr_9asvxkui9a</code> (blocked on <code>pint_qypn9bbuws</code>), worker child <code>thr_7p4yx6bibn</code></td></tr>
  </table>
  <p><strong>Gotcha for anyone re-running this:</strong> the shell that hosts an agent may already export <code>BB_SERVER_URL</code>/<code>BB_THREAD_ID</code> pointing at the user's real bb. Hard-set <code>BB_SERVER_URL</code> to your dev instance and <code>unset BB_THREAD_ID</code>, otherwise <code>bb thread tell</code> attaches a sender thread that does not exist on the dev instance (or worse, targets the wrong server). The helper scripts below do this.</p>

  <h2 id="repro">4. Minimal reproduction</h2>
  <h3>4a. Live (CLI + real provider)</h3>
  <ol>
    <li>Start a dev instance and create a project:
<pre>scripts/bb-dev-app current                     # prints App/Server URLs + data dir
export BB_SERVER_URL=http://localhost:21503 BB_HOST_DAEMON_PORT=29503; unset BB_THREAD_ID
mkdir -p /tmp/bb-1650-qa &amp;&amp; git -C /tmp/bb-1650-qa init -q &amp;&amp; echo hi &gt; /tmp/bb-1650-qa/README.md \\
  &amp;&amp; git -C /tmp/bb-1650-qa add -A &amp;&amp; git -C /tmp/bb-1650-qa -c user.email=a@b -c user.name=qa commit -qm init
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/bb-1650-qa","hostId":"&lt;id from: pnpm bb:dev machine list&gt;"}}}}'</pre></li>
    <li>Spawn an "orchestrator" that immediately parks itself on a question:
<pre>pnpm bb:dev thread spawn --project &lt;proj id&gt; --provider claude-code --model claude-haiku-4-5 \\
  --permission-mode accept-edits --title "1650 orchestrator" \\
  --prompt "Call the AskUserQuestion tool exactly once with a single question 'Proceed?' and options Yes / No. After the answer arrives, reply only with ok." --json
# ~20s later:
pnpm bb:dev thread list --json | grep -E '"id"|"status"|hasPending'
#   "id": "thr_9asvxkui9a",  "status": "active",  "hasPendingInteraction": true,</pre>
    <figure><img src="assets/1650-blocked.png" alt="Orchestrator thread parked on the Proceed? question card"><figcaption><strong>Before.</strong> The orchestrator thread in the web app, blocked on the AskUserQuestion card ("Waiting for answer Proceed?"). Nothing else in the timeline. Sidebar shows the child "1650 worker".</figcaption></figure></li>
    <li>Act as a worker and report back three ways (<a href="1650/repro/run-tell.sh">run-tell.sh</a>). <strong>Expected:</strong> the message is accepted, or at least parked somewhere the orchestrator will see. <strong>Actual:</strong> every mode is refused, and the queue is empty:
<pre>{inc("01-tell-while-blocked.clean.txt")}</pre></li>
    <li>Spawn a real child of the orchestrator that finishes immediately (this exercises bb's own parent-notification path):
<pre>pnpm bb:dev thread spawn --project &lt;proj id&gt; --provider claude-code --model claude-haiku-4-5 --permission-mode accept-edits \\
  --parent-thread thr_9asvxkui9a --title "1650 worker" --prompt "Reply only with ok." --json
# child thr_7p4yx6bibn goes idle ~20s later</pre>
    <strong>Expected:</strong> the parent gets a <code>[bb system]</code> "child completed" turn request (that is what happens when the parent is idle or plainly active). <strong>Actual</strong> (<a href="1650/repro/dump-evidence.sh">dump-evidence.sh</a>): no event, no queued row, <em>and no server log line at all</em>:
<pre>{inc("02-child-completion-dropped.txt")}</pre></li>
    <li>Show the inconsistency and the workaround: the queued-message route is not guarded. Then answer the question and see what actually reaches the orchestrator (<a href="1650/repro/run-queue-and-answer.sh">run-queue-and-answer.sh</a>):
<pre>{inc("03-queue-create-and-answer.txt")}</pre>
    <figure><img src="assets/1650-after-answer.png" alt="Orchestrator timeline after the question was answered"><figcaption><strong>The moment the bug is visible.</strong> After answering "Yes": the timeline shows "ok" and then only "worker report 4 (via bb thread queue create)". Worker reports 1–3 (all three <code>tell</code> modes) and the child "1650 worker" completion notice never arrive — the orchestrator has no evidence its worker ever existed or reported.</figcaption></figure>
    The parent's turn-request events after resolution confirm it (seq 31 is the queue-created message; there is no <code>initiator: "system"</code> row):
<pre>{inc("04-parent-turn-requests-after-resolve.txt")}</pre></li>
  </ol>

  <h3>4b. Unit-level (fails on main, passes on PR #1699)</h3>
  <p>Save as <code>apps/server/test/threads/issue-1650-blocked-thread-message-loss.test.ts</code> (copy: <a href="1650/repro/issue-1650-blocked-thread-message-loss.test.ts">repro/issue-1650-blocked-thread-message-loss.test.ts</a>) and run <code>cd apps/server &amp;&amp; pnpm exec vitest run test/threads/issue-1650-blocked-thread-message-loss.test.ts</code>. Real SQLite via the test harness, no mocks. Both tests assert the <em>desired</em> behaviour and fail on main:</p>
  <ul>
    <li>Test 1: <code>POST /send</code> (<code>steer-if-active</code>, with <code>senderThreadId</code>) to an active thread with a pending user question → asserts 200 and a persisted row. <strong>Fails: status 409, 0 queued rows, 0 turn requests.</strong></li>
    <li>Test 2: <code>queueParentSystemMessage</code> to a blocked parent → asserts it does not return <code>false</code> with nothing persisted. <strong>Fails: <code>{{ delivered: false, persistedSystemTurnRequests: 0 }}</code>.</strong></li>
  </ul>
<pre>{inc("05-vitest-main.txt")}</pre>
  <details><summary>Repro test source</summary><pre>{repro_test}</pre></details>

  <h2 id="root-cause">5. Root cause</h2>
  <p>There are two independent drop sites, both keyed on <code>pendingInteractions.hasPendingThreadInteraction(threadId)</code> (an in-memory + DB view of <code>pending_interactions</code> rows with status <code>pending</code>/<code>resolving</code>).</p>
  <h3>5a. The public send route refuses and persists nothing</h3>
  <p>{L("apps/server/src/services/threads/thread-send.ts",147,160)} throws <code>ApiError(409, "awaiting_user_interaction")</code>. It is invoked from two places:</p>
  <ul>
    <li>{L("apps/server/src/routes/threads/actions.ts",318,341)}: the <code>send</code> route. For <code>queue-if-active</code> on an active thread (and during manual compaction) it calls the guard <em>before</em> <code>createQueuedMessageForThread</code>, so even the explicitly-queued form is refused. This guard was added on purpose in <a href="https://github.com/get-bb/bb/pull/112">#112</a> ("reject <code>queue-if-active</code> requests while an active thread is awaiting user interaction"), with a regression test asserting that <em>no queued row is created</em> ({L("apps/server/test/public/public-thread-interactions.test.ts",817,955)}). Whatever the original motivation, it turned the queue — the one place a message could have waited safely — into a refusal.</li>
    <li>{L("apps/server/src/services/threads/thread-send.ts",393,396)}: <code>sendThreadMessage</code> for the <code>steer</code>/<code>auto</code>/<code>start</code> paths when <code>trigger === "user"</code>. Note this fires for agent-originated tells too (the CLI sends <code>senderThreadId</code>, but <code>trigger</code> is still <code>"user"</code>).</li>
  </ul>
  <p>Meanwhile <code>POST /threads/:id/queued-messages</code> ({L("apps/server/src/routes/threads/actions.ts",383,390)}) has <em>no</em> guard, which is why <code>bb thread queue create</code> works and its message drains via the existing <code>queued-message-auto-send</code> follow-up when the thread returns to idle ({L("apps/server/src/internal/events.ts",502,522)}). So the system already knows how to hold and later deliver such a message; the <code>send</code> route simply chooses not to.</p>
  <h3>5b. bb's own parent notifications vanish without a trace</h3>
  <p>{L("apps/server/src/services/threads/parent-system-messages.ts",410,424)}:</p>
  <pre>export async function queueParentSystemMessage(deps, args): Promise&lt;boolean&gt; {{
  const parentThread = getThread(deps.db, args.parentThreadId);
  if (!parentThread || parentThread.archivedAt !== null || parentThread.deletedAt !== null) {{
    return false;
  }}
  if (deps.pendingInteractions.hasPendingThreadInteraction(parentThread.id)) {{
    return false;            // &lt;-- no log, no row, no retry
  }}
  …</pre>
  <p>Every caller treats <code>false</code> as a soft outcome: {L("apps/server/src/services/threads/child-thread-notifications.ts",412,440)} (batched child completed/failed/interrupted), needs-attention ({L("apps/server/src/services/threads/child-thread-notifications.ts",517,530)}) and ownership hand-offs (<code>thread-ownership.ts</code>) only log when an exception is thrown. The 2-second batch window in <code>child-thread-notifications.ts</code> means the notice is evaluated once, ~2s after the child finishes, and then discarded. This is the mechanism behind "the orchestrator believed the worker had gone silent": the worker (or bb on its behalf) reported, bb dropped it, and no one — not the sender, not the recipient, not the log — recorded that.</p>
  <h3>Why the symptom follows</h3>
  <p>An orchestrator blocked on a question is by definition idle from the model's point of view but <code>active</code> from bb's. All inbound traffic during that window (tells, queue-mode tells, child completion notices) hits one of the two guards. When the human finally answers, the model resumes with a context that contains nothing from that window, so it concludes the workers were silent. Deeper issue: "blocked on interaction" is modelled purely as a <em>refusal condition</em>; there is no state that represents "messages addressed to this thread while blocked".</p>

  <h2 id="fix">6. Proposed fix (first principles)</h2>
  <ol>
    <li><strong>Server, <code>send</code> route:</strong> when the target has a pending interaction and the mode is not <code>start</code>, persist the message as a queued thread message (reuse <code>createQueuedMessageForThread</code>) and return <code>200</code> with a discriminated outcome (<code>delivery: "queued"</code>, reason <code>awaiting_user_interaction</code>). Keep the 409 only for <code>start</code>. Delete the guard call inside the <code>shouldQueue</code> branch of {L("apps/server/src/routes/threads/actions.ts",325,327)} and flip the #112 regression test. Risk: a <code>--mode steer "STOP"</code> is now delivered later as a new turn instead of interrupting; the CLI must say so, and callers that need a hard stop should use <code>bb thread stop</code>.</li>
    <li><strong>Server, <code>queueParentSystemMessage</code>:</strong> never return <code>false</code> silently for a blocked parent. Persist the notice (a small durable table keyed by parent thread, or reuse queued messages with a system initiator) and log at info. Flush it when the parent's interaction settles (a settle hook on <code>PendingInteractionLifecycle</code>) and from the periodic sweep so a restart cannot strand it. Do <em>not</em> delete the row before delivery succeeds; a thread that is <code>stopping</code> or whose host is momentarily disconnected must keep the row for the sweep (see PR #1699 finding 2).</li>
    <li><strong>Drain semantics:</strong> the queue must not auto-send while an interaction is pending (guard inside <code>sendNextQueuedMessageIfPresent</code>) and must be kicked when the interaction settles on an idle thread (plugin input requests can block idle threads).</li>
    <li><strong>Recipient visibility (option 2 in the issue):</strong> queued rows are already visible in <code>bb thread queue list</code> and the app queue UI; optionally prepend a one-line "N messages arrived while you were waiting for input" system note when the queue drains after a blocked period.</li>
    <li>SDK/CLI: surface the outcome (<code>delivery</code>) in <code>bb thread tell</code> and <code>--json</code>; update the guide and bb-cli skill so agents do not resend.</li>
  </ol>
  <p>PR #1699 implements essentially this shape (1, 2 partially, 3, 5). No <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump is needed: nothing on the server↔daemon wire changes.</p>

  <h2 id="prs">7. PR review</h2>

  <h3 id="pr1699">PR #1699 — "Queue messages sent to a thread that awaits user interaction" (head <code>bdcb9104</code>, base <code>ba426545</code>) — <span class="sev-high">REQUEST CHANGES</span></h3>
  <p><strong>What it changes.</strong> <code>send</code> queues instead of 409 when the target awaits input (<code>resolveSendQueuedReason</code>), returns <code>{{ok, delivery, queuedReason}}</code>; queue auto-send skips blocked threads and is re-kicked by a new <code>PendingInteractionLifecycle.setThreadInteractionSettledListener</code>; parent system messages to a blocked parent are persisted in a new <code>deferred_parent_system_messages</code> table (migration <code>0099_deferred_parent_system_messages</code>) and flushed on settle plus a periodic sweep; SDK <code>threads.send</code> returns the new response; CLI prints the queued outcome; guide/skill updated. (The PR description still says "defer in server memory"; the code persists — the description is stale.)</p>
  <p><strong>Does it address the root cause?</strong> Yes, both drop sites (5a and 5b). My repro test passes on this branch (<a href="1650/repro/06-vitest-pr1699.txt">06-vitest-pr1699.txt</a>), and its own tests pass (<code>parent-system-messages-deferred.test.ts</code>, <code>public-thread-interactions.test.ts</code>: 30 passed).</p>
  <table>
    <tr><th style="width:5%">#</th><th style="width:10%">Severity</th><th>Finding</th></tr>
    <tr><td>1</td><td><span class="sev-high">High</span></td><td><strong>Stale against main; migration index collision.</strong> The branch is 26 commits behind <code>16ceb3a54</code>. Main already has migration idx 99 (<code>packages/db/drizzle/0099_flawless_maximus.sql</code>, from #1716). The PR adds a second idx 99 (<code>0099_deferred_parent_system_messages.sql</code>, <code>_journal.json</code> entry, <code>meta/0099_snapshot.json</code>). <code>git merge 16ceb3a54</code> conflicts in 9 files: <code>packages/db/drizzle/meta/_journal.json</code>, <code>meta/0099_snapshot.json</code>, <code>packages/db/test/migrate.test.ts</code>, <code>packages/domain/src/plugin-sdk-version.ts</code> (PR bumps 0.4.6→0.4.7, main is already 0.4.8), <code>packages/plugin-sdk/package.json</code>, the bundled d.ts, <code>apps/server/src/server.ts</code>, <code>SKILL.md</code>. Must rebase, renumber the migration to 0100 and <em>regenerate</em> the snapshot with Drizzle (AGENTS.md forbids hand-editing snapshots), and re-bump the plugin SDK version to 0.4.9.</td></tr>
    <tr><td>2</td><td><span class="sev-med">Medium</span></td><td><strong>Deferred parent messages are still lost when delivery fails at flush time.</strong> <code>flushDeferredParentSystemMessages</code> deletes the row <em>before</em> attempting delivery ("claim") and on failure only logs. Probe (b) in <a href="1650/repro/pr1699-probe.test.ts">pr1699-probe.test.ts</a>: parent active+blocked, child notice deferred, parent gets <code>stop.requested</code> (status <code>stopping</code>) and its interaction is interrupted — the settle listener fires, the flush throws <code>Thread lifecycle event not applied (illegal-transition): no transition for run.started from status stopping</code>, and the row is gone (<a href="1650/repro/07-pr1699-probe-output.txt">07 output</a>: <code>system requests: 0, deferred rows left: 0</code>). A moment later the thread is idle and the sweep could have delivered it. Same for a transient host disconnect (<code>ensureHostSessionReadyForWork</code> throws). Since the PR advertises durability and ships a sweep, delete only after a successful send (or claim with a <code>claimed_at</code> column and release on failure). This is the exact "user gives up on the question and stops the thread" sequence.</td></tr>
    <tr><td>3</td><td><span class="sev-med">Medium</span></td><td><strong>Two different delivery semantics for the same situation, undocumented.</strong> A worker's <code>bb thread tell</code> becomes a queued message that lands only when the orchestrator is next <em>idle</em> (after the whole turn), while a child-completed notice flushes at settle as an active-turn steer (probe (a): <code>target.kind:"auto"</code> right after settle; probe (c): the tell's queued row is still there after settle while the thread is active). If the orchestrator keeps working for an hour after the question, worker reports arrive an hour late even though the "blocked" reason is long gone. Either flush the queue on settle too (as a steer, mirroring the system-message path), or state the trade-off in the guide/skill. Also a silent semantic downgrade: <code>--mode steer "STOP"</code> is no longer an interruption; the CLI text does say "queued", but the guide line should tell agents to use <code>bb thread stop</code> for hard stops.</td></tr>
    <tr><td>4</td><td><span class="sev-low">Low</span></td><td><code>parent-system-messages-deferred.test.ts</code> seeds an <em>idle</em> blocked parent, so the real AskUserQuestion case (active parent → <code>queueActiveParentSystemMessage</code> → <code>turn.submit</code> mode <code>auto</code>) is untested by the PR. My probe (a) shows it works, but add the active-parent case, and a case where the flush fails, to the PR.</td></tr>
    <tr><td>5</td><td><span class="sev-low">Low</span></td><td>Unrelated formatting churn: <code>apps/server/test/public/public-thread-data.test.ts</code> (+124/−120, prettier re-wrap of an unrelated test), parts of <code>packages/db/test/migrate.test.ts</code>, and a whitespace change in <code>SKILL.md</code> line 304. Drop these to keep the diff reviewable.</td></tr>
    <tr><td>6</td><td><span class="sev-low">Low</span></td><td>Left-over belt-and-braces: <code>sendThreadMessage</code> still calls <code>ensureThreadIsNotAwaitingUserInteraction</code> for <code>trigger === "user"</code>, so a request that races an interaction being registered between the route check and the send still 409s. Acceptable (rare, and the caller can retry), but worth a comment; the 409 text is now shared with #1698 which rewrites it — expect a conflict.</td></tr>
    <tr><td>7</td><td><span class="sev-low">Low</span></td><td>Boundary/typing: <code>parseDeferredParentSystemMessage</code> parses stored JSON with zod (good). No <code>as</code>/<code>unknown</code> smuggling found. Response contract change is additive (<code>{{ok:true}}</code> → <code>{{ok:true, delivery}}</code>); old CLIs ignore the extra fields, new CLIs on old servers print the generic "updated" text. No daemon wire change, so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump needed.</td></tr>
  </table>
  <p><strong>Tests I ran on the branch:</strong> <code>pnpm exec vitest run test/threads/issue-1650-blocked-thread-message-loss.test.ts test/threads/parent-system-messages-deferred.test.ts test/public/public-thread-interactions.test.ts</code> → 30 passed after fixing my fixture (see note in appendix); <code>pr1699-probe.test.ts</code> (3 probes, output in 07). <strong>Verdict: REQUEST CHANGES</strong> — right design, but it cannot merge as-is (finding 1) and finding 2 re-introduces a silent-loss path in the very feature that is meant to remove one.</p>
  <details><summary>Probe test source (not part of the PR)</summary><pre>{probe_test}</pre></details>

  <h3 id="pr1698">PR #1698 — "Surface pending interactions in the CLI and add thread wait --until-input" (head <code>c4ccb7fc</code>, base <code>ba426545</code>) — <span class="sev-med">REQUEST CHANGES</span> (for staleness; it does not target #1650)</h3>
  <p><strong>What it changes.</strong> This PR "Fixes #1655" (pending interactions invisible to the CLI). Relevant to #1650 only in that (a) it rewrites the 409 text in {L("apps/server/src/services/threads/thread-send.ts",155,159)} to name <code>bb thread interactions list &lt;id&gt;</code> / <code>bb thread stop &lt;id&gt;</code>, and (b) <code>bb thread show</code>/<code>list</code> mark threads as "waiting for input" and <code>bb thread wait --until-input</code> lets a coordinator notice a blocked worker. It explicitly leaves the send-route behaviour to #1650/#1699.</p>
  <table>
    <tr><th style="width:5%">#</th><th style="width:10%">Severity</th><th>Finding</th></tr>
    <tr><td>1</td><td><span class="sev-med">Medium</span></td><td>Stale: merges with main conflict in <code>packages/domain/src/plugin-sdk-version.ts</code> (bumps 0.4.6→0.4.7, main is 0.4.8), <code>packages/plugin-sdk/package.json</code>, the bundled d.ts and <code>plugin-sdk-dts.generated.ts</code>. Needs a rebase and re-bump to 0.4.9. It also edits the same 409 assertions in <code>public-thread-interactions.test.ts</code> and the same guide/skill/SDK files as #1699, so whichever lands second must rebase again.</td></tr>
    <tr><td>2</td><td><span class="sev-low">Low</span></td><td>Does not address #1650's root cause (by design). The improved 409 text helps a human but a worker agent still cannot deliver; the recipient still learns nothing.</td></tr>
    <tr><td>3</td><td><span class="sev-low">Low</span></td><td><code>threads.wait({{untilInput}})</code> polls <code>interactions.list</code> every 250 ms and thread status every 8th cycle; fine. <code>isThreadWaitTargetUnreachable</code> treats <code>idle</code> as unreachable for interaction waits, but an idle thread <em>can</em> hold a pending plugin input request; the interaction check runs first each cycle so the pending one is found before the status check — OK, but a comment would help. Terminal-control sanitising of untrusted question text in <code>pending-interactions.ts</code> is a nice touch.</td></tr>
  </table>
  <p><strong>Tests I ran on the branch:</strong> <code>pnpm exec turbo run test --filter=@bb/cli --filter=@bb/sdk --filter=@bb/thread-view</code> → all pass (cli 457, sdk 92, thread-view 369; <a href="1650/repro/08-pr1698-tests.txt">08</a>). <strong>Verdict: REQUEST CHANGES</strong> only for the rebase/version re-bump; otherwise mergeable as an #1655 fix, and a useful companion to #1699.</p>

  <h2 id="related">8. Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1655">#1655</a> awaiting-interaction threads invisible to the CLI (companion; PR #1698).</li>
    <li><a href="https://github.com/get-bb/bb/issues/1706">#1706</a> queue-mode thread messages can silently vanish — different trigger (idle target), same class of "queue accepted, message gone" symptom; worth checking against the queue drain paths touched by #1699.</li>
    <li><a href="https://github.com/get-bb/bb/pull/112">#112</a> introduced the <code>queue-if-active</code> guard that this issue is about.</li>
  </ul>

  <h2 id="appendix">9. Appendix</h2>
  <h3>Files</h3>
  <ul>
    <li><a href="1650/repro/run-tell.sh">repro/run-tell.sh</a>, <a href="1650/repro/run-queue-and-answer.sh">repro/run-queue-and-answer.sh</a>, <a href="1650/repro/dump-evidence.sh">repro/dump-evidence.sh</a> — live repro drivers</li>
    <li><a href="1650/repro/01-tell-while-blocked.txt">01</a> raw CLI output (with turbo noise), <a href="1650/repro/02-child-completion-dropped.txt">02</a>, <a href="1650/repro/03-queue-create-and-answer.txt">03</a>, <a href="1650/repro/04-parent-turn-requests-after-resolve.txt">04</a></li>
    <li><a href="1650/repro/issue-1650-blocked-thread-message-loss.test.ts">repro test</a>, <a href="1650/repro/05-vitest-main.txt">05 main run</a>, <a href="1650/repro/06-vitest-pr1699.txt">06 PR #1699 run</a></li>
    <li><a href="1650/repro/pr1699-probe.test.ts">PR #1699 probes</a>, <a href="1650/repro/07-pr1699-probe-output.txt">07 output</a>; <a href="1650/repro/08-pr1698-tests.txt">08 PR #1698 test run</a></li>
    <li><a href="1650/repro/shot1.js">shot1.js</a>, <a href="1650/repro/shot2.js">shot2.js</a> — dev-browser scripts for the two screenshots</li>
  </ul>
  <h3>Notes on the investigation</h3>
  <ul>
    <li>First attempt at test 1 returned 500 <code>Thread … has no stored execution model</code> on the PR branch: a fixture artefact (a freshly seeded thread has no runtime state). Real threads always have one; adding <code>seedThreadRuntimeState</code> made the test faithful. It still fails on main with 409.</li>
    <li>The first run of <code>run-tell.sh</code> hit the wrong server (inherited <code>BB_SERVER_URL=http://127.0.0.1:38886</code> from the agent shell) and got 404s; only reads and a failed tell to a non-existent thread id happened there. Fixed by hard-setting the dev URL and unsetting <code>BB_THREAD_ID</code>.</li>
    <li>Both PRs share base <code>ba426545</code>; main moved 26 commits (incl. migration 0099 and plugin SDK 0.4.8) after they were opened. Neither PR needs a <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump.</li>
    <li>Dev instance stopped with <code>pnpm dev:stop</code>; the worktree was returned to <code>16ceb3a54</code> with a clean tree.</li>
  </ul>
  <h3>Commands run (abridged, in order)</h3>
  <pre>gh issue view 1650 --repo get-bb/bb --json title,body,labels,state,createdAt,author,comments
gh pr view 1698 / 1699 --json …;  gh pr diff 1698 / 1699
pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
grep -rn "awaiting_user_interaction" apps/server/src …;  git log -S ensureThreadIsNotAwaitingUserInteraction;  git show 15da61844
scripts/bb-dev-app current;  curl POST /api/v1/projects;  pnpm bb:dev thread spawn … (orchestrator, worker)
repro/run-tell.sh thr_9asvxkui9a;  repro/dump-evidence.sh &lt;data dir&gt; thr_9asvxkui9a thr_7p4yx6bibn
dev-browser --browser bb1650 --headless run repro/shot1.js
repro/run-queue-and-answer.sh thr_9asvxkui9a pint_qypn9bbuws;  dev-browser … run repro/shot2.js
cd apps/server &amp;&amp; pnpm exec vitest run test/threads/issue-1650-blocked-thread-message-loss.test.ts   # main: 2 failed
git fetch origin pull/1699/head:pr1699-review &amp;&amp; git checkout pr1699-review;  git merge --no-commit 16ceb3a54 (9 conflicts) ; git merge --abort
pnpm exec turbo run build --filter=@bb/server;  vitest run (repro + PR tests + probes)
git fetch origin pull/1698/head:pr1698-review &amp;&amp; git checkout pr1698-review;  merge check (4 conflicts);  turbo run test --filter=@bb/cli --filter=@bb/sdk --filter=@bb/thread-view
git checkout 16ceb3a54;  vitest run repro (2 failed);  pnpm dev:stop</pre>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/1650.html").write_text(page)
print("wrote", len(page))
