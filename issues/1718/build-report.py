#!/usr/bin/env python3
"""Builds /tmp/bb-reports/issues/1718.html from the repro artifacts (escapes <pre> content)."""
import html, pathlib, re

R = pathlib.Path("/tmp/bb-reports/issues/1718/repro")
OUT = pathlib.Path("/tmp/bb-reports/issues/1718.html")
BASE = "16ceb3a540f81c1189efaffb27a39b1d9443abf5"
GH = f"https://github.com/get-bb/bb/blob/{BASE}/"

def e(s): return html.escape(s)
def f(name, start=None, end=None, strip_ansi=True, maxcol=None):
    t = (R / name).read_text()
    if strip_ansi: t = re.sub(r"\x1b\[[0-9;]*m", "", t)
    lines = t.splitlines()
    if start is not None or end is not None: lines = lines[start:end]
    if maxcol: lines = [l[:maxcol] for l in lines]
    return e("\n".join(lines))
def link(path, l1, l2=None, text=None):
    frag = f"#L{l1}" + (f"-L{l2}" if l2 else "")
    return f'<a href="{GH}{path}{frag}">{text or (path.split("/")[-1] + frag)}</a>'

# selected event ranges from the idle run (bug) and the fixed run
def events_from(name, first_seq, last_seq=None, maxcol=175):
    out = []
    seen = set()
    for l in (R / name).read_text().splitlines():
        m = re.match(r"^(\d+)\t", l)
        if not m: continue
        seq = int(m.group(1))
        if seq < first_seq or (last_seq and seq > last_seq) or seq in seen: continue
        seen.add(seq); out.append(l[:maxcol])
    return e("\n".join(out))

sdk_bug = f("1718-sdk-resume.out")
sdk_bug = "\n".join(l for l in sdk_bug.splitlines() if "thinking_tokens" not in l)

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1718 claude-code: message after stopping a thread with backgrounded work is dropped</title>
<style>
  :root {{ --canvas:#fafaf8; --ink:#1a1a1a; --muted:#666; --line:#e2e2de; --accent:#0052cc; --high:#b60205; --ok:#0e8a16; --warn:#b26a00; --med:#d4a017; }}
  body {{ margin:0; background:var(--canvas); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; }}
  main {{ max-width:900px; margin:0 auto; padding:40px 24px 80px; }}
  h1 {{ font-size:26px; line-height:1.25; margin:0 0 6px; }}
  h2 {{ font-size:18px; margin:36px 0 10px; padding-top:20px; border-top:1px solid var(--line); }}
  h3 {{ font-size:15px; margin:22px 0 6px; }}
  .meta {{ color:var(--muted); font-size:14px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }}
  .pill {{ display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); }}
  .pill.high {{ background:var(--high); color:#fff; border-color:var(--high); }}
  .pill.medium {{ background:var(--med); color:#fff; border-color:var(--med); }}
  .verdict {{ font-weight:600; }}
  .v-repro {{ color:var(--high); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1718 · claude-code: user message sent after stopping a thread with backgrounded work is dropped</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill medium">Medium</span> <span class="pill">Effort: Small</span>
    <span class="pill">providers</span> <span class="pill">provider-claude-code</span>
    <a href="https://github.com/get-bb/bb/issues/1718">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>{BASE}</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> A bb thread run by the <code>claude-code</code> provider is a Claude Code CLI process driven through the Claude Agent SDK. Claude can start a shell command "in the background" (<code>run_in_background</code>); such a task belongs to the CLI process, not to bb. <code>bb thread stop</code> closes that CLI process (bb waits at most 4&nbsp;s and then aborts it, which is what happens while a background task is alive). The next message reopens the conversation with the SDK's <code>resume</code> and pushes the new prompt right away. bb groups everything a provider emits into <em>turns</em>: the user's accepted message (<code>turn/input/accepted</code>) is attached to the first turn that opens after it, and the provider's terminal <code>result</code> message closes the turn.</p>
  <p><b>What happens.</b> Claude Code CLI 2.1.234 does something new on resume when the previous process died with a background shell task still running: at startup it synthesises a <code>&lt;task-notification status=stopped&gt;</code> ("No completion record was found for this background shell command from the previous session…"), commits it to the transcript <em>without calling the model</em>, and emits a <code>result</code> message with <code>num_turns: 0</code>, zero usage and <code>origin: {{ kind: "task-notification" }}</code> — before it processes the prompt bb just pushed. bb's translator (<a href="{GH}plugins/provider-claude-code/src/event-translation.ts#L1365">event-translation.ts#L1365</a>, via <code>resolveProviderTerminalTurn</code> introduced by #1432) sees "a <code>result</code> arrived and a user message is pending" and opens-and-immediately-closes the user's turn: <code>turn/started → turn/input/accepted → tokenUsage(0) → turn/completed</code>, no items. The thread reads <code>idle</code>, <code>bb thread wait --status idle</code> returns, and one to five seconds later the model's real answer arrives in a turn that has no user input attached ("unsolicited"). The model does see the new prompt (in 3/3 of my runs it answered it correctly); the message is not lost at the provider, but from bb's point of view the request settled empty and the answer belongs to nothing — which is what waiters, parent threads and the reporter observed. Whether the model then answers the previous question or the new one is up to the model (the "stopped" notification sits in its context right before the new prompt).</p>
  <p><b>Regression status.</b> Reproduces 3/3 against base <code>16ceb3a54</code> with the CLI stopped while idle (release) and while active (interrupt), plus a bb-free reproduction driving the Agent SDK directly. It is <b>not</b> a #1640 regression: the translation is the same code that #1640 moved from <code>packages/agent-runtime/src/claude-code/translate-message.ts</code>. It <b>is</b> a regression from <a href="https://github.com/get-bb/bb/pull/1432">#1432</a> (2026-08-13, "Settle provider prompts that complete without starting a turn", fixes #1431), whose zero-work settlement is what consumes the pending user message on this result. Not fixed on <code>origin/main</code> (<code>a108fa7ef</code>) as of today.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Message sent after stopping a thread with backgrounded work produces an empty turn (<code>turn/started → input/accepted → turn/completed</code>, 0 tokens, no items)</td><td class="ok">Verified</td><td>Seq 20–23 of <code>thr_gmgcn5kqjd</code> (run "idle") and seq 24–27 of <code>thr_wieshz9ii2</code> (run "active"): exactly that sequence, with <code>thread/tokenUsage/updated</code> total 0. See Minimal reproduction.</td></tr>
    <tr><td>A later unsolicited turn arrives</td><td class="ok">Verified</td><td>Seq 24–31 (idle run): <code>turn/started</code> for a new turn id with no <code>turn/input/accepted</code>, carrying the assistant reply, 1–5&nbsp;s after the empty turn.</td></tr>
    <tr><td>The unsolicited turn "answered the previous question, not the new message"</td><td class="unv">Not reproduced as such</td><td>In all my runs the answer addressed the new prompt ("second"/"4"). The model's context contains the synthesized <em>stopped</em> notification immediately before the new prompt, so answering the old question is plausible model behaviour, but it is not what makes the turn empty. bb's turn structure is broken either way.</td></tr>
    <tr><td>Likely provider-level (claude-code background-task interaction)</td><td class="ok">Verified, with a bb half</td><td>The trigger is CLI behaviour on resume (bb-free SDK script shows the extra <code>result num_turns=0 origin=task-notification</code>). The <em>consequence</em> is bb's: <code>resolveProviderTerminalTurn</code> settles the pending user message on that result.</td></tr>
    <tr><td>Not reproduced against pre-#1640 main; may be a #1640 regression</td><td class="no">Refuted (pre-existing)</td><td>#1640 moved the <code>result</code> handling byte-for-byte from <code>translate-message.ts</code>; the consuming logic was added by #1432 on 2026-08-13 (diff shows the old guard <code>if (state.currentTurnId)</code> replaced by <code>resolveProviderTerminalTurn</code>). Before #1432 the empty result was ignored and the answer would have drained the pending input correctly.</td></tr>
    <tr><td>Where to look: stop/interrupt handling and session resume in <code>plugins/provider-claude-code/src/bridge/</code></td><td class="ok">Partly</td><td>Stop is fine (it is what orphans the task, by design: <code>closeGracefully</code> 4&nbsp;s then abort). The bug is in <code>src/event-translation.ts</code> (result → turn resolution), not in the bridge lifecycle.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, base commit), worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-7</code>; dev instance app <code>:12709</code>, server <code>:20709</code>, host daemon <code>:28709</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-7-e6d29a2dcff7</code>.</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, Claude Code CLI <code>2.1.234</code>, <code>@anthropic-ai/claude-agent-sdk</code> 0.3.197 (the version pinned by <code>plugins/provider-claude-code</code>). Model in bb runs: the default <code>claude-opus-5[1m]</code>; in the SDK script: <code>claude-sonnet-4-5</code>.</li>
    <li>Project <code>proj_wajvahc5ha</code> (local path <code>/tmp/1718-qa</code>, host <code>host_qjr6dszb9v</code>). Threads: <code>thr_kbtzibr84e</code> (manual first run), <code>thr_gmgcn5kqjd</code> (script, idle), <code>thr_wieshz9ii2</code> (script, active), <code>thr_uhjh8vbtdd</code> (script, idle, with proposed fix).</li>
    <li>CLI wrapper: <a href="1718/repro/1718-bb.sh">1718/repro/1718-bb.sh</a> (<code>BB_REPO=&lt;your worktree&gt;</code>; evaluates <code>scripts/bb-dev-app env</code>). Event dump: <a href="1718/repro/1718-events.sh">1718-events.sh</a>.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. End to end through bb (script)</h3>
  <ol>
    <li>Build and start your dev instance once: <code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code>. <code>claude</code> must be logged in on the machine.</li>
    <li>Create a scratch git repo and a project: <code>mkdir -p /tmp/1718-qa &amp;&amp; git -C /tmp/1718-qa init</code>; <code>curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/1718-qa","hostId":"&lt;id from bb machine list&gt;"}}}}'</code>.</li>
    <li>Run <a href="1718/repro/1718-repro.sh">1718/repro/1718-repro.sh</a>: <code>BB_REPO=&lt;worktree&gt; ./1718-repro.sh &lt;project id&gt; idle</code> (or <code>active</code>). It spawns a claude-code thread whose prompt backgrounds <code>sleep 120</code>, waits until the thread is idle (background task still running), runs <code>bb thread stop</code>, sends <code>SECOND_MSG: what is 2+2? …</code>, runs <code>bb thread wait --status idle</code>, and dumps the events twice (right when idle, and 25&nbsp;s later).</li>
  </ol>
  <p><b>Expected:</b> one new turn owning <code>SECOND_MSG</code>, its answer, and <code>turn/completed</code>; <code>bb thread wait --status idle</code> returns after the answer. <b>Actual</b> (<a href="1718/repro/1718-repro-idle.out">1718-repro-idle.out</a>, thread <code>thr_gmgcn5kqjd</code>): the user's turn <code>bt7391c9c4-4-1</code> is opened and closed empty at 07:23:55 (<code>wait</code> returns here); the answer "4" arrives at 07:23:56 in turn <code>bt7391c9c4-4-2</code> with no <code>turn/input/accepted</code>.</p>
  <pre>{f("1718-repro-idle.out", 0, 10)}
{events_from("1718-repro-idle.out", 16, 31)}</pre>
  <p>Same shape when the thread is <b>active</b> at stop time (interrupt): <a href="1718/repro/1718-repro-active.out">1718-repro-active.out</a>, thread <code>thr_wieshz9ii2</code>, empty turn <code>bt7391c9c4-6-1</code> at 07:24:51, unsolicited answer turn <code>bt7391c9c4-6-2</code> at 07:24:56 (5&nbsp;s of "idle" in between).</p>
  <pre>{events_from("1718-repro-active.out", 18, 28)}
…
39	07:24:56	turn/completed	bt7391c9c4-6-2	status completed</pre>
  <figure><img src="assets/1718-thread-after-bug-run.png" alt="Thread thr_gmgcn5kqjd in the app after the run"><figcaption>The app view of <code>thr_gmgcn5kqjd</code> after the bug run. Note there is nothing to see after the fact: the timeline renders the user message and the later "4" as if they were one exchange. The damage is in the turn structure (the request settled empty and idle a second before the answer), which is what waiters, parent threads and the reporter's event dump observe — this is not a rendering bug.</figcaption></figure>

  <h3>B. What Claude Code itself emits on resume (no bb)</h3>
  <p><a href="1718/repro/1718-sdk-resume.mjs">1718/repro/1718-sdk-resume.mjs</a> drives the Agent SDK exactly like the bridge (streaming input, <code>persistSession</code>, <code>resume</code>). Phase 1 backgrounds <code>sleep 120</code>, ends the input stream on <code>result</code> and aborts after 4&nbsp;s (= <code>SdkSession.closeGracefully</code>). Phase 2 resumes the same session id and pushes one prompt. Run it from the plugin dir so the SDK resolves: <code>cd plugins/provider-claude-code &amp;&amp; cp /tmp/bb-reports/issues/1718/repro/1718-sdk-resume.mjs . &amp;&amp; node ./1718-sdk-resume.mjs</code>. Output (<a href="1718/repro/1718-sdk-resume.out">1718-sdk-resume.out</a>, <code>thinking_tokens</code> lines removed):</p>
  <pre>{sdk_bug}</pre>
  <p>Two <code>result</code>s for one prompt. The first (07:20:26.463) has <code>num_turns=0</code>, zero usage, empty <code>result</code>, arrives 50&nbsp;ms after startup, right after two <code>system/task_notification status=stopped</code> and the first <code>system/init</code>; a second <code>system/init</code> then opens the loop that answers the prompt. Raw JSON of both results (<a href="1718/repro/1718-sdk-resume-raw.out">1718-sdk-resume-raw.out</a>) — the discriminator is <code>origin</code>:</p>
  <pre>{{"type":"result","subtype":"success","is_error":false,"duration_ms":35,"duration_api_ms":0,"num_turns":0,"result":"","stop_reason":null,
 "session_id":"2564d7f4-…","total_cost_usd":0,"usage":{{"input_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0,"output_tokens":0,…}},
 "modelUsage":{{}},"permission_denials":[],"fast_mode_state":"off",<b>"origin":{{"kind":"task-notification"}}</b>,"uuid":"f1d5e34c-…"}}

{{"type":"result","subtype":"success","is_error":false,"api_error_status":null,"duration_ms":2515,"duration_api_ms":2507,…,"num_turns":1,"result":"second","stop_reason":"end_turn",…}}   ← no origin</pre>
  <p>Controls: without a background task the resumed session emits exactly one result (<a href="1718/repro/1718-sdk-resume-control-nobg.out">control-nobg.out</a>, "total result messages: 1"). Pushing the prompt 8&nbsp;s after resume (<a href="1718/repro/1718-sdk-resume-delayed-push.out">delayed-push.out</a>) shows the empty result is emitted at startup regardless of the prompt (07:21:42.004, prompt pushed at 07:21:49): it is the CLI settling the orphaned task, not a reply to anything. The CLI's own transcript for the bb thread (<a href="1718/repro/1718-claude-transcript-thr_kbtzibr84e.txt">transcript summary</a>) shows the synthesized notification committed as a <code>user</code> message with <code>origin.kind = task-notification</code> at 07:18:33.586, then <code>SECOND_MSG</code> at 33.595, then one assistant reply.</p>

  <h3>C. Unit-level repro (fails on main)</h3>
  <p>File: <a href="1718/repro/issue-1718-resume-task-notification-result.test.ts">1718/repro/issue-1718-resume-task-notification-result.test.ts</a>. Copy to <code>plugins/provider-claude-code/src/</code> and run <code>cd plugins/provider-claude-code &amp;&amp; pnpm exec vitest run src/issue-1718-resume-task-notification-result.test.ts</code>. It replays the captured messages into the translator: a queued accepted user message, <code>system/task_notification(stopped)</code>, <code>system/init</code>, then the <code>origin: task-notification</code> result. First assertion that fails on main: the result produces <code>['turn/started','turn/input/accepted','thread/tokenUsage/updated','turn/completed']</code> — the user's turn is settled empty. Second test fails because the answer then lands in <code>turn-2</code> without the accepted input (<a href="1718/repro/1718-unit-test-main.out">1718-unit-test-main.out</a>).</p>
  <pre>{f("issue-1718-resume-task-notification-result.test.ts")}</pre>
  <pre>{f("1718-unit-test-main.out", 0, 12)}</pre>

  <h2>Root cause</h2>
  <p><b>1. bb's stop orphans the CLI's background task (by design).</b> <code>thread/stop</code> in the bridge closes the SDK session with <code>closeGracefully(THREAD_STOP_CLOSE_TIMEOUT_MS = 4000)</code> ({link("plugins/provider-claude-code/src/bridge/bridge.ts", 399)}, {link("plugins/provider-claude-code/src/bridge/bridge.ts", 1341)}; {link("plugins/provider-claude-code/src/bridge/sdk-session.ts", 336, 366)}): it ends the input stream and, if the CLI has not exited after 4&nbsp;s (it does not while a background shell task is alive — <code>bb thread stop</code> took 5&nbsp;s in every run), aborts the process. Claude Code therefore has a <code>task_started</code> in its transcript with no completion record. Backgrounded shell commands deliberately do not hold the bb turn open ({link("plugins/provider-claude-code/src/task-translation.ts", 102, 116)}), so the thread is idle while the task runs and a stop is a "release"; an interrupt during an active turn ends the same way.</p>
  <p><b>2. Claude Code settles orphaned tasks on resume with a zero-work result.</b> The next message makes the runtime <code>thread/resume</code> + <code>turn/start</code>; the bridge starts a new SDK session with <code>resume: providerThreadId</code> and queues the prompt in the same tick ({link("plugins/provider-claude-code/src/bridge/bridge.ts", 2257, 2300, "runTurnStart")}), and <code>emitCanonicalTurnInputAccepted</code> queues the accepted user message in translator state because no turn is open yet ({link("plugins/provider-claude-code/src/bridge/bridge.ts", 731, 757)}). Claude Code 2.1.234, on resume, enqueues a synthetic <code>&lt;task-notification status=stopped&gt;</code> for the orphaned task, records it as a user message (no model call), and emits <code>result {{ num_turns: 0, usage: 0, origin: {{ kind: "task-notification" }} }}</code> before opening the loop for the real prompt (section B).</p>
  <p><b>3. The translator settles the pending user turn on that result.</b> {link("plugins/provider-claude-code/src/event-translation.ts", 1355, 1372, "event-translation.ts#L1355-L1372")} calls <code>resolveProviderTerminalTurn</code>, which returns <code>state.currentTurnId ?? (pendingAcceptedUserMessages.length &gt; 0 ? ensureTurnStarted(…) : undefined)</code> ({link("packages/provider-bridge-protocol/src/bridge-kit/provider-terminal-turn.ts", 23, 34)}). With the user's message pending, it opens a turn (emitting <code>turn/started</code> and draining <code>turn/input/accepted</code>) and the same handler then pushes <code>thread/tokenUsage/updated</code> (zeros) and <code>turn/completed</code> ({link("plugins/provider-claude-code/src/event-translation.ts", 1436, 1456)}). That is the empty turn. When the model's answer streams in, <code>ensureTurnStarted</code> finds no pending input and opens a fresh, unsolicited turn.</p>
  <pre>{e('''// event-translation.ts (base) — the result handler cannot tell "the CLI closed its own
// task-notification loop" from "the CLI finished the user's prompt without work" (#1431):
const message = parsedMessage.data;
const turnId = resolveProviderTerminalTurn({ events, registry: args.turnState, state, threadId });
if (turnId) {
  …
  events.push({ type: "turn/completed", threadId, providerThreadId: "", scope: turnScope(turnId), status: failed ? "failed" : "completed", … });
  args.turnState.finishTurn({ state, threadId: stateKey });
}''')}</pre>
  <p><b>Why the visible symptom follows.</b> The server applies <code>turn/completed</code>: the thread flips to <code>idle</code>, waiters (<code>bb thread wait</code>, parent-thread completion notifications, queued-message drain) fire with a turn that has zero items and zero tokens, and the answer that follows is a turn nobody asked for. In the reporter's run the model additionally chose to talk about the previous task (the stopped notification is the last thing in its context before the new prompt), which made it look like the new message was ignored.</p>
  <p><b>History.</b> The consuming behaviour was introduced by #1432 (7c3d1ab76, 2026-08-13) which replaced <code>if (state.currentTurnId)</code> with <code>resolveProviderTerminalTurn</code> so that a locally handled <code>/clear</code> (bare success result, no activity) settles its turn instead of leaving the thread active forever (#1431). #1640 later moved the code verbatim into the plugin. The other ingredient (the CLI's orphaned-task settlement on resume) is CLI behaviour whose introduction date I cannot pin down; it exists in 2.1.234.</p>
  <p><b>Deeper issue.</b> Any resume of a claude-code session whose previous process died with a background shell task alive — not only <code>bb thread stop</code>: daemon restart, plugin update retiring the bridge, machine reboot, session replacement after construction-scoped settings change — will hit this on the next message. Side observation: the empty turn also emits <code>thread/tokenUsage/updated</code> with all-zero totals (seq 22/26 above), because token totals are per SDK session state.</p>

  <h2>Proposed fix (first principles)</h2>
  <p>The SDK already tells us whose loop a <code>result</code> closes: <code>SDKResultSuccess.origin?: SDKMessageOrigin</code> ("Absent or <code>human</code> means keyboard input from the user"; <code>{{ kind: "task-notification" }}</code> for background-task reinvocations, sdk.d.ts of 0.3.197). A task-notification result can never be the settlement of accepted user input, so it must not open a turn on behalf of pending input; it may still complete a turn that is already open (a live-session background task reinvoking the model, whose assistant messages opened an unsolicited turn). Diff against base: <a href="1718/repro/1718-proposed-fix.diff">1718/repro/1718-proposed-fix.diff</a>.</p>
  <pre>{f("1718-proposed-fix.diff")}</pre>
  <p>Verification: the two repro tests pass, the full plugin suite still passes (19 files, 263 tests incl. the #1431 zero-work and <code>conversation_reset</code> cases) and typecheck is clean (<a href="1718/repro/1718-plugin-suite-with-fix.out">1718-plugin-suite-with-fix.out</a>). Rebuilt and re-ran the end-to-end script with the fix in the dev instance (<a href="1718/repro/1718-repro-idle-with-fix.out">1718-repro-idle-with-fix.out</a>, thread <code>thr_uhjh8vbtdd</code>): one turn <code>bt0314961e-2-1</code> owns <code>turn/input/accepted</code>, the answer "4" and <code>turn/completed</code>; <code>bb thread wait --status idle</code> returned after the answer.</p>
  <pre>{events_from("1718-repro-idle-with-fix.out", 18, 28)}</pre>
  <figure><img src="assets/1718-thread-with-fix.png" alt="Thread thr_uhjh8vbtdd with the proposed fix"><figcaption><code>thr_uhjh8vbtdd</code> after the same script with the fix built in — visually identical to the bug run (as expected), the difference is in the events above.</figcaption></figure>
  <p>What could go wrong: (a) The fix relies on the CLI stamping <code>origin</code>; older CLIs that do not stamp it keep today's behaviour (no worse). (b) A live-session race remains: if a background task completes and reinvokes the model at the same moment a user prompt is accepted, the assistant message of the notification loop still drains the pending input into that turn — pre-existing and out of scope, but a full solution would also skip <code>drainAcceptedUserMessages</code> for loops that a task-notification <code>user</code> message (also stamped with <code>origin</code>) opened. (c) Not a wire change: translation happens inside the bridge/plugin, so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump. Alternative I rejected: dropping every <code>result</code> with <code>num_turns === 0</code> would break #1431 (its <code>/clear</code> result is also <code>num_turns: 0</code>).</p>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1431">#1431</a> / <a href="https://github.com/get-bb/bb/pull/1432">#1432</a>: <code>/clear</code> turn never settles — the zero-work settlement that now over-applies to the resume result.</li>
    <li><a href="https://github.com/get-bb/bb/pull/1640">#1640</a>: provider bridge protocol; the QA that surfaced this. Not the cause.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1584">#1584</a>: release vs interrupt semantics of <code>thread/stop</code> (referenced in <code>handleThreadStop</code>); both intents orphan a running background task.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1706">#1706</a>: queued thread messages "vanish" — a different mechanism, but the same class of symptom (a waiter observing idle before the real work).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
  <pre>{e('''# worktree /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-7, checked out at 16ceb3a54 (branch issue-1718-base)
pnpm install --frozen-lockfile --prefer-offline && pnpm exec turbo run build
scripts/bb-dev-app current                                  # app :12709, server :20709, daemon :28709
export BB_REPO=$PWD; BB=/tmp/bb-reports/issues/1718/repro/1718-bb.sh
$BB machine list --json                                     # host_qjr6dszb9v
mkdir -p /tmp/1718-qa && git -C /tmp/1718-qa init && …commit
curl -s -X POST http://localhost:20709/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/1718-qa","hostId":"host_qjr6dszb9v"}}'   # proj_wajvahc5ha
# manual first run (thr_kbtzibr84e)
$BB thread spawn --project proj_wajvahc5ha --provider claude-code --permission-mode accept-edits --title "1718 A" --prompt "Use the Bash tool with run_in_background set to true to run the command: sleep 120; echo BG_DONE. Once it is started in the background, reply with exactly the word: started. Do not wait for it and do not do anything else." --json
$BB thread stop thr_kbtzibr84e ; $BB thread tell thr_kbtzibr84e "SECOND_MSG: reply with exactly the word: second"
BB_SERVER_URL=http://localhost:20709 1718/repro/1718-events.sh thr_kbtzibr84e
jq -c … ~/.claude/projects/-tmp-1718-qa/e9136ce3-….jsonl        # CLI transcript
# scripted runs
1718/repro/1718-repro.sh proj_wajvahc5ha idle   > 1718-repro-idle.out     # thr_gmgcn5kqjd
1718/repro/1718-repro.sh proj_wajvahc5ha active > 1718-repro-active.out   # thr_wieshz9ii2
# bb-free SDK repro (from plugins/provider-claude-code)
node ./1718-sdk-resume.mjs > 1718-sdk-resume.out
REPRO_NO_BG=1 node ./1718-sdk-resume.mjs > 1718-sdk-resume-control-nobg.out
REPRO_PUSH_DELAY_MS=8000 node ./1718-sdk-resume.mjs > 1718-sdk-resume-delayed-push.out
REPRO_RAW=1 node ./1718-sdk-resume.mjs > 1718-sdk-resume-raw.out
# unit repro
cp 1718/repro/issue-1718-resume-task-notification-result.test.ts plugins/provider-claude-code/src/
cd plugins/provider-claude-code && pnpm exec vitest run src/issue-1718-resume-task-notification-result.test.ts   # 2 failed on main
# proposed fix
git apply 1718/repro/1718-proposed-fix.diff
pnpm exec turbo run test typecheck --filter=bb-plugin-provider-claude-code --force   # 263 passed
scripts/bb-dev-app current && 1718/repro/1718-repro.sh proj_wajvahc5ha idle > 1718-repro-idle-with-fix.out   # thr_uhjh8vbtdd
git checkout -- plugins/provider-claude-code/src   # worktree left pristine
pnpm dev:stop''')}</pre>
  <h3>Full event dump of the first manual run (thr_kbtzibr84e)</h3>
  <pre>{e('''21 07:18:29 item/backgroundTask/completed  (task:bahu2x1mc → status interrupted / taskStatus stopped, emitted by the stop)
22 07:18:30 client/turn/requested  creq_ke44su93nd  "SECOND_MSG: reply with exactly the word: second"
23 07:18:30 thread/identity        e9136ce3-165c-4784-b75f-60397f1c5cca
24 07:18:33 turn/started           bt7391c9c4-2-1
25 07:18:33 turn/input/accepted    bt7391c9c4-2-1  creq_ke44su93nd
26 07:18:33 thread/tokenUsage/updated bt7391c9c4-2-1  total 0 / last 0
27 07:18:33 turn/completed         bt7391c9c4-2-1  completed              ← empty turn
28 07:18:35 turn/started           bt7391c9c4-2-2                          ← unsolicited
29-31       agentMessage "second"  bt7391c9c4-2-2
35 07:18:36 turn/completed         bt7391c9c4-2-2  completed''')}</pre>
  <h3>Delayed-push SDK run (empty result at startup, prompt pushed 7 s later)</h3>
  <pre>{f("1718-sdk-resume-delayed-push.out", 14, None)}</pre>
</main></body></html>
"""
OUT.write_text(page)
print(OUT, len(page))
