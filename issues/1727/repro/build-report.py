import html, pathlib
def esc(s): return html.escape(s)
R = pathlib.Path('/tmp/bb-reports/issues/1727')
test_src = (R/'repro/bridge.resume-usage-replay.test.ts').read_text()
fake_diff = (R/'repro/fake-codex-app-server.diff').read_text()
proto_diff = (R/'repro/prototype-fix-bridge.diff').read_text()
test_out = (R/'repro-test-output.txt').read_text()
probe_log = (R/'codex-app-server-probe.log').read_text()
probe_lines = [l for l in probe_log.splitlines() if 'delta' not in l and 'mcpServer' not in l and 'remoteControl' not in l and 'rawResponse' not in l and 'status/changed' not in l and 'goal/cleared' not in l and 'rateLimits' not in l]
probe_trim = "\n".join(probe_lines)
server_log = (R/'server.log').read_text()
orphan_lines = "\n".join(l for l in server_log.splitlines() if 'orphan' in l)
P = "https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/"

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1727 pre-turn thread usage snapshots dropped as orphan</title>
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
  .pill.low {{ background:#eef; }}
  .verdict {{ font-weight:600; }}
  .v-repro {{ color:var(--ok); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1727 · Pre-turn thread usage snapshots are dropped as "orphan thread-state snapshot with no stored turn/started"</h1>
  <p class="meta">
    <span class="pill">Question / Bug</span> <span class="pill low">Low</span> <span class="pill">Effort: Small</span>
    <span class="pill">providers</span> <span class="pill">provider-codex</span>
    <a href="https://github.com/get-bb/bb/issues/1727">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> Every event the Codex provider produces for a bb thread is tagged with a <em>turn id</em>. The server refuses to store most turn-tagged events until it has stored that turn's <code>turn/started</code>; two "thread-state snapshot" events (<code>thread/tokenUsage/updated</code>, <code>thread/contextWindowUsage/updated</code>) are the exception: instead of failing the batch they are silently discarded and a warning is logged. The bb Codex plugin runs one <code>codex app-server</code> child per thread and prefixes every Codex turn id with a per-session nonce (<code>bt&lt;entropy&gt;-&lt;serial&gt;-</code>) before it reaches bb; each resume or fork of a thread is a new session with a new prefix.</p>
  <p><b>What the user sees.</b> Two <code>Dropped orphan thread-state snapshot with no stored turn/started</code> warnings in the server log every time a Codex thread is resumed (archive→unarchive, daemon restart, or plain idle reaping after 30&nbsp;min) and on the first turn of every native fork. Nothing is visibly broken in the app.</p>
  <p><b>What is actually happening.</b> <code>codex app-server</code> (0.147.0) replays the rollout's <em>last-turn</em> token usage on <code>thread/resume</code> and <code>thread/fork</code>, scoped to that <em>previous</em> turn's Codex id, before any new turn exists (verified with a raw JSON-RPC probe). The bridge stamps that id with the <em>new</em> session's prefix, so on resume the same Codex turn arrives under a bb turn id different from the one its <code>turn/started</code> was stored under, and on fork it names a turn the forked bb thread never had. Either way the server's orphan rule fires. The drop is deliberate at the server layer (there is a comment and a test for the fork case); the surprising part is that resume also hits it, which is a side effect of the per-session id prefix introduced with the bridge protocol (#1640) — the previous adapter forwarded raw Codex turn ids, which matched.</p>
  <p><b>Impact.</b> On resume the dropped snapshot is byte-for-byte the value already stored for that turn (I compared payloads), so nothing is lost — it is log noise, but it fires routinely. On fork the forked thread simply has no context-window number until its own first turn completes; the parent's inherited context usage (~20k of 258k tokens here) is discarded although the domain scope policy would let it be stored thread-scoped. Answer to the issue's question: the server should keep dropping unknown-turn snapshots (buffering would re-introduce the batch-wedging fork bug this rule was written for); the Codex bridge should stop emitting turn-scoped replays for turns it never started — thread-scope the context usage, drop the duplicate token usage. A prototype of that (bridge-only, ~20 lines) passes the full codex plugin suite.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Server warns <code>Dropped orphan thread-state snapshot with no stored turn/started</code> for <code>thread/tokenUsage/updated</code> and <code>thread/contextWindowUsage/updated</code> on codex resume</td><td class="ok">Verified</td><td>Live: archive→unarchive→<code>thread tell</code> on <code>thr_gfmnau443m</code> logged both warnings; also after a dev-instance restart forced a second resume. <a href="1727/server.log">1727/server.log</a>, lines below.</td></tr>
    <tr><td>Same on the first turn of a forked codex thread</td><td class="ok">Verified</td><td>Fork <code>thr_3xey7gdhwn</code> with a first prompt: both warnings, turn id <code>bte3e286cb-1-01a013e5-8295…</code> = parent's last Codex turn re-prefixed with the fork session's nonce.</td></tr>
    <tr><td>Snapshots arrive "before the turn's <code>turn/started</code> is stored"</td><td class="unv">Imprecise</td><td>They do not belong to the upcoming turn at all: they are Codex's replay of the <em>previous</em> turn's usage, emitted right after <code>thread/resume</code>/<code>thread/fork</code> and before any <code>turn/start</code> request (raw app-server probe below). There is no ordering race with <code>turn/started</code> persistence.</td></tr>
    <tr><td>Usage lands afterwards; impact is a transiently missing number, not persistent loss</td><td class="ok">Verified, with nuance</td><td>Resume: dropped payload equals the already-stored snapshot for that turn (seq 27 vs dropped, both <code>total 39970 / last 19993</code>), so nothing is even transiently missing. Fork: the forked thread has no context-window usage until its first turn completes.</td></tr>
    <tr><td>Drop site is <code>apps/server/src/internal/events.ts</code> ~L949</td><td class="ok">Verified</td><td>Log site <a href="{P}apps/server/src/internal/events.ts#L941-L951">events.ts#L941-L951</a>; the decision is in <a href="{P}packages/db/src/data/events.ts#L381-L430">packages/db/src/data/events.ts#L381-L430</a>.</td></tr>
    <tr><td>Pre-existing, verified on origin/main</td><td class="unv">Partly</td><td>The server-side drop rule dates from #85 and the fork case is by design (tested). The resume case only exists since the bridge's per-session id prefix landed with #1640 (<code>c5b53caab</code>, merged 6&nbsp;minutes before this issue was filed); the legacy adapter passed raw Codex turn ids, which match across sessions. Nothing on origin/main after the base commit touches this (checked <code>16ceb3a54..origin/main</code>).</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18), package version 0.38.0. Worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-33</code>. Note: the worktree was created at <code>a108fa7ef</code>; I checked out <code>16ceb3a54</code> before the live runs (relevant files are unchanged between the two apart from unrelated item-id bounding).</li>
    <li>Dev instance: app <code>:12350</code>, server <code>:20350</code>, host daemon <code>:28350</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-33-3a3a06c6efd6</code>, host <code>host_675q2rjmvs</code>.</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, pnpm 9.15.0, codex-cli 0.147.0 (provider <code>codex</code>, default model).</li>
    <li>Project <code>proj_9u4kg498pm</code> (local path <code>/tmp/bb-1727-probe/scratch</code>), threads <code>thr_gfmnau443m</code> (resume case) and <code>thr_3xey7gdhwn</code> (fork case).</li>
    <li>Server-log instrumentation used for the second run (adds <code>scope</code> + <code>data</code> to the warn line): <a href="1727/repro/server-log-instrumentation.diff">1727/repro/server-log-instrumentation.diff</a>. Not required to see the warning, only to see which turn id was dropped.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. What codex app-server does on resume / fork (no bb involved)</h3>
  <p>Script <a href="1727/repro/codex-app-server-probe.mjs">1727/repro/codex-app-server-probe.mjs</a> drives three <code>codex app-server</code> children over stdio: (A) <code>thread/start</code> + one tiny turn, (B) <code>thread/resume</code> of that thread in a fresh process, then a turn, (C) <code>thread/fork</code> in a fresh process, then a turn. Run: <code>node codex-app-server-probe.mjs /path/to/any/git/repo</code>. Trimmed output (full: <a href="1727/codex-app-server-probe.log">1727/codex-app-server-probe.log</a>):</p>
  <pre>{esc(probe_trim)}</pre>
  <p><b>Look at</b> the first <code>thread/tokenUsage/updated</code> after <code>thread/resume</code> (turnId <code>01a013de-8818…</code> = the turn from process A) and after <code>thread/fork</code> (turnId <code>01a013de-a00b…</code> = the parent's last turn, on the <em>new</em> thread id <code>01a013de-b0f5…</code>). Both precede any <code>turn/start</code>.</p>

  <h3>B. Live bb: resume and fork on a codex thread</h3>
  <ol>
    <li><code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code>; note Server URL and Data dir. <code>export BB_SERVER_URL=http://localhost:20350</code> (yours will differ). <code>CLI="node packages/scripts/dist/commands/run-cli.js"</code> (after one <code>pnpm bb:dev</code>). Unset <code>BB_THREAD_ID</code> if your shell has one, otherwise <code>thread tell</code> fails with <code>Sender thread is invalid</code>.</li>
    <li>Create a scratch git repo and a project: <code>curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/bb-1727-probe/scratch","hostId":"&lt;id from $CLI machine list&gt;"}}}}'</code></li>
    <li>Spawn and finish one codex turn: <code>$CLI thread spawn --project &lt;proj&gt; --provider codex --permission-mode accept-edits --prompt "Reply only with ok." --json</code>; <code>$CLI thread wait &lt;thr&gt;</code>.</li>
    <li>Resume path: <code>$CLI thread archive &lt;thr&gt;</code>; <code>$CLI thread unarchive &lt;thr&gt;</code>; <code>$CLI thread tell &lt;thr&gt; "Reply only with ok."</code>; <code>$CLI thread wait &lt;thr&gt;</code>. (Any session release works the same: daemon restart, or waiting &gt;30&nbsp;min for idle reaping — <a href="{P}apps/host-daemon/src/app.ts#L66">IDLE_PROVIDER_SESSION_REAP_AFTER_MS</a>.)</li>
    <li>Fork path: <code>$CLI thread fork &lt;thr&gt; --workspace reuse --prompt "Reply only with ok." --json</code>; <code>$CLI thread wait &lt;fork thr&gt;</code>.</li>
    <li>Look: <code>grep orphan &lt;Data dir&gt;/logs/server.1.log</code></li>
  </ol>
  <p><b>Expected:</b> no warnings; a resume re-reporting the same turn's usage is a no-op, and a fork carries the parent's context usage. <b>Actual</b> (my run; the last four lines carry the instrumentation fields):</p>
  <pre>{esc(orphan_lines)}</pre>
  <p>Cross-check against what is stored for the resumed thread (<code>sqlite3 &lt;Data dir&gt;/bb.db</code>): the second warning names Codex turn <code>01a013e4-49fe…</code> under prefix <code>bt2e052653-1-</code>, but that turn's <code>turn/started</code> was stored under <code>bt0b93b7ec-1-</code> (seq 22), and its usage snapshot is already at seq 27 with the identical numbers:</p>
  <pre>sqlite&gt; select sequence,type,turn_id,substr(data,1,120) from events where thread_id='thr_gfmnau443m' and type in ('turn/started','thread/tokenUsage/updated') order by sequence;
10|turn/started|bt4d7c8505-1-01a013e3-8409-7fb2-91fd-f37f0174c383|{{"providerThreadId":"01a013e3-834a-7aa2-8e56-7ecfe0707907"}}
15|thread/tokenUsage/updated|bt4d7c8505-1-01a013e3-8409-7fb2-91fd-f37f0174c383|{{…"total":{{"totalTokens":19977,…}},"last":{{"totalTokens":19977,…
22|turn/started|bt0b93b7ec-1-01a013e4-49fe-7570-8577-320efd692a83|{{"providerThreadId":"01a013e3-834a-7aa2-8e56-7ecfe0707907"}}
27|thread/tokenUsage/updated|bt0b93b7ec-1-01a013e4-49fe-7570-8577-320efd692a83|{{…"total":{{"totalTokens":39970,…}},"last":{{"totalTokens":19993,…
34|turn/started|bt2e052653-1-01a013e5-8295-7f52-aeff-0dfc8b1bbe94|{{"providerThreadId":"01a013e3-834a-7aa2-8e56-7ecfe0707907"}}
39|thread/tokenUsage/updated|bt2e052653-1-01a013e5-8295-7f52-aeff-0dfc8b1bbe94|{{…"total":{{"totalTokens":59979,…}},"last":{{"totalTokens":20009,…</pre>
  <p>Three sessions, three prefixes (<code>bt4d7c8505-1-</code>, <code>bt0b93b7ec-1-</code>, <code>bt2e052653-1-</code>): each resume spawns a new bridge/child pair, so both the entropy and the serial change. For the fork (<code>thr_3xey7gdhwn</code>) the dropped snapshot names <code>01a013e5-8295…</code>, i.e. the parent's third turn, under the fork session's prefix <code>bte3e286cb-1-</code>; the forked thread's own events start at its first <code>turn/started</code> (<code>bte3e286cb-1-01a013e6-0fe9…</code>).</p>

  <h3>C. Repro test at the bridge (fails on 16ceb3a54)</h3>
  <p>File: <a href="1727/repro/bridge.resume-usage-replay.test.ts">plugins/provider-codex/src/bridge/bridge.resume-usage-replay.test.ts</a>. It needs a 20-line opt-in in the test fixture <code>fake-codex-app-server.mjs</code> so that <code>thread/resume</code> for a <code>usage-replay-*</code> thread id replays last-turn usage exactly like the real app-server (<a href="1727/repro/fake-codex-app-server.diff">1727/repro/fake-codex-app-server.diff</a>). Run from <code>plugins/provider-codex</code>: <code>pnpm exec vitest run src/bridge/bridge.resume-usage-replay.test.ts</code>. The final assertion fails: the replayed usage for Codex turn <code>turn-fx-1</code> is emitted as <code>bt…-2-turn-fx-1</code> while its <code>turn/started</code> went out as <code>bt…-1-turn-fx-1</code> — precisely the pair the server compares. Output (<a href="1727/repro-test-output.txt">1727/repro-test-output.txt</a>):</p>
  <pre>{esc(test_out)}</pre>
  <pre>{esc(test_src)}</pre>
  <pre>{esc(fake_diff)}</pre>

  <h2>Root cause</h2>
  <ol>
    <li><b>Codex replays last-turn usage on resume/fork.</b> Verified with the raw probe (section A): <code>thread/resume</code> and <code>thread/fork</code> each emit one <code>thread/tokenUsage/updated</code> carrying the rollout's last turn id, before any turn is started. The bridge translates it 1:1 into <code>thread/tokenUsage/updated</code> + <code>thread/contextWindowUsage/updated</code>, both turn-scoped: <a href="{P}plugins/provider-codex/src/event-translation.ts#L975-L1016">event-translation.ts#L975-L1016</a>. The bridge sends <code>thread/resume</code>/<code>thread/fork</code> at <a href="{P}plugins/provider-codex/src/bridge/bridge.ts#L1135-L1160">bridge.ts#L1135-L1160</a>.</li>
    <li><b>The bridge re-mints turn ids per session.</b> <code>bridgeIdEntropyPrefix</code> is a per-process nonce (<a href="{P}plugins/provider-codex/src/bridge/bridge.ts#L369">bridge.ts#L369</a>), each session gets <code>idPrefix = entropy + serial + "-"</code> (<a href="{P}plugins/provider-codex/src/bridge/bridge.ts#L1045-L1055">#L1045-L1055</a>), and <code>remapScope</code>/<code>remapEvent</code> stamp it on every turn scope (<a href="{P}plugins/provider-codex/src/bridge/bridge.ts#L491-L513">#L491-L513</a>). This is the protocol's rule ("turn ids embed per-bridge-instance entropy … so ids never collide across process restarts or session resumes", <a href="{P}docs/provider-bridge-protocol.md#L99-L109">provider-bridge-protocol.md#L99-L109</a>), so it is not itself a bug. Its consequence: the replayed usage for Codex turn X is emitted as <code>&lt;newPrefix&gt;X</code>, but bb stored <code>turn/started</code> for <code>&lt;oldPrefix&gt;X</code> (resume) or never stored it at all (fork). The protocol also says a bridge "must never reference a turn id bb has not seen" (<a href="{P}docs/provider-bridge-protocol.md#L139-L141">#L139-L141</a>); the codex bridge does here.</li>
    <li><b>The server drops it by design.</b> <code>resolveDaemonTurnStartDisposition</code> returns <code>skip-orphan-snapshot</code> for the two usage types (and <code>provider/unhandled</code>) when no <code>turn/started</code> exists for <code>(threadId, turnId)</code>, instead of throwing <code>MissingStoredTurnStartedError</code> and rolling back the batch: <a href="{P}packages/db/src/data/events.ts#L381-L430">packages/db/src/data/events.ts#L381-L430</a>. The comment there already describes the fork case; the route logs each skip at warn level: <a href="{P}apps/server/src/internal/events.ts#L941-L951">apps/server/src/internal/events.ts#L941-L951</a>. Tested in <a href="{P}packages/db/test/data/events.test.ts#L437">events.test.ts#L437</a>. There is no buffering, and none is needed: the snapshot is not for the upcoming turn.</li>
  </ol>
  <p><b>Why the symptom follows.</b> Resume: same Codex turn, different bb id → orphan → warn ×2 (tokenUsage + contextWindowUsage), payload identical to what is stored → no data effect. Fork: parent's turn id → orphan → warn ×2, and the parent's context-window usage, which the fork genuinely inherits, is discarded until the fork's first turn reports its own.</p>
  <p><b>Deeper point.</b> The domain scope policy already anticipates this: <code>thread/contextWindowUsage/updated</code> is <code>thread-or-turn</code> ("providers can report it before, during, or after a turn") while <code>thread/tokenUsage/updated</code> is turn-only — <a href="{P}packages/domain/src/thread-event-scope.ts#L122-L127">thread-event-scope.ts#L122-L127</a>. The ACP bridge already emits thread-scoped context usage when no turn is open (<a href="{P}plugins/provider-acp/src/event-translation.ts#L806-L813">acp event-translation.ts#L806-L813</a>); the codex bridge does not make that distinction. Also, the warn line does not include the turn id, which is why the issue could not tell which turn was being dropped.</p>

  <h2>Proposed fix (first principles)</h2>
  <p>Fix in the Codex plugin (provider translation is the plugin's job; the server rule is a correct safety net and should stay). In <code>toCanonicalEvents</code> (<a href="{P}plugins/provider-codex/src/bridge/bridge.ts#L620-L656">bridge.ts#L620-L656</a>) track the Codex turn ids this session has emitted <code>turn/started</code> for; when a <code>thread/tokenUsage/updated</code> or <code>thread/contextWindowUsage/updated</code> arrives for any other turn (only replays on resume/fork can produce that), re-scope the context-window usage to <code>{{kind:"thread"}}</code> and drop the token usage (turn-only by policy; on resume it duplicates the stored snapshot, on fork <code>total</code> is the parent's cumulative count anyway). Prototype diff: <a href="1727/repro/prototype-fix-bridge.diff">1727/repro/prototype-fix-bridge.diff</a> (applied by <a href="1727/repro/apply-prototype-fix.py">apply-prototype-fix.py</a>); a variant of the repro test that encodes the fixed behavior passes (<a href="1727/repro/bridge.resume-usage-replay.fixed.test.ts">bridge.resume-usage-replay.fixed.test.ts</a>) and the full <code>bb-plugin-provider-codex</code> suite stays green with it (165 passed; only the intentionally failing repro test fails — <a href="1727/prototype-suite-output.txt">1727/prototype-suite-output.txt</a>).</p>
  <pre>{esc(proto_diff)}</pre>
  <p>Before landing: bound <code>startedCodexTurnIds</code> like the item-id sets on origin/main (<code>MAX_TRACKED_ITEM_IDS_PER_SESSION</code>), extend the fake app-server so a bridge test covers both resume and fork replay, and confirm in the app that a thread-scoped context usage on a fresh fork renders (the consumer <code>extractThreadContextWindowUsage</code> ignores scope, so it should). Optionally, server side: log the dropped snapshot's <code>scope.turnId</code> and lower the level to <code>info</code>/<code>debug</code>, since the fork replay is expected traffic. What could go wrong: nothing user-visible — this only touches events the server discards today, plus it stores one extra thread-scoped context snapshot per resume/fork (pruned by the existing age-prunable rule). No wire shape changes, so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump. Do <em>not</em> "fix" it by making the codex prefix stable across sessions or by buffering server-side: the former contradicts the protocol's collision rule, the latter re-creates the batch-wedging fork failure the drop was added for.</p>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>Related issues</h2>
  <ul>
    <li>#1640 — provider bridge protocol; introduced the per-session id prefix that turns the resume replay into an orphan (issue was filed from its final validation).</li>
    <li>#1224 — the cross-resume id collision that motivated per-instance entropy in ids.</li>
    <li>#85 — introduced the orphan-snapshot drop for native forks.</li>
    <li>#1320 — bridge-minting rule ("ids that reach bb's persistence are always minted by bb-authored bridge code").</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Artifacts</h3>
  <ul>
    <li><a href="1727/codex-app-server-probe.log">codex-app-server-probe.log</a> — raw app-server probe (full).</li>
    <li><a href="1727/server.log">server.log</a>, <a href="1727/host-daemon.log">host-daemon.log</a> — dev instance logs covering both live runs.</li>
    <li><a href="1727/instrumentation.diff">instrumentation.diff</a> — server warn-log instrumentation used for the second run.</li>
    <li><a href="1727/repro/">1727/repro/</a> — probe script, repro test, fake app-server diff, prototype fix + fixed-behavior test, this report's generator.</li>
  </ul>
  <h3>Commands run (abridged)</h3>
  <pre>gh issue view 1727 --comments --json title,body,comments,labels
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
node /tmp/bb-reports/issues/1727/repro/codex-app-server-probe.mjs /tmp/bb-1727-probe/scratch
git checkout 16ceb3a54 &amp;&amp; pnpm exec turbo run build
scripts/bb-dev-app current
curl -s -X POST http://localhost:20350/api/v1/projects -H 'content-type: application/json' -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/bb-1727-probe/scratch","hostId":"host_675q2rjmvs"}}}}'
CLI="node packages/scripts/dist/commands/run-cli.js"; export BB_SERVER_URL=http://localhost:20350
$CLI thread spawn --project proj_9u4kg498pm --provider codex --permission-mode accept-edits --title "1727 repro" --prompt "Reply only with ok." --json
$CLI thread archive thr_gfmnau443m; $CLI thread unarchive thr_gfmnau443m
$CLI thread tell thr_gfmnau443m "Reply only with ok."; $CLI thread wait thr_gfmnau443m
grep orphan &lt;data dir&gt;/logs/server.1.log
# apply instrumentation.diff, scripts/bb-dev-app current (restart => session release => resume)
$CLI thread tell thr_gfmnau443m "Reply only with ok."; $CLI thread wait thr_gfmnau443m
$CLI thread fork thr_gfmnau443m --workspace reuse --title "1727 fork" --prompt "Reply only with ok." --json; $CLI thread wait thr_3xey7gdhwn
sqlite3 &lt;data dir&gt;/bb.db "select sequence,type,turn_id,data from events where thread_id in ('thr_gfmnau443m','thr_3xey7gdhwn') ..."
cd plugins/provider-codex &amp;&amp; pnpm exec vitest run src/bridge/bridge.resume-usage-replay.test.ts   # fails (repro)
python3 /tmp/bb-reports/issues/1727/repro/apply-prototype-fix.py plugins/provider-codex/src/bridge/bridge.ts
pnpm exec turbo run typecheck --filter=bb-plugin-provider-codex; cd plugins/provider-codex &amp;&amp; pnpm exec vitest run   # 165 pass, repro test fails as designed
git checkout -- plugins/provider-codex/src/bridge/bridge.ts
pnpm dev:stop</pre>
</main></body></html>
'''
pathlib.Path('/tmp/bb-reports/issues/1727.html').write_text(page)
print(len(page))
