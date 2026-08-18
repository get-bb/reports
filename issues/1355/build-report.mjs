import fs from "node:fs";
const R = "/tmp/bb-reports/issues/1355/repro/";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
const file = (n) => esc(strip(fs.readFileSync(R + n, "utf8")));
const P = "https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/";
const L = (path, a, b, label) => `<a href="${P}${path}#L${a}${b ? "-L" + b : ""}"><code>${label ?? path + ":" + a + (b ? "-" + b : "")}</code></a>`;

const eventTable = JSON.parse(fs.readFileSync(R + "thread-b-events.json", "utf8"))
  .map((e) => `${String(e.seq).padStart(3)}  ${e.type.padEnd(32)} ${e.data?.item?.type ?? ""}${e.data?.item?.text ? "  " + JSON.stringify(e.data.item.text.slice(0, 70)) : ""}`)
  .join("\n");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1355 assistant text hidden inside "Worked for"</title>
<style>
  :root { --canvas:#fafaf8; --ink:#1a1a1a; --muted:#666; --line:#e2e2de; --accent:#0052cc; --high:#b60205; --ok:#1a7f37; --bad:#b60205; --warn:#9a6700; }
  body { margin:0; background:var(--canvas); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; }
  main { max-width:900px; margin:0 auto; padding:40px 24px 80px; }
  h1 { font-size:26px; line-height:1.25; margin:0 0 6px; }
  h2 { font-size:18px; margin:36px 0 10px; padding-top:20px; border-top:1px solid var(--line); }
  h3 { font-size:15px; margin:22px 0 8px; }
  .meta { color:var(--muted); font-size:14px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }
  .pill { display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); }
  .pill.high { background:var(--high); color:#fff; border-color:var(--high); }
  .verdict { margin:14px 0 0; padding:10px 14px; border-radius:6px; background:#fff; border:1px solid var(--line); font-size:15px; }
  .ok { color:var(--ok); font-weight:600; } .bad { color:var(--bad); font-weight:600; } .warn { color:var(--warn); font-weight:600; }
  figure { margin:16px 0; } figure img { max-width:100%; border:1px solid var(--line); border-radius:6px; background:#fff; }
  figcaption { font-size:13px; color:var(--muted); margin-top:6px; }
  table { border-collapse:collapse; width:100%; font-size:14px; } td,th { text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
  code, pre { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; } pre { background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; max-height:520px; }
  a { color:var(--accent); }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; } @media (max-width:700px){ .grid{grid-template-columns:1fr;} }
  details summary { cursor:pointer; color:var(--accent); font-size:14px; }
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1355 · With a stop hook, most of the Assistant text is hidden inside "Worked for [time]"</h1>
  <p class="meta">
    <span class="pill">Type: Bug (unset on GitHub)</span> <span class="pill">Priority: unset</span> <span class="pill">Effort: unset</span>
    <span class="pill">providers</span> <span class="pill">provider-claude-code</span>
    <a href="https://github.com/get-bb/bb/issues/1355">open on GitHub</a>
    <span>investigated 2026-08-18</span>
    <span>base <code>16ceb3a54</code> (main)</span>
  </p>
  <p class="verdict"><span class="ok">REPRODUCED</span> — live, twice, on a dev instance built from <code>16ceb3a54</code> (browser + CLI), plus a failing vitest at the exact code path. Root-cause confidence: <b>high</b>. Not fixed on main. No linked PRs.</p>

  <h2>1. TL;DR</h2>
  <p>When a Claude Code <code>Stop</code> hook blocks the end of a turn, Claude Code injects the hook's reason as a synthetic user message and Claude answers again — so one bb turn ends up containing <em>two</em> assistant text blocks (the real answer, then a short reply to the hook). bb's timeline renders only the <em>last</em> assistant text of a completed turn as the visible "Assistant" row and folds every earlier assistant text into the collapsed <code>Worked for …</code> summary, next to tool calls. The user therefore sees only "The verify gate is open…" and must notice a chevron and expand the summary to read the actual answer. This affects the web/desktop app <em>and</em> <code>bb thread log</code> (default minimal format), so agents orchestrating other agents via the CLI lose the content too.</p>
  <p>Two things combine: (a) <code>@bb/thread-view</code>'s completed-turn grouping keeps exactly one "terminal" message per turn segment (the last <code>assistant-text</code>/<code>error</code>) outside the summary; (b) <code>provider-claude-code</code> drops the SDK's synthetic <code>user</code> hook-feedback message (it only forwards <code>tool_result</code> user messages), so nothing tells the timeline that a new "exchange segment" started and the answer preceding it should stay visible. The same folding also happens for any <code>text → tool_use → text</code> turn — that part is a deliberate design (interim narration is hidden), but the hook case buries the whole answer.</p>

  <h2>2. Claims vs findings</h2>
  <table>
    <tr><th>Claim (issue)</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>bb treats only the last text block as the message and collapses everything before it into "Worked for…"</td><td><span class="ok">Verified</span></td><td>Screenshots below; <code>bb thread log</code> output; failing test. Code: ${L("packages/thread-view/src/completed-turn-grouping.ts", 108, 143)} + ${L("packages/thread-view/src/timeline-message-helpers.ts", 47, 57)}.</td></tr>
    <tr><td>Stop hook reason is injected as a user message and Claude emits a short acknowledgement</td><td><span class="ok">Verified</span></td><td>Claude transcript rows show <code>user isMeta:true "Stop hook feedback: …"</code> between the two assistant texts; SDK stream probe shows <code>{"type":"user","isSynthetic":true,…}</code> (<a href="1355/repro/sdk-stream-probe.out">sdk-stream-probe.out</a>).</td></tr>
    <tr><td>Nothing here is hook-specific: any <code>text → tool_use → text</code> turn has the same shape</td><td><span class="ok">Verified</span></td><td>Thread A (planets) — first text hidden behind "Worked for 11s" with a Read + ls in between; second repro test fails identically.</td></tr>
    <tr><td>Claude Code's own REPL prints every text block in order</td><td><span class="warn">Unverified (plausible)</span></td><td>Not run here. The transcript JSONL contains both text blocks in order, so the data is there; how the REPL displays it was not checked.</td></tr>
    <tr><td>Label "Worked for 45s" reads as a duration stat, not a container holding the reply</td><td><span class="ok">Verified</span></td><td>Label built at ${L("packages/thread-view/src/timeline-row-title.ts", 1289, 1294)}; nothing indicates hidden prose. In the collapsed state the chevron is not even drawn until hover (compare screenshots below).</td></tr>
    <tr><td>Environment: bb desktop, Claude Code via Agent SDK, macOS</td><td><span class="ok">Consistent</span></td><td>Reproduced on Linux web app with the same provider plugin; the code path is platform-independent (shared <code>@bb/thread-view</code>).</td></tr>
  </table>

  <h2>3. Environment</h2>
  <pre>bb commit        16ceb3a540f81c1189efaffb27a39b1d9443abf5 (main, 2026-08-18)
OS               Linux 7.0.0-29-generic x86_64
node             v24.18.0
Claude Code CLI  2.1.234   (@anthropic-ai/claude-agent-sdk 0.3.197 bundled in provider-claude-code)
dev instance     scripts/bb-dev-app current
                 App http://localhost:11498  Server http://localhost:19498  Host daemon 127.0.0.1:27498
                 Data dir /home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_debcf606-e4a-17-e5eac5b29036
project          proj_953iq6k6vv ("qa", local_path /tmp/bb-1355-repo on host_iie7u36z9x)
threads          thr_qnizjf8s8f (thread A, text→tools→text), thr_g28r4itw8a (thread B, text→hook→text)</pre>

  <h2>4. Minimal reproduction</h2>
  <h3>4a. Live (real Claude Code, one turn, ~10 s)</h3>
  <ol>
    <li>Create a scratch git repo with a project-level Stop hook that blocks the first stop of every turn (files also saved under <a href="1355/repro/">1355/repro/</a>):
<pre>mkdir -p /tmp/bb-1355-repo/.claude
cat &gt; /tmp/bb-1355-repo/.claude/stop-hook.sh &lt;&lt;'EOF'
${file("stop-hook.sh")}EOF
chmod +x /tmp/bb-1355-repo/.claude/stop-hook.sh
cat &gt; /tmp/bb-1355-repo/.claude/settings.json &lt;&lt;'EOF'
${file("settings.json")}EOF
echo "# scratch" &gt; /tmp/bb-1355-repo/README.md
git -C /tmp/bb-1355-repo init -q &amp;&amp; git -C /tmp/bb-1355-repo add -A &amp;&amp; git -C /tmp/bb-1355-repo -c user.email=a@b -c user.name=qa commit -qm init</pre>
      (The hook message intentionally tells the model not to repeat itself — that is what a real "verify gate" hook does, and it is what makes the second text block a short acknowledgement, exactly as in the issue. Even a plain <code>exit 2</code> hook produces two text blocks; the visible one is then whatever the model says second.)</li>
    <li>Start a dev instance and create a project on it:
<pre>scripts/bb-dev-app current            # prints App/Server URLs
eval "$(scripts/bb-dev-app env)"
HOST=$(pnpm bb:dev machine list --json | jq -r '.[0].id')
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/bb-1355-repo","hostId":"'$HOST'"}}'   # → proj_…</pre></li>
    <li>Spawn one claude-code thread (BB_HOST_DAEMON_PORT must be set or the spawn fails with "Host not found"):
<pre>pnpm bb:dev thread spawn --project proj_953iq6k6vv --provider claude-code --permission-mode accept-edits \\
  --title "1355 stop hook B" \\
  --prompt "Without using any tools, answer in about 6 short bullet points: what are the trade-offs between SQLite and Postgres for a single-user desktop app? End with one explicit question for me to decide." --json
# wait until idle
until curl -s $BB_SERVER_URL/api/v1/threads/thr_g28r4itw8a | grep -q '"status":"idle"'; do sleep 2; done</pre></li>
    <li><b>Actual</b> — <code>bb thread log thr_g28r4itw8a</code> (default minimal format; this is what an orchestrating agent reads):
<pre>${file("thread-b-log-minimal.txt")}</pre>
      The six bullet points and the explicit question are gone. <code>--format verbose</code> shows they are inside the "Worked for" block:
<pre>${file("thread-b-log-verbose.txt")}</pre>
      <b>Expected</b>: both assistant texts visible at rest, in order (answer, then the hook acknowledgement), with only tool activity collapsed.</li>
    <li>Same thing in the app (<code>http://localhost:11498/projects/proj_953iq6k6vv/threads/thr_g28r4itw8a</code>):</li>
  </ol>
  <div class="grid">
    <figure><img src="assets/1355-b-collapsed.png" alt="Thread B collapsed: only the hook acknowledgement is visible under a 'Worked for 9s' row"><figcaption><b>Bug, at rest.</b> The only visible assistant text is the reply to the hook ("The verify gate is open…"). The row above it, "Worked for 9s", is the answer's hiding place. No chevron is drawn until hover.</figcaption></figure>
    <figure><img src="assets/1355-b-expanded.png" alt="Thread B after clicking 'Worked for 9s': the six bullet answer and the question appear indented inside the summary"><figcaption><b>After clicking "Worked for 9s".</b> The full answer including "Question for you: …" was inside the collapsed summary the whole time, rendered indented like tool activity.</figcaption></figure>
    <figure><img src="assets/1355-a-collapsed.png" alt="Thread A collapsed"><figcaption><b>Thread A (text → Read/ls → text), collapsed.</b> Here the model happened to repeat the planets, so the damage is smaller, but the first text block is still hidden under "Worked for 11s".</figcaption></figure>
    <figure><img src="assets/1355-a-expanded.png" alt="Thread A expanded"><figcaption><b>Thread A expanded.</b> "1. Mercury 2. Venus 3. Mars" (first text block) sits inside the summary above "Explored 1 file, 1 list".</figcaption></figure>
  </div>
  <p>Screenshot driver scripts: <a href="1355/repro/shot1.js">shot1.js</a>, <a href="1355/repro/shot2.js">shot2.js</a> (dev-browser, headless).</p>

  <h3>4b. Unit-level (deterministic, no provider needed)</h3>
  <p>File: <a href="1355/repro/issue-1355-multi-text-turn.test.ts">packages/thread-view/test/issue-1355-multi-text-turn.test.ts</a>. Both tests <b>fail on main</b> at the <code>topLevelAssistantTexts(...)</code> assertion: the received array contains only the last text; the earlier text is a child of the <code>turn</code> (summary) row.</p>
<pre>cd packages/thread-view &amp;&amp; pnpm exec vitest run test/issue-1355-multi-text-turn.test.ts</pre>
<pre>${file("issue-1355-multi-text-turn.test.ts")}</pre>
  <details><summary>vitest output on main</summary><pre>${file("vitest-main.txt")}</pre></details>

  <h2>5. Root cause</h2>
  <h3>5a. What bb persists for the turn</h3>
  <p>The events for thread B (<a href="1355/repro/thread-b-events.json">raw JSON</a>). Note there is <em>no event at all</em> between seq 19 and 21 for the hook feedback — one turn, two <code>agentMessage</code> items:</p>
<pre>${esc(eventTable)}</pre>
  <p>Claude's own transcript (<code>~/.claude/projects/-tmp-bb-1355-repo/*.jsonl</code>) and the raw SDK stream both contain the hook message between the two texts:</p>
<pre>${file("claude-transcript-b-excerpt.txt")}
--- SDK stream (sdk-stream-probe.mjs, "Reply only with ok." against the same hook) ---
${file("sdk-stream-probe.out")}</pre>

  <h3>5b. Layer 1 — provider-claude-code discards the hook-feedback user message</h3>
  <p>${L("plugins/provider-claude-code/src/event-translation.ts", 1311, 1323)}: for SDK <code>type:"user"</code> messages the translator only extracts <code>tool_result</code> blocks; a user message with text content and no tool results hits <code>if (toolResults.length === 0) break;</code> and produces no bb event. ${L("plugins/provider-claude-code/src/visibility.ts", 464, 467)} classifies <code>sdk/user:text</code> as <code>coverage: "noise"</code>, so it is not even surfaced as a <code>provider/unhandled</code> operation. Normally that is right (the echoed prompt is redundant), but the synthetic <code>isSynthetic:true</code> "Stop hook feedback" message is a real conversational boundary and is lost.</p>

  <h3>5c. Layer 2 — completed-turn grouping keeps exactly one visible text per segment</h3>
  <p>When a turn completes, ${L("packages/thread-view/src/build-thread-timeline.ts", 1162, 1197, "buildTurnRows")} stops rendering messages individually and calls <code>groupCompletedTurnMessages</code>. The turn's <code>terminalMessage</code> is chosen by ${L("packages/thread-view/src/apply-turn-message-detail.ts", 15, 19, "findProjectionTerminalMessage")} → ${L("packages/thread-view/src/timeline-message-helpers.ts", 47, 57, "findLastTerminalTimelineMessage")}: <b>the last</b> <code>assistant-text</code>/<code>error</code> message. Then ${L("packages/thread-view/src/completed-turn-grouping.ts", 108, 143, "splitCompletedTurnMessages")} slices everything before it into <code>summaryMessages</code>:</p>
<pre>  return {
    summaryMessages: messages.slice(0, terminalIndex),   // ← the real answer lands here
    terminalMessages: [terminalMessageAtIndex],          // ← only the hook acknowledgement
    trailingMessages: messages.slice(terminalIndex + 1),
  };</pre>
  <p>${L("packages/thread-view/src/completed-turn-grouping.ts", 146, 163, "groupCompletedTurnSummaryMessages")} then makes a single <code>summary</code> group of those messages unless there is an <em>external user boundary</em> or an ungroupable message. Assistant text is groupable (${L("packages/thread-view/src/timeline-message-helpers.ts", 20, 30, "isTimelineUngroupableMessage")} only exempts legacy user messages), and the hook feedback never became a bb message, so no boundary exists → one summary row titled "Worked for (9s)" (${L("packages/thread-view/src/timeline-row-title.ts", 1289, 1294)}) that contains the answer, followed by one Assistant row with the acknowledgement. The app renders <code>turn</code> rows collapsed by default (${L("apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx", 1245, null)}), and the CLI minimal format prints the summary header without children.</p>
  <p>This is deliberate design from <a href="https://github.com/get-bb/bb/pull/320">#320</a>/<a href="https://github.com/get-bb/bb/pull/897">#897</a> ("user message → collapsed work summary → last agent message"). It assumes the last text of a segment is the message addressed to the user; the Stop-hook re-query violates that assumption, and the missing boundary means the #897 per-segment preservation cannot kick in either. The <code>text → tool → text</code> case (thread A) is the same mechanism and shows that interim prose is always hidden — usually fine ("Let me look at…"), catastrophic when the interim prose is the answer.</p>
  <p><b>Deeper issue:</b> the "which text is the message" heuristic is applied at render time to a lossy event stream. Once the provider drops the boundary, no renderer can recover it; and while the turn is running the app shows all texts individually, so the answer visibly <em>disappears</em> at <code>turn/completed</code> (the same effect is reported for steers/AskUserQuestion in <a href="https://github.com/get-bb/bb/issues/1656">#1656</a>).</p>

  <h2>6. Proposed fix (first principles)</h2>
  <p>Confident. Two changes; the first alone fixes the reported symptom for every provider, the second restores the lost information so the rendering can be smarter.</p>
  <ol>
    <li><b><code>@bb/thread-view</code>, <code>completed-turn-grouping.ts</code></b> — treat every top-level completed <code>assistant-text</code> message (no <code>parentToolCallId</code>, non-empty, not <code>isLegacyUserMessage</code>) as an <code>ungrouped-message</code> item in sequence, and let each contiguous run of non-text activity between them become its own <code>summary</code> group. Concretely: in <code>groupCompletedTurnSummaryMessages</code>, drop the early single-summary return when <code>summaryMessages</code> contains an <code>assistant-text</code>, and in the loop <code>flushGroupedMessages()</code> + push an <code>ungrouped-message</code> when the message is a top-level assistant text (or make <code>isTimelineUngroupableMessage</code> return true for such messages and keep the existing loop). <code>getProjectionSummaryCount</code> already excludes ungroupable messages, and <code>applySingleSummaryTurnBounds</code> keeps the "Worked for (total)" label when there is still exactly one activity group. Update <code>completed-turn-summary-rendering.test.ts</code> / <code>timeline-cli-rendering.snapshots.test.ts</code> expectations. Risks: (i) interim narration ("Let me check X…") becomes visible at rest — a product call; if unwanted, keep hiding a text only when it is immediately followed by tool activity <em>and</em> is short (e.g. &lt; 200 chars, no headings/lists/questions), but the reporter's option 1/2 is simpler and matches Claude Code's REPL; (ii) turns with several activity groups get per-segment durations, so the row title falls back to "Worked" without a total (${L("packages/thread-view/src/timeline-row-title.ts", 1296, 1305)}) — acceptable, or compute per-group bounds from <code>getSummaryMessageBounds</code>. Both the app and <code>bb thread log</code> pick this up automatically because they share the same row builder.</li>
    <li><b><code>provider-claude-code</code>, <code>event-translation.ts</code> <code>case "user"</code></b> — when the SDK user message is <code>isSynthetic === true</code> (or content starts with <code>"Stop hook feedback:"</code>) and has no tool results, emit a small item (e.g. an <code>item/completed</code> <code>userMessage</code> with a system-initiator flag, or a <code>provider/unhandled</code>-style operation titled "Stop hook: …") instead of <code>break</code>-ing, and mark <code>sdk/user:text</code> synthetic messages as <code>normalized</code> in <code>visibility.ts</code>. This makes the boundary visible ("hook fired, agent re-queried"), which is useful UX on its own. If it goes over the wire in a new shape, bump <code>HOST_DAEMON_PROTOCOL_VERSION</code>. Note that thread-view currently builds user rows only from <code>client/turn/requested</code>, so this alone would not fix the folding — hence change 1 is the primary fix.</li>
    <li>Optional label change: when a summary group contains hidden assistant text, title it "Worked for 9s · 1 message hidden" (thread-view <code>timeline-row-title.ts</code>) — the reporter's fallback ask; unnecessary if change 1 lands.</li>
  </ol>

  <h2>7. PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>8. Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1656">#1656</a> Replies to mid-turn messages disappear from the timeline when the turn completes — same grouping mechanism (only the segment's last assistant message survives <code>turn/completed</code>); a fix for change 1 above resolves most of it.</li>
    <li><a href="https://github.com/get-bb/bb/pull/897">#897</a> Preserve agent messages around timeline steers — introduced per-segment terminal preservation; the design being extended here.</li>
    <li><a href="https://github.com/get-bb/bb/pull/320">#320</a> Split completed turn summaries at user boundaries — origin of the "one visible terminal message" model.</li>
  </ul>

  <h2>9. Appendix</h2>
  <h3>Artifacts</h3>
  <ul>
    <li><a href="1355/repro/stop-hook.sh">stop-hook.sh</a>, <a href="1355/repro/settings.json">settings.json</a> — the hook used.</li>
    <li><a href="1355/repro/thread-b-events.json">thread-b-events.json</a>, <a href="1355/repro/thread-b-log-minimal.txt">thread-b-log-minimal.txt</a>, <a href="1355/repro/thread-b-log-verbose.txt">thread-b-log-verbose.txt</a>.</li>
    <li><a href="1355/repro/claude-transcript-b-excerpt.txt">claude-transcript-b-excerpt.txt</a> — Claude's JSONL rows showing the isMeta hook message.</li>
    <li><a href="1355/repro/sdk-stream-probe.mjs">sdk-stream-probe.mjs</a> / <a href="1355/repro/sdk-stream-probe.out">.out</a> — proves the SDK stream emits the synthetic user message bb drops.</li>
    <li><a href="1355/repro/issue-1355-multi-text-turn.test.ts">issue-1355-multi-text-turn.test.ts</a> / <a href="1355/repro/vitest-main.txt">vitest-main.txt</a>.</li>
  </ul>
  <h3>Commands run (abridged)</h3>
<pre>gh issue view 1355 --comments
pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
scripts/bb-dev-app current
curl -s -X POST http://localhost:19498/api/v1/projects ... /tmp/bb-1355-repo
BB_SERVER_URL=http://localhost:19498 BB_HOST_DAEMON_PORT=27498 node packages/scripts/dist/commands/run-cli.js thread spawn --project proj_953iq6k6vv --provider claude-code ...
node packages/scripts/dist/commands/run-cli.js thread log thr_g28r4itw8a [--format verbose|json]
dev-browser --browser bb1355 --headless run shot1.js / shot2.js
cd plugins/provider-claude-code &amp;&amp; env -u ANTHROPIC_MODEL node .probe-1355.mjs   # sdk-stream-probe
cd packages/thread-view &amp;&amp; pnpm exec vitest run test/issue-1355-multi-text-turn.test.ts
pnpm dev:stop</pre>
  <h3>Notes / caveats</h3>
  <ul>
    <li>The hook reason text in thread B steers the model to answer briefly; that mirrors the reporter's "verify gate" hook. Thread A used a neutral <code>exit 2</code> reason and the model re-listed the answer, which is why its collapsed view looks less broken — the folding is identical.</li>
    <li>The SDK probe needed <code>ANTHROPIC_MODEL</code> unset and an explicit <code>model</code> because this shell inherits an EAP model id the CLI rejects; irrelevant to the bug.</li>
    <li>Not fixed on main: <code>completed-turn-grouping.ts</code> last changed in #1493 (2026-08-12) and the terminal-message selection is unchanged since #897 (2026-07-29); the issue was filed 2026-08-11.</li>
  </ul>
</main></body></html>
`;
fs.writeFileSync("/tmp/bb-reports/issues/1355.html", html);
console.log("wrote", html.length);
