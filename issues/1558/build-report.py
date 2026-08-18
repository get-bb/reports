import html, pathlib
D = pathlib.Path("/tmp/bb-reports/issues/1558")
def esc(p): return html.escape(pathlib.Path(p).read_text())
test_src = esc(D/"repro/issue-1558-foreign-health.test.ts")
vitest_out = esc(D/"repro/vitest-output.txt")
import re
vitest_out = re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", vitest_out)
log_one = esc(D/"launcher-one.log")
log_two1 = esc(D/"launcher-two-first-run.log")
log_two2 = esc(D/"launcher-two-restart.log")
log_var = esc(D/"launcher-two-variant-daemon-port-differs.log")
diff = esc(D/"repro/export-waitForHealth.diff")
start_one = esc(D/"repro/start-one.sh"); start_two = esc(D/"repro/start-two.sh"); restart_two = esc(D/"repro/restart-two.sh")
B = "https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/"
def L(path, a, b=None, text=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="{B}{path}{frag}">{text or (path.split("/")[-1] + frag)}</a>'

# trim the variant log to the first restart cycle
cut = log_var.find("Server restarted")
cut = log_var.find("Node.js v24.18.0", cut) + len("Node.js v24.18.0") if cut != -1 else len(log_var)
log_var_short = log_var[:cut]

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1558 bb-app can enroll a host against the wrong server after its server child fails with EADDRINUSE</title>
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
  .pill.medium {{ background:var(--warn); color:#fff; border-color:var(--warn); }}
  .verdict {{ font-weight:600; }}
  .v-repro {{ color:var(--high); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1558 · bb-app can enroll a host against the wrong server after its server child fails with EADDRINUSE</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill medium">Medium</span> <span class="pill">Effort: Small</span>
    <span class="pill">desktop</span> <span class="pill">connect</span>
    <a href="https://github.com/get-bb/bb/issues/1558">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> <code>npx bb-app</code> (the "launcher") starts two child processes: the bb <em>server</em> (HTTP API + SQLite database under <code>BB_DATA_DIR</code>) and the <em>host daemon</em> (the process that runs agents on this machine). On first start the daemon has no credentials, so the launcher asks the server for a one-time <em>enroll key</em>, the daemon exchanges it for a permanent <em>host key</em>, and the daemon writes that key to <code>&lt;BB_DATA_DIR&gt;/auth.json</code>. The server remembers the enrolled host in its own <code>bb.db</code>. From then on the daemon authenticates with that host key.</p>
  <p>The launcher decides that its server child is "up" by polling <code>GET http://127.0.0.1:&lt;port&gt;/health</code> until it gets a 200. It never checks <em>who</em> answered. If some other bb server already owns the port (for example a second <code>bb-app</code> run with a different <code>BB_DATA_DIR</code> but default ports), the very first poll succeeds against that foreign server, long before the launcher's own child has finished booting and died with <code>EADDRINUSE</code>. The launcher prints <code>✓ Server listening</code>, mints an enroll key <b>from the foreign server</b>, and its daemon enrolls there. The daemon then persists the resulting host key into the <em>second</em> data directory. Later, when the first bb is gone and the second one starts on its own database, the daemon presents a host key that only exists in the other database and is rejected with <code>401 Unauthorized</code> (server log: Better Auth <code>INVALID_API_KEY</code>; daemon log: "Server rejected host credentials — this host is not registered with the server"). The second data dir is now permanently broken until <code>auth.json</code> is deleted.</p>
  <p>Reproduced end to end on <code>16ceb3a54</code> with the built <code>packages/bb-app/dist/bb-app.js</code> (identical launcher code to 0.35.1 and 0.38.0), on non-default ports so the user's real instance was not touched. It is not a narrow race: the foreign 200 wins on the first 100&nbsp;ms poll every time because a bb server takes seconds to boot. A one-file vitest repro at the exact function (<code>waitForHealth</code>) fails on main. In a variant where only the server port collides, the launcher even reports <b><code>bb is ready</code></b> and then loops <code>✓ Server restarted</code> forever while its own server dies with EADDRINUSE each time.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Second launcher (different data dir, same ports) can mistake the first launcher's server for its own</td><td class="ok">Verified</td><td>Repro step 2: launcher two prints <code>✓ Server listening on http://127.0.0.1:45886</code> while its own server child prints <code>listen EADDRINUSE</code> a moment later (<a href="1558/launcher-two-first-run.log">launcher-two-first-run.log</a>).</td></tr>
    <tr><td>Launcher requests an enroll key from the existing server and saves host credentials in the second data dir</td><td class="ok">Verified</td><td><code>/tmp/bb1558-two/auth.json</code> and <code>host-id</code> = <code>host_jqdf8jbftp</code>; <code>sqlite3 /tmp/bb1558-one/bb.db "select id from hosts"</code> lists it, <code>/tmp/bb1558-two/bb.db</code> has an empty <code>hosts</code> table.</td></tr>
    <tr><td>After the first launcher stops, the second one fails with "Server rejected host credentials — this host is not registered with the server" / <code>INVALID_API_KEY</code></td><td class="ok">Verified</td><td>Repro step 3 (<a href="1558/launcher-two-restart.log">launcher-two-restart.log</a>): both strings appear verbatim; <code>INVALID_API_KEY</code> comes from the Better Auth apikey plugin log inside the server, the other from <code>logFatalConnectError</code> in the daemon.</td></tr>
    <tr><td>Host ID from <code>bb-two/auth.json</code> present in <code>bb-one/bb.db</code>, absent from <code>bb-two/bb.db</code></td><td class="ok">Verified</td><td>See above.</td></tr>
    <tr><td>Suspected cause: race in <code>waitForHealth()</code> between the child's exit and the unrelated server's 200</td><td class="ok">Verified, and stronger than a race</td><td>{L("packages/bb-app/src/launcher.ts",2164,2186)}: the loop checks <code>exitCode</code> then <code>fetch</code>es. The first fetch happens ~0&nbsp;ms after spawn; the child needs seconds to reach <code>listen()</code>. So the foreign 200 is accepted deterministically, not occasionally. Unit repro fails 1/1 runs.</td></tr>
    <tr><td>"A 2xx only proves that a server is listening, not that it is the child just spawned"</td><td class="ok">Verified</td><td><code>/health</code> returns a constant <code>{{"ok":true}}</code> ({L("apps/server/src/server.ts",331)}). The launcher already does an identity check for the <em>daemon</em> (<code>waitForHostDaemonStatus</code> compares <code>hostId</code> and <code>serverUrl</code>, added by #1155) but not for the server.</td></tr>
    <tr><td>Environment: bb-app 0.35.1</td><td class="ok">Consistent</td><td><code>waitForHealth</code> at tag <code>desktop-v0.35.1</code> is byte-identical to <code>16ceb3a54</code>.</td></tr>
    <tr><td>Launcher "may still consider startup successful"</td><td class="ok">Verified</td><td>Variant with a distinct daemon port: launcher two prints <code>● bb is ready</code>, then loops <code>! server exited with code 1 - restarting server</code> / <code>✓ Server restarted</code> (<a href="1558/launcher-two-variant-daemon-port-differs.log">log</a>). With the daemon port also colliding, the daemon fails its readiness check after ~60&nbsp;s and the launcher exits 1 — but <code>auth.json</code> is already written.</td></tr>
    <tr><td>Error-message suggestion (INVALID_API_KEY is misleading; unrecoverable auth failures should stop the restart loop)</td><td class="unv">Opinion, partially moot</td><td>The daemon already treats 401/403 as fatal (<code>fatalConnectError</code>, {L("apps/host-daemon/src/server-connection.ts",402,432)}) and exits with <code>reason: startup-failed</code>; the launcher then exits 1. The <code>INVALID_API_KEY</code> line is a Better Auth internal log, not a bb message. Adding the "remove auth.json" hint to the daemon's fatal message would be cheap.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18). Worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-21</code> (HEAD <code>a108fa7ef</code> on origin/main; <code>git diff 16ceb3a54 HEAD -- packages/bb-app apps/host-daemon/src/start-host-daemon.ts apps/server/src/start-server.ts apps/server/src/server.ts</code> is empty, so all excerpts and line numbers below are those of the base commit). <code>git log 16ceb3a54..origin/main -- packages/bb-app</code> is empty: not fixed on main.</li>
    <li>Linux 7.0.0-29-generic x86_64, node v24.18.0, pnpm workspace built with <code>pnpm exec turbo run build</code>. Launcher used: <code>packages/bb-app/dist/bb-app.js</code> (package version 0.38.0), which spawns <code>packages/bb-app/server/dist/index.js</code> and <code>packages/bb-app/host-daemon/dist/daemon-bundle.mjs</code>: the same artifacts <code>npx bb-app</code> ships.</li>
    <li>No dev instance (<code>scripts/bb-dev-app</code>) was needed. Two throw-away launcher instances: data dirs <code>/tmp/bb1558-one</code> and <code>/tmp/bb1558-two</code>, server port <code>45886</code>, daemon port <code>45887</code> (variant: <code>45889</code>). Ports were chosen to stay clear of the real instance on 38886/38887. No providers were invoked.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <p>Scripts are in <a href="1558/repro/">1558/repro/</a>. They hardcode the launcher path of my worktree in <code>BBAPP=</code>; point it at your own <code>packages/bb-app/dist/bb-app.js</code> (or replace <code>node "$BBAPP"</code> with <code>npx bb-app@0.38.0</code>, which reproduces identically with default ports if nothing else is on 38886).</p>
  <ol>
    <li>Start instance one and wait for <code>bb is ready</code> (<a href="1558/repro/start-one.sh">start-one.sh</a>; output <a href="1558/launcher-one.log">launcher-one.log</a>):
<pre>$ bash 1558/repro/start-one.sh          # BB_DATA_DIR=/tmp/bb1558-one BB_SERVER_PORT=45886 BB_HOST_DAEMON_PORT=45887 node dist/bb-app.js
$ grep -A8 "bb is ready" /tmp/bb1558-one/launcher.log
  ●  bb is ready
     app    http://127.0.0.1:45886
     daemon 45887
     data   /tmp/bb1558-one
     db     /tmp/bb1558-one/bb.db</pre></li>
    <li>Start instance two with a <b>different data dir</b> and the <b>same ports</b> (<a href="1558/repro/start-two.sh">start-two.sh</a>). <b>Expected</b> (issue's "Expected behavior"): the launcher fails startup because its server child cannot bind the port, and does not create host authentication state. <b>Actual</b> (<a href="1558/launcher-two-first-run.log">launcher-two-first-run.log</a>, verbatim):
<pre>$ bash 1558/repro/start-two.sh          # BB_DATA_DIR=/tmp/bb1558-two, same ports
$ cat /tmp/bb1558-two/launcher.log
{log_two1}</pre>
      Note the order: <code>✓ Server listening</code> is printed first (answered by instance one), then the launcher moves on to <code>Starting host daemon</code>, and only afterwards does its own server child die with <code>EADDRINUSE</code>. The daemon then fails on its own port collision, but not before enrolling:
<pre>$ ls /tmp/bb1558-two
auth-secret  auth.json  bb-app-runtime.json  bb.db  bb.db-shm  bb.db-wal  daemon.lock  host-id  launcher.log  logs  skills  telemetry-id  thread-storage
$ cat /tmp/bb1558-two/auth.json
{{
  "hostId": "host_jqdf8jbftp",
  "hostKey": "bbdh_&lt;redacted&gt;",
  "hostType": "persistent"
}}
$ sqlite3 /tmp/bb1558-one/bb.db "select id, name from hosts"
host_yej96dezaf|bee
host_jqdf8jbftp|bee                    &lt;-- instance two's host, enrolled in instance ONE's database
$ sqlite3 /tmp/bb1558-two/bb.db "select id, name from hosts"
                                       &lt;-- empty</pre></li>
    <li>Stop instance one, start instance two again on its (now free) ports, keeping its data dir (<a href="1558/repro/restart-two.sh">restart-two.sh</a>). <b>Expected</b>: instance two starts. <b>Actual</b> (<a href="1558/launcher-two-restart.log">launcher-two-restart.log</a>):
<pre>$ kill &lt;launcher one pid&gt;; bash 1558/repro/restart-two.sh
$ cat /tmp/bb1558-two/launcher-restart.log
{log_two2}</pre>
      Instance two is now unusable until <code>auth.json</code> (and <code>host-id</code>) are removed, exactly as the issue's workaround says.</li>
  </ol>

  <h3>Variant: only the server port collides → "bb is ready" and an endless restart loop</h3>
  <p><a href="1558/repro/start-two-daemon-port-differs.sh">start-two-daemon-port-differs.sh</a> uses <code>BB_HOST_DAEMON_PORT=45889</code> for instance two. Its daemon now binds fine, enrolls with instance one, connects to instance one, and passes the launcher's daemon identity check (the expected host id came from instance one's enroll-key response). The launcher declares victory and then restarts its doomed server child every ~2&nbsp;s, each time "successfully" (<a href="1558/launcher-two-variant-daemon-port-differs.log">full log</a>):</p>
<pre>{log_var_short}
…(repeats until Ctrl+C)</pre>

  <h3>Unit-level repro at the exact code path</h3>
  <p>File: <a href="1558/repro/issue-1558-foreign-health.test.ts">1558/repro/issue-1558-foreign-health.test.ts</a> (copy to <code>packages/bb-app/test/</code>). <code>waitForHealth</code> is module-private, so the test needs this one-line change to <code>src/launcher.ts</code> (<a href="1558/repro/export-waitForHealth.diff">export-waitForHealth.diff</a>):</p>
<pre>{diff}</pre>
  <p>The test starts a plain <code>node:http</code> server that answers <code>/health</code> with 200 (instance one), spawns a child that exits with code 1 after 400&nbsp;ms (instance two's server child dying on EADDRINUSE), and asks <code>waitForHealth</code> whether <em>that child</em> became healthy. On main it resolves ("healthy") on the first poll; the final assertion fails:</p>
<pre>{test_src}</pre>
<pre>$ cd packages/bb-app &amp;&amp; pnpm exec vitest run test/issue-1558-foreign-health.test.ts
{vitest_out}</pre>
  <p>(<a href="1558/repro/vitest-output.txt">raw output</a>.) The assertion that fails is <code>expect(outcome).not.toBe("healthy")</code>: <code>waitForHealth</code> returned success for a child that never listened and exited 1.</p>

  <h2>Root cause</h2>
  <p><b>1. The server readiness probe has no identity check.</b> {L("packages/bb-app/src/launcher.ts",2164,2186,"launcher.ts#L2164-L2186")}:</p>
<pre>async function waitForHealth(args: WaitForHealthArgs): Promise&lt;void&gt; {{
  const timeoutMs = args.timeoutMs ?? HEALTH_CHECK_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() &lt;= deadline) {{
    if (args.childProcess &amp;&amp; (args.childProcess.exitCode !== null || args.childProcess.signalCode !== null)) {{
      throw new Error("Process exited before becoming healthy");
    }}
    try {{
      const response = await fetch(args.url);
      if (response.ok) {{
        return;                       // &lt;-- any 200 from anyone on this port
      }}
    }} catch {{}}
    await new Promise&lt;void&gt;((resolvePromise) =&gt; {{ setTimeout(resolvePromise, HEALTH_CHECK_INTERVAL_MS); }});
  }}
  throw new Error(`Timed out waiting for health at ${{args.url}}`);
}}</pre>
  <p>It is called from <code>startFullStackServerProcess</code> immediately after <code>spawn</code> ({L("packages/bb-app/src/launcher.ts",2898,2927,"launcher.ts#L2898-L2927")}) with <code>url = &lt;serverUrl&gt;/health</code>, where <code>/health</code> is a constant <code>{{ ok: true }}</code> ({L("apps/server/src/server.ts",331,None,"server.ts#L331")}). Because the child needs seconds to <code>initDb</code>, migrate, and load plugins before it reaches <code>listen()</code>, and the poll fires at t≈0 and every 100&nbsp;ms, a foreign server on the port always wins. The child-exit guard only helps if the child dies before the first successful fetch, which it never does here. The issue's "there appears to be a race" is therefore too generous: it is the common case, not a window.</p>
  <p><b>2. Success of that probe gates enrollment against the same URL.</b> Right after <code>✓ Server listening</code>, <code>runBbApp</code> calls <code>maybeAddAutoJoinEnv</code> ({L("packages/bb-app/src/launcher.ts",3349,3354,"launcher.ts#L3349-L3354")}), which — when <code>&lt;dataDir&gt;/auth.json</code> is absent — POSTs <code>/internal/hosts/enroll-key</code> to <code>context.serverUrl</code> ({L("packages/bb-app/src/launcher.ts",2130,2162,"launcher.ts#L2130-L2162")}, {L("packages/bb-app/src/launcher.ts",2105,2128,"#L2105-L2128")}). That route is unauthenticated for loopback callers by design ({L("apps/server/src/internal/hosts.ts",54,80,"internal/hosts.ts#L54-L80")}), so instance one happily mints a key and a fresh <code>hostId</code> in <em>its</em> database. The launcher passes them to the daemon as <code>BB_HOST_ENROLL_KEY</code>/<code>BB_HOST_ID</code>.</p>
  <p><b>3. The daemon persists credentials before it binds anything and before the launcher's daemon identity check runs.</b> {L("apps/host-daemon/src/start-host-daemon.ts",159,186,"start-host-daemon.ts#L159-L186")}: <code>enrollDaemonHost(...)</code> against <code>serverUrl</code> (instance one), then <code>persistHostId</code> + <code>writeHostAuthState</code> into its own <code>dataDir</code> (instance two). Only afterwards does it resolve the local API port ({L("apps/host-daemon/src/start-host-daemon.ts",190,198,"#L190-L198")}) and possibly fail with "port already in use". So even when the launcher ultimately exits 1 (both ports colliding), the poison <code>auth.json</code> is already on disk. The launcher's daemon check (<code>waitForHostDaemonStatus</code>, which verifies <code>hostId</code>/<code>serverUrl</code>) cannot catch this: in the variant it passes legitimately because the daemon really did connect, to the wrong server, with the host id the launcher was told to expect.</p>
  <p><b>4. Why the later 401.</b> Instance two's <code>bb.db</code> never saw the enrollment. On the next start its own server validates the daemon's <code>bbdh_…</code> key with the Better Auth apikey plugin, which logs <code>INVALID_API_KEY</code> and yields <code>401 unauthorized</code> from <code>/internal/hosts/session</code>; the daemon treats 401 as non-retryable ({L("apps/host-daemon/src/server-connection.ts",402,432,"server-connection.ts#L402-L432")}), logs "Server rejected host credentials — this host is not registered with the server", and shuts down with <code>reason: startup-failed</code>; the launcher prints <code>✗ Host daemon failed to start</code> and exits 1. Every subsequent start does the same, because <code>maybeAddAutoJoinEnv</code> sees <code>auth.json</code> and skips re-enrollment.</p>
  <p><b>Contributing/adjacent defects observed while reproducing.</b> (a) <code>apps/server</code> logs <code>Server listening</code> before the socket is actually bound: <code>startHttpListener</code> returns synchronously from <code>@hono/node-server</code>'s <code>serve()</code> and the log follows immediately ({L("apps/server/src/start-server.ts",219,232,"start-server.ts#L219-L232")}); the EADDRINUSE arrives later as an unhandled <code>'error'</code> event and crashes the process with a raw Node stack, no bb-authored diagnostic (compare the daemon's "Host daemon local API port … already in use" message from #1155). In the logs above you can see <code>INFO: [server] Server listening {{… dataDir: /tmp/bb1558-two}}</code> for a server that never listened. (b) The launcher's supervision loop restarts the server unconditionally and re-runs the same identity-free probe, so a permanently un-bindable server child produces an infinite <code>✓ Server restarted</code> loop instead of a fatal error. (c) The pre-flight warnings in <code>runBbApp</code> (<code>warnExistingDaemonLock</code>, <code>warnExistingRuntimeRecord</code>) are all keyed on the data dir, so a port collision across data dirs is invisible to them.</p>

  <h2>Proposed fix (first principles)</h2>
  <ol>
    <li><b>Make the server probe prove identity, not liveness.</b> The launcher owns the server child, so it can hand it a per-launch secret: generate <code>BB_SERVER_LAUNCH_ID = randomUUID()</code> in <code>startFullStackServerProcess</code>, pass it in the child env, and have the server expose it — either as a field on <code>/health</code> (<code>{{ ok: true, launchId }}</code>, only when the env var is set) or on a small loopback-only <code>/internal/launch-identity</code>. <code>waitForHealth</code> (server flavour) then accepts only a 200 whose <code>launchId</code> matches, exactly like <code>waitForHostDaemonStatus</code> already requires the expected <code>hostId</code>/<code>serverUrl</code>. A foreign server returns no/other id → the loop keeps polling → the child exits with EADDRINUSE → <code>"Process exited before becoming healthy"</code> → launcher prints <code>✗ Server failed to start</code> and, crucially, never reaches <code>maybeAddAutoJoinEnv</code>. This is launcher↔server, not server↔daemon, so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump is needed; the launcher and server always ship together in the same package. Risk: the desktop app or other tooling that reads <code>/health</code> must tolerate the extra field (additive, fine); if using a dedicated route, gate it with <code>assertLoopbackRequest</code>. Also fix the misleading server log by using <code>serve(..., listeningListener)</code> (or the <code>'listening'</code> event) and add an <code>'error'</code> handler that turns EADDRINUSE into a bb-authored message and exit code.</li>
    <li><b>Cheap belt-and-braces:</b> before spawning the server, probe <code>/health</code> once; if it already answers, refuse to start with "port &lt;n&gt; is already served by another bb server (data dir? see its <code>bb-app-runtime.json</code>); use <code>BB_SERVER_PORT</code>/<code>--port</code>". This is not sufficient alone (a race with a concurrently booting instance one remains), which is why 1 is the real fix.</li>
    <li><b>Give the doomed restart loop an exit:</b> in <code>superviseFullStackProcesses</code>, stop restarting the server after N consecutive restarts that ended in exit-before-listen (or once the identity probe never matched), and exit 1 with the log-dir hint. Independent of 1 this turns the infinite <code>✓ Server restarted</code> loop into a visible failure.</li>
    <li><b>Recovery hint (optional):</b> extend the daemon's fatal 401/403 message to say the persisted <code>auth.json</code> in <code>&lt;dataDir&gt;</code> is not known to <code>&lt;serverUrl&gt;</code> and can be removed to re-enroll. Do <em>not</em> auto-delete: a wrong <code>BB_SERVER_URL</code> pointing at a legitimate remote server would then silently re-enroll a duplicate host.</li>
  </ol>
  <p>Test to add with fix 1: the vitest above (asserting rejection), plus a positive one where a fake server answers <code>/health</code> with the expected <code>launchId</code>. Test for 3: drive <code>superviseFullStackProcesses</code> with a <code>startServer</code> stub whose child exits immediately and assert it gives up.</p>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1121">#1121</a> (closed by #1155): enrolled host daemon had no collision handling for the default daemon port. #1155 added the <code>/status</code> identity check for the <em>daemon</em>; this issue is the missing counterpart for the <em>server</em> probe.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1524">#1524</a>: desktop startup against a server target that never answers has no deadline/recovery screen (adjacent: launcher/desktop trust of a port).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
<pre># worktree /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-21
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build                                    # 14 tasks, 13 cached
git fetch origin main; git log 16ceb3a54..origin/main --oneline -- packages/bb-app apps/host-daemon/src/start-host-daemon.ts apps/server/src/start-server.ts   # empty
git show desktop-v0.35.1:packages/bb-app/src/launcher.ts | grep -n "async function waitForHealth" -A 22   # identical to base

bash 1558/repro/start-one.sh                                 # instance one, /tmp/bb1558-one, ports 45886/45887
bash 1558/repro/start-two.sh                                 # instance two, /tmp/bb1558-two, same ports
cat /tmp/bb1558-two/auth.json; cat /tmp/bb1558-two/host-id
sqlite3 /tmp/bb1558-one/bb.db "select id,name from hosts"; sqlite3 /tmp/bb1558-two/bb.db "select id,name from hosts"
kill &lt;launcher one pid&gt;; bash 1558/repro/restart-two.sh       # instance two alone -&gt; 401 / INVALID_API_KEY
bash 1558/repro/start-one.sh; bash 1558/repro/start-two-daemon-port-differs.sh; bash 1558/repro/wait-restarts.sh &lt;pid&gt;   # variant: "bb is ready" + restart loop
kill &lt;both launcher pids&gt;; ss -ltn | grep -E "4588[6-9]"       # nothing left listening

# unit repro
sed -i 's/^async function waitForHealth(/export async function waitForHealth(/' packages/bb-app/src/launcher.ts
cp 1558/repro/issue-1558-foreign-health.test.ts packages/bb-app/test/
cd packages/bb-app &amp;&amp; pnpm exec vitest run test/issue-1558-foreign-health.test.ts    # 1 failed (expected on main)</pre>
  <h3>Repro scripts</h3>
<pre># start-one.sh
{start_one}
# start-two.sh
{start_two}
# restart-two.sh
{restart_two}</pre>
  <h3>Instance one launcher log (for reference)</h3>
<pre>{log_one}</pre>
</main></body>
</html>
"""
(D.parent/"1558.html").write_text(page)
print("wrote", len(page))
