#!/usr/bin/env python3
"""Assemble /tmp/bb-reports/issues/2029.html from the repro artifacts."""
import html
from pathlib import Path

R = Path("/tmp/bb-reports/issues/2029/repro")
OUT = Path("/tmp/bb-reports/issues/2029.html")
BASE = "c7c66423d55c320bab9103218f0ffef1a8191331"
GH = f"https://github.com/get-bb/bb/blob/{BASE}"


def pre(name: str, start: int | None = None, end: int | None = None) -> str:
    text = (R / name).read_text()
    if start is not None or end is not None:
        lines = text.splitlines()
        text = "\n".join(lines[start:end])
    return f"<pre>{html.escape(text)}</pre>"


def code(s: str) -> str:
    return f"<pre>{html.escape(s)}</pre>"


def link(path: str, l1: int, l2: int | None = None, label: str | None = None) -> str:
    frag = f"#L{l1}" + (f"-L{l2}" if l2 else "")
    return f'<a href="{GH}/{path}{frag}">{label or (path + ":" + str(l1))}</a>'


RUNTIME = "apps/server/src/services/plugins/plugin-runtime.ts"
SERVICE = "apps/server/src/services/plugins/plugin-service.ts"
ARTIFACTS = "apps/server/src/services/plugins/managed-plugin-artifacts.ts"
ROUTES = "apps/server/src/routes/plugins.ts"
CLI = "apps/cli/src/commands/plugin.ts"
BUILD = "packages/plugin-build/src/build-plugin-app.ts"

doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #2029 Plugin reload: host rebuilds plugin artifacts into the deployed root, and orphaned services survive with closed handles while reload reports exit 0</title>
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
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; white-space:pre-wrap; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#2029 · Plugin reload: host rebuilds plugin artifacts into the deployed root, and orphaned services survive with closed handles while reload reports exit 0</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill med">Priority: Medium</span> <span class="pill">Effort: n/a</span> <span class="pill">cli</span> <span class="pill">plugins</span>
    <a href="https://github.com/get-bb/bb/issues/2029">open on GitHub</a>
    <span>2026-08-20 · base <code>c7c66423d</code></span>
  </p>
  <p><strong>Verdict:</strong> <span class="verdict">REPRODUCED</span> (both defects, live on a dev instance at the base commit) · <strong>Root-cause confidence:</strong> high</p>

  <h2>1. TL;DR</h2>
  <p>Two separate behaviours, both real and both reproduced at <code>c7c66423d</code>.</p>
  <p><strong>Defect 1 — the host writes into a path-installed plugin's root.</strong> For <code>path:</code> installs the server treats <code>dist/app.*</code> as a cache of the source tree: it rebuilds the frontend bundle in place on <em>install</em> (always), and on every <em>load</em> (server start, <code>bb plugin reload</code>, <code>bb plugin enable</code>) when either any non-ignored file's mtime is newer than <code>dist/app.js</code> or the committed <code>dist/app.meta.json</code> records a different SDK version than the running host. This is deliberate design ("mutable plugin app artifacts are only a cache of their source tree"), not an accident, and it is covered by an existing unit test. Deploying a git checkout that commits <code>dist/</code> therefore goes dirty the moment the host loads it. The reporter's mtime workaround only disables the first trigger; the SDK-version trigger still rewrites the files (repro step 5). The "output differs from committed bytes" part of the complaint (path comments like <code>// .bb/worktrees/.../src/provider-marks.ts</code>) is specific to 0.39.0, where the esbuild call had no <code>absWorkingDir</code> and no <code>minify</code>, so path comments were relative to the server process cwd; PR #1895 (on main, unreleased) minifies and pins <code>absWorkingDir</code>, so on main the rebuilt <code>app.js</code>/<code>app.css</code> are byte-identical and only <code>dist/app.meta.json</code> (<code>builtWith.bbVersion</code>) can differ.</p>
  <p><strong>Defect 2 — reload reports success for an unusable plugin.</strong> When a background service ignores its abort signal, the runtime waits 5 s, marks the plugin <code>degraded</code>, refuses to load the new instance (to avoid double-starting), closes the old instance's database handles, and returns normally. <code>POST /api/v1/plugins/reload</code> therefore answers <code>{{"ok":true}}</code> and <code>bb plugin reload</code> exits 0, while the plugin's CLI command is gone (<code>error: unknown command 'collab'</code>) and the orphaned service keeps ticking against the closed handle (<code>TypeError: The database connection is not open</code>). The "degraded" state itself is the intended design; the missing piece is that the reload result does not carry that outcome, so automation cannot see it.</p>

  <h2>2. Claims vs findings</h2>
  <table><tr><th>Claim from the issue</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>The host rebuilds <code>dist/app.js</code>/<code>dist/app.css</code> during plugin load when a source mtime exceeds <code>dist/app.js</code>, writing into the plugin root.</td><td class="ok">Verified</td><td>{link(RUNTIME, 976, 1012, "isMutableAppBundleStale")} + {link(RUNTIME, 1085, 1124, "loadAppBundleCandidate")}; repro step 4(a): after <code>touch src/provider-marks.ts</code>, <code>bb plugin reload</code> rewrote all three <code>dist/app.*</code> files and logged <code>rebuilding frontend bundle (plugin source is newer than dist/app.js)</code>.</td></tr>
    <tr><td>The rebuilt output differs from committed bytes because it embeds absolute/cwd-relative paths.</td><td class="ok">Verified for 0.39.0; fixed-by-accident on main</td><td>0.39.0's build had no <code>absWorkingDir</code> and no minify, so esbuild's <code>// path</code> comments were relative to <code>process.cwd()</code> (demo: <a href="2029/repro/esbuild-path-comments.log">esbuild-path-comments.log</a>). #1895 (<code>dbbb7640f</code>, not in any release tag) adds <code>absWorkingDir: rootDir</code> and <code>minify: true</code>; on main only <code>app.meta.json</code> differs (repro steps 1, 4, 5: <code>builtWith.bbVersion</code> 0.39.0 → 0.0.0-dev).</td></tr>
    <tr><td><code>server.js</code> is never rebuilt by this path; only <code>app.*</code>.</td><td class="ok">Verified</td><td>Path installs load the backend from source ({link(RUNTIME, 1027, 1040, "resolveServerEntry")}); only <code>buildPluginApp</code> (and <code>buildPluginHost</code> when <code>bb.host</code> is declared) runs on load. <code>dist/server.js</code> mtime unchanged across all steps.</td></tr>
    <tr><td>Timing: artifacts written ~13 s after the reload call returned.</td><td class="unv">Unverified</td><td>On main the rebuild is awaited inside <code>loadOne</code> before the route answers (step 4: files rewritten during the call). I could not reproduce a delayed write; possibly a second load (enable, server restart) in their deploy.</td></tr>
    <tr><td>Workaround: keep <code>dist/</code> mtimes newer than all sources.</td><td class="ok">Verified but incomplete</td><td>Disables the mtime trigger only. Step 5: with every <code>dist/*</code> newer than every source but <code>app.meta.json</code> stamped <code>sdkVersion 0.4.1</code>, server start still rebuilt (<code>built with SDK unknown, running SDK is 0.4.9</code>). Also <code>bb plugin install &lt;path&gt;</code> always builds (step 1; {link(ARTIFACTS, 330, 352)}).</td></tr>
    <tr><td>A reload left the previous service resident, throwing <code>capacity-interval-unreadable:TypeError: The database connection is not open</code> every tick.</td><td class="ok">Verified</td><td>Step 3: after reload, <code>bb plugin logs collab-fixture</code> fills with exactly that TypeError once per second; {link(RUNTIME, 1670, 1698, "disposePluginInstance")} closes database handles after the bounded service wait.</td></tr>
    <tr><td><code>bb plugin reload</code> returned exit 0.</td><td class="ok">Verified</td><td>Step 3: <code>exit=0</code>; <code>--json</code> shows <code>"ok": true</code>. Route always answers ok ({link(ROUTES, 451, 455)}); CLI only fails on <code>!ok</code> or unknown id ({link(CLI, 1621, 1650)}). Unit repro <a href="2029/repro/issue-2029-reload-reports-success.test.ts">issue-2029-reload-reports-success.test.ts</a> fails on main at the last assertion.</td></tr>
    <tr><td><code>bb plugin list</code> showed <code>degraded (service lane-watcher did not stop)</code>.</td><td class="ok">Verified</td><td>Step 3 output and <a href="assets/2029-plugins-page.png">screenshot</a>.</td></tr>
    <tr><td>The plugin's CLI command surface was entirely gone (<code>error: unknown command 'collab'</code>).</td><td class="ok">Verified</td><td>Step 3: <code>bb collab</code> → <code>error: unknown command 'collab'</code> exit 1; <code>bb plugin run collab-fixture</code> → <code>plugin "collab-fixture" is not running (status: degraded — …)</code>. Cause: {link(RUNTIME, 1575, 1588)} deletes the plugin from <code>loaded</code> when the old service hung.</td></tr>
    <tr><td>A second reload cleared the degraded label; <code>disable</code>+<code>enable</code> cleared the orphan.</td><td class="unv">Unverified (plugin-dependent)</td><td>Recovery only happens once the hung <code>start()</code> promise settles ({link(RUNTIME, 1298, 1305)}, <code>onHungServiceSettled</code>). My fixture's promise never settles, so the second reload, disable and enable all stayed <code>degraded</code> (step 3). The reporter's service must have settled between their calls; the interval behind it is never killed by the host either way.</td></tr>
    <tr><td><code>bb plugin list</code> reported <code>running</code> for a period while a component was dead.</td><td class="unv">Unverified</td><td>Plausible paths: a failed reload keeps the previous instance and reports <code>running (reload failed: …)</code> ({link(RUNTIME, 1288, 1294)}); a crashed service in backoff leaves plugin status <code>running</code> with the service state shown separately. Not reproduced.</td></tr>
  </table>

  <h2>3. Environment</h2>
  <ul>
    <li>bb monorepo at <code>c7c66423d</code> (branch main, 2026-08-20); origin/main has no newer commits touching these paths. App version <code>0.39.0</code> (dev build reports <code>0.0.0-dev</code>), plugin SDK <code>0.4.9</code>. Issue was filed against 0.39.0 / SDK 0.4.1 on macOS.</li>
    <li>Linux 7.0.0-29-generic, Node v24.18.0, pnpm workspace, esbuild 0.28.1.</li>
    <li>Own dev instance via <code>scripts/bb-dev-app current</code>: server <code>http://localhost:19347</code>, app <code>http://localhost:11347</code>, host daemon <code>127.0.0.1:27347</code>, data dir <code>~/.bb-dev/projects-bb-.claude-worktrees-wf_926b3193-f6c-4-896a981b4828</code> (deleted at cleanup).</li>
    <li>Fixture plugin: <code>/tmp/bb2029-plugin</code> (git repo with <code>dist/</code> committed), sources in <a href="2029/repro/">2029/repro/</a> (<code>fixture-*.ts*</code>, <code>fixture-package.json</code>).</li>
  </ul>

  <h2>4. Minimal reproduction</h2>
  <p>Fixture: a path plugin with a frontend entry (<code>src/app.tsx</code> importing <code>src/provider-marks.ts</code>), a CLI command <code>bb collab</code>, and a background service <code>lane-watcher</code> that captures <code>bb.storage.database()</code>, ticks every second, and ignores its abort signal (the reporter's lane-watcher behaviour). <code>dist/</code> is built with <code>bb plugin build</code> and committed, so <code>git status</code> is the integrity check.</p>
  {code((R / "fixture-server.ts").read_text())}
  <ol>
    <li><strong>Install from a clean checkout</strong> — <a href="2029/repro/step1-install.sh">step1-install.sh</a>. Expected: the author's directory is untouched. Actual: <code>dist/app.js</code>, <code>dist/app.css</code>, <code>dist/app.meta.json</code> are rewritten (mtimes) and <code>app.meta.json</code> differs in bytes.
    {pre("step1-install.log")}</li>
    <li><strong>Deploy by <code>git checkout</code> then reload</strong> — <a href="2029/repro/step2-deploy-reload.sh">step2-deploy-reload.sh</a>. Here git wrote <code>dist/app.js</code> and <code>src/provider-marks.ts</code> with identical mtimes, so the mtime gate was <em>not</em> satisfied and no rebuild happened; the step instead surfaces defect 2 (reload → <code>degraded</code>, <code>exit=0</code>). Whether a checkout trips the gate depends on write ordering and timestamp granularity, which is the "undocumented internal condition" the issue describes.
    {pre("step2-deploy-reload.log")}</li>
    <li><strong>Orphaned service, exit 0, command surface gone</strong> — <a href="2029/repro/step3-orphan.sh">step3-orphan.sh</a> (run against a freshly started server). Expected: a reload that leaves the plugin unusable fails its exit code. Actual: <code>exit=0</code>, <code>"ok": true</code>, <code>bb collab</code> → <code>unknown command</code>, plugin log fills with <code>TypeError: The database connection is not open</code>, and the count keeps growing after <code>disable</code>/<code>enable</code>.
    {pre("step3-orphan.log")}
    <figure><img src="assets/2029-plugins-page.png" alt="Installed plugins page showing Collab fixture as Degraded: service lane-watcher did not stop"><figcaption>App → Extensions → Installed plugins after step 3: "Collab fixture — Degraded — service lane-watcher did not stop". The CLI that produced it exited 0.</figcaption></figure></li>
    <li><strong>Reload rebuilds into the root when a source is newer</strong> — <a href="2029/repro/step4-reload-rebuild.sh">step4-reload-rebuild.sh</a> (fresh server). Part (a) reproduces: <code>touch src/provider-marks.ts</code> + reload rewrote <code>dist/app.*</code>, log line <code>rebuilding frontend bundle (plugin source is newer than dist/app.js)</code>. Part (b) did not fire in this run only because the same reload had already left the plugin hung (hung check precedes the rebuild); it is re-run cleanly as step 5.
    {pre("step4-reload-rebuild.log")}</li>
    <li><strong>SDK-version trigger defeats the mtime workaround</strong> — <a href="2029/repro/step5-sdk-mismatch.sh">step5-sdk-mismatch.sh</a>. Committed <code>app.meta.json</code> stamped <code>sdkVersion 0.4.1</code> (the reporter's SDK), every <code>dist/*</code> touched newer than every source, server restarted. Actual: rebuilt on load anyway; checkout dirty.
    {pre("step5-sdk-mismatch.log")}</li>
    <li><strong>Unit-level repro of defect 2</strong> — <a href="2029/repro/issue-2029-reload-reports-success.test.ts">apps/server/test/services/plugins/issue-2029-reload-reports-success.test.ts</a>, run with <code>pnpm exec vitest run test/services/plugins/issue-2029-reload-reports-success.test.ts</code> from <code>apps/server</code>. Every observation assertion passes (degraded, API gone, closed-handle errors &gt; 0); the final assertion, "reload() must not resolve as success", fails on main:
    {pre("vitest-issue-2029.log", 4, 20)}
    {code((R / "issue-2029-reload-reports-success.test.ts").read_text())}</li>
  </ol>
  <p>Repro files: <a href="2029/repro/">2029/repro/</a></p>

  <h2>5. Root cause</h2>
  <h3>Defect 1: path-install artifacts are a host-owned cache living in the author's directory</h3>
  <p>Three code paths write <code>dist/app.*</code> into a path plugin's root:</p>
  <ul>
    <li><strong>Install</strong>: {link(ARTIFACTS, 330, 352, "managed-plugin-artifacts.ts:330-352")} — for every non-npm, non-packaged-builtin plugin with <code>bb.app</code>, <code>validateInstallDir</code> calls <code>buildPluginApp(args.rootDir, …)</code> unconditionally. The comment above it says "path: the author owns that directory … only the frontend is built", i.e. the write is intentional.</li>
    <li><strong>Load</strong> (server start, reload, enable): {link(RUNTIME, 1085, 1124, "plugin-runtime.ts:1085-1124")} — <code>loadAppBundleCandidate</code> rebuilds when <code>meta?.sdkVersion !== PLUGIN_SDK_VERSION</code> (<em>any</em> difference, including a meta it cannot parse) or when {link(RUNTIME, 976, 1012, "isMutableAppBundleStale")} finds any file or directory (excluding <code>dist</code>, <code>node_modules</code>, <code>.git</code>) with <code>mtimeMs &gt; dist/app.js mtimeMs</code>. The docstring states the policy: "Mutable plugin app artifacts are only a cache of their source tree."</li>
    <li><strong>Load, host bundle</strong>: {link(RUNTIME, 1126, 1145, "loadHostArtifactCandidate")} — when <code>bb.host</code> is declared, <code>buildPluginHost</code> runs on <em>every</em> load with no staleness check at all (not exercised by the reporter's plugin, but the same class of write).</li>
  </ul>
  <p>The build itself ({link(BUILD, 621, 735, "buildPluginApp")}) stages under <code>dist/.stage-*</code> and renames into <code>dist/app.js</code>, <code>dist/app.css</code>, <code>dist/app.meta.json</code>. <code>app.meta.json</code> always embeds <code>builtWith.bbVersion</code> from the running host, so even a bit-identical JS/CSS rebuild changes that file whenever the host's version differs from the one that produced the commit (<code>0.39.0 → 0.0.0-dev</code> in every step above). In 0.39.0 the esbuild call ({link("packages/plugin-build/src/build-plugin-app.ts", 494, 520, "desktop-v0.39.0 build-plugin-app.ts:494")} at tag <code>desktop-v0.39.0</code>) had no <code>absWorkingDir</code> and no <code>minify</code>, so esbuild's <code>// &lt;path&gt;</code> comments were computed relative to the server process's cwd — for a macOS app launched from <code>~</code>, <code>// .bb/worktrees/env_…/bb-collab/src/provider-marks.ts</code>, exactly the diff in the issue. #1895 (<code>dbbb7640f</code>, on main, no release tag yet) sets <code>absWorkingDir: rootDir</code> and <code>minify: true</code>; the comments disappear and JS/CSS become location-independent. The write-into-root behaviour is unchanged by #1895.</p>
  <p>Why the reporter saw drift "on the next deploy": <code>git checkout</code> writes changed paths in index order (<code>dist/…</code> before <code>src/…</code>), so a commit that touches both can leave sources newer than <code>dist/app.js</code>; whether it does depends on filesystem timestamp granularity (identical ns timestamps in step 2 here, but APFS/macOS and larger trees differ). And independent of mtimes, an artifact built by a different SDK version is rebuilt on first load after any host upgrade — so their 0.4.1-built bundle will be rewritten the moment the host ships a newer SDK, regardless of the mtime workaround.</p>

  <h3>Defect 2: the hung-service outcome never reaches the reload result</h3>
  <ol>
    <li><code>reload(id)</code> ({link(SERVICE, 1778, 1786)}) calls <code>loadOne(row)</code> and returns <code>void</code>; the route ({link(ROUTES, 451, 455)}) returns <code>{{ ok: true, plugins: list() }}</code> unconditionally; the CLI ({link(CLI, 1621, 1650)}) exits non-zero only when <code>ok</code> is false or the id is unknown. Plugin status is printed but never inspected.</li>
    <li>Inside <code>loadOne</code>, when a previous instance exists, {link(RUNTIME, 1575, 1588)} runs <code>disposePluginInstance</code>, which calls <code>stopServices</code> ({link(RUNTIME, 639, 668)}): abort every service, wait <code>serviceStopTimeoutMs</code> (5000 ms, {link(RUNTIME, 321)}), and on timeout record the service in <code>hungServices</code>, set status <code>degraded</code>, and move on. <code>disposePluginInstance</code> then closes the old instance's database handles ({link(RUNTIME, 1684, 1694)}) and invalidates the API handle — so the still-running orphan's next <code>db.prepare(...)</code> throws <code>TypeError: The database connection is not open</code>; this is the documented contract ("The host closes handles on dispose/reload; a closed handle throws on use", {link("packages/plugin-sdk/src/backend-contract.ts", 117, 125)}).</li>
    <li>Back in <code>loadOne</code>, because <code>hungServices</code> is non-empty the new instance is discarded (<code>loaded.delete</code>, its handles closed, <code>return</code>) so the plugin is now <em>unloaded</em>: no CLI registration (→ <code>unknown command 'collab'</code>), no routes, no API. Every later <code>loadOne</code> (reload, enable, and even server-lifetime) short-circuits at {link(RUNTIME, 1298, 1305)} until the hung promise settles.</li>
    <li>None of that is propagated: no throw, no field on the route payload, no non-zero exit. The only signals are the log line <code>service lane-watcher did not stop within 5000ms</code> and the <code>degraded</code> status, which the CLI prints and then exits 0.</li>
  </ol>
  <p><strong>Underlying/related:</strong> the host has no way to stop an orphaned timer or socket owned by plugin code that ignored abort; it can only refuse to double-start. While checking this I also observed (with an earlier fixture revision whose catch block referenced a non-existent <code>bb.logger</code>) that an exception thrown inside the orphan's <code>setInterval</code> callback after reload killed the entire bb server process (<a href="2029/repro/server-crash-from-orphan-timer.log">server-crash-from-orphan-timer.log</a>). There is no process-level <code>uncaughtException</code> guard in <code>apps/server/src</code>; this is the subject of #1746.</p>

  <h2>6. Proposed fix (first principles)</h2>
  <h3>Defect 2 (small, contained)</h3>
  <ul>
    <li>Make <code>PluginService.reload(id)</code> return the per-plugin outcome instead of <code>void</code> — e.g. the reloaded <code>PluginListEntry</code> list — and have <code>POST /plugins/reload</code> answer <code>ok: false</code> (still HTTP 200 or 409) with <code>error: 'plugin "x" degraded: service lane-watcher did not stop'</code> whenever any targeted plugin ended in <code>degraded</code>/<code>error</code>/<code>incompatible</code>/<code>missing</code>, or when a reload kept the previous instance (<code>reload failed: …</code> detail). The CLI then exits 1 through the existing <code>!result.ok</code> path ({link(CLI, 1640, 1642)}) with the detail printed; the existing unit repro turns green by asserting a rejected/failed outcome. Keep the runtime's degraded policy as is. Risk: <code>bb plugin dev</code> and the builtin watcher loop use the same route and currently tolerate a degraded outcome silently — they should log it, not loop. No wire change to the host daemon, so no protocol bump.</li>
    <li>Optionally, after the bounded wait, keep surfacing progress: log each <code>onHungServiceSettled</code> (already done) and, in <code>bb plugin list</code>, append "reload again to recover" — cosmetic.</li>
  </ul>
  <h3>Defect 1 (design decision, larger)</h3>
  <ul>
    <li>Build path-install frontend/host artifacts into a host-owned cache keyed by root path (e.g. <code>&lt;dataDir&gt;/plugin-app-cache/&lt;hash(rootDir)&gt;/</code>), the same way managed <code>git:</code>/<code>npm:</code> artifacts already live under the data dir ({link("apps/server/src/services/plugins/install-sources.ts", 412, 440, "install-sources.ts npmArtifactCacheDir/gitArtifactCacheDir")}). <code>loadPluginAppBundle</code>/<code>getAppAsset</code> would read from that cache; <code>buildPluginApp</code> already accepts a root and writes to <code>&lt;root&gt;/dist</code>, so it needs an explicit <code>outDir</code> parameter (the Tailwind scanner's <code>dist/**</code> exclusion must then also exclude the cache dir, which is trivially outside the root). The staleness rule can stay but compare against the cache file. This removes every write into the author's directory on install and load; <code>bb plugin build</code> and <code>bb plugin dev</code> keep writing <code>dist/</code> explicitly because the author asked for it.</li>
    <li>If that is too large: (a) stop calling <code>buildPluginApp</code> in <code>validateInstallDir</code> for <code>path</code> installs when a compatible <code>dist/app.meta.json</code> is already present; (b) in <code>loadAppBundleCandidate</code> treat a present, SDK-compatible, non-stale committed artifact as authoritative and make the rebuild opt-in via a manifest flag (#1863 asks for the inverse: a plugin-supplied build command); (c) document the two triggers (mtime &gt; <code>dist/app.js</code>, <code>sdkVersion</code> mismatch) in the plugin docs so deployers can reason about them.</li>
    <li>Not worth doing: making the rebuild reproduce committed bytes. #1895 already made JS/CSS location-independent; <code>app.meta.json</code> intentionally records the host that built it.</li>
  </ul>

  <h2>7. PR review</h2>
  <p>No open PR is linked to this issue.</p>

  <h2>8. Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1863">#1863</a> — same reporter, same defect 1 on 0.38.0 ("bb plugin reload rebuilds a path plugin with the host build, with no way for the plugin to supply its own"). #2029's defect 1 is effectively a duplicate with the added byte-diff/mtime observations.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1746">#1746</a> — "Plugin background services can kill the server: supervisor only sees the promise chain"; the orphan-timer crash observed here is that failure mode.</li>
    <li>PR <a href="https://github.com/get-bb/bb/pull/1895">#1895</a> — minifies plugin app bundles and pins <code>absWorkingDir</code>; removes the cwd-relative path comments from rebuilt output (not yet in a release).</li>
  </ul>

  <h2>9. Appendix</h2>
  <h3>Commands run</h3>
  {code('''cd <worktree> && pnpm install --frozen-lockfile --prefer-offline && pnpm exec turbo run build
scripts/bb-dev-app current            # server :19347, app :11347, host daemon :27347
export BB_SERVER_URL=http://localhost:19347 BB_HOST_DAEMON_PORT=27347 BB_PROJECT_ID=proj_personal
CLI="node packages/scripts/dist/commands/run-cli.js"
# fixture (see 2029/repro/fixture-*): git init /tmp/bb2029-plugin; $CLI plugin build /tmp/bb2029-plugin; git commit dist
bash 2029/repro/step1-install.sh          # install rewrites dist/app.*
bash 2029/repro/step2-deploy-reload.sh    # checkout + reload
pnpm dev:stop && scripts/bb-dev-app current   # fresh server (clears hung service)
bash 2029/repro/step3-orphan.sh           # reload -> degraded, exit 0, command gone, closed-handle errors
pnpm dev:stop && scripts/bb-dev-app current
bash 2029/repro/step4-reload-rebuild.sh   # touch src -> reload rebuilds
# commit app.meta.json with sdkVersion 0.4.1, touch dist/*, restart server
bash 2029/repro/step5-sdk-mismatch.sh     # rebuild despite dist newest
cd apps/server && pnpm exec vitest run test/services/plugins/issue-2029-reload-reports-success.test.ts
doobie --headless < 2029/repro/shot.js    # screenshot''')}
  <h3>esbuild path-comment demonstration (0.39.0 vs main build options)</h3>
  {pre("esbuild-path-comments.log")}
  <h3>Server crash from the orphaned timer (side finding)</h3>
  {pre("server-crash-from-orphan-timer.log")}
  <h3>Release check</h3>
  {code('''$ git tag --contains dbbb7640f        # PR #1895 "Minify plugin app bundles ..."
(no tags)                               # desktop-v0.39.0 predates it
$ git show desktop-v0.39.0:packages/plugin-build/src/build-plugin-app.ts | grep -c absWorkingDir
0
$ git log c7c66423d..origin/main --oneline
(empty)''')}
</main></body></html>
"""
OUT.write_text(doc)
print(OUT, len(doc))
