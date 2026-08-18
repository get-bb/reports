import html, pathlib
R = pathlib.Path("/tmp/bb-reports/issues/1334/repro")
def esc(p, head=None, tail=None):
    t = (R / p).read_text()
    if head: t = "\n".join(t.splitlines()[:head])
    if tail: t = "\n".join(t.splitlines()[-tail:])
    return html.escape(t)
E = html.escape
BASE = "16ceb3a540f81c1189efaffb27a39b1d9443abf5"
def L(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="https://github.com/get-bb/bb/blob/{BASE}/{path}{frag}"><code>{path}{frag.replace("#","#")}</code></a>'

test_src = esc("frozen-daemon-liveness.repro.test.ts")
script_src = esc("run-in-scope-v2.sh")
memhog_src = esc("memhog.mjs")
probe_src = esc("external-probe.sh")
run1 = esc("external-probe.run1.out")
run2 = esc("external-probe.run2.out")
run3 = esc("external-probe.run3.out")
wchan = E("\n".join([l for l in (R/"wchan-sample.out").read_text().splitlines()][:12] + ["..."] + (R/"wchan-sample.out").read_text().splitlines()[-4:]))
scope_head = esc("run-in-scope-v2.out", head=54)
scope_tail = esc("run-in-scope-v2.out", tail=8)

server_log_lines = [l for l in (R/"launcher.out").read_text().splitlines() if "Event loop stalled" in l or "Slow DB query" in l or "command_timeout" in l or "heartbeat timer delayed" in l or "Host daemon event loop stalled" in l]
server_log = E("\n".join(server_log_lines[-14:]))
memhog_out = esc("memhog.out")

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1334 co-located execution workload starves the bb server</title>
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
  .v-yes {{ color:var(--high); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1334 · Co-located execution workload can starve the bb server and leave threads spinning</h1>
  <p class="meta">
    <span class="pill">Bug / architecture</span> <span class="pill high">High</span> <span class="pill">Effort: Large</span>
    <span class="pill">perf</span> <span class="pill">host</span>
    <a href="https://github.com/get-bb/bb/issues/1334">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>{BASE}</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-yes">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p>When bb is deployed the documented way on Linux (<code>npx bb-app</code> or the packaged <code>bb-app</code> under a systemd unit), the launcher forks the <b>server</b> (control plane: HTTP API, web UI, SQLite) and the <b>primary host daemon</b> (execution plane: provider processes, agent shell commands, their descendants) as ordinary child processes. Linux puts every descendant into the same cgroup as its parent, so under a unit with <code>MemoryHigh=</code> the server, the daemon, every provider CLI and every process an agent starts share one memory budget. When the execution side pushes the cgroup over <code>memory.high</code>, the kernel throttles <em>every</em> task in that cgroup that allocates memory (<code>mem_cgroup_handle_over_high</code>, up to 2 s per allocation batch) — including the server that would have to report or stop the runaway work.</p>
  <p>I reproduced this end to end on the base commit with the real <code>bb-app</code> launcher inside a <code>systemd-run --scope</code> with <code>MemoryHigh=800M</code>: a single 1 GiB memory hog started in the same cgroup made <code>curl --max-time 5 /health</code> time out repeatedly, put the server process into uninterruptible sleep in <code>__mem_cgroup_handle_over_high</code>, produced 72 <code>Event loop stalled</code> lines in the server log and 15 in the daemon log (one 34.9 s stall; heartbeat gap 35.7 s &gt; 30 s lease), a <code>command_timeout</code> on a provider status request, and left the web UI on its loading skeleton for tens of seconds. Kernel <code>memory.events</code> showed <code>oom_kill 0</code> throughout, matching the reporter's "control-plane dead zone, not an OOM" observation.</p>
  <p>Two product gaps make the symptom "spin indefinitely" rather than "fail with a reason": (1) there is no supported server-only or isolated-daemon deployment (the launcher has no server-only command; a <code>bb-server</code> bin exists but is undocumented and unpaired with a way to run the daemon in a separate resource domain), and (2) since #421 the server decides host liveness solely from the presence of a registered daemon WebSocket in memory and never consults the heartbeat lease, so a throttled daemon whose socket is still open is reported <code>connected</code> and its threads stay <code>active</code> with no deadline. Nothing in the server, daemon, or UI observes host pressure.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Packaged <code>bb-app</code> starts server and primary host daemon as managed child processes, so under systemd they share one service cgroup with provider runtimes and agent-launched descendants</td><td class="ok">Verified</td><td>{L("packages/bb-app/src/launcher.ts",2264,2270)} (<code>spawn</code> without any cgroup/scope isolation), {L("packages/bb-app/src/launcher.ts",2898,2966)}. Repro baseline listing shows launcher, server, daemon and its plugin workers all in <code>run-p….scope</code>; the memhog spawned by the script landed in the same cgroup.</td></tr>
    <tr><td>Cgroup above <code>MemoryHigh</code> puts server (and others) into uninterruptible sleep in <code>mem_cgroup_handle_over_high</code></td><td class="ok">Verified</td><td><code>wchan-sample.out</code>: <code>server(1509173) state=D wchan=__mem_cgroup_handle_over_high</code> in 22 of 60 samples while the hog ran; the hog itself sat there permanently.</td></tr>
    <tr><td><code>curl --max-time 5 http://127.0.0.1:38886/health</code> and the daemon port time out</td><td class="ok">Verified</td><td><code>external-probe.run2.out</code>: 5 timeouts in 13 probes of <code>/health</code>; <code>run3</code>: <code>/health</code>, <code>/api/v1/threads</code> and daemon <code>/</code> all hit the 5 s timeout together at 05:33:07–05:33:36. Recovered to &lt;1 ms within seconds of killing the hog.</td></tr>
    <tr><td>Journal shows repeated server and host-daemon event-loop stalls, multi-second delays; provider requests time out</td><td class="ok">Verified</td><td>Server log: 72 × <code>Event loop stalled</code> (maxDelayMs 2046–10242, one request in flight 45 s); daemon log: 15 stalls incl. <code>maxDelayMs 34863</code> and <code>heartbeat timer delayed gapMs 35688</code>; <code>Failed to resolve known ACP agent status … command_timeout … 504</code>. See Appendix.</td></tr>
    <tr><td>Not an OOM kill: <code>memory.events oom 0 oom_kill 0</code> (comment 1)</td><td class="ok">Verified</td><td>All <code>memory.events</code> samples in the run: <code>oom 0 oom_kill 0</code>, <code>high</code> counter climbing to 109,119. Same mechanism (reclaim throttling) as the reporter's 2,677,099 <code>high</code> events.</td></tr>
    <tr><td>App shows a spinner without explaining that the host is resource-exhausted</td><td class="ok">Verified (delayed load in my scaled-down repro)</td><td>Screenshot A: loading skeleton 4 s after DOMContentLoaded (navigation itself took 6.6 s). At my pressure level the page finished loading after ~30 s (Screenshot B); the reporter's cgroup was under far heavier pressure (199 s query). Nothing in the UI names the cause in either state.</td></tr>
    <tr><td>Host stays "connected"/threads keep spinning while daemon is frozen (implicit in "threads spinning")</td><td class="ok">Verified in code + unit test</td><td>{L("apps/server/src/services/threads/thread-runtime-display.ts",143,153)}, {L("apps/server/src/services/lib/entity-lookup.ts",104,113)}: liveness = socket registered in hub, lease ignored (by design since #421). Repro test below passes on main; <code>/api/v1/hosts</code> returned <code>"status":"connected"</code> during the freeze.</td></tr>
    <tr><td>No server-only mode / no way to isolate the primary daemon</td><td class="ok">Verified (partially)</td><td>{L("packages/bb-app/src/launcher.ts",1397,1446)}: commands are start/stop/host-daemon/client/config/env/help — no server-only. A <code>bb-server</code> bin does exist ({L("packages/bb-app/src/launcher.ts",2626,2680)}, package.json <code>bin</code>) but is undocumented and there is no launcher path that runs it plus a separately-scoped daemon.</td></tr>
    <tr><td>Browser daemon "reparented to user systemd manager but remained in bb.service's cgroup"</td><td class="unv">Unverified but consistent</td><td>Standard Linux semantics: reparenting on parent exit does not change cgroup membership; only an explicit <code>cgroup.procs</code> write or <code>systemd-run</code> does. My memhog stayed in the scope after its parent subshell would have exited.</td></tr>
    <tr><td>Comment 2: 17 Codex app-servers ≈ 1.26 GiB RSS with 4 active threads on 0.37.0</td><td class="unv">Plausible, not reproduced</td><td>One app-server per bb thread ({L("plugins/provider-codex/src/bridge/bridge.ts",1640,1660)}); the daemon idle-reaps provider sessions only after 30 min ({L("apps/host-daemon/src/app.ts",66,67)}). Idle-but-not-yet-reaped sessions would explain the count; not measured here.</td></tr>
    <tr><td>Comment 2: on 0.37.0 the server was OOM-killed at <code>MemoryMax=4G</code></td><td class="unv">Unverified</td><td>Consistent with the shared-cgroup design (kernel picks the largest RSS task in the cgroup; a fat server heap, see #1748, is a likely victim). Not reproduced (my run set <code>MemoryMax</code> well above use to isolate the throttling behaviour).</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb: worktree at <code>{BASE}</code> (main, 2026-08-18), built with <code>pnpm exec turbo run build</code>; the packaged launcher <code>packages/bb-app/dist/bb-app.js</code> was run directly (same code path as <code>npx bb-app</code>).</li>
    <li>OS: Ubuntu 26.04 LTS, kernel 7.0.0-29-generic, cgroup v2 (<code>cgroup2fs</code>), systemd user session; 16 vCPU / 58 GiB RAM host (limits imposed with <code>systemd-run --user --scope</code>).</li>
    <li>Node v24.18.0.</li>
    <li>Isolated instance: data dir <code>/tmp/bb-1334-scope-data</code>, server <code>http://127.0.0.1:48861</code>, host daemon port 48862 (host id <code>host_zgj5r8yyt9</code>). No providers were exercised; no real turns run.</li>
    <li>Cgroup limits used: <code>MemoryHigh=800M MemoryMax=2200M MemorySwapMax=64M</code> (bb baseline in the scope was ~545 MiB; hog target 1024 MiB).</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <p>Everything below is under <a href="1334/repro/">1334/repro/</a>. Requires Linux with cgroup v2 and a systemd user session (<code>systemd-run --user</code> works). No provider account needed.</p>
  <ol>
    <li>Build bb: <code>pnpm install --frozen-lockfile &amp;&amp; pnpm exec turbo run build</code>.</li>
    <li>Start the packaged launcher inside one memory-limited scope and, once healthy, start a memory hog in the same cgroup:
<pre>systemd-run --user --scope --quiet -p MemoryHigh=800M -p MemoryMax=2200M -p MemorySwapMax=64M \\
  /tmp/bb-reports/issues/1334/repro/run-in-scope-v2.sh &lt;worktree&gt; /tmp/bb-1334-scope-data 48861 48862 1024 200 \\
  | tee run-in-scope-v2.out</pre>
      The script starts <code>node packages/bb-app/dist/bb-app.js --data-dir … --server-port 48861 --host-daemon-port 48862</code>, waits for <code>/health</code>, lists the cgroup members, then runs <code>memhog.mjs 1024</code> (allocates and keeps touching 1 GiB) in the same cgroup, sampling <code>memory.*</code> and per-process <code>wchan</code>.</li>
    <li>From a second shell (outside the cgroup — this is what a browser tab or the CLI is), probe the control plane while generating light API load:
<pre>/tmp/bb-reports/issues/1334/repro/external-probe.sh 48861 48862 90 6 | tee external-probe.run2.out</pre></li>
    <li>Optionally sample kernel wait channels: <code>wchan-sample.sh &lt;serverPid&gt; &lt;daemonPid&gt; &lt;hogPid&gt; 60</code>.</li>
    <li>Kill the hog (<code>kill &lt;hogPid&gt;</code>) and re-probe: everything is back to sub-millisecond within seconds.</li>
  </ol>

  <h3>Expected</h3>
  <p><code>/health</code> keeps answering in ~1 ms (as at baseline), or the affected turn/host is failed or paused with an actionable "execution host resource exhausted" state.</p>

  <h3>Actual — control plane probes from outside the cgroup (<code>external-probe.run2.out</code>)</h3>
<pre>{run2}</pre>
  <p>Baseline before the hog (from <code>run-in-scope-v2.out</code>): <code>server /health -&gt; 200 in 0.001352s</code>, <code>/api/v1/threads -&gt; 200 in 0.002189s</code>, <code>daemon / -&gt; 404 in 0.002121s</code>. During the third probe run the daemon port timed out too:</p>
<pre>{run3}</pre>

  <h3>Actual — where the server is sleeping (<code>wchan-sample.out</code>, sampled every 250 ms)</h3>
<pre>{wchan}</pre>

  <h3>Actual — cgroup view and cgroup members (<code>run-in-scope-v2.out</code>, first rounds)</h3>
<pre>{scope_head}</pre>
  <p>Note the wall-clock gaps between rounds (t+10 s printed at 05:19:40, t+20 s at 05:21:19, t+30 s at 05:27:27): the probing <em>bash script itself</em>, being in the same cgroup, was throttled on every <code>fork()</code>. That is what happens to anything bb spawns (git, provider CLIs, tool commands) inside a pressured cgroup. After the hog was killed:</p>
<pre>{scope_tail}</pre>

  <h3>Actual — what the server and daemon logged (<code>launcher.out</code>, excerpt)</h3>
<pre>{server_log}</pre>
  <p>Totals for the run: 72 <code>Event loop stalled</code> lines in <code>server.log</code>, 20 <code>Slow DB query</code> lines (a one-row <code>update host_daemon_sessions</code> heartbeat took 2045 ms), 15 daemon stall/heartbeat-delay warnings, one provider RPC <code>command_timeout</code>. The maximum per-stall delay clusters at 2048 ms and multiples of it because the kernel caps each over-high penalty at 2 s (<code>MEMCG_MAX_HIGH_DELAY_JIFFIES</code>).</p>
  <p>The hog itself was throttled hardest: it reached only 512 MiB in 782 s (<code>memhog.out</code>), so the cgroup only ever exceeded <code>memory.high</code> by ~100–170 MiB. Even that modest, sustained overage was enough for the effects above; the reporter's cgroup was ~300 MiB over for a long time with far more allocating processes.</p>
<pre>{memhog_out}</pre>

  <h3>Visual: web UI served by the throttled server</h3>
  <figure><img src="assets/1334-app-under-pressure-a.png" alt="bb web app showing sidebar loading skeleton and empty main pane"><figcaption>Screenshot A — <code>http://127.0.0.1:48861/</code> in headless Chromium while the hog ran (external load loops active). <code>page.goto</code> took 6.6 s to DOMContentLoaded; 4 s later the sidebar still shows the grey loading skeleton and the main pane is blank. There is no message about the host being under pressure.</figcaption></figure>
  <figure><img src="assets/1334-app-under-pressure-b.png" alt="bb web app finally rendered home screen"><figcaption>Screenshot B — the same tab about 30 s later. At my (mild) pressure level the requests eventually completed and the home screen rendered; at the reporter's pressure level (199 s timeline query) the skeleton simply never resolves.</figcaption></figure>

  <h3>Unit-level repro of the liveness gap (passes on main; documents current behaviour)</h3>
  <p><code>apps/server/test/hosts/issue-1334/frozen-daemon-liveness.repro.test.ts</code> (copy at <a href="1334/repro/frozen-daemon-liveness.repro.test.ts">1334/repro/frozen-daemon-liveness.repro.test.ts</a>). Run from <code>apps/server</code>: <code>pnpm exec vitest run test/hosts/issue-1334/</code> → <code>2 passed | 1 expected fail</code>. The two passing tests assert what the server does today (host <code>connected</code>, thread <code>active</code> with <code>hostReconnectGraceExpiresAt: null</code>) for a daemon whose lease expired 5 minutes ago but whose socket is still registered; the <code>it.fails</code> case states the desired behaviour.</p>
<pre>{test_src}</pre>

  <h2>Root cause</h2>
  <h3>1. One process tree, one cgroup: no containment boundary between control and execution planes</h3>
  <p>The full-stack path of the launcher spawns the server and daemon with a plain <code>child_process.spawn</code>:</p>
<pre>{E('''function spawnManagedProcess(args: ManagedSpawnArgs): ChildProcess {
  const child = spawn(args.command, args.args, {
    cwd: process.cwd(),
    env: args.env,
    stdio: ["ignore", "pipe", "inherit"],
  });''')}</pre>
  <p>{L("packages/bb-app/src/launcher.ts",2264,2270)}, used by {L("packages/bb-app/src/launcher.ts",2898,2966)}. The daemon in turn spawns provider bridges (e.g. {L("plugins/provider-codex/src/bridge/app-server-connection.ts",111)}) and, through them, agent tool commands. On Linux a child inherits its parent's cgroup unconditionally, and cgroup membership survives reparenting, so <b>anything the agent starts is billed to the same <code>memory.high</code> as the server</b>. cgroup v2's <code>memory.high</code> is enforced by making each allocating task in the cgroup reclaim and then sleep in <code>mem_cgroup_handle_over_high</code> (penalty proportional to the square of the overage, capped at 2 s per allocation batch). The server allocates on every request (JSON, SQLite result rows, WebSocket frames), so it is throttled in lock-step with the runaway workload. That is exactly the <code>state=D wchan=__mem_cgroup_handle_over_high</code> and the 2048 ms-quantised event-loop stalls observed. Kernel <code>MemoryMax</code> would instead OOM-kill the largest task — often the server, whose V8 heap is sized from host RAM (#1748) — so neither knob gives containment.</p>
  <p>The launcher's command set ({L("packages/bb-app/src/launcher.ts",1397,1446)}) has <code>host-daemon</code> (daemon-only) but no server-only mode; the help text ({L("packages/bb-app/src/launcher.ts",2868,2884)}) never mentions the packaged <code>bb-server</code> bin. So an operator following the docs cannot put the daemon in its own systemd unit/slice on the same machine; the only escape is a second machine (which the reporter used).</p>

  <h3>2. The server cannot tell a frozen daemon from a healthy one</h3>
  <p>#421 (<code>0461d6bbd</code>) deliberately made process-local socket registration the sole liveness authority and removed the lease-expiry sweep, to survive laptop sleep. Consequences on this code path:</p>
<pre>{E('''// thread-runtime-display.ts
function hasOpenDaemonSessionForHost(deps, hostId): boolean {
  const sessionId = deps.hub.getDaemonSessionIdForHost(hostId);
  if (!sessionId) return false;
  const session = getSessionById(deps.db, { sessionId });
  return session?.hostId === hostId && session.status === "active";
}
// entity-lookup.ts
getOpenDaemonSessionForHost(deps, row.id) ? "connected" : "disconnected"''')}</pre>
  <p>{L("apps/server/src/services/threads/thread-runtime-display.ts",143,153)}, {L("apps/server/src/services/lib/entity-lookup.ts",104,113)}. Daemon messages still renew <code>lease_expires_at</code> ({L("apps/server/src/ws/daemon-protocol.ts",110,121)}) but nothing reads it except port sharing. A throttled daemon keeps its TCP connection (the kernel ACKs on its behalf) while its heartbeat timer slips — in the repro the daemon logged <code>heartbeat timer delayed gapMs 35688</code> against <code>leaseTimeoutMs 30000</code> — and the server kept reporting <code>connected</code>. Threads therefore stay <code>active</code> with <code>hostReconnectGraceExpiresAt: null</code>, and neither the daemon-disconnect grace ({L("apps/server/src/constants.ts",1,5)}) nor any turn deadline ever fires. That is the "spinner without explanation".</p>

  <h3>3. Nobody measures pressure</h3>
  <p>Both processes have event-loop stall monitors ({L("apps/server/src/services/system/event-loop-stall-monitor.ts",34,60)}, {L("apps/host-daemon/src/event-loop-stall-monitor.ts",50)}) that only <em>log</em>. There is no reading of <code>memory.pressure</code>/PSI or <code>memory.events</code>, no admission control on new turns (see #1393), and no host-health field in the API/UI beyond connected/disconnected. The daemon's idle provider reaper runs every 5 min with a 30 min idle threshold ({L("apps/host-daemon/src/app.ts",66,67)}), so up to dozens of idle app-servers can sit resident (comment 2's 17 Codex app-servers for 4 threads).</p>

  <h2>Proposed fix (first principles)</h2>
  <p>This is architectural; there is no one-line fix. In order of leverage:</p>
  <ol>
    <li><b>Give operators a supported split deployment.</b> Document and wire <code>bb-server</code> (already packaged) as a first-class <code>bb-app server</code> command, and make <code>bb-app host-daemon</code> the paired way to run the primary daemon on the same machine in its own systemd unit/slice. Ship a reference pair of units (server unit with modest limits; daemon unit with the big <code>MemoryHigh</code>/<code>MemoryMax</code>). Risk: auto-join/enroll flow assumes the launcher owns both; <code>runHostDaemonOnly</code> already handles join, so mostly docs + help + install script.</li>
    <li><b>Isolate the daemon on Linux even in the single-launcher path.</b> When <code>systemd-run --user</code> is available, start the daemon (or at least its provider/agent process tree) via <code>systemd-run --user --scope --collect -p MemoryHigh=… </code> or by moving its PID into a child cgroup created under the launcher's own cgroup (write to <code>cgroup.procs</code> of a new subdirectory; requires the delegated cgroup that user-services already have). Then agent descendants inherit the <em>daemon's</em> sub-cgroup and the server keeps its own budget. Fallback silently when unavailable (macOS, containers without delegation). Risk: cgroup delegation edge cases; must not break the existing "kill the whole tree on stop" logic.</li>
    <li><b>Make liveness pressure-aware without regressing sleep/wake.</b> Keep socket registration as the primary authority, but treat "socket registered AND lease stale by &gt; N × lease" as a distinct <code>unresponsive</code> host status surfaced in <code>/api/v1/hosts</code>, thread runtime state (<code>displayStatus</code>), and the UI banner ("host bee is not responding — likely resource-exhausted"). Additionally have the daemon sample <code>/sys/fs/cgroup/…/memory.pressure</code> and <code>memory.events</code> (raw data, per the server/daemon boundary) in its heartbeat payload so the server can refuse new turns above a threshold. That last part changes the heartbeat wire shape → bump <code>HOST_DAEMON_PROTOCOL_VERSION</code>. Risk: false positives after sleep — mitigated by requiring the socket to be alive <em>and</em> stale for well over the lease.</li>
    <li>Smaller mitigations that reduce the blast radius: cap V8 heap from the cgroup limit (#1748), shorten/idle-reap provider processes more aggressively (#1604), and give provider RPCs an explicit failure when the host is unresponsive rather than a bare 504 <code>command_timeout</code>.</li>
  </ol>

  <h2>PR review</h2>
  <p>No linked open PRs.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1748">#1748</a> Server heap is sized from host RAM, not the cgroup limit — same deployment, explains why the server is the natural OOM victim and why <code>MemoryHigh</code> is breached so often.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1393">#1393</a> Host lacks global admission control across work sources — the "reject or pause new turns under pressure" half of the ask.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1604">#1604</a> Idle agent processes are never reclaimed for non-Codex providers — resident provider processes inflate the shared budget.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1660">#1660</a> bb host process grew to 77 GB RSS and froze the machine — the un-limited variant of the same failure.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1131">#1131</a>, <a href="https://github.com/get-bb/bb/issues/1207">#1207</a> synchronous SQLite on the event loop — makes each throttling penalty stall the whole server.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1320">#1320</a> (closed) daemon-event batch poisoning — reporter correctly distinguishes it; no rejected batches were seen here either.</li>
    <li><a href="https://github.com/get-bb/bb/pull/421">#421</a> Harden host session liveness after sleep — the change that removed lease-based liveness (intentional; interacts with this issue).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
<pre>{E('''gh issue view 1334 --comments
pnpm install --frozen-lockfile --prefer-offline && pnpm exec turbo run build
systemd-run --user --scope --quiet -p MemoryHigh=800M -p MemoryMax=2200M -p MemorySwapMax=64M \\
  /tmp/bb-reports/issues/1334/repro/run-in-scope-v2.sh /home/sawyer/projects/bb/.claude/worktrees/wf_debcf606-e4a-18 \\
  /tmp/bb-1334-scope-data 48861 48862 1024 200 | tee /tmp/bb-reports/issues/1334/repro/run-in-scope-v2.out
/tmp/bb-reports/issues/1334/repro/external-probe.sh 48861 48862 60 6   # run1
/tmp/bb-reports/issues/1334/repro/wchan-sample.sh 1509173 1509238 1513061 60
/tmp/bb-reports/issues/1334/repro/external-probe.sh 48861 48862 90 6   # run2
curl -s --max-time 20 http://127.0.0.1:48861/api/v1/hosts             # "status":"connected" during the freeze
dev-browser --browser bb1334 --headless run screenshot-app.js         # screenshot A (external-probe run3 in background)
dev-browser --browser bb1334 --headless run screenshot-app-b.js       # screenshot B (run4 in background)
kill 1513061                                                          # hog; script then stopped the launcher cleanly
cd apps/server && pnpm exec vitest run test/hosts/issue-1334/         # 2 passed | 1 expected fail''')}</pre>
  <h3>Files</h3>
  <ul>
    <li><a href="1334/repro/run-in-scope-v2.sh">run-in-scope-v2.sh</a>, <a href="1334/repro/memhog.mjs">memhog.mjs</a>, <a href="1334/repro/external-probe.sh">external-probe.sh</a>, <a href="1334/repro/wchan-sample.sh">wchan-sample.sh</a>, <a href="1334/repro/screenshot-app.js">screenshot-app.js</a>, <a href="1334/repro/screenshot-app-b.js">screenshot-app-b.js</a></li>
    <li>Outputs: <a href="1334/repro/run-in-scope-v2.out">run-in-scope-v2.out</a>, <a href="1334/repro/external-probe.run1.out">run1</a> / <a href="1334/repro/external-probe.run2.out">run2</a> / <a href="1334/repro/external-probe.run3.out">run3</a> / <a href="1334/repro/external-probe.run4.out">run4</a>, <a href="1334/repro/wchan-sample.out">wchan-sample.out</a>, <a href="1334/repro/launcher.out">launcher.out</a>, <a href="1334/repro/server.log">server.log</a>, <a href="1334/repro/host-daemon.log">host-daemon.log</a>, <a href="1334/repro/memhog.out">memhog.out</a></li>
    <li>Earlier calibration attempts (milder limits, cut short): <a href="1334/repro/run-in-scope.sh">run-in-scope.sh</a>, <a href="1334/repro/run-in-scope.attempt1-mild.out">attempt1 (MemoryHigh=1200M, hog 768: no throttling, control plane fine)</a>, <a href="1334/repro/run-in-scope.out">attempt2 (MemoryHigh=1000M, hog 1024: pressure 88 %, in-cgroup probes still fast in the first 35 s)</a>. Lesson: without an external client hitting the server it barely allocates and is rarely throttled; the reporter's real UI/CLI traffic is what turns pressure into timeouts.</li>
  </ul>
  <h3>Repro scripts (inline)</h3>
<pre>{script_src}</pre>
<pre>{memhog_src}</pre>
<pre>{probe_src}</pre>
  <h3>Probe run 1</h3>
<pre>{run1}</pre>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/1334.html").write_text(page)
print(len(page))
