import html, json, pathlib

R = pathlib.Path("/tmp/bb-reports/issues/1914")
def esc(p): return html.escape(pathlib.Path(p).read_text())
def strip(p):
    import re
    return html.escape(re.sub(r"\x1b\[[0-9;]*m", "", pathlib.Path(p).read_text()))

server_test = esc(R / "repro/issue-1914-thread-failed-provider-error.test.ts")
wf_test = esc(R / "repro/issue-1914-worker-failed.test.ts")
server_out = strip(R / "repro/server-test-output.txt")
wf_out = strip(R / "repro/workflows-test-output.txt")
patch = esc(R / "repro/prototype-fix.patch")
fake = esc(R / "repro/fake-429.mjs")
wf_src = esc(R / "repro/collect.workflow.js")
status = html.escape(json.dumps(json.loads((R / "workflow-status.out").read_text()), indent=2))
history_lines = (R / "workflow-history.out").read_text().strip().splitlines()
call_rec = json.loads(history_lines[1])
call_short = html.escape(json.dumps({k: call_rec[k] for k in ["id","callIndex","resolvedProvider","resolvedModel","status","childThreadId","providerRetryAttempts","error","startedAt","finishedAt"]}, indent=2))
child_events = esc(R / "child-thread-events.txt")
child_log = (R / "child-thread-log.json").read_text()
evs = json.loads(child_log)
evs = evs if isinstance(evs, list) else evs.get("events", evs)
child_detail = html.escape("\n".join(
    f"{e.get('type')}  {json.dumps(e.get('data', e))[:420]}" for e in evs
    if e.get("type") in ("provider/rateLimits/updated","provider/error","turn/completed","item/completed")))
origin_note = esc(R / "origin-notification.txt")
fake_log = esc(R / "fake-429.log")

BASE = "d81fee6f47178c75f6ecf23d80bb69c4a3e9e5c3"
def L(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="https://github.com/get-bb/bb/blob/{BASE}/{path}{frag}"><code>{path}:{a}</code></a>'

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1914 A rate-limited workflow call reports only 'Workflow worker failed'</title>
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
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
  details summary {{ cursor:pointer; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1914 · A rate-limited workflow call reports only 'Workflow worker failed' — the 429 is hidden in a child thread</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill med">Priority: Medium</span> <span class="pill">Effort: n/a</span> <span class="pill">cli</span> <span class="pill">plugins</span> <span class="pill">workflows</span>
    <a href="https://github.com/get-bb/bb/issues/1914">open on GitHub</a>
    <span>2026-08-19 · base <code>d81fee6f</code> (worktree HEAD 0f6759a74, +2 unrelated UI/tasks commits)</span>
  </p>
  <p><strong>Verdict:</strong> <span class="verdict">REPRODUCED</span> · <strong>Root-cause confidence:</strong> high</p>

  <h2>1. TL;DR</h2>
  <p>When a workflow worker thread dies because the provider rejected the request (here: Claude Code 429 "session limit"), <code>bb workflows status/history</code>, the run record, and the completion notification sent back to the origin agent all say only <code>Workflow worker failed</code>. The 429 details exist, but only as a <code>provider/error</code> event (with <code>errorInfo {{ category: "rate-limit", providerCode: "rate_limit_event", httpStatusCode: 429 }}</code>) inside the hidden child thread.</p>
  <p>The actual defect is in the server, not in the workflows plugin. The plugin-facing <code>thread.failed</code> event is built by <code>getLastThreadErrorMessage()</code>, which reads <em>only</em> <code>system/error</code> rows. A provider-originated failure is persisted as <code>provider/error</code> + <code>turn/completed status=failed</code> and never writes a <code>system/error</code> row, so <code>thread.failed</code> fires with <code>error: null</code>. The workflows plugin then falls back to <code>error ?? "Workflow worker failed"</code>. A side effect: the workflows plugin's own transient-provider retry classifier (which matches <code>/rate.?limit|429/</code> on the error text) never sees the real text, so it is dead for every provider-originated failure. The automations plugin has the identical problem ("Turn failed").</p>
  <p>Reproduced end to end on a dev instance by pointing Claude Code at a fake Anthropic endpoint that answers 429 with the unified rate-limit headers: the run fails in ~4 s with <code>"error": "Workflow worker failed"</code> while the child thread holds the full 429. Two failing vitest repros (server seam + workflows plugin) are included, plus a small prototype patch that makes the server test pass.</p>

  <h2>2. Claims vs findings</h2>
  <table><tr><th>Claim from the issue</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>A call that dies on a provider 429 surfaces as <code>Workflow worker failed</code> in <code>bb workflows status</code> and <code>history</code></td><td class="ok">Verified</td><td>Live run <code>wfr_4469d4b6…</code>: status JSON <code>"error": "Workflow worker failed"</code>, call record <code>"error": "Workflow worker failed"</code> (section 4, step 6/7).</td></tr>
    <tr><td>The real cause is present only in the hidden child thread (<code>provider/rateLimits/updated</code> + <code>provider/error</code> with <code>category: rate-limit, providerCode: rate_limit_event, httpStatusCode: 429</code>)</td><td class="ok">Verified</td><td>Child <code>thr_u982areftg</code> (visibility <code>hidden</code>, status <code>error</code>) events 6 and 10 carry exactly those fields; no <code>system/error</code> row exists (section 4, step 8).</td></tr>
    <tr><td>The call was dead ~3.5 s in</td><td class="ok">Verified (analogous)</td><td>Our call: startedAt 1787153297760 → finishedAt 1787153301251 = 3.49 s.</td></tr>
    <tr><td>Not a one-off: a second run failed 13 of 29 calls the same way</td><td class="unv">Unverified</td><td>We did not have the reporter's records; but the mechanism is deterministic (any provider-originated failure on any provider takes this path), so it is expected.</td></tr>
    <tr><td><code>Workflow worker failed</code> is indistinguishable from a bb-side crash</td><td class="ok">Verified</td><td>The identical string is also what a null-error <code>thread.failed</code> yields for any other provider error (auth, bad request, context overflow). Only bb-side <code>system/error</code>s (process exit, watchdog, command failure) propagate text. The origin-thread notification also says just <code>Error: Workflow worker failed</code> and the origin agent spent a turn investigating (section 4, step 9 and screenshot).</td></tr>
    <tr><td><code>fetch failed</code> comes from a bb server stall</td><td class="unv">Unverified</td><td>Not investigated here; out of scope.</td></tr>
    <tr><td>Suggested fix: propagate child's <code>provider/error</code> (category/providerCode/httpStatusCode) into the call error</td><td class="ok">Agree, but at the server layer</td><td>The info must reach the <code>thread.failed</code> payload (server), not be dug out by the workflows plugin. See section 6.</td></tr>
  </table>

  <h2>3. Environment</h2>
  <ul>
    <li>bb monorepo worktree at <code>0f6759a74</code> (base <code>d81fee6f</code> plus two unrelated commits: #1912 thread TOC breakpoint, #1923 tasks presets); bb-app version 0.39.0; <code>git log d81fee6f..origin/main -- plugins/workflows apps/server/src/services/plugins apps/server/src/services/threads/thread-data.ts</code> is empty → not fixed on main.</li>
    <li>Linux 7.0.0-29-generic (Ubuntu), node v24.18.0, Claude Code CLI 2.1.235, codex-cli 0.148.0 (origin thread only).</li>
    <li>Own dev instance: App <code>http://localhost:11386</code>, Server <code>http://localhost:19386</code>, Host daemon <code>127.0.0.1:27386</code>, data dir <code>~/.bb-dev/projects-bb-.claude-worktrees-wf_d5c47f31-487-6-484bd182cef1</code> (deleted at cleanup).</li>
    <li>Fake Anthropic API: <code>node fake-429.mjs 45929</code>, injected with <code>ANTHROPIC_BASE_URL=http://127.0.0.1:45929</code> exported before <code>scripts/bb-dev-app current</code> (verified present in the host-daemon process environment).</li>
  </ul>

  <h2>4. Minimal reproduction</h2>
  <h3>A. Unit-level (fastest, no provider needed)</h3>
  <ol>
    <li>Copy <a href="1914/repro/issue-1914-thread-failed-provider-error.test.ts">issue-1914-thread-failed-provider-error.test.ts</a> to <code>apps/server/test/services/plugins/</code> and run it from <code>apps/server</code>: <code>pnpm exec vitest run test/services/plugins/issue-1914-thread-failed-provider-error.test.ts</code>. It installs an observer plugin, seeds an active claude-code thread, and POSTs the exact four events the claude-code provider emits for a hard rate-limit rejection through the real <code>/internal/session/events</code> seam.
<pre>expected: thread.failed payload.error describes the 429
actual:
{server_out}</pre>
The thread does reach status <code>error</code> and <code>thread.failed</code> fires, but <code>error</code> is <code>null</code>.</li>
    <li>Copy <a href="1914/repro/issue-1914-worker-failed.test.ts">issue-1914-worker-failed.test.ts</a> to <code>plugins/workflows/src/</code> and run <code>pnpm exec vitest run src/issue-1914-worker-failed.test.ts</code> from <code>plugins/workflows</code>. It feeds that <code>null</code> into the service exactly as <code>server.ts</code> does:
<pre>{wf_out}</pre></li>
  </ol>

  <h3>B. Live end-to-end (real claude-code process, real 429)</h3>
  <ol>
    <li>Start a fake Anthropic API that answers every call with HTTP 429 and the unified rate-limit headers (<a href="1914/repro/fake-429.mjs">fake-429.mjs</a>): <code>node fake-429.mjs 45929</code>. Sanity check: <code>ANTHROPIC_BASE_URL=http://127.0.0.1:45929 claude -p "Reply only with ok." --output-format stream-json --verbose</code> prints a <code>rate_limit_event</code> with <code>status: "rejected"</code> immediately (no retries).</li>
    <li>Start a dev instance with the override in its environment: <code>export ANTHROPIC_BASE_URL=http://127.0.0.1:45929; scripts/bb-dev-app current</code>. Enable the workflows plugin: <code>curl -X POST $BB_SERVER_URL/api/v1/plugins/workflows/enable</code>.</li>
    <li>Create a scratch git repo and a project (<code>POST /api/v1/projects</code> with a <code>local_path</code> source), then spawn an origin thread with a cheap provider: <code>bb thread spawn --project &lt;proj&gt; --environment /tmp/bb-1914/qa-repo --provider codex --prompt "Reply only with ok." --title "1914 origin"</code> → <code>thr_4nt62zknyn</code> (idle, env <code>env_wbxyk8aus8</code>).</li>
    <li>Put this workflow inside the workspace (<a href="1914/repro/collect.workflow.js">collect.workflow.js</a>):<pre>{wf_src}</pre></li>
    <li>From the origin thread context (<code>BB_THREAD_ID=thr_4nt62zknyn BB_PROJECT_ID=&lt;proj&gt; BB_ENVIRONMENT_ID=env_wbxyk8aus8</code>), run <code>bb workflows run --file /tmp/bb-1914/qa-repo/collect.workflow.js</code>:
<pre>{{"runId":"wfr_4469d4b6-7bef-4f17-ad96-430190dc103f","name":"collect-1914","status":"queued"}}</pre></li>
    <li><code>bb workflows status wfr_4469d4b6-7bef-4f17-ad96-430190dc103f</code> a few seconds later:
<pre>expected: something like  "error": "rate limited (429): You've hit your session limit · resets 6:24pm (UTC)"
actual (excerpt; full JSON in appendix):
  "status": "failed",
  "phase": "Collect",
  "error": "Workflow worker failed",
  "calls": {{ "total": 1, "queued": 0, "running": 0, "succeeded": 0, "failed": 1, "cancelled": 0 }},
  "startedAt": 1787153296809,
  "finishedAt": 1787153301255</pre></li>
    <li><code>bb workflows history wfr_4469d4b6-…</code> call record (excerpt):<pre>{call_short}</pre></li>
    <li>The hidden child thread holds the real cause. <code>sqlite3 bb.db "select sequence,type from events where thread_id='thr_u982areftg' order by sequence"</code>:<pre>{child_events}</pre>No <code>system/error</code> row. <code>bb thread log thr_u982areftg --json</code> (relevant events):<pre>{child_detail}</pre></li>
    <li>The notification the workflows plugin sent back to the origin agent is equally opaque (event 19 on the origin thread):<pre>{origin_note}</pre>The origin (codex) agent then spent a turn investigating ("Worked for 1m 3s" in the screenshot) — the exact cost the issue describes.</li>
  </ol>
  <figure><img src="assets/1914-child-thread.png" alt="Hidden worker thread showing Provider rate limit reached / error and the session-limit text"><figcaption>The hidden worker thread <code>thr_u982areftg</code> in the app: "Provider rate limit reached · error — You've hit your session limit · resets 6:24pm (UTC)". This is the only place the 429 is visible.</figcaption></figure>
  <figure><img src="assets/1914-origin-thread.png" alt="Origin thread after receiving the 'Workflow worker failed' notification"><figcaption>The origin thread <code>thr_4nt62zknyn</code> after the workflow notification ("Error: Workflow worker failed"); the agent had to go digging before it could say the worker was rate limited.</figcaption></figure>
  <p>Repro files: <a href="1914/repro/">1914/repro/</a> (tests, fake API, workflow, helper scripts, raw outputs, prototype patch).</p>

  <h2>5. Root cause</h2>
  <p><strong>Chain:</strong></p>
  <ol>
    <li>The claude-code provider plugin translates a hard rate-limit rejection into <code>provider/rateLimits/updated</code>, a <code>provider/error</code> carrying <code>errorInfo</code>, and a <code>turn/completed status: "failed"</code> (no error text on the turn/completed): {L("plugins/provider-claude-code/src/event-translation.ts", 1466, 1515)} and the <code>rate_limit_event</code> case at {L("plugins/provider-claude-code/src/event-translation.ts", 1526, 1560)}. Nothing on this path emits <code>system/error</code>; that event type is reserved for bb-side failures (provider process exit {L("apps/host-daemon/src/runtime-manager.ts", 1282, 1312)}, turn-start watchdog {L("packages/agent-runtime/src/runtime.ts", 392, 398)}, command failures {L("apps/server/src/services/threads/thread-lifecycle.ts", 1712, 1720)}).</li>
    <li>The server turns <code>turn/completed failed</code> into the lifecycle event <code>run.failed</code> → thread status <code>error</code>: {L("apps/server/src/internal/turn-completed-events.ts", 21, 30)}.</li>
    <li>Entering <code>error</code> emits the plugin event <code>thread.failed</code>: {L("apps/server/src/services/plugins/plugin-thread-events.ts", 44, 54)} → {L("apps/server/src/services/plugins/plugin-service.ts", 1473, 1478)}, whose <code>error</code> field is <code>getLastThreadErrorMessage(db, thread.id)</code>.</li>
    <li><code>getLastThreadErrorMessage</code> only looks at <code>system/error</code> rows: {L("apps/server/src/services/threads/thread-data.ts", 167, 176)} via {L("packages/db/src/data/events.ts", 3049, 3064)} (<code>eq(events.type, "system/error")</code>). The contract even documents this: {L("packages/plugin-sdk/src/backend-contract.ts", 149, 151)} — "error is the latest system/error event message, when one exists". So for every provider-originated failure the payload is <code>error: null</code>.</li>
    <li>The workflows plugin maps <code>null</code> to the generic string: {L("plugins/workflows/src/server.ts", 233, 235)} → {L("plugins/workflows/src/service.ts", 1519, 1520)} <code>failThreadCall(threadId, error ?? "Workflow worker failed")</code>. That string becomes the call error, the run error (<code>wakeCall</code> rejects with it, {L("plugins/workflows/src/service.ts", 900)}), the status/history output, and the origin notification.</li>
  </ol>
  <p><strong>Deeper consequence:</strong> the workflows plugin already contains a transient-provider retry path keyed on the error text — {L("plugins/workflows/src/service.ts", 104, 131)} matches <code>/rate.?limit/</code>, <code>429</code>, overload, etc., and {L("plugins/workflows/src/service.ts", 866, 881)} retries up to two times. Because the text never arrives for provider-originated failures, that classifier only ever sees <code>"Workflow worker failed"</code>, so it is effectively dead for the cases it was written for (our call shows <code>providerRetryAttempts: 0</code>). The same null reaches the automations plugin, which records <code>"Turn failed"</code> ({L("plugins/automations/src/run.ts", 325)}).</p>
  <p><strong>Why the report's two cases look alike:</strong> a bb-side stall/crash writes <code>system/error</code> and therefore propagates real text (e.g. "Provider process exited…"), while a provider 429 propagates nothing; the workflows fallback string is what makes them look alike, but the missing data is upstream of it.</p>

  <h2>6. Proposed fix (first principles)</h2>
  <p>Fix at the server boundary, where the data already lives, so every plugin consumer (workflows, automations, third-party) benefits:</p>
  <ol>
    <li><strong>packages/db</strong>: add a query that returns the latest failure-describing row for a thread across <code>system/error</code> <em>and</em> <code>provider/error</code> (ideally restricted to events at/after the last root <code>turn/started</code> so a stale <code>willRetry: true</code> provider error from an earlier, recovered turn cannot leak into a later unrelated failure).</li>
    <li><strong>apps/server <code>getLastThreadErrorMessage</code></strong>: format <code>provider/error</code> as <code>detail ?? message</code> plus <code>(category, HTTP nnn, providerCode)</code>. Optionally extend the <code>thread.failed</code> payload with a structured <code>errorInfo: ProviderErrorInfo | null</code> (and the rate-limit <code>resetsAtMs</code> from the latest <code>provider/rateLimits/updated</code>) so plugins can render "rate limited (429), resets HH:MM" without parsing text. A new payload field is new public plugin API → follow the AGENTS.md <code>experimental_</code>/<code>docs/api_to_audit.md</code> rule, and update the doc comment in <code>backend-contract.ts</code>. No host-daemon wire change is involved (server-internal), so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump.</li>
    <li><strong>plugins/workflows</strong>: keep <code>error ?? "Workflow worker failed"</code> as the last-resort fallback, but also decide retry policy from the structured category: a 429 with a blocked subscription window resetting hours away should <em>not</em> burn the two 1 s/4 s retries (and should probably fail the call immediately with a clear "rate limited, resets …" message), whereas overload/5xx should.</li>
  </ol>
  <p>A minimal prototype of steps 1–2 (<a href="1914/repro/prototype-fix.patch">prototype-fix.patch</a>, 84 lines) makes the server repro test pass together with the existing <code>plugin-thread-events.test.ts</code> (12/12) and typechecks <code>@bb/server</code>; it is not scoped to the failing turn yet, which is the one thing to add before shipping:</p>
  <pre>{patch}</pre>
  <p>Risk: the workflows retry classifier will start matching rate-limit text and retry twice (5 s total) before failing; harmless but wasteful, hence step 3.</p>

  <h2>7. PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>8. Related issues</h2>
  <ul>
    <li>Automations plugin shows the same <code>"Turn failed"</code> for provider-originated failures (same <code>thread.failed</code> payload) — not filed separately; fixing the server path fixes both.</li>
    <li>Workflows transient-provider retry (#733 introduced <code>isRetryableProviderFailure</code>) is dead for provider-originated failures for the same reason.</li>
  </ul>

  <h2>9. Appendix</h2>
  <details><summary>Full <code>bb workflows status</code> output</summary><pre>{status}</pre></details>
  <details><summary>Fake 429 server log (the extra POSTs after the first are from the claude-code process's own retries/housekeeping; the worker turn itself failed on the first rejected response)</summary><pre>{fake_log}</pre></details>
  <details><summary>Server repro test source</summary><pre>{server_test}</pre></details>
  <details><summary>Workflows repro test source</summary><pre>{wf_test}</pre></details>
  <details><summary>Fake Anthropic 429 server</summary><pre>{fake}</pre></details>
  <details><summary>Commands run (abridged)</summary><pre>gh issue view 1914 --repo get-bb/bb --comments
pnpm install --frozen-lockfile --prefer-offline; pnpm exec turbo run build
git fetch origin main; git log d81fee6f..origin/main --oneline      # 2 unrelated commits
# code trace
grep -rn "Workflow worker failed" plugins/workflows/src
grep -rn "thread.failed" apps/server/src packages/plugin-sdk/src plugins/*/src
# unit repros
cd apps/server && pnpm exec vitest run test/services/plugins/issue-1914-thread-failed-provider-error.test.ts
cd plugins/workflows && pnpm exec vitest run src/issue-1914-worker-failed.test.ts
# live repro
node /tmp/bb-reports/issues/1914/repro/fake-429.mjs 45929 &
ANTHROPIC_BASE_URL=http://127.0.0.1:45929 claude -p "Reply only with ok." --output-format stream-json --verbose
export ANTHROPIC_BASE_URL=http://127.0.0.1:45929; scripts/bb-dev-app current
curl -X POST http://localhost:19386/api/v1/plugins/workflows/enable
curl -X POST http://localhost:19386/api/v1/projects -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/bb-1914/qa-repo","hostId":"host_nccjkbdw72"}}}}'
bb thread spawn --project proj_wqncx5cr2y --environment /tmp/bb-1914/qa-repo --provider codex --prompt "Reply only with ok." --title "1914 origin" --json
bb workflows validate --file /tmp/bb-1914/qa-repo/collect.workflow.js
bb workflows run --file /tmp/bb-1914/qa-repo/collect.workflow.js
bb workflows status wfr_4469d4b6-7bef-4f17-ad96-430190dc103f
bb workflows history wfr_4469d4b6-7bef-4f17-ad96-430190dc103f
bb thread show thr_u982areftg; bb thread log thr_u982areftg --json
sqlite3 &lt;data-dir&gt;/bb.db "select sequence,type from events where thread_id='thr_u982areftg' order by sequence"
# prototype fix
git apply /tmp/bb-reports/issues/1914/repro/prototype-fix.patch; pnpm exec turbo run typecheck --filter=@bb/server; (tests) ; git checkout -- .
# cleanup
pnpm dev:stop; rm -rf ~/.bb-dev/projects-bb-.claude-worktrees-wf_d5c47f31-487-6-484bd182cef1 /tmp/bb-1914</pre></details>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/1914.html").write_text(page)
print("ok", len(page))
