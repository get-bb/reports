import html, pathlib
R = pathlib.Path("/tmp/bb-reports/issues/1604/repro")
def esc(p): return html.escape(R.joinpath(p).read_text())
test_src = esc("issue-1604.repro.test.ts")
vitest_out = esc("vitest-output.txt")
census = esc("census.sh")
patch = esc("timing-patch.diff")
reaplines = esc("host-daemon-reap-lines.jsonl")
threadlog = esc("thread-log-after-resume.txt")
evq = esc("events-provider-thread-id.txt")
BASE="16ceb3a540f81c1189efaffb27a39b1d9443abf5"
def L(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="https://github.com/get-bb/bb/blob/{BASE}/{path}{frag}"><code>{path}:{a}{"-"+str(b) if b else ""}</code></a>'

doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1604 Idle agent processes are never reclaimed for non-Codex providers</title>
<style>
  :root {{ --canvas:#fafaf8; --ink:#1a1a1a; --muted:#666; --line:#e2e2de; --accent:#0052cc; --high:#b60205; --ok:#1a7f37; --warn:#9a6700; }}
  body {{ margin:0; background:var(--canvas); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; }}
  main {{ max-width:900px; margin:0 auto; padding:40px 24px 80px; }}
  h1 {{ font-size:26px; line-height:1.25; margin:0 0 6px; }}
  h2 {{ font-size:18px; margin:36px 0 10px; padding-top:20px; border-top:1px solid var(--line); }}
  h3 {{ font-size:15px; margin:22px 0 6px; }}
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
  .v {{ font-weight:600; }} .v.ok {{ color:var(--ok); }} .v.no {{ color:var(--high); }} .v.un {{ color:var(--warn); }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1604 · Idle agent processes are never reclaimed for non-Codex providers</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill high">host</span> <span class="pill">Priority: not set on issue</span> <span class="pill">Effort: not set on issue</span>
    <a href="https://github.com/get-bb/bb/issues/1604">open on GitHub</a>
    <span>investigated 2026-08-18</span>
    <span>base commit <code>16ceb3a54</code></span>
  </p>
  <p class="meta">
    <span class="verdict">Verdict: <span class="pill high">REPRODUCED</span> (with default settings; an opt-in mitigation exists on main)</span>
    <span class="verdict">Root-cause confidence: <span class="pill ok">high</span></span>
  </p>

  <h2>TL;DR</h2>
  <p>Every bb thread that runs on Claude Code (and Pi, and ACP agents) keeps its agent OS process alive for as long as the host daemon runs, even after the thread has been idle for hours. Only Codex threads get their process released after 30 idle minutes. Each retained <code>claude</code> process holds roughly 300-350 MB RSS on this machine, so a busy user quietly accumulates gigabytes of idle agents. The cause is a provider gate in the idle-session reaper: <code>findReapableIdleProviderSession</code> in <code>packages/agent-runtime/src/runtime.ts</code> returns <code>null</code> for any thread whose provider is not <code>codex</code> unless the <code>providerSessionReaping</code> experiment is on, and that experiment defaults to <code>false</code>. The generalized reaper was added ~2.5 h after the issue was filed (PR #1606, commit <code>3bc9ce54b</code>) but only behind that off-by-default toggle, so an ordinary installation at the base commit still exhibits exactly the reported behavior. I reproduced it live: with defaults, a Codex thread's process was reaped 47.6 s after going idle (timers shortened for the demo) while the Claude Code thread's <code>claude</code> process survived more than 8 sweeps at 3.4x the threshold; flipping the experiment on released it within one sweep, and the next turn resumed the same Claude session with history intact.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim (from issue)</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>The reaper only reaps Codex; Claude Code and ACP retain one process per idle thread indefinitely.</td><td><span class="v ok">Verified</span> (default config)</td><td>Unit repro fails on main: <code>reapIdleProviderSessions(&#123;idleForMs: 30min, providerSessionReapingEnabled:false&#125;)</code> returns <code>[]</code> for an idle restorable <code>claude-code</code> thread and <code>[thread]</code> for <code>codex</code>. Live: <code>claude</code> pid 1205611 survived 153 s idle (threshold 45 s, sweep 15 s); daemon log shows only the codex reap.</td></tr>
    <tr><td>Root cause is <code>if (!isThreadScopedCodexProcess(proc)) continue;</code> at <code>runtime.ts:2205</code> plus the gate in <code>findReapableIdleProviderSession</code> at <code>runtime.ts:707</code>.</td><td><span class="v ok">Verified</span> (line numbers moved)</td><td>At base commit the two gates are at {L("packages/agent-runtime/src/runtime.ts",813,823)} and {L("packages/agent-runtime/src/runtime.ts",2404,2415)}. Both are now conditional on <code>providerSessionReapingEnabled</code>; with the default <code>false</code> they behave exactly as described.</td></tr>
    <tr><td>Both gates landed in <code>2a84ecfdc</code> (#130) which scoped only Codex.</td><td><span class="v ok">Verified</span></td><td>Comment block at {L("packages/agent-runtime/src/runtime.ts",462,469)} ("Codex runs one provider process per thread ... the pre-experiment idle reap keys off isThreadScopedCodexProcess") and <code>git log -S</code>.</td></tr>
    <tr><td>Idle tracking (<code>observeProviderSessionIdleState</code>) is already provider-agnostic.</td><td><span class="v ok">Verified</span></td><td>{L("packages/agent-runtime/src/runtime.ts",782,799)} keys on generic <code>turn/started</code>, <code>turn/completed</code>, <code>provider/error</code>; start/resume also mark idle (lines 1642, 1971).</td></tr>
    <tr><td>Claude Code sessions survive losing their process and resume with in-agent history.</td><td><span class="v ok">Verified</span> (graceful path)</td><td>After the reap the next turn spawned a new <code>claude</code> pid (1240748) and answered "What was my previous message?" with <code>"Reply only with ok."</code>; the <code>events</code> table shows one <code>provider_thread_id</code> spanning both turns.</td></tr>
    <tr><td>Nothing calls the manual release verb (#1573/#1584) for an ordinary thread that goes idle.</td><td><span class="v ok">Verified</span></td><td>#1584 merged (<code>1c3f3eff</code>): <code>thread.stop</code> on an idle thread now releases the runtime, but only on explicit stop. The scheduled reaper is the only automatic caller and it is gated as above.</td></tr>
    <tr><td>~215 MB per idle agent, 5.2 GB across 24 idle agents, event-loop stalls, swap.</td><td><span class="v un">Unverified</span> (macOS measurements)</td><td>Cannot re-measure the reporter's host. On this Linux box a fresh idle <code>claude</code> process shows 319-349 MB RSS (see census); the mechanism is consistent with the claim.</td></tr>
    <tr><td>ACP restorability depends on <code>agentCapabilities.loadSession</code>; must gate on it.</td><td><span class="v ok">Verified / already done</span></td><td>{L("plugins/provider-acp/src/bridge/bridge.ts",1785)} and line 2311 report <code>sessionRestorable: session.supportsLoadSession</code>; the experiment path only considers <code>runtimeConfig.sessionRestorable</code> threads.</td></tr>
    <tr><td>Non-Codex process keys are shared, so forgetting thread state before shutdown is unsafe.</td><td><span class="v ok">Verified concern, handled</span></td><td>The experiment path uses <code>runtime.stopThread</code> ({L("packages/agent-runtime/src/runtime.ts",2160,2203)}), which sends <code>thread/stop</code> to the bridge (bridge closes only that thread's SDK child), then <code>releaseIdleProviderProcess</code> shuts a process down only if it is a thread-scoped Codex process with zero threads. Shared bridge processes stay up; the memory-heavy <code>claude</code> child is what goes away.</td></tr>
  </table>

  <h2>Environment</h2>
  <table>
    <tr><td>bb source</td><td><code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main, 2026-08-18) with the reap timers shortened for the live demo (see patch below; not needed for the unit repro)</td></tr>
    <tr><td>OS / node</td><td>Linux 7.0.0-29-generic x86_64 · node v24.18.0 (dev launcher may select node 22)</td></tr>
    <tr><td>Providers</td><td>Claude Code CLI 2.1.234, codex-cli 0.147.0</td></tr>
    <tr><td>Dev instance</td><td>App :17677 · Server :25677 · Host daemon :33677 · data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_debcf606-e4a-13-4b70b9558a57</code></td></tr>
    <tr><td>Project</td><td><code>proj_ihgu3q8df5</code> "qa" on <code>/tmp/bb-1604-repo</code>, host <code>host_fnmzhw6c9c</code></td></tr>
    <tr><td>Threads</td><td><code>thr_vuenabh7hq</code> (claude-code) · <code>thr_jujbg48wz7</code> (codex)</td></tr>
  </table>

  <h2>Minimal reproduction</h2>
  <h3>A. Unit-level (fails on main, no dev instance needed)</h3>
  <ol>
    <li>Save the test below as <code>packages/agent-runtime/src/issue-1604.repro.test.ts</code> (copy in <a href="1604/repro/issue-1604.repro.test.ts">1604/repro/issue-1604.repro.test.ts</a>).</li>
    <li>Run from <code>packages/agent-runtime</code>: <code>pnpm exec vitest run src/issue-1604.repro.test.ts</code></li>
    <li><b>Expected</b>: all three tests pass (an idle restorable Claude Code session is released like a Codex one).<br><b>Actual</b>: the first test fails: <code>expected [] to deeply equal [ ObjectContaining&#123;providerId:"claude-code"&#125; ]</code>. The Codex baseline passes; the opt-in (<code>providerSessionReapingEnabled: true</code>) variant passes.</li>
  </ol>
  <pre>{test_src}</pre>
  <p>Output (<a href="1604/repro/vitest-output.txt">vitest-output.txt</a>):</p>
  <pre>{vitest_out}</pre>

  <h3>B. Live (real Claude Code + Codex processes)</h3>
  <p>The production timers are 30 min idle / 5 min sweep. To watch it happen in minutes I shortened them in my worktree only (<a href="1604/repro/timing-patch.diff">timing-patch.diff</a>); the logic under test is untouched:</p>
  <pre>{patch}</pre>
  <ol>
    <li><code>pnpm exec turbo run build --filter=@bb/host-daemon &amp;&amp; scripts/bb-dev-app current</code>, then <code>eval "$(scripts/bb-dev-app env)"</code>.</li>
    <li>Confirm the default experiment state: <code>curl -s $BB_SERVER_URL/api/v1/system/config | jq .experiments</code> →
      <pre>&#123;"claudeCodeMockCliTraffic":false,"editMessages":true,"newOnboarding":false,"providerSessionReaping":false&#125;</pre></li>
    <li>Create a project (curl from the brief) and spawn one thread per provider:
      <pre>pnpm bb:dev thread spawn --project proj_ihgu3q8df5 --provider claude-code --permission-mode accept-edits --title "1604 claude" --prompt "Reply only with ok." --json
pnpm bb:dev thread spawn --project proj_ihgu3q8df5 --provider codex --permission-mode accept-edits --title "1604 codex" --prompt "Reply only with ok." --json</pre>
      Both threads reach <code>idle</code> within ~30 s (<code>pnpm bb:dev thread list --project proj_ihgu3q8df5</code>).</li>
    <li>Census the agent processes by <code>BB_THREAD_ID</code> in their environment (<a href="1604/repro/census.sh">census.sh</a>) and grep the daemon log for <code>Reaped idle provider sessions</code>.
      <pre>$ date -u; ./census.sh thr_jujbg48wz7 thr_vuenabh7hq
2026-08-18T04:41:17Z
1205611  thr_vuenabh7hq      346 MB  /home/sawyer/.local/bin/claude --output-format stream-json ...
# codex process for thr_jujbg48wz7 already gone; daemon log:
&#123;"t":"2026-08-18T04:41:18Z","sessions":[&#123;"providerId":"codex","threadId":"thr_jujbg48wz7","idleForMs":47626&#125;]&#125;

$ date -u; ./census.sh thr_jujbg48wz7 thr_vuenabh7hq
2026-08-18T04:42:56Z
1205611  thr_vuenabh7hq      319 MB  /home/sawyer/.local/bin/claude --output-format stream-json ...
$ ps -o pid,etimes,rss -p 1205611
    PID ELAPSED   RSS
1205611     153 326772</pre>
      <b>Expected</b>: both idle sessions released after the 45 s threshold. <b>Actual</b>: Codex released at 47.6 s idle; the Claude Code process is still alive at 153 s (8+ sweeps, 3.4x threshold) and no <code>claude-code</code> reap line ever appears. With production timers this is 30 minutes / forever.</li>
    <li>Control: turn the opt-in experiment on and watch the very next sweep release it, then prove the session resumes:
      <pre>$ pnpm bb:dev settings experiment providerSessionReaping true          # 04:43:13Z
providerSessionReaping updated
# daemon log 6 s later:
&#123;"t":"2026-08-18T04:43:19Z","sessions":[&#123;"providerId":"claude-code","threadId":"thr_vuenabh7hq","idleForMs":169805&#125;]&#125;
$ ./census.sh thr_vuenabh7hq          # (no output: pid 1205611 is gone)

$ pnpm bb:dev thread tell thr_vuenabh7hq "What was my previous message to you? Quote it exactly, nothing else."
Thread thr_vuenabh7hq steered
$ ./census.sh thr_vuenabh7hq
1240748  thr_vuenabh7hq      343 MB  /home/sawyer/.local/bin/claude ...      # new pid</pre>
      Thread log after resume (<a href="1604/repro/thread-log-after-resume.txt">thread-log-after-resume.txt</a>):
      <pre>{threadlog}</pre>
      Same provider session across both turns (<a href="1604/repro/events-provider-thread-id.txt">events query</a>; the empty first row is pre-identity provisioning events):
      <pre>{evq}</pre></li>
  </ol>
  <figure><img src="assets/1604-experiments-default-off.png" alt="Settings → Experiments with Idle provider session release off"><figcaption>Settings → Experiments on a fresh dev instance. "Idle provider session release" is off by default; this is the switch that decides whether non-Codex idle agents are ever reclaimed.</figcaption></figure>
  <figure><img src="assets/1604-experiments-on.png" alt="Settings → Experiments after enabling Idle provider session release"><figcaption>After <code>bb settings experiment providerSessionReaping true</code>. Six seconds later the daemon released the idle Claude Code session.</figcaption></figure>

  <h2>Root cause</h2>
  <p>The daemon runs one scheduled sweep ({L("apps/host-daemon/src/app.ts",157,210)}) every 5 minutes with <code>idleForMs = 30 min</code> and <code>providerSessionReapingEnabled</code> read from the server's <code>/internal/runtime-policy</code>, which is simply <code>getExperiments(db).providerSessionReaping</code> ({L("apps/server/src/internal/session.ts",40,44)}). That experiment defaults to <code>false</code> ({L("packages/domain/src/experiments.ts",30,35)}):</p>
  <pre>export const defaultExperiments: Experiments = &#123;
  claudeCodeMockCliTraffic: false,
  editMessages: true,
  newOnboarding: false,
  providerSessionReaping: false,
&#125;;</pre>
  <p>Inside the runtime, candidate selection has an explicit provider gate ({L("packages/agent-runtime/src/runtime.ts",813,823)}):</p>
  <pre>const runtimeConfig = threadRuntimeConfigs.get(args.threadId);
if (
  !runtimeConfig ||
  // The experiment extends release to every restorable provider. It does
  // not gate release: Codex idle sessions are released without it ...
  (args.providerSessionReapingEnabled
    ? !runtimeConfig.sessionRestorable
    : runtimeConfig.providerId !== CODEX_PROVIDER_ID)
) &#123;
  return null;
&#125;</pre>
  <p>and a second one on the process ({L("packages/agent-runtime/src/runtime.ts",2404,2415)}): with the experiment off a candidate is dropped unless <code>isThreadScopedCodexProcess(proc)</code>, which can only be true for Codex because only Codex gets a per-thread process key ({L("packages/agent-runtime/src/runtime.ts",470,478)}). So with defaults, the idle timestamps recorded for every provider by <code>observeProviderSessionIdleState</code> are never acted on for anything but Codex, and the per-thread <code>claude</code> child that the Claude Code bridge spawns lives until the daemon exits, the thread is stopped explicitly (#1584), or the environment is cleaned up (which destroys the workspace).</p>
  <p><b>History.</b> The Codex-only shape came from #130 (<code>2a84ecfdc</code>, per-thread Codex processes). PR #1606 (<code>3bc9ce54b</code>, merged 2026-08-14 17:34, ~2.5 h after this issue was filed) added everything the issue asks for in point 1: restorability reported per session on <code>thread/start</code> by every bridge (Claude Code always <code>true</code>, ACP <code>supportsLoadSession</code>, Codex/Pi <code>true</code>), release via <code>stopThread</code>, and protection for open background work / agents / monitors. It deliberately shipped default-off. Nothing implements points 2 (demand-driven eviction at <code>ensureEnvironment</code>) or 3 (bounded idle pool / memory-pressure trigger).</p>
  <p><b>Deeper issue.</b> Even with the experiment on, reclamation is time-based only: a burst of subagents that all go idle is retained in full for 30 minutes regardless of host memory. That residual concern (issue points 2-3) is not addressed anywhere on main.</p>

  <h2>Proposed fix (first principles)</h2>
  <ol>
    <li><b>Make restorable-session release the default.</b> Flip <code>defaultExperiments.providerSessionReaping</code> to <code>true</code> in <code>packages/domain/src/experiments.ts</code> (or, cleaner, remove the experiment and the two <code>providerSessionReapingEnabled ? ... : ...</code> branches so the reaper is simply "restorable + idle + no open work"). Update <code>docs/configuration.md</code>, the Settings copy in <code>apps/app/src/views/SettingsView.tsx</code>, and the tests that pin the default (<code>packages/db/test/experiments.test.ts</code>, <code>apps/server/test/system/experiments.test.ts</code>, <code>runtime.process-lifecycle.test.ts</code> "only when the experiment is on"). Flipping the default is not a wire change. Removing the field from <code>HostDaemonRuntimePolicy</code> would be, and would need a <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump.</li>
    <li><b>Risks to check before flipping:</b> (a) ACP agents that report <code>supportsLoadSession</code> but restore poorly - the gate is only as good as the agent's claim; (b) any per-session in-bridge state that does not survive resume (Claude Code one-off permission grants held in the bridge session, plan-mode state) - <code>handleThreadResume</code> rebuilds from <code>params</code>, so server-owned settings survive, but transient in-session grants may not; (c) UI surprise: the thread's next turn pays a cold start. These are the same trade-offs Codex users have had since #130.</li>
    <li><b>Optional follow-up (issue points 2-3):</b> in <code>RuntimeManager.ensureEnvironment</code>, before creating a new runtime, call <code>reapIdleProviderSessions(&#123;idleForMs: 0&#125;)</code> across environments when the number of idle restorable sessions exceeds a static cap (e.g. <code>max(2, floor(totalmem/2GiB))</code>). Keep it static and portable first; PSI-based triggers can come later.</li>
  </ol>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue. The relevant merged PR is <a href="https://github.com/get-bb/bb/pull/1606">#1606</a> (opt-in experiment); its runtime path was exercised above and behaved correctly (release on the next sweep, clean resume, and a second reap 53 s after the resumed session went idle again).</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/pull/1606">#1606</a> Add provider session release experiment (merged; the opt-in mitigation)</li>
    <li><a href="https://github.com/get-bb/bb/issues/1573">#1573</a> / <a href="https://github.com/get-bb/bb/pull/1584">#1584</a> Release agent runtimes on thread stop (merged; manual release verb)</li>
    <li><a href="https://github.com/get-bb/bb/issues/1131">#1131</a> Synchronous SQLite on the event loop (the stalls memory pressure amplifies)</li>
    <li><a href="https://github.com/get-bb/bb/issues/1363">#1363</a> Provider processes need one host-daemon lease owner tied to active turns</li>
    <li><a href="https://github.com/get-bb/bb/pull/130">#130</a> Run Codex app-server per thread (origin of the Codex-only gate)</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Daemon reap log lines (<a href="1604/repro/host-daemon-reap-lines.jsonl">jsonl</a>)</h3>
  <pre>{reaplines}</pre>
  <h3>Process census script (<a href="1604/repro/census.sh">census.sh</a>)</h3>
  <pre>{census}</pre>
  <h3>Commands run</h3>
  <pre>gh issue view 1604 --repo get-bb/bb --json ...
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
cd packages/agent-runtime &amp;&amp; pnpm exec vitest run src/issue-1604.repro.test.ts
sed -i (shorten IDLE_PROVIDER_SESSION_REAP_AFTER_MS/INTERVAL_MS) apps/host-daemon/src/app.ts
pnpm exec turbo run build --filter=@bb/host-daemon
scripts/bb-dev-app current
curl -s $BB_SERVER_URL/api/v1/system/config | jq .experiments
curl -s -X POST $BB_SERVER_URL/api/v1/projects ... /tmp/bb-1604-repo host_fnmzhw6c9c
pnpm bb:dev thread spawn --provider claude-code ... ; pnpm bb:dev thread spawn --provider codex ...
./census.sh thr_jujbg48wz7 thr_vuenabh7hq (repeated)
grep "Reaped idle" .../logs/host-daemon.1.log
pnpm bb:dev settings experiment providerSessionReaping true
pnpm bb:dev thread tell thr_vuenabh7hq "What was my previous message to you? Quote it exactly, nothing else."
pnpm bb:dev thread log thr_vuenabh7hq
sqlite3 bb.db "SELECT provider_thread_id, MIN(sequence), MAX(sequence), COUNT(*) FROM events WHERE thread_id='thr_vuenabh7hq' GROUP BY provider_thread_id"
pnpm dev:stop</pre>
  <h3>Notes</h3>
  <ul>
    <li>The unit repro passes/fails independently of the timing patch; the patch only exists so the live demo takes minutes instead of 30+.</li>
    <li>Real turns were sent to Claude Code (2) and Codex (1), all with tiny prompts.</li>
    <li>Priority/Effort GitHub project fields were not readable through <code>gh issue view</code>; only the <code>host</code> label is present.</li>
    <li>Note: <code>bb thread tell</code> from inside another bb thread inherits <code>BB_THREAD_ID</code> and fails with "Sender thread is invalid"; unset it first.</li>
  </ul>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/1604.html").write_text(doc)
print(len(doc))
