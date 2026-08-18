#!/usr/bin/env python3
"""Assemble /tmp/bb-reports/issues/1758.html from the repro artifacts."""
import html, pathlib

R = pathlib.Path("/tmp/bb-reports/issues/1758/repro")
def esc(p): return html.escape(R.joinpath(p).read_text())
def E(s): return html.escape(s)

BASE = "16ceb3a540f81c1189efaffb27a39b1d9443abf5"
def L(path, a, b=None, label=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="https://github.com/get-bb/bb/blob/{BASE}/{path}{frag}">{label or (path.split("/")[-1] + frag)}</a>'

test_src = esc("server.auth-latch.test.ts")
fix_diff = esc("proposed-fix.diff")
vitest_main = esc("vitest-main-clean.txt")
vitest_fix = esc("vitest-with-fix-clean.txt")
after6 = esc("04-after-6min.txt")
reload_txt = esc("05-reload.txt")
slow_txt = esc("06-slow-gh-reload.txt")
token_probe = esc("07-gh-token-probe.txt")
shim = esc("fakebin/gh")
start_sh = esc("start-dev-offline.sh")
before_txt = esc("01-plugin-list-while-offline.txt")

out = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1758 github plugin latches needs-configuration on one transient gh auth failure</title>
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
  .v-repro {{ color:var(--high); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:14px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1758 · github plugin latches needs-configuration on one transient gh auth failure and never re-probes</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill med">Medium</span> <span class="pill">Effort: Small</span>
    <span class="pill">github</span>
    <a href="https://github.com/get-bb/bb/issues/1758">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>{BASE}</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> bb's optional <em>GitHub</em> plugin talks to GitHub through the <code>gh</code> command-line tool. When the plugin starts it runs <code>gh auth status</code> once to check that <code>gh</code> is logged in. <code>gh auth status</code> is not a local check: it calls the GitHub API, so it also fails when the network is down, when the macOS keychain holding the token is still locked, or when a slow machine makes it exceed the plugin's 10 s timeout. bb has a plugin state called <em>needs-configuration</em>, meant for "the user has to enter a setting"; a plugin in that state stays there until it is reloaded.</p>
  <p><b>What the user sees.</b> After a bb start during which <code>gh auth status</code> failed once, <code>bb plugin list</code> shows <code>github … needs-configuration (GitHub CLI is not authenticated … run `gh auth login`, then `bb plugin reload github`)</code>, the <em>GitHub</em> entry disappears from the app sidebar, and nothing changes for hours even though <code>gh auth status</code> succeeds in every terminal. Running <code>gh auth login</code> as instructed does nothing; only <code>bb plugin reload github</code> (or saving the plugin's settings) helps.</p>
  <p><b>What is actually wrong.</b> Verified end to end on <code>{BASE[:9]}</code>: <code>checkAuth()</code> in <code>plugins/github/server.ts</code> maps <em>every</em> failure of <code>gh auth status</code> to <code>NeedsConfigurationError</code>. That error is thrown from the load-time probe (which calls <code>bb.status.needsConfiguration</code>) and again from the first pass of the <code>sync</code> background service, which the plugin runtime treats as "stop this service and do not restart until reload". After that no code path runs <code>gh auth status</code> again: the runtime keeps needs-configuration until the next load, the plugin API has no way to clear it, and the app does not even load the frontend bundle of a non-running plugin, so the panel that could have shown the retained error (and its "Sync now" button) is unreachable. I reproduced it live (real <code>gh</code> behind a dead proxy for 10 s at server start, then healthy for 6.5 minutes: zero re-probes, still needs-configuration; <code>bb plugin reload github</code> → running) and with a vitest that fails on main.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td><code>checkAuth()</code> runs at load and only again on reload; a one-off failure is latched permanently</td><td class="ok">Verified</td><td>Load-time probe {L("plugins/github/server.ts",751,758)}; the <code>sync</code> service's <code>syncAll()</code> also calls it {L("plugins/github/server.ts",696,697)} but its <code>NeedsConfigurationError</code> stops the service "until reload" {L("apps/server/src/services/plugins/plugin-runtime.ts",589,598)}. Live: 3 gh calls at 07:23:54, none in the following 6.5 min (<a href="1758/repro/04-after-6min.txt">04-after-6min.txt</a>). Unit test fails on main.</td></tr>
    <tr><td><code>bb plugin list</code> shows <code>needs-configuration</code> with the <code>gh auth login</code> hint while <code>gh auth status</code> succeeds</td><td class="ok">Verified</td><td><a href="1758/repro/04-after-6min.txt">04-after-6min.txt</a>: <code>gh auth status</code> ✓ and <code>github@0.2.1 needs-configuration (GitHub CLI is not authenticated. …)</code> in the same second.</td></tr>
    <tr><td><code>bb plugin reload github</code> fixes it instantly</td><td class="ok">Verified</td><td><a href="1758/repro/05-reload.txt">05-reload.txt</a>: reload → <code>running</code>, <code>service sync: running</code>, three fresh gh calls.</td></tr>
    <tr><td><code>gh auth status</code> makes a real API call (not local-only)</td><td class="ok">Verified</td><td>With <code>HTTPS_PROXY=http://127.0.0.1:9</code> (nothing listening) <code>gh auth status</code> exits 1 in 0.17 s printing "The token … is invalid"; normally 0.7 s here (Appendix). gh's own wording for a network failure is itself misleading.</td></tr>
    <tr><td>Plausible one-off causes: locked keychain, network blip, slow start past the 10 s timeout, bb started before <code>gh auth login</code></td><td class="unv">Partly verified</td><td>Network failure: reproduced live. Slow host: reproduced by making the shim sleep 12 s (<a href="1758/repro/06-slow-gh-reload.txt">06-slow-gh-reload.txt</a>); the plugin then reports the same needs-configuration text while the retained inner error even says "GitHub CLI not found" (the 5 s <code>gh --version</code> probe timed out). Keychain: no macOS here, unverified, but any non-zero exit of <code>gh auth status</code> takes the identical path. bb-before-login: same path; that one is a genuine configuration case, but recovery still requires a reload.</td></tr>
    <tr><td>The original <code>ghAuthError</code> is not recoverable after the fact; <code>bb plugin list</code> shows only the generic hint</td><td class="ok">Verified for the CLI, refined</td><td><code>bb plugin list</code> prints only the <code>statusDetail</code> string. The retained error <em>is</em> returned by the plugin's <code>status</code> RPC (<a href="1758/repro/03-rpc-status-after-gh-online.json">03-rpc-status…json</a>) but the only consumer, the plugin's own panel, is never mounted for a non-running plugin ({L("apps/app/src/lib/plugin-frontend.ts",312,314)}), so in practice it is invisible.</td></tr>
    <tr><td>The hint names the wrong remedy (<code>gh auth login</code>)</td><td class="ok">Verified</td><td>The remedy is <code>bb plugin reload github</code> (or saving the plugin's settings, which the runtime answers with a reload: {L("apps/server/src/services/plugins/plugin-service.ts",1900,1913)}). Neither is discoverable from the message except as the trailing "then …" clause.</td></tr>
    <tr><td>Observed on bb 0.38.0 / macOS 26 / gh 2.95.0</td><td class="unv">Unverifiable</td><td>Reproduced on Linux with gh 2.96.0 at <code>{BASE[:9]}</code>; the code path is unchanged since <code>plugins/github</code> was created (git log -S checkAuth) and identical on <code>origin/main</code> today.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>{BASE[:9]}</code> (main, 2026-08-18); <code>git fetch origin main</code> shows no later commit touching <code>plugins/github</code> or the plugin runtime status handling.</li>
    <li>Ubuntu 26.04, Linux 7.0.0-29-generic, node v24.18.0, gh 2.96.0 (authenticated as SawyerHood via <code>~/.config/gh/hosts.yml</code>).</li>
    <li>Dev instance from worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-3</code>: app <code>:15580</code>, server <code>:23580</code>, host daemon <code>:31580</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-3-d733fd243d0c</code>. The github plugin is an "official" (not auto-installed) plugin: <code>bb plugin install builtin:github --yes</code>.</li>
    <li>CLI wrapper: <a href="1758/repro/bb.sh">1758/repro/bb.sh</a> (sets <code>BB_SERVER_URL=http://localhost:23580</code> and runs <code>packages/scripts/dist/commands/run-cli.js</code>). Below, <code>bb</code> means this wrapper.</li>
    <li>No agent turns were run; no provider usage.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>Live repro: gh unreachable for the first seconds of bb's life, then healthy</h3>
  <p>The only trick is a transparent <code>gh</code> shim (<a href="1758/repro/fakebin/gh">1758/repro/fakebin/gh</a>) that runs the <b>real</b> <code>gh</code>, but while a flag file exists routes it through a dead proxy (<code>HTTPS_PROXY=http://127.0.0.1:9</code>) — a faithful "network is down" — and logs every invocation the server makes:</p>
  <pre>{shim}</pre>
  <ol>
    <li>Build once: <code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build</code>.</li>
    <li>Start the dev instance with the shim first on PATH and gh "offline" (<a href="1758/repro/start-dev-offline.sh">start-dev-offline.sh</a>; <code>scripts/bb-dev-app</code> prepends <code>BB_DEV_NODE_BIN_DIR</code> to the server's PATH ahead of <code>~/.local/bin</code>, where the real gh lives, so the shim dir also carries a <code>node</code> symlink):
<pre>{start_sh}</pre>
    If the github plugin is not installed yet: <code>bb plugin install builtin:github --yes</code> (I had installed it in a previous run of the same instance; the shim log below therefore starts with the plugin loading at server start).</li>
    <li>Observe the latch (<a href="1758/repro/01-plugin-list-while-offline.txt">01-plugin-list-while-offline.txt</a>, shim log, dev.log):
<pre>$ cat 1758/repro/gh-calls.log
07:23:54 pid=2314480 ppid=2313311 mode=OFFLINE args=--version
07:23:54 pid=2314493 ppid=2313311 mode=OFFLINE args=auth status      # load-time probe
07:23:54 pid=2314513 ppid=2313311 mode=OFFLINE args=auth status      # sync service's first syncAll()
$ grep github dev.log
[07:23:54] INFO: [server] plugin github@0.2.1 loaded
[07:23:54] INFO: [server] [plugin:github] service sync needs configuration; not restarting until reload
$ bb plugin list | grep -A3 ^github
{before_txt}</pre></li>
    <li>Bring gh back (07:24:07): <code>rm 1758/repro/gh-offline</code>; <code>gh auth status</code> → ✓ Logged in.</li>
    <li>Wait longer than the plugin's 5-minute sync interval and look again (<a href="1758/repro/wait-and-check.sh">wait-and-check.sh</a>, output <a href="1758/repro/04-after-6min.txt">04-after-6min.txt</a>):
<pre>{after6}</pre>
    <b>Expected</b> (issue): the plugin notices that <code>gh</code> works and comes back. <b>Actual</b>: 6 min 34 s after gh recovered the server has not run <code>gh</code> even once more, <code>bb plugin list</code> still says <code>needs-configuration (GitHub CLI is not authenticated … run `gh auth login` …)</code>, the sync service is <code>stopped</code>, and the retained error (only visible via the RPC) still describes the failure from 07:23:54.</li>
    <li>The workaround from the issue (<a href="1758/repro/05-reload.txt">05-reload.txt</a>):
<pre>$ bb plugin reload github
{reload_txt}</pre></li>
  </ol>
  <figure><img src="assets/1758-needs-config-detail.png" alt="Extensions › Installed plugins › GitHub while latched"><figcaption>Extensions › Installed plugins › GitHub while latched (gh already healthy again). The banner says "GitHub CLI is not authenticated … run gh auth login … Complete the Configuration section; bb reloads the plugin after you save", the sync service is Stopped. Note the plugin has no configuration that could fix this.</figcaption></figure>
  <figure><img src="assets/1758-installed-list.png" alt="Installed plugins list while latched"><figcaption>Extensions › Installed plugins while latched: the GitHub row is enabled (toggle on) and only a small gear badge on its icon hints at the needs-configuration state; the list gives no reason.</figcaption></figure>
  <figure><img src="assets/1758-sidebar-no-github.png" alt="Sidebar without GitHub entry while latched"><figcaption>App sidebar while latched: there is no <em>GitHub</em> entry at all (New thread / Extensions / Automations only). The app does not load the frontend bundle of a plugin whose status is not <code>running</code>, so the panel that would show the retained gh error and its "Sync now" button cannot be reached.</figcaption></figure>
  <figure><img src="assets/1758-sidebar-after-reload.png" alt="Sidebar after bb plugin reload github"><figcaption>Same sidebar seconds after <code>bb plugin reload github</code>: <em>GitHub</em> is back. Nothing about gh changed between the two screenshots.</figcaption></figure>

  <h3>Variant: slow host (gh takes &gt; 10 s)</h3>
  <p>The shim can also sleep 12 s before running gh (flag <code>gh-slow</code>), the "load average 23" scenario. Reload the plugin under that condition (<a href="1758/repro/06-slow-gh-reload.txt">06-slow-gh-reload.txt</a>):</p>
  <pre>$ touch 1758/repro/gh-slow; bb plugin reload github; rm 1758/repro/gh-slow
{slow_txt}</pre>
  <p>Same latch, same "not authenticated" hint; the retained inner error is "GitHub CLI not found" because the 5 s <code>gh --version</code> probe in <code>resolveGh()</code> timed out first. Both messages are wrong for a machine that merely was busy.</p>

  <h3>Unit-level repro (vitest, fails on main)</h3>
  <p>File: <a href="1758/repro/server.auth-latch.test.ts">1758/repro/server.auth-latch.test.ts</a> — copy to <code>plugins/github/server.auth-latch.test.ts</code> and run <code>cd plugins/github &amp;&amp; pnpm exec vitest run server.auth-latch.test.ts</code>. It drives the real plugin entry (<code>plugins/github/server.ts</code>) through <code>createFakePluginHost</code> from <code>@get-bb/plugin-sdk/testing</code>, with a fake <code>gh</code> on PATH whose <code>auth status</code> fails while a flag file exists (with gh 2.96's verbatim offline wording) and succeeds afterwards; <code>auth token</code> (local-only) always succeeds because credentials are configured.</p>
  <pre>{test_src}</pre>
  <p>On main two of the four tests fail (<a href="1758/repro/vitest-main-clean.txt">vitest-main-clean.txt</a>): the first because after gh recovers the plugin makes no further gh call at all (<code>expected 3 to be greater than 3</code>) and <code>ghOk</code> stays false; the second because a purely transient failure produced two needs-configuration reports carrying the <code>gh auth login</code> remedy. The "no credentials at all" and the healthy control cases pass on main and must keep passing after a fix.</p>
  <pre>{vitest_main}</pre>

  <h2>Root cause</h2>
  <p><b>1. Every <code>gh auth status</code> failure is classified as a configuration error.</b> {L("plugins/github/server.ts",500,508,"server.ts#L500-L508")}:</p>
  <pre>async function checkAuth(): Promise&lt;void&gt; {{
  try {{
    await gh(["auth", "status"], 10_000);
    ghAuthError = null;
  }} catch (error) {{
    ghAuthError = error instanceof Error ? error.message : String(error);
    throw needsConfiguration(`GitHub CLI is not authenticated. ${{GH_HINT}}`);
  }}
}}</pre>
  <p><code>gh auth status</code> hits the GitHub API, so network outage, locked keychain, dead proxy, or the 10 s <code>execFile</code> timeout on a starved host all land here. <code>resolveGh()</code> ({L("plugins/github/server.ts",479,492)}) has the same shape: a 5 s <code>gh --version</code> timeout is reported as "GitHub CLI not found". <code>GH_HINT</code> ({L("plugins/github/server.ts",20,22)}) always says <code>gh auth login</code>.</p>
  <p><b>2. The error is thrown from the two places that latch.</b> At load, {L("plugins/github/server.ts",751,758)} calls <code>bb.status.needsConfiguration(message)</code>. Immediately after, the <code>sync</code> service's first <code>syncAll()</code> ({L("plugins/github/server.ts",696,697)}, service at {L("plugins/github/server.ts",728,750)}) throws the same error out of <code>start()</code>. The runtime treats that as terminal: {L("apps/server/src/services/plugins/plugin-runtime.ts",589,598)}</p>
  <pre>if (isNeedsConfigurationError(outcome.error)) {{
  service.state = "stopped";
  reportNeedsConfiguration(id, outcome.error.message || `service ${{name}} needs configuration`);
  logger.info(`[plugin:${{id}}] service ${{name}} needs configuration; not restarting until reload`);
  return;
}}</pre>
  <p>Ordinary crashes get exponential-backoff restarts (same function, a few lines down); NeedsConfigurationError deliberately does not. So the only periodic re-probe the plugin has (the 5-minute sync loop) is dead after one failure.</p>
  <p><b>3. Nothing can clear the state except a reload.</b> The runtime keeps needs-configuration in a map that is only cleared "on the next load" ({L("apps/server/src/services/plugins/plugin-runtime.ts",455,457)}, {L("apps/server/src/services/plugins/plugin-runtime.ts",1595)}); the plugin API exposes only <code>bb.status.needsConfiguration(message)</code>, no way back to running ({L("apps/server/src/services/plugins/plugin-api.ts",1166,1175)}). The one automatic reload is triggered by a settings save ({L("apps/server/src/services/plugins/plugin-service.ts",1900,1913)}), which the github plugin's message does not mention and which has nothing to do with gh.</p>
  <p><b>4. The retained error and the manual re-probe are unreachable.</b> The plugin remembers <code>ghAuthError</code> and its <code>status</code> RPC returns it ({L("plugins/github/server.ts",909,921)}); the panel would render it and offers a "Sync now" button whose <code>refresh</code> RPC would call <code>checkAuth()</code> again. But the app skips the frontend bundle of any plugin whose status is not <code>running</code> ({L("apps/app/src/lib/plugin-frontend.ts",312,314)}), so the sidebar entry vanishes (screenshots above), the banner in {L("plugins/github/app.tsx",2405,2410)} never mounts, and even that <code>refresh</code> could not have cleared the runtime status. <code>bb plugin list</code> prints only <code>statusDetail</code>, i.e. the generic hint.</p>
  <p><b>Why the symptom follows.</b> One failed probe at startup → <code>needs-configuration</code> + sync service stopped → no further <code>gh</code> invocation from the server process, ever → <code>bb plugin list</code> keeps quoting a hint (<code>gh auth login</code>) that cannot change anything, the GitHub panel is gone, and only <code>bb plugin reload github</code> (or a settings save) re-runs the probe. Deeper issue: the plugin uses the runtime's <em>configuration</em> state for a <em>dependency availability</em> condition, and the runtime, correctly for real configuration errors, offers no self-healing for it.</p>

  <h2>Proposed fix (first principles)</h2>
  <p>Contained in the plugin; no server/daemon boundary change, no wire change, no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump. Prototype diff: <a href="1758/repro/proposed-fix.diff">1758/repro/proposed-fix.diff</a> (applied in my worktree; makes all four tests in the repro file pass and keeps the existing <code>bb-plugin-github</code> typecheck and tests green: <a href="1758/repro/turbo-typecheck-test-with-fix.txt">turbo output</a>, <a href="1758/repro/vitest-with-fix-clean.txt">vitest output</a>).</p>
  <ol>
    <li><b>Classify probe failures.</b> In <code>checkAuth()</code>, throw <code>NeedsConfigurationError</code> only when gh is missing or holds no credentials at all. <code>gh auth token</code> is network-free (verified: it prints the token behind a dead proxy and fails with "no oauth token found for github.com" when there is no config, <a href="1758/repro/07-gh-token-probe.txt">07-gh-token-probe.txt</a>), so use it to tell "not logged in" from "logged in but the API probe failed". Everything else becomes a plain <code>Error</code> that carries gh's stderr.</li>
    <li><b>Do not let the sync loop die on transient errors.</b> Catch non-configuration errors inside the <code>sync</code> service loop, log them, and retry with backoff (30 s doubling up to the 5-minute interval) instead of throwing out of <code>start()</code>. Rethrow only <code>NeedsConfigurationError</code>. Do not rely on the runtime's crash-restart for this: a throw during activation would mark the plugin <code>error</code> ({L("apps/server/src/services/plugins/plugin-runtime.ts",603,611)}).</li>
    <li><b>Re-probe on demand.</b> In the <code>status</code> RPC, if the last probe failed, run <code>checkAuth()</code> again before answering, so the panel banner (and any CLI/SDK caller) reflects the current state.</li>
    <li><b>Load-time.</b> Only call <code>bb.status.needsConfiguration</code> for the two configuration cases; log transient failures as warnings.</li>
  </ol>
  <pre>{fix_diff}</pre>
  <p><b>What could go wrong / follow-ups.</b> (a) While gh is unreachable the plugin now shows <code>running</code>; the retained error is visible in the panel banner and dev log, but <code>bb plugin list</code> has no "degraded" detail. If a visible status is wanted the runtime would need a plugin-facing degraded/clear API (new public API ⇒ <code>experimental_</code> prefix and <code>docs/api_to_audit.md</code> per AGENTS.md); I would not block the fix on that. (b) The panel banner text in <code>app.tsx</code> still says "run gh auth login, then reload the plugin"; it should be reworded to show the actual error and offer "Sync now". (c) <code>resolveGh()</code> should distinguish ENOENT from a timeout so a slow host is not reported as "GitHub CLI not found" (in the prototype a timeout there is treated as transient only because it happens on the <code>auth status</code> path; a first-call timeout at <code>--version</code> still surfaces as NeedsConfiguration — worth tightening). (d) The genuinely-unauthenticated case still requires <code>bb plugin reload github</code> after <code>gh auth login</code>; that matches the runtime contract and the message is now correct for it. (e) <code>GH_TOKEN</code>-only setups: <code>gh auth token</code> returns the env token, so they are treated as configured; fine.</p>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1267">#1267</a> (closed): GitHub plugin fails to load PRs when Issues are disabled — the other place where one gh failure took the whole sync down; fixed by per-repo tolerance in <code>fetchRepoItems</code>.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1543">#1543</a> (open): wake threads from native GitHub PR state changes — will lean on the same gh plumbing and sync loop.</li>
    <li>No prior issue about needs-configuration latching or the plugin runtime's "not restarting until reload" policy was found (searched "needs-configuration", "gh auth", "github plugin").</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
  <pre>git checkout 16ceb3a54 ; pnpm install --frozen-lockfile --prefer-offline ; pnpm exec turbo run build
# shim self-test (real gh through a dead proxy fails; normal gh works)
bash 1758/repro/shim-selftest.sh
# first attempt (superseded, see 02-plugin-list-after-gh-online.txt): scripts/bb-dev-app current with the shim on PATH,
#   bb plugin install builtin:github --yes  → the launcher puts ~/.local/bin (real gh) ahead of PATH; fixed by BB_DEV_NODE_BIN_DIR
# clean run
bash 1758/repro/start-dev-offline.sh                     # server starts 07:23:53 with gh offline
bash 1758/repro/bb.sh plugin list | grep -A3 ^github     # 01-plugin-list-while-offline.txt
rm 1758/repro/gh-offline                                 # 07:24:07 gh healthy again
curl -s -X POST http://localhost:23580/api/v1/plugins/github/rpc/status -H 'content-type: application/json' -H 'origin: http://localhost:15580' -d null   # 03-rpc-status-after-gh-online.json
bash 1758/repro/wait-and-check.sh 07:30:40 | tee 1758/repro/04-after-6min.txt
bash 1758/repro/bb.sh plugin reload github               # 05-reload.txt
touch 1758/repro/gh-slow; bash 1758/repro/bb.sh plugin reload github; rm 1758/repro/gh-slow   # 06-slow-gh-reload.txt
dev-browser --browser bb1758 --headless run 1758/repro/shot-home.js ; … shot-extensions.js       # screenshots
pnpm dev:stop
bash 1758/repro/gh-token-probe.sh                        # 07-gh-token-probe.txt
cp 1758/repro/server.auth-latch.test.ts plugins/github/ &amp;&amp; cd plugins/github &amp;&amp; pnpm exec vitest run server.auth-latch.test.ts   # fails on main
git apply 1758/repro/proposed-fix.diff ; pnpm exec turbo run typecheck test --filter=bb-plugin-github --force        # all green</pre>
  <h3>gh behaviour behind a dead proxy vs. normally</h3>
  <pre>$ time gh auth status
github.com
  ✓ Logged in to github.com account SawyerHood (/home/sawyer/.config/gh/hosts.yml)
real 0m0.708s
$ time HTTPS_PROXY=http://127.0.0.1:9 gh auth status
github.com
  X Failed to log in to github.com account SawyerHood (/home/sawyer/.config/gh/hosts.yml)
  - Active account: true
  - The token in /home/sawyer/.config/gh/hosts.yml is invalid.
  - To re-authenticate, run: gh auth refresh -h github.com
real 0m0.174s   exit=1</pre>
  <h3><code>gh auth token</code> as a network-free discriminator</h3>
  <pre>{token_probe}</pre>
  <h3>vitest with the prototype fix applied</h3>
  <pre>{vitest_fix}</pre>
  <h3>Files</h3>
  <ul>
    <li><a href="1758/repro/gh-calls.log">gh-calls.log</a> — every gh invocation the server made (clean run + reload + slow variant).</li>
    <li><a href="1758/repro/dev.log">dev.log</a> — full dev-server log of the clean run.</li>
    <li><a href="1758/repro/start-dev.log">start-dev.log</a>, <a href="1758/repro/dev-stop.log">dev-stop.log</a>.</li>
  </ul>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/1758.html").write_text(out)
print("wrote", len(out))
