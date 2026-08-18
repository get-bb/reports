#!/usr/bin/env python3
"""Assemble /tmp/bb-reports/issues/1656.html (embeds the repro test verbatim)."""
import html, pathlib

R = pathlib.Path("/tmp/bb-reports/issues/1656")
test_src = html.escape((R / "repro/issue-1656-repro.test.ts").read_text())
pr_diff_lines = (R / "pr1657.diff").read_text().count("\n")

BASE = "https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/"

def L(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="{BASE}{path}{frag}">{path.split("/")[-1]}{frag}</a>'

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1656 replies to mid-turn messages disappear when the turn completes</title>
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
  .pill.med {{ background:var(--warn); color:#fff; border-color:var(--warn); }}
  .verdict {{ font-weight:600; }}
  .v-yes {{ color:var(--high); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ color:var(--muted); font-size:13px; margin-top:6px; }}
  .sev-high {{ color:var(--high); font-weight:600; }} .sev-med {{ color:var(--warn); font-weight:600; }} .sev-low {{ color:var(--muted); font-weight:600; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1656 · Replies to mid-turn messages disappear from the timeline when the turn completes</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill med">Priority: Medium</span> <span class="pill">Effort: n/a (project fields not readable with this token)</span>
    <span class="pill">threads</span>
    <a href="https://github.com/get-bb/bb/issues/1656">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-yes">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: <a href="https://github.com/get-bb/bb/pull/1657">#1657</a> (REQUEST CHANGES)</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> While an agent turn is running, bb's thread page shows every assistant message as its own row. The moment the turn ends (<code>turn/completed</code>), the timeline is re-rendered in "summary" mode: the turn's work is folded into a collapsible <em>"Worked for …"</em> row and only certain assistant messages stay visible outside it. When a user sends a message to a running thread (a <em>steer</em>, the default mode of <code>bb thread tell</code> and of the composer), the turn is split into <em>segments</em> at that user row, and each segment keeps exactly one assistant message outside the fold: its <b>last</b> one.</p>
  <p>The reporter is right about what they see and I reproduced it live and in a unit test: the agent's direct answer to a steer ("Understood - read-only only.") is on screen while the turn runs, then vanishes into the "Worked for 34s" row as soon as the turn completes (screenshots below), because it was not the last assistant message of its segment. Answered <code>AskUserQuestion</code> cards and the message that asked the question fold in the same way, because those messages are neither ungroupable nor segment boundaries. Both are direct consequences of the completed-turn grouping rules in <code>packages/thread-view/src/completed-turn-grouping.ts</code>, deliberately introduced by <a href="https://github.com/get-bb/bb/pull/897">#897</a> ("keep each segment's last assistant/error message"). This is a design limitation of the summary view rather than a coding slip, and it is the same mechanism as <a href="https://github.com/get-bb/bb/issues/1355">#1355</a>. The issue's second bullet ("the final segment loses every message except the terminal because the final flush never preserves a terminal") is a misreading: the turn's terminal message is sliced out before grouping, so the last segment behaves exactly like an ordinary unsteered turn.</p>
  <p>Linked PR <a href="https://github.com/get-bb/bb/pull/1657">#1657</a> makes the reply after a user boundary visible, but it also changes the rendering of every ordinary <em>follow-up</em> turn (the first assistant message and the second-to-last assistant message pop out of the fold), contradicting its own description; I verified that on the real event log of my repro thread. It should not merge as is.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>While a turn runs, every assistant message is rendered individually</td><td class="ok">Verified</td><td><code>buildTurnRows</code> returns <code>convertMessage</code> for every message when the turn is not completed ({L("packages/thread-view/src/build-thread-timeline.ts",1163,1176)}); screenshot "running" below shows the reply and the numbers as separate rows.</td></tr>
    <tr><td>Direct reply to a mid-turn steer disappears from the top level on <code>turn/completed</code></td><td class="ok">Verified</td><td>Unit repro (fails on main, assertion at line 72) and live thread <code>thr_3qxpfum5zs</code>: "Understood - read-only only." visible while running, folded into "Worked for 34s" after completion (screenshots 2 and 3).</td></tr>
    <tr><td>Only the segment's last assistant message is preserved</td><td class="ok">Verified</td><td><code>flushGroupedMessages(true)</code> keeps <code>findLastTerminalTimelineMessage(segment)</code> only ({L("packages/thread-view/src/completed-turn-grouping.ts",188,213)}).</td></tr>
    <tr><td>"Every assistant message in the final segment except the turn's terminal message vanishes; the final flush never preserves a terminal"</td><td class="unv">Behavior true, diagnosis wrong</td><td>Intermediate messages of the last segment do fold, but that is identical to an unsteered turn: <code>splitCompletedTurnMessages</code> removes the turn's terminal message <em>before</em> grouping ({L("packages/thread-view/src/completed-turn-grouping.ts",108,143)}), so the final <code>flushGroupedMessages()</code> has nothing extra to preserve. Treating this as a separate defect leads PR #1657 to surface the <em>penultimate</em> message (finding 2 below).</td></tr>
    <tr><td>Answered <code>AskUserQuestion</code> cards and the report preceding them fold into the summary</td><td class="ok">Verified (unit level)</td><td>Scenario B on main: running view shows <code>assistant: Audit complete. Which changes…</code> and <code>work(question)</code>; completed view is <code>user, turn-summary(count=6), assistant: Final runbook.</code> (<a href="1656/scenarios-main.log">scenarios-main.log</a>). <code>user-question-lifecycle</code> is not in <code>isTimelineUngroupableMessage</code> ({L("packages/thread-view/src/timeline-message-helpers.ts",19,29)}). Not exercised with a live provider.</td></tr>
    <tr><td>Content is still reachable by expanding the summary row</td><td class="ok">Verified</td><td>Screenshot 4: expanding "Worked for 34s" reveals "Understood - read-only only." as its first child.</td></tr>
    <tr><td>Deterministic; depends only on the reply not being the last message of its segment</td><td class="ok">Verified</td><td>Scenario C (steer answered by a single message after tools) keeps the reply visible; the repro fixture (reply followed by more assistant text) hides it. Same in three live attempts.</td></tr>
    <tr><td>Sending a message to a running thread defaults to steer</td><td class="ok">Verified</td><td><code>bb thread tell --help</code>: <code>--mode &lt;mode&gt; Message mode: steer (default), queue, or auto</code>.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18) in worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-13</code>. Not fixed on <code>origin/main</code> (<code>a108fa7ef</code>): no commit after the base touches <code>completed-turn-grouping.ts</code> or <code>timeline-message-helpers.ts</code>.</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, provider <code>claude-code</code> (Claude Code 2.1.234, model Opus 5), codex-cli 0.147.0 not used.</li>
    <li>Dev instance: app <code>http://localhost:11579</code>, server <code>http://localhost:19579</code>, host daemon <code>:27579</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-13-16091f43bc55</code>. Project <code>proj_haaz26xrzy</code> (local path <code>/tmp/bb-1656-qa</code>, host <code>host_p8dftbfcbg</code>). Repro thread <code>thr_3qxpfum5zs</code>; earlier attempts <code>thr_3qfymfks8h</code>, <code>thr_pfp3ymb88c</code>, <code>thr_q9xpuy7mzd</code> (claude-code ended the turn right after the steer, so no message followed the reply; kept for the record).</li>
    <li>Screenshots taken with <code>dev-browser --headless</code> (Chromium 1280×1000/1100).</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. Unit-level (deterministic, no provider needed)</h3>
  <p>The test builds one provider turn with the shared timeline harness: user prompt → "Starting the audit." → tool → <b>steer</b> → "Understood - read-only only." → tool → "Login works." → "Audit complete. Nothing was changed." → "Final runbook.", renders it once without and once with <code>turn/completed</code>, and asserts the steer reply is a top-level row in both. File: <a href="1656/repro/issue-1656-repro.test.ts">1656/repro/issue-1656-repro.test.ts</a> (copy to <code>packages/thread-view/test/</code>).</p>
  <pre>{test_src}</pre>
  <pre>$ cp /tmp/bb-reports/issues/1656/repro/issue-1656-repro.test.ts packages/thread-view/test/
$ cd packages/thread-view &amp;&amp; pnpm exec vitest run test/issue-1656-repro.test.ts --disableConsoleIntercept
RUNNING:
  user: Check my router setup
  assistant: Starting the audit.
  work
  user: explore but do not apply changes
  assistant: Understood - read-only only.
  work
  assistant: Login works.
  assistant: Audit complete. Nothing was changed.
  assistant: Final runbook.
COMPLETED:
  user: Check my router setup
  turn-summary(count=1)
  assistant: Starting the audit.
  user: explore but do not apply changes
  turn-summary(count=4)
  assistant: Final runbook.
     × shows the same assistant rows before and after turn/completed 19ms
AssertionError: expected [ 'user: Check my router setup', …(5) ] to include 'assistant: Understood - read-only onl…'
     72|     expect(done).toContain("assistant: Understood - read-only only.");</pre>
  <p><b>Expected:</b> the reply to the steer stays a top-level row after completion. <b>Actual:</b> it is one of the four messages inside <code>turn-summary(count=4)</code>. Full log: <a href="1656/repro-main.log">repro-main.log</a>. Note also that segment 0 renders <em>summary then "Starting the audit."</em> although the assistant said that before running the tool: preserved terminals are always emitted after their segment's summary.</p>

  <h3>B. Live, in the app (claude-code)</h3>
  <ol>
    <li><code>scripts/bb-dev-app current</code>, then <code>export BB_SERVER_URL=&lt;Server URL&gt;</code>; unset <code>BB_THREAD_ID</code>/<code>BB_PROJECT_ID</code> if you run inside a bb thread (otherwise <code>tell</code> fails with <code>HTTP 400: Sender thread is invalid</code>).</li>
    <li>Create a scratch repo and project: <code>git init /tmp/bb-1656-qa</code> (+ one commit); <code>curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/bb-1656-qa","hostId":"&lt;bb machine list id&gt;"}}}}'</code>.</li>
    <li>Spawn a turn that emits many assistant messages slowly:
<pre>node packages/scripts/dist/commands/run-cli.js thread spawn --project proj_haaz26xrzy --provider claude-code \\
  --permission-mode full --title "issue 1656 repro 4" --json --prompt "Count from 1 to 12. For each number: first run the shell command python3 -c 'import time; time.sleep(4)' in the foreground, then send a separate assistant text message containing only the number. If I send you a message while you are counting, acknowledge it in its own assistant text message and then keep counting until 12. After 12, reply with exactly: Final runbook."</pre></li>
    <li>About 30 s later, while it is counting, steer it (default mode):
<pre>node packages/scripts/dist/commands/run-cli.js thread tell thr_3qxpfum5zs "Explore only, do not apply changes. Acknowledge with exactly: Understood - read-only only." --mode steer
Thread thr_3qxpfum5zs steered</pre></li>
    <li>Open <code>http://localhost:11579/projects/proj_haaz26xrzy/threads/thr_3qxpfum5zs</code> and watch the reply appear, then watch it disappear when the turn completes.</li>
  </ol>
  <figure><img src="assets/1656-running-before-steer.png" alt="Running turn right after the steer"><figcaption>1. Turn still running (stop button, "Working…"): the steer row, the agent's reply "Understood - read-only only." and "6" are all separate top-level rows.</figcaption></figure>
  <figure><img src="assets/1656-running-after-steer.png" alt="Running turn a few seconds later"><figcaption>2. A few seconds later, still running: the reply remains visible above the continued counting (7…10).</figcaption></figure>
  <figure><img src="assets/1656-completed-collapsed.png" alt="Completed turn: reply folded into Worked for 34s"><figcaption>3. The same thread after <code>turn/completed</code>: the turn is now "Worked for 35s / 5 / Steer / Worked for 34s / 12 Final runbook." The reply "Understood - read-only only." is gone from the top level; only the last message of each segment ("5" and "12 / Final runbook.") survived. Look at the gap between the steer bubble and "Worked for 34s".</figcaption></figure>
  <figure><img src="assets/1656-completed-expanded.png" alt="Expanded Worked for row shows the reply"><figcaption>4. Expanding "Worked for 34s" (<a href="1656/repro/expand-summary.js">expand-summary.js</a>) shows the reply as the first child of the fold, followed by 6…11 and the tool runs. Nothing is lost, it is just hidden.</figcaption></figure>
  <p>The CLI shares the row builder, so <code>bb thread log</code> shows the same shape (<code>── Worked for (34s) ──</code> directly after the steer). Event log of the thread: <a href="1656/repro/issue-1656-live-events.json">issue-1656-live-events.json</a>; replaying it through the harness (<a href="1656/repro/issue-1656-live-replay.test.ts">issue-1656-live-replay.test.ts</a>) prints on main:</p>
  <pre>LIVE COMPLETED:
  user: Count from 1 to 12. For each number: first run the shell com
  turn-summary(count=11)
  assistant: 5
  user: Explore only, do not apply changes. Acknowledge with exactly
  turn-summary(count=12)
  assistant: 12 Final runbook.
  user: Follow-up task. Send these as SEPARATE assistant text messag
  turn-summary(count=2)
  assistant: Middle note. Follow-up done.</pre>
  <p>(The third block is a later plain follow-up turn used to test PR #1657, see below.)</p>

  <h2>Root cause</h2>
  <p><b>Where the fold is decided.</b> For a completed turn, <code>buildTurnRows</code> calls <code>groupCompletedTurnMessages</code> ({L("packages/thread-view/src/build-thread-timeline.ts",1183,1198)}). That function first slices the turn's single <em>terminal</em> message (the last <code>assistant-text</code>/<code>error</code> of the whole turn, computed in <code>applyTurnMessageDetail</code>, {L("packages/thread-view/src/apply-turn-message-detail.ts",107,110)}) out of the list ({L("packages/thread-view/src/completed-turn-grouping.ts",108,143)}), and passes the rest to <code>groupCompletedTurnSummaryMessages</code> ({L("packages/thread-view/src/completed-turn-grouping.ts",145,249)}).</p>
  <p><b>Segments and the one-survivor rule.</b> Inside that function every <em>ungroupable</em> message (a user message that is not an agent/system steer, a legacy user message, a debug raw event; {L("packages/thread-view/src/timeline-message-helpers.ts",19,29)}) is emitted as its own row and closes the current segment. When the closer is a human message, the segment is flushed with <code>preserveLastTerminalMessage = true</code>, which pulls exactly one message, <code>findLastTerminalTimelineMessage(segment)</code>, out of the summary group; every other assistant message stays inside <code>sourceMessages</code> of the summary item:</p>
  <pre>function flushGroupedMessages(preserveLastTerminalMessage = false): void {{
  …
  // Human follow-ups split one provider turn into multiple visible exchange
  // segments. Keep each segment's last assistant/error message beside the
  // user row instead of burying it inside that segment's collapsed summary.
  const terminalMessage = preserveLastTerminalMessage
    ? findLastTerminalTimelineMessage(sourceMessages)
    : undefined;
  if (!terminalMessage) {{ appendSummaryGroup(sourceMessages); return; }}
  appendSummaryGroup(sourceMessages.filter((message) =&gt; message.id !== terminalMessage.id));
  items.push({{ kind: "ungrouped-message", message: terminalMessage }});
}}
…
for (const message of summaryMessages) {{
  flushExternalBoundariesBefore(message);
  if (isTimelineUngroupableMessage(message)) {{
    flushGroupedMessages(message.kind === "user" &amp;&amp; message.initiator === "user");
    items.push({{ kind: "ungrouped-message", message }});
    continue;
  }}
  groupedMessages.push(message);
}}
…
flushGroupedMessages();   // last segment: its terminal was already sliced out above</pre>
  <p>({L("packages/thread-view/src/completed-turn-grouping.ts",188,247)}.) So for the steer segment <code>[Understood, tool, Login works, Audit complete]</code> the survivor is "Audit complete"; "Understood" is grouped. That rule was introduced on purpose by <a href="https://github.com/get-bb/bb/pull/897">#897</a> ("Preserve agent messages around timeline steers"), whose description states the intended shape: <em>user message → collapsed work summary → last agent message → next user message</em>. The issue is therefore a limitation of that design, not a regression: the fold rule optimises for "one final answer per exchange" and has no notion of "the reply the user already read".</p>
  <p><b>Why AskUserQuestion folds too.</b> <code>user-question-lifecycle</code> messages are groupable (not in <code>isTimelineUngroupableMessage</code>) and answering a question is not a segment boundary, so the question card and the report before it are ordinary summary members (scenario B: <code>turn-summary(count=6)</code>).</p>
  <p><b>Why the symptom is jarring.</b> The running view uses no grouping at all (<code>buildTurnRows</code> early return), so the transition running → completed can remove rows that were on screen seconds earlier. Same mechanism as <a href="https://github.com/get-bb/bb/issues/1355">#1355</a> (text → tool → text turns show only the second text).</p>
  <p><b>Deeper issue found while testing.</b> The message that starts a turn is not always inside the turn's message list: for the <em>first</em> (spawn) turn of my live threads the user prompt is a separate <code>projected-message</code> entry (turn messages start with the first assistant text), whereas for a follow-up turn started with <code>bb thread tell</code> on an idle thread the user message is the first element of <code>turn.messages</code> (<code>user(initiator=user), assistant-text, command, assistant-text</code>; <a href="1656/live-replay-main.log">live-replay-main.log</a>, "LIVE turn messages"). Any grouping rule keyed on "user input boundary" therefore behaves differently for the first turn and for follow-ups; the fast path at {L("packages/thread-view/src/completed-turn-grouping.ts",149,164)} ("no external boundaries and no ungroupable messages → one summary") is <em>not</em> taken for follow-up turns. This is what trips PR #1657.</p>

  <h2>Proposed fix (first principles)</h2>
  <p>The mechanism is clear (confidence high); which rule to adopt is a product decision, so two options, in order of preference:</p>
  <ol>
    <li><b>Make the fold collapse only work, never conversation.</b> In <code>groupCompletedTurnSummaryMessages</code>, emit every top-level <code>assistant-text</code>/<code>error</code> message (not legacy, no parent tool call) as <code>ungrouped-message</code> in source order and let each run of tool/operation activity between them be its own summary group; treat answered <code>user-question-lifecycle</code> messages as ungrouped rows as well. This makes the running and completed views agree, fixes this issue and #1355 with one rule, and removes the segment-boundary special-casing (and the summary-before-terminal ordering artefact). Risks: turns with many short status texts (Codex emits them) get more rows; closed PR <a href="https://github.com/get-bb/bb/pull/1508">#1508</a> tried this behind a preference and its review flagged a 1500-row / 461 KB timeline page and the 200-row completed-timeline cache limit, so cap it (e.g. still fold assistant texts shorter than N chars that are immediately followed by tool activity, or page). Consumers to update: <code>completed-turn-summary-rendering.test.ts</code>, CLI <code>bb thread log</code> snapshots, app row tests. No server↔daemon wire change (thread-view runs on server and app; no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump), but the timeline row cache keyed by shape may need invalidation.</li>
    <li><b>Minimal, rule-preserving variant</b> (if the one-answer-per-exchange shape must stay): additionally preserve the first assistant/error message that follows a <em>mid-turn</em> user input (accepted steer, external human boundary, answered question) — i.e. what #1657 intends — but (a) do not arm it for the message that started the turn (it must not fire for the initial user row of a follow-up turn), (b) do not change the final <code>flushGroupedMessages()</code> (the turn terminal is already preserved), and (c) cover with fixtures shaped like real follow-up turns (user message inside <code>turn.messages</code>) and like spawn turns (user message outside). Also make answered questions ungroupable boundaries so the report before them survives.</li>
  </ol>

  <h2>PR review</h2>
  <h3><a href="https://github.com/get-bb/bb/pull/1657">#1657</a> · Keep mid-turn user exchanges visible after a turn completes · verdict: <span class="no">REQUEST CHANGES</span></h3>
  <p><b>What it changes</b> (<a href="1656/pr1657.diff">pr1657.diff</a>, {pr_diff_lines} lines, <code>packages/thread-view</code> only): (1) a <code>preserveNextTerminalMessage</code> flag, armed after every user-input boundary (external boundary, user message, answered question), that pops the next assistant/error message out of the fold; (2) the final flush becomes <code>flushGroupedMessages(true)</code>; (3) answered <code>user-question-lifecycle</code> messages become ungroupable and boundaries (<code>isTimelineUserInputBoundaryMessage</code>); (4) one existing expectation rewritten and a new test file. Applied cleanly on <code>16ceb3a54</code>; <code>turbo run test --filter=@bb/thread-view</code>: 24 files / 383 tests pass (<a href="1656/pr-tests-thread-view.log">log</a>); typecheck passes (<a href="1656/pr-typecheck.log">log</a>). It does fix the reported symptom: my repro test passes with it (<a href="1656/repro-pr1657.log">repro-pr1657.log</a>).</p>
  <p><b>Does it address the root cause?</b> Partly. It patches the one-survivor rule with a second survivor rather than reconsidering the rule, and it does so on the wrong premise for point (2) (see claim table: the last segment's terminal is already preserved). It also changes rendering far beyond turns with mid-turn input.</p>
  <table>
    <tr><th>#</th><th>Severity</th><th>Where</th><th>Finding</th></tr>
    <tr><td>1</td><td class="sev-high">High</td><td><code>completed-turn-grouping.ts</code> lines 234–246 and 264 (PR numbering)</td><td><b>Regresses every ordinary follow-up turn.</b> The PR description says "Turns without mid-turn user input keep the existing single-summary collapse", but the initial user message of a <code>tell</code>-started turn is inside <code>turn.messages</code> and is a user-input boundary, so the flag arms and the first assistant message pops out; the final <code>flushGroupedMessages(true)</code> then also pops the penultimate one. Real data (turn 3 of <code>thr_3qxpfum5zs</code>, no steer): main renders <code>user, turn-summary(count=2), assistant: Middle note. Follow-up done.</code>; with the PR: <code>user, assistant: Starting follow-up., turn-summary(count=1), assistant: Middle note. Follow-up done.</code> (<a href="1656/live-replay-main.log">main</a> vs <a href="1656/live-replay-pr1657.log">PR</a>). Synthetic scenario A (unsteered, 4 assistant texts): main <code>user, turn-summary(count=4), Final runbook.</code>; PR <code>user, Starting the audit., turn-summary(count=2), Audit complete., Final runbook.</code> (<a href="1656/scenarios-main.log">main</a> / <a href="1656/scenarios-pr1657.log">PR</a>). No test in the PR covers an unsteered turn; the new file only asserts on the steered/questioned fixtures.</td></tr>
    <tr><td>2</td><td class="sev-med">Medium</td><td><code>completed-turn-grouping.ts</code> line 264 (<code>flushGroupedMessages(true)</code>)</td><td>Built on the refuted claim. Because the turn terminal is sliced first, preserving "the last terminal of the remaining messages" surfaces the <em>second-to-last</em> assistant message, producing two consecutive answer rows at the end of steered turns ("Audit complete." + "Final runbook.", and "11" + "12 Final runbook." on the live log) while unsteered turns keep one. The rewritten expectation in <code>completed-turn-grouping.test.ts</code> (legacy-user-message case) enshrines this.</td></tr>
    <tr><td>3</td><td class="sev-med">Medium</td><td><code>timeline-message-helpers.ts</code> lines 28–44</td><td>Answered questions become ungroupable, which also drops them from <code>summaryCount</code> (<code>isTimelineSummaryCountedMessage</code>) and from the "Worked for" duration bounds; <code>permission-grant-lifecycle</code>, the sibling user interaction, is left grouped, so a turn with a permission prompt and a turn with a question now render differently. Reasonable direction, but it should be a deliberate, symmetric decision with a test on the summary count/duration.</td></tr>
    <tr><td>4</td><td class="sev-low">Low</td><td>tests</td><td>The steer test asserts <code>not.toContain("Login works.")</code> but does not assert the fate of "Starting the audit." (which the PR pops out — the fixture is follow-up-shaped) nor that an unsteered turn is unchanged; the description's central claim is untested. The behavior split between spawn turns and follow-up turns (user message outside vs inside <code>turn.messages</code>) is not acknowledged.</td></tr>
    <tr><td>5</td><td class="sev-low">Info</td><td>—</td><td>No casts, no boundary crossing, no daemon protocol impact (thread-view is server/app only). Prettier/format not checked.</td></tr>
  </table>
  <p><b>Tests run:</b> PR applied to worktree; <code>pnpm exec turbo run test --filter=@bb/thread-view --force</code> (383 pass); <code>pnpm exec turbo run typecheck --filter=@bb/thread-view</code>; my repro test (passes with PR); scenario tests A–D and the live-log replay on both main and PR (logs linked above).</p>
  <p><b>Verdict: REQUEST CHANGES.</b> Keep the intent (reply after mid-turn input stays visible; answered questions are boundaries) but arm the flag only for mid-turn boundaries, drop the <code>flushGroupedMessages(true)</code> final flush, add an unsteered-follow-up-turn regression test, and state the intended rule in the PR description; or replace with option 1 above.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1355">#1355</a>: with a Stop hook most assistant text hides inside "Worked for" — same one-survivor rule, different trigger (report: <a href="1355.html">1355.html</a>).</li>
    <li><a href="https://github.com/get-bb/bb/pull/897">#897</a> (merged): introduced per-segment terminal preservation, the rule this issue is about.</li>
    <li><a href="https://github.com/get-bb/bb/pull/1508">#1508</a> (closed sweep PR): tried "show all assistant messages" behind a preference; its review notes on row-count/cache limits apply to option 1.</li>
    <li><a href="https://github.com/get-bb/bb/pull/320">#320</a>: original split of completed-turn summaries at user boundaries.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1650">#1650</a>: AskUserQuestion-related timeline/blocking behavior (adjacent area).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
  <pre>gh issue view 1656 --repo get-bb/bb --json title,labels,body,comments
gh pr view 1657; gh pr diff 1657 &gt; /tmp/bb-reports/issues/1656/pr1657.diff
git fetch origin main; git log 16ceb3a54..origin/main --oneline -- packages/thread-view/src/completed-turn-grouping.ts packages/thread-view/src/timeline-message-helpers.ts   # empty
pnpm install --frozen-lockfile --prefer-offline; pnpm exec turbo run build
cp /tmp/bb-reports/issues/1656/repro/*.test.ts packages/thread-view/test/
cd packages/thread-view &amp;&amp; pnpm exec vitest run test/issue-1656-repro.test.ts --disableConsoleIntercept        # fails on main
cd packages/thread-view &amp;&amp; pnpm exec vitest run test/issue-1656-scenarios.test.ts --disableConsoleIntercept    # scenarios A–D
git apply /tmp/bb-reports/issues/1656/pr1657.diff   # PR on; re-run both; then git stash to go back to main
pnpm exec turbo run test --filter=@bb/thread-view --force; pnpm exec turbo run typecheck --filter=@bb/thread-view
scripts/bb-dev-app current; export BB_SERVER_URL=http://localhost:19579; unset BB_THREAD_ID BB_PROJECT_ID BB_ENVIRONMENT_ID
node packages/scripts/dist/commands/run-cli.js machine list
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/bb-1656-qa","hostId":"host_p8dftbfcbg"}}}}'
node packages/scripts/dist/commands/run-cli.js thread spawn --project proj_haaz26xrzy --provider claude-code --permission-mode full --title "issue 1656 repro 4" --json --prompt "Count from 1 to 12 …"
node packages/scripts/dist/commands/run-cli.js thread tell thr_3qxpfum5zs "Explore only, do not apply changes. Acknowledge with exactly: Understood - read-only only." --mode steer
dev-browser --browser bb1656 --headless run /tmp/bb-reports/issues/1656/repro/watch-thread.js   # 2 s polling screenshots while running
dev-browser --browser bb1656 --headless run /tmp/bb-reports/issues/1656/repro/shot-thread.js    # completed view
dev-browser --browser bb1656 --headless run /tmp/bb-reports/issues/1656/repro/expand-summary.js # expanded fold
curl -s "$BB_SERVER_URL/api/v1/threads/thr_3qxpfum5zs/events?limit=300" &gt; /tmp/bb-reports/issues/1656/thread-thr_3qxpfum5zs-events.json
node packages/scripts/dist/commands/run-cli.js thread tell thr_3qxpfum5zs "Follow-up task. Send these as SEPARATE assistant text messages …"   # idle → plain follow-up turn
pnpm dev:stop</pre>
  <h3>Scenario outputs on main (<a href="1656/scenarios-main.log">scenarios-main.log</a>)</h3>
  <pre>A COMPLETED (unsteered):
  user: Check my router setup
  turn-summary(count=4)
  assistant: Final runbook.
B RUNNING:
  user: Audit the router
  assistant: Let me look.
  work(command)
  assistant: Audit complete. Which changes should I include?
  work(question)
  work(command)
  assistant: Applied all.
  assistant: Final runbook.
B COMPLETED:
  user: Audit the router
  turn-summary(count=6)
  assistant: Final runbook.
C COMPLETED:
  user: Check my router setup
  turn-summary(count=1)
  user: explore but do not apply changes
  turn-summary(count=1)
  assistant: Only reply.
  work(command)
D turn messages: user(initiator=user), assistant-text, command, assistant-text</pre>
  <h3>Same scenarios with PR #1657 applied (<a href="1656/scenarios-pr1657.log">scenarios-pr1657.log</a>)</h3>
  <pre>A COMPLETED (unsteered):
  user: Check my router setup
  assistant: Starting the audit.
  turn-summary(count=2)
  assistant: Audit complete.
  assistant: Final runbook.
B COMPLETED:
  user: Audit the router
  assistant: Let me look.
  turn-summary(count=1)
  assistant: Audit complete. Which changes should I include?
  work(question)
  turn-summary(count=1)
  assistant: Applied all.
  assistant: Final runbook.
C COMPLETED:
  user: Check my router setup
  turn-summary(count=1)
  user: explore but do not apply changes
  turn-summary(count=1)
  assistant: Only reply.
  work(command)</pre>
  <h3>Live log replay with PR #1657 (<a href="1656/live-replay-pr1657.log">live-replay-pr1657.log</a>)</h3>
  <pre>LIVE COMPLETED:
  user: Count from 1 to 12. For each number: first run the shell com
  turn-summary(count=11)
  assistant: 5
  user: Explore only, do not apply changes. Acknowledge with exactly
  assistant: Understood - read-only only. 6
  turn-summary(count=10)
  assistant: 11
  assistant: 12 Final runbook.
  user: Follow-up task. Send these as SEPARATE assistant text messag
  assistant: Starting follow-up.
  turn-summary(count=1)
  assistant: Middle note. Follow-up done.
LIVE projected-message: user
LIVE turn messages: assistant-text, command, … user(initiator=user), assistant-text, command, … assistant-text
LIVE turn messages: user(initiator=user), assistant-text, command, assistant-text</pre>
  <h3>Event skeleton of the live repro turn (seq / type / turn)</h3>
  <pre>45 item/completed btfadef95e-4-1  agentMessage "5"
47 client/turn/requested          source=tell initiator=user  (the steer)
48 turn/input/accepted btfadef95e-4-1 clientRequestId=creq_kv5t9t6w3y
51 item/completed btfadef95e-4-1  commandExecution python3 -c 'import time; time.sleep(4)'
55 item/completed btfadef95e-4-1  agentMessage "Understood - read-only only.\\n\\n6"
59 … 94                            alternating commandExecution / agentMessage "7" … "11"
98 item/completed btfadef95e-4-1  agentMessage "12\\n\\nFinal runbook."
101 turn/completed btfadef95e-4-1 status=completed</pre>
  <h3>Other artifacts</h3>
  <ul>
    <li><a href="1656/repro/issue-1656-scenarios.test.ts">issue-1656-scenarios.test.ts</a>, <a href="1656/repro/issue-1656-live-replay.test.ts">issue-1656-live-replay.test.ts</a> (needs <code>issue-1656-live-events.json</code> next to it in <code>packages/thread-view/test/</code>)</li>
    <li><a href="1656/repro/watch-thread.js">watch-thread.js</a>, <a href="1656/repro/shot-thread.js">shot-thread.js</a>, <a href="1656/repro/expand-summary.js">expand-summary.js</a> (dev-browser scripts; edit thread/project ids)</li>
    <li><a href="1656/thread-thr_3qfymfks8h-events.json">thread-thr_3qfymfks8h-events.json</a> (first attempt: steer landed after the turn had ended → became its own turn)</li>
    <li><a href="1656/devapp.log">devapp.log</a>, <a href="1656/build.log">build.log</a>, <a href="1656/install.log">install.log</a></li>
  </ul>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/1656.html").write_text(page)
print("wrote", len(page))
