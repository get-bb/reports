import html
R = '/tmp/bb-reports/issues/2122/repro/'
repro_test = open(R + 'issue-2122.repro.test.ts').read()
agent = open(R + 'issue-2122-unprompted-agent.mjs').read()
edges = open(R + 'issue-2122.pr-edges.test.ts').read()
ev_main = open(R + 'events-table-main.txt').read()
ev_pr = open(R + 'events-table-pr2123.txt').read()
ev_pr_after = open(R + 'events-table-pr2123-after-quiet.txt').read()
vit_main = open(R + 'vitest-main.log').read()
vit_edges = open(R + 'vitest-pr2123-edges.log').read()
commands = open(R + 'commands-run.txt').read()
E = html.escape
BASE = "fcada5a3b88302acb9944aa74b11db4ecaa215a0"


def pl(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="https://github.com/get-bb/bb/blob/{BASE}/{path}{frag}"><code>{path}{frag}</code></a>'


MAIN_TEST_OUT = '''delta kinds on the wire: session.reset turn.open input.accepted item.textClose item.textDelta item.textClose item.textClose turn.boundary item.textClose item.textDelta item.textClose item.textClose item.open item.close item.textClose item.textDelta
assembled event types: turn/started turn/input/accepted item/started item/agentMessage/delta item/completed turn/completed provider/unhandled(acp/update:agent_message_chunk, {"kind":"thread"}) provider/unhandled(acp/update:tool_call, {"kind":"thread"}) provider/unhandled(acp/update:tool_call_update, {"kind":"thread"}) provider/unhandled(acp/update:agent_message_chunk, {"kind":"thread"})
agent message texts: ["PROMPTED: started bg_4"]

AssertionError: expected [ { type: 'turn/started', ...(3) } ] to have a length of 2 but got 1
 > src/bridge/issue-2122.repro.test.ts:190:58'''

CONFIG_SNIPPET = '''{ "customAcpAgents": [ { "id": "unprompted", "displayName": "Unprompted Fake ACP",
    "command": "/path/to/node",
    "args": ["/path/to/plugins/provider-acp/src/bridge/issue-2122-unprompted-agent.mjs"],
    "env": { "UNPROMPTED_DELAY_MS": "3000" } } ] }'''

SPAWN_SNIPPET = '''pnpm bb:dev thread spawn --project proj_jws2kuv28t --provider acp-unprompted --permission-mode full \\
  --title "issue 2122 repro" --prompt "start job" --json      # -> thr_7hqca7hpyd'''

doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #2122 provider-acp silently drops agent-initiated turns</title>
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
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
  details summary {{ cursor:pointer; color:var(--accent); }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#2122 · provider-acp silently drops agent-initiated turns (unprompted session updates, e.g. OMP async-job delivery)</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill high">Priority: High</span> <span class="pill">Effort: Small</span> <span class="pill">omp · providers · provider-acp</span>
    <a href="https://github.com/get-bb/bb/issues/2122">open on GitHub</a>
    <span>2026-08-21 · base <code>fcada5a3b</code></span>
  </p>
  <p><strong>Verdict:</strong> <span class="verdict">REPRODUCED</span> · <strong>Root-cause confidence:</strong> high</p>
  <p><strong>Linked PR:</strong> <a href="https://github.com/get-bb/bb/pull/2123">#2123</a> — verdict <strong>REQUEST CHANGES</strong> (fixes the drop, but a vouched turn is left open forever when the agent process exits, permission requests inside a vouched turn are auto-cancelled, and the 120 s quiet window hides the last message and shows "Working…" for two minutes).</p>

  <h2>1. TL;DR</h2>
  <p>When an ACP agent (the concrete case is OMP's async-job auto-delivery) streams text or tool calls <em>without</em> bb having sent it a <code>session/prompt</code>, the ACP bridge forwards those updates to the runtime but never opens a turn for them. The runtime's delta assembler, by design, refuses to let item/stream deltas open a turn, so each unprompted chunk is demoted to a thread-scoped <code>provider/unhandled</code> raw-event row. Those rows are persisted but hidden from the timeline unless the <code>showUnhandledProviderEvents</code> setting is on (it defaults to off; dev builds force it on), so the user sees a thread that simply never answered. I reproduced this end to end on <code>fcada5a3b</code> with a ~100-line fake ACP agent, both as a failing vitest against the real bridge + assembler and live in a dev instance (DB rows and screenshots below). The issue's mechanism is essentially right; one detail is wrong: the events are not "zero persisted", they are persisted as <code>provider/unhandled</code> and hidden. PR #2123 makes the bridge open a vouched turn for idle work updates and closes it after 120 s of silence; it fixes the drop but introduces a hung-thread failure mode and leaves permission requests broken inside such turns.</p>

  <h2>2. Claims vs findings</h2>
  <table><tr><th>Claim from the issue</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Unprompted <code>session/update</code> work (message chunks, tool calls) with no prompt in flight never reaches the thread as a turn/message.</td><td class="ok">Verified</td><td>Repro test on main: assembled events after the prompted turn are four <code>provider/unhandled</code> (thread scope), zero <code>turn/started</code>, zero agent-message items (§4, <code>vitest-main.log</code>). Live DB rows seq 14–17 (§4).</td></tr>
    <tr><td>"Zero persisted events between those timestamps — no turn, no items, no error."</td><td class="no">Refuted (on fcada5a3b)</td><td>Each chunk IS persisted, as a thread-scoped <code>provider/unhandled</code> row (<code>events-table-main.txt</code> seq 14–17). They are hidden from the timeline in production because <code>includeProviderUnhandledOperations = isDevelopment || settings.showUnhandledProviderEvents</code> ({pl("apps/server/src/routes/threads/data.ts",340,342)}) and the setting defaults to <code>false</code>. Net user-visible effect is the same: nothing renders. The reporter's 0.39.0 DB query may have filtered on turn-scoped rows; I could not inspect it.</td></tr>
    <tr><td><code>handleAgentNotification</code> forwards <code>session/update</code> with no turn bracketing when no prompt is in flight.</td><td class="ok">Verified</td><td>{pl("plugins/provider-acp/src/bridge/bridge.ts",2170,2214)}: the only gates are <code>stopping</code>, <code>loading</code> and session-id match; it never consults <code>activePromptKind</code>.</td></tr>
    <tr><td><code>noTurnFallbackFor</code> "classifies those updates <code>unhandled</code> with <code>onlyIfNoTurn: true</code>".</td><td class="unv">Partly wrong</td><td>The translator emits real <code>item.textDelta</code>/<code>item.open</code>/<code>item.close</code> deltas carrying a <code>noTurnFallback</code> payload ({pl("plugins/provider-acp/src/delta-translation.ts",448,466)}). It is the <em>assembler</em> that, finding no open turn, pushes the fallback as <code>provider/unhandled</code> ({pl("packages/provider-bridge-protocol/src/assembler/delta-assembler.ts",1843,1856)}, {pl("packages/provider-bridge-protocol/src/assembler/delta-assembler.ts",1334,1354)}). <code>onlyIfNoTurn</code> is only used for empty-translation updates. Same outcome, different layer.</td></tr>
    <tr><td><code>user_message_chunk</code> is classified as noise and swallowed.</td><td class="ok">Verified</td><td>{pl("plugins/provider-acp/src/visibility.ts",36,44)} lists it in <code>NOISE_ACP_UPDATE_KINDS</code>; in the repro it produced no delta at all (delta kinds on the wire in §4).</td></tr>
    <tr><td>OMP 17.4.0 over <code>omp acp</code> emits <code>user_message_chunk</code> + <code>agent_message_chunk</code>s after <code>session/prompt</code> returned.</td><td class="unv">Unverified</td><td>I did not drive a real OMP async job (costs usage; this machine has omp 16.3.10). The fake agent reproduces exactly that wire shape; any ACP agent emitting idle work updates hits the same path.</td></tr>
    <tr><td>Updates arriving while a prompt is in flight render fine; only the no-prompt window drops.</td><td class="ok">Verified</td><td>The prompted chunk <code>PROMPTED: started bg_4</code> rendered as an agent message in the same thread (seq 10–12).</td></tr>
    <tr><td>Protocol rule 3 permits a bridge-emitted <code>turn.open</code> for turns the user did not initiate; compaction already does this.</td><td class="ok">Verified</td><td><code>docs/provider-bridge-protocol.md</code> "Turn lifecycle" rule 3; <code>startCompaction</code> emits <code>ACP_COMPACTION_STARTED_METHOD</code> which the translator turns into a turn.</td></tr>
    <tr><td>"the claude-code translator auto-opens turns on streamed text".</td><td class="ok">Verified</td><td><code>plugins/provider-claude-code/src/delta-translation.ts</code> pushes <code>{{ kind: "turn.open" }}</code> before stream text deltas (lines ~1056, ~1070).</td></tr>
    <tr><td>Not a permission stall / not provider reaping / not the DB write path.</td><td class="ok">Consistent</td><td>Repro runs in full permission mode with no permission requests; the agent process stays alive; prompted deltas persist in the same thread.</td></tr>
  </table>

  <h2>3. Environment</h2>
  <ul>
    <li>bb <code>fcada5a3b</code> (main, 2026-08-21), app version 0.39.0, macOS 26.5.2 (Darwin 25.5.0) arm64, Node v22.23.1.</li>
    <li>Dev instance from this worktree: App <code>http://localhost:15768</code>, Server <code>http://localhost:23768</code>, Host daemon <code>127.0.0.1:31768</code>, data dir <code>~/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-4-66591f607d02</code> (deleted at cleanup).</li>
    <li>Provider: a custom ACP agent registered through <code>customAcpAgents</code> in the dev data dir's <code>config.json</code>, pointing at <code>issue-2122-unprompted-agent.mjs</code> (a ~100-line scripted ACP agent). No real OMP session was run; <code>omp</code> 16.3.10 is on this machine, the issue reports 17.4.0.</li>
    <li>PR #2123 was evaluated after rebasing its single commit onto <code>fcada5a3b</code> (its base <code>c9aef7514</code> is 39 commits behind; one trivial import conflict in <code>bridge.test.ts</code> because the testing helpers moved to <code>@get-bb/plugin-sdk/provider-bridge/testing</code>).</li>
  </ul>

  <h2>4. Minimal reproduction</h2>
  <h3>4a. Unit level (fails on main, passes on PR #2123)</h3>
  <ol>
    <li>Copy <a href="2122/repro/issue-2122-unprompted-agent.mjs"><code>issue-2122-unprompted-agent.mjs</code></a> and <a href="2122/repro/issue-2122.repro.test.ts"><code>issue-2122.repro.test.ts</code></a> into <code>plugins/provider-acp/src/bridge/</code>. The agent answers <code>initialize</code>/<code>session/new</code>/<code>session/prompt</code>, returns <code>end_turn</code>, then 150 ms later emits an unsolicited <code>user_message_chunk</code>, <code>agent_message_chunk</code>, <code>tool_call</code>, <code>tool_call_update</code>, <code>agent_message_chunk</code>.</li>
    <li>Run it from the repo root:
<pre>pnpm --dir plugins/provider-acp exec vitest run src/bridge/issue-2122.repro.test.ts</pre></li>
    <li>Expected: two <code>turn/started</code>, the unprompted text assembled as agent messages, no <code>provider/unhandled</code>. Actual on <code>fcada5a3b</code>:
<pre>{E(MAIN_TEST_OUT)}</pre>
    Note the wire: the bridge <em>does</em> emit <code>item.textDelta</code>/<code>item.open</code>/<code>item.close</code> for the unprompted updates but no second <code>turn.open</code>; the assembler converts each into a thread-scoped <code>provider/unhandled</code>. Full log: <a href="2122/repro/vitest-main.log">vitest-main.log</a>; assembled events: <a href="2122/repro/main-events.json">main-events.json</a>.</li>
  </ol>

  <h3>4b. Live (dev instance on fcada5a3b)</h3>
  <ol>
    <li><code>scripts/bb-dev-app current</code>, then add to <code>&lt;data dir&gt;/config.json</code> (paths adjusted) and <code>curl -X POST $BB_SERVER_URL/api/v1/system/config/reload</code>:
<pre>{E(CONFIG_SNIPPET)}</pre></li>
    <li>Create a project on a scratch repo and spawn a thread:
<pre>{E(SPAWN_SNIPPET)}</pre></li>
    <li>After ~10 s, query the events table. Expected: a second turn with the agent's follow-up. Actual: the follow-up is four thread-scoped <code>provider/unhandled</code> rows (seq 14–17), no turn, no items:
<pre>{E(ev_main)}</pre></li>
    <li>The timeline API returns the four rows only as <code>system</code> rows titled "Unhandled Unprompted Fake ACP event" — and only because dev mode forces <code>includeProviderUnhandledOperations</code>; in a packaged build they are filtered out entirely.</li>
  </ol>
  <figure><img src="assets/2122-thread-main.png" alt="Thread on main: the prompted message renders, the unprompted follow-up appears only as four greyed 'Unhandled ... event' rows"><figcaption>main (dev build): "PROMPTED: started bg_4" rendered normally; the agent-initiated follow-up shows only as four greyed "Unhandled Unprompted Fake ACP event" system rows. In a production build these rows are hidden (setting off by default), so the user sees nothing at all.</figcaption></figure>
  <figure><img src="assets/2122-thread-main-expanded.png" alt="Expanded unhandled rows showing the raw agent_message_chunk payloads with the lost text"><figcaption>Expanding two of the rows: the raw <code>acp/update:agent_message_chunk</code> payloads carry the lost text "UNPROMPTED: job bg_4 finished, " and "the answer is 42.".</figcaption></figure>
  <p>Repro files: <a href="2122/repro/">2122/repro/</a></p>
  <details><summary>issue-2122.repro.test.ts (inline)</summary><pre>{E(repro_test)}</pre></details>
  <details><summary>issue-2122-unprompted-agent.mjs (inline)</summary><pre>{E(agent)}</pre></details>

  <h2>5. Root cause</h2>
  <p>Three pieces, each individually "by design", compose into a silent drop:</p>
  <ol>
    <li><strong>The bridge only opens turns for prompts it sent.</strong> <code>runTurn</code> sets <code>activePromptKind = "turn"</code> and emits <code>ACP_TURN_STARTED_METHOD</code> ({pl("plugins/provider-acp/src/bridge/bridge.ts",1996,2002)}); <code>finishTurn</code> emits the completion when <code>session/prompt</code> resolves. <code>handleAgentNotification</code> ({pl("plugins/provider-acp/src/bridge/bridge.ts",2170,2214)}) forwards every <code>session/update</code> to the translator regardless of whether a prompt is in flight. ACP itself has no "agent-initiated turn" bracket, so nothing ever opens one.</li>
    <li><strong>The translator is context-free.</strong> <code>agent_message_chunk</code> becomes an <code>item.textDelta</code> with a <code>noTurnFallback</code> payload ({pl("plugins/provider-acp/src/delta-translation.ts",448,466)}); <code>tool_call</code>/<code>tool_call_update</code> become <code>item.open</code>/<code>item.close</code> with the same fallback. It cannot open a turn because it does not know whether bb asked for this work.</li>
    <li><strong>The assembler refuses to let item deltas open a turn</strong> (turn-opening rule, {pl("packages/provider-bridge-protocol/src/assembler/delta-assembler.ts",18,24)}). With <code>state.currentTurnId === undefined</code> every one of those deltas takes the <code>pushNoTurnFallback</code> branch ({pl("packages/provider-bridge-protocol/src/assembler/delta-assembler.ts",1843,1856)}, {pl("packages/provider-bridge-protocol/src/assembler/delta-assembler.ts",1334,1354)}) and is emitted as a thread-scoped <code>provider/unhandled</code>. This is the intentional "no active turn" visibility guard — correct for stray noise, wrong for real work.</li>
  </ol>
  <p><strong>Why the user sees nothing:</strong> <code>provider/unhandled</code> is persisted, but the timeline projection drops it unless <code>includeProviderUnhandledOperations</code> is set ({pl("packages/thread-view/src/parse-operation-message.ts",442,445)}), which the server derives from <code>isDevelopment || showUnhandledProviderEvents</code> ({pl("apps/server/src/routes/threads/data.ts",340,342)}); the setting defaults to <code>false</code> (<code>packages/domain/src/app-settings.ts</code>). So in the packaged app the agent's work is invisible, and even in dev it is an opaque "Unhandled … event" row rather than a message.</p>
  <p><strong>Deeper issue:</strong> the bridge keeps a single mirror of "is a turn open" in <code>activePromptKind</code>, and several paths key off it as if it were authoritative: <code>emitSessionError</code> only settles a turn when it is non-null ({pl("plugins/provider-acp/src/bridge/bridge.ts",324,349)}), <code>handlePermissionRequest</code> auto-cancels every <code>session/request_permission</code> unless it is exactly <code>"turn"</code> ({pl("plugins/provider-acp/src/bridge/bridge.ts",1340,1358)}), and <code>turn/steer</code> is rejected otherwise ({pl("plugins/provider-acp/src/bridge/bridge.ts",2550,2556)}). Any fix that opens a turn for agent-initiated work has to teach all of those paths about the new kind of turn — PR #2123 does not (see §7).</p>

  <h2>6. Proposed fix (first principles)</h2>
  <p>The right layer is the ACP bridge (provider translation lives in the daemon/plugin per AGENTS.md; no wire change, no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump). The bridge is the only component that knows whether bb asked for the work, and protocol rule 3 sanctions a bridge-emitted <code>turn.open</code> for provider-internal activity. Concretely:</p>
  <ol>
    <li>Make the open-turn mirror cover the new case instead of adding a parallel boolean: e.g. <code>activePromptKind: "turn" | "compaction" | "agent" | null</code>. In <code>handleAgentNotification</code>, when <code>activePromptKind === null</code> and the update is a work kind (reuse <code>NORMALIZED_ACP_UPDATE_KINDS</code> minus <code>usage_update</code> from <code>visibility.ts</code> rather than a second hand-maintained map), set <code>"agent"</code> and emit <code>ACP_TURN_STARTED_METHOD</code>.</li>
    <li>Settle that turn on every exit path, not just the happy ones: before the next <code>turn/start</code>/compaction (<code>end_turn</code>), on <code>thread/stop</code> interrupt (<code>cancelled</code>), and — missing in the PR — on agent process exit / <code>emitSessionError</code> (emit the settling error delta while the turn is still marked open, so the assembler's <code>provider.error {{ settlesTurn }}</code> closes it as failed). Rule 1 ("every turn reaches exactly one terminal state") must hold for vouched turns too.</li>
    <li>Treat <code>"agent"</code> like <code>"turn"</code> in <code>handlePermissionRequest</code> (full mode auto-allows; other modes forward to the user). Without this, an OMP follow-up that runs a tool under a non-yolo policy is silently denied, and even full mode cancels it.</li>
    <li>Bound the turn by a much shorter quiet window than 120 s, and/or close it on a positive end signal if the agent emits one (OMP may send <code>usage_update</code> at the end of a turn — experiment: record <code>omp acp</code> with <code>BB_PROVIDER_BRIDGE_RECORD_DIR</code> during an async-job delivery and look at the last notification). With a 120 s window the server buffers the final streamed message until the turn flushes (§7 screenshot), the thread shows "Working…" with a Stop button for two minutes, and "Worked for 2m" is reported for sub-second work. A 5–10 s window re-armed per chunk, with the "split turn" cost accepted, is a far better trade.</li>
    <li><code>turn/steer</code> during an agent turn already degrades gracefully (runtime maps <code>NO_ACTIVE_TURN</code> to a fresh <code>turn/start</code>, <code>packages/agent-runtime/src/runtime.ts</code> ~L2066) — keep that; <code>runTurn</code> settles the agent turn first.</li>
  </ol>
  <p>Risk: a provider that streams idle noise as <code>agent_message_chunk</code> (none known; Cursor/opencode/grok only do so inside prompts) would now produce phantom turns. The work-kind allowlist plus the existing noise list keeps that narrow.</p>

  <h2>7. PR review — <a href="https://github.com/get-bb/bb/pull/2123">#2123</a> "Vouch agent-initiated ACP turns so async job delivery renders"</h2>
  <p><strong>What it changes</strong> (<a href="2122/repro/pr-2123.diff">diff</a>, +224/−4, bridge-only): adds <code>spontaneousTurnOpen</code>/<code>spontaneousQuietTimer</code> to the session; in <code>handleAgentNotification</code>, when <code>activePromptKind === null</code> and the update kind is in a new <code>AGENT_WORK_UPDATE_KINDS</code> map, emits <code>ACP_TURN_STARTED_METHOD</code> once and (re)arms a 120 s timer that emits <code>ACP_TURN_COMPLETED_METHOD {{ end_turn }}</code>; <code>runTurn</code>/<code>startCompaction</code> settle a still-open vouched turn first; <code>stopSession</code> settles it as <code>cancelled</code>; <code>removeSession</code> clears the flag/timer. Adds two fake-agent behaviours and three tests. Translator, assembler, wire: untouched.</p>
  <p><strong>Root cause vs symptom:</strong> it addresses the actual mechanism (no <code>turn.open</code> for agent-initiated work) at the correct layer, in the shape rule 3 sanctions. My repro test passes on it (<a href="2122/repro/vitest-pr2123.log">log</a>, <a href="2122/repro/pr2123-events.json">events</a>), and live the follow-up renders as turn <code>t2</code> with agent messages and a tool row (<a href="2122/repro/events-table-pr2123.txt">DB rows</a>). <code>turbo run test typecheck lint --filter=bb-plugin-provider-acp --force</code> on the rebased branch: 7/7 tasks green. No protocol bump needed (no wire shape change) — correct.</p>
  <h3>Findings</h3>
  <table><tr><th>#</th><th>Severity</th><th>Where</th><th>Finding</th></tr>
    <tr><td>1</td><td class="no">High</td><td><code>bridge.ts</code> <code>onExit</code> → <code>removeSession</code> → <code>clearSpontaneousTurn</code> (PR hunk at base L1571 / L2193); <code>emitSessionError</code> unchanged (base L324–349)</td><td><strong>A vouched turn is never settled when the agent process exits.</strong> <code>removeSession</code> silently clears the flag, then <code>emitSessionError</code> skips the settling error delta because <code>activePromptKind === null</code>. The assembler keeps turn <code>t2</code> open forever: the thread shows "Working…" with a spinner and Stop button indefinitely (screenshot below, 2.5 min after the crash; DB shows only a thread-scoped <code>provider/warning</code>, no <code>turn/completed</code>). This is the hung-thread class rule 1 exists to prevent, and it is a regression versus main, where an agent dying while idle leaves the thread idle. Repro: <a href="2122/repro/issue-2122.pr-edges.test.ts">issue-2122.pr-edges.test.ts</a> test 1 fails with <code>expected turn/completed length 2, got 1</code>. Fix: call <code>settleSpontaneousTurn(session, "cancelled")</code> (or emit the error while the turn is still open) in <code>onExit</code> before <code>removeSession</code>.</td></tr>
    <tr><td>2</td><td class="no">High</td><td><code>bridge.ts</code> <code>handlePermissionRequest</code> (base L1340–1358, unchanged by PR)</td><td><strong>Permission requests raised during a vouched turn are auto-answered <code>cancelled</code></strong> — even in <code>full</code> mode, because the <code>activePromptKind !== "turn"</code> guard runs before the full-mode auto-allow. An agent-initiated turn that needs to run a tool therefore renders the tool call and then gets it denied. Pre-existing code, but the PR's premise ("output is never lost", agent-initiated turns are real turns) makes it in scope. Repro: pr-edges test 2: the agent receives <code>{{"outcome":{{"outcome":"cancelled"}}}}</code>.</td></tr>
    <tr><td>3</td><td class="unv">Medium</td><td><code>SPONTANEOUS_TURN_IDLE_TIMEOUT_MS = 120_000</code></td><td><strong>The 120 s quiet window is user-visible and misleading.</strong> Measured live: last chunk at <code>1787325866731</code>, <code>item/completed</code>+<code>turn/completed</code> at <code>1787325986719</code> (119.99 s later). During that window: (a) the server's assistant-text buffering holds the last streamed message until a flush, so a reload shows "Working…" instead of "the answer is 42." (screenshot); (b) the thread is "running" — spinner in the sidebar, Stop button in the composer — for two minutes after the agent finished; (c) after close the turn is summarised as "Worked for 2m" for sub-second work; (d) turn-completed notifications and attention state are delayed by two minutes. A 5–10 s window, or an end signal, would be far better; the PR offers no rationale for 120 s.</td></tr>
    <tr><td>4</td><td class="unv">Low</td><td><code>AGENT_WORK_UPDATE_KINDS</code></td><td>Duplicates <code>NORMALIZED_ACP_UPDATE_KINDS</code> in <code>visibility.ts</code> (minus <code>usage_update</code>). Derive from the visibility metadata so a future update kind cannot be "normalized" in one place and "noise" in the other.</td></tr>
    <tr><td>5</td><td class="unv">Low</td><td>parallel <code>spontaneousTurnOpen</code> boolean</td><td>Adds a second "is a turn open" mirror next to <code>activePromptKind</code>; every reader of the old mirror (<code>emitSessionError</code>, <code>handlePermissionRequest</code>, <code>turn/steer</code>, <code>stopSession</code>'s cancel path) silently keeps the old semantics — findings 1 and 2 are direct consequences. Folding it into <code>activePromptKind</code> (e.g. <code>"agent"</code>) forces each reader to decide.</td></tr>
    <tr><td>6</td><td class="unv">Low</td><td>tests</td><td>The three new tests cover open/quiet-close, settle-before-next-turn, and noise-does-not-open. No test for agent exit, <code>thread/stop</code> interrupt, permission requests, or a steer arriving during a vouched turn. The second test leaves the production 120 s timer armed until <code>afterEach</code>'s <code>stopThread</code>; fine, but brittle if the teardown changes.</td></tr>
    <tr><td>7</td><td class="ok">OK</td><td>layering / protocol</td><td>Bridge-local, no server/daemon boundary move, no wire change, so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump required. No casts or <code>unknown</code> smuggling. Test hook <code>__setSpontaneousTurnIdleTimeoutForTests</code> has precedent (<code>resetPiModelRuntimesForTests</code>).</td></tr>
    <tr><td>8</td><td class="unv">Note</td><td>branch</td><td>Based on <code>c9aef7514</code>, 39 commits behind main; conflicts with the test-helper move to <code>@get-bb/plugin-sdk/provider-bridge/testing</code>. Needs a rebase before CI can pass.</td></tr>
  </table>
  <figure><img src="assets/2122-pr2123-thread-renders.png" alt="PR branch: unprompted follow-up renders, but the last message is hidden behind Working… during the 120 s window"><figcaption>PR #2123, ~10 s after the agent finished: the follow-up now renders as a turn ("UNPROMPTED: job bg_4 finished,", "Read result.txt"), but the final message "the answer is 42." is buffered behind "Working…" and the thread stays running (Stop button, sidebar spinner) for the full 120 s quiet window.</figcaption></figure>
  <figure><img src="assets/2122-pr2123-thread-after-quiet.png" alt="PR branch after 120 s: turn closed, summarised as Worked for 2m"><figcaption>Same thread after the quiet window: the turn closed, the last message appears, and the work is summarised as "Worked for 2m" although the agent was busy for under a second.</figcaption></figure>
  <figure><img src="assets/2122-pr2123-thread-crash-hung-after.png" alt="PR branch: agent crashed mid vouched turn, thread still Working… 2.5 minutes later"><figcaption>Finding 1: the agent process exited (exit 3) right after its unprompted output. 2.5 minutes later the thread is still "Working…" with an active Stop button; the only trace is the greyed "ACP agent … exited unexpectedly" warning row. No <code>turn/completed</code> will ever arrive.</figcaption></figure>
  <p><strong>Tests I ran on the rebased PR:</strong> my repro test (passes); the PR's three tests (pass); full <code>bb-plugin-provider-acp</code> test+typecheck+lint via turbo (green); two hostile probes (<a href="2122/repro/issue-2122.pr-edges.test.ts">pr-edges</a>, both fail — <a href="2122/repro/vitest-pr2123-edges.log">log</a>); live dev-instance runs of a normal and a crashing agent (DB: <a href="2122/repro/events-table-pr2123.txt">during window</a>, <a href="2122/repro/events-table-pr2123-after-quiet.txt">after window</a>).</p>
  <p><strong>Verdict: REQUEST CHANGES.</strong> The approach is right and it demonstrably fixes the reported drop, but as written it trades a silent drop for a hung thread whenever the agent dies mid-turn, leaves agent-initiated tool permissions broken, and the 120 s window produces visibly wrong UI for two minutes per delivery. Fix findings 1–3 (and ideally 5), add tests for exit/stop/permission inside a vouched turn, rebase, and it is mergeable.</p>
  <details><summary>pr-edges test output (inline)</summary><pre>{E(vit_edges)}</pre></details>
  <details><summary>issue-2122.pr-edges.test.ts (inline)</summary><pre>{E(edges)}</pre></details>

  <h2>8. Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1431">#1431</a> — hung-thread class (turns that never reach a terminal state); finding 1 above re-creates it for vouched turns.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1584">#1584</a> — <code>thread/stop</code> release must not fabricate an interruption; relevant to how a vouched turn should be settled on release vs interrupt.</li>
    <li><a href="https://github.com/get-bb/bb/issues/2014">#2014</a> — accepted-input correlation; the PR correctly leaves <code>user_message_chunk</code> as noise so no phantom accepted input is created.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1224">#1224</a> — id discipline; vouched turns get assembler-minted ids, consistent.</li>
  </ul>

  <h2>9. Appendix</h2>
  <h3>Commands run</h3>
  <pre>{E(commands)}</pre>
  <h3>DB rows — PR branch, during the quiet window</h3>
  <pre>{E(ev_pr)}</pre>
  <h3>DB rows — PR branch, after the quiet window (thr_i4fi2raq6u closed at +119.99 s; thr_t6m373xpvh never closes)</h3>
  <pre>{E(ev_pr_after)}</pre>
  <h3>Full vitest output on main</h3>
  <pre>{E(vit_main)}</pre>
</main></body></html>
"""
open('/tmp/bb-reports/issues/2122.html', 'w').write(doc)
print(len(doc))
