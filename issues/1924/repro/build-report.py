#!/usr/bin/env python3
# Generates /tmp/bb-reports/issues/1924.html from artifacts in this directory.
import html, pathlib

R = pathlib.Path("/tmp/bb-reports/issues/1924/repro")
def esc(p):
    return html.escape((R / p).read_text())

test_src = esc("issue-1924-archive-pruned-environment.test.ts")
diff_src = esc("prototype-fix.diff")
vitest_base = esc("vitest-output-base.txt")
BASE = "c7c66423d55c320bab9103218f0ffef1a8191331"
def pl(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f"https://github.com/get-bb/bb/blob/{BASE}/{path}{frag}"

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1924 Archiving a thread fails with 409 once its environment row has been pruned</title>
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
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
  details pre {{ max-height:480px; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1924 · Archiving a thread fails with 409 once its environment row has been pruned</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill high">Priority: High</span> <span class="pill">Effort: Small</span> <span class="pill">threads</span> <span class="pill">workspaces</span>
    <a href="https://github.com/get-bb/bb/issues/1924">open on GitHub</a>
    <span>2026-08-20 · base <code>c7c66423d</code></span>
  </p>
  <p><strong>Verdict:</strong> <span class="verdict no">REPRODUCED</span> · <strong>Root-cause confidence:</strong> high</p>

  <h2>1. TL;DR</h2>
  <p>A thread whose managed environment was destroyed and later garbage-collected can never be archived: <code>POST /api/v1/threads/:id/archive</code> and <code>/archive-all</code> return <code>409 thread_environment_unavailable</code> (reason <code>never_attached</code>), the CLI prints <code>HTTP 409: Thread environment is unavailable</code>, and the app shows the misleading toast "Workspace is not available yet." The thread stays in the sidebar forever; the only way out is delete, which destroys the transcript.</p>
  <p>Mechanism: <code>pruneDestroyedEnvironments</code> hard-deletes <code>destroyed</code> environment rows after 7 days without checking for live threads; <code>threads.environment_id</code> is <code>ON DELETE SET NULL</code>, so the still-unarchived thread silently loses its pointer. The archive path (<code>routes.archive</code>, <code>archiveThreadAndHiddenSourceForks</code>, <code>archiveThreadAndChildren</code>) calls <code>requireThreadHostCommandEnvironment</code>, which throws for a NULL pointer, even though the environment is only used to stop live runtime work (which a pointer-less idle thread has none of). Delete and stop already tolerate NULL; archive does not.</p>
  <p>I reproduced it live on a dev instance with a fully organic path that needs no "mystery destroy": archive thread → wait out the 5-minute retire grace window (environment becomes <code>destroyed</code>) → unarchive the thread (allowed; read-only) → 7-day TTL elapses (simulated by rewinding <code>environments.updated_at</code>) → periodic sweep prunes the row → archive now 409s. A vitest repro fails on base and passes with a 3-file prototype fix; the same fix made the live thread archivable.</p>

  <h2>2. Claims vs findings</h2>
  <table><tr><th>Claim from the issue</th><th>Status</th><th>Evidence</th></tr>
    <tr><td><code>/archive</code> returns 409 <code>thread_environment_unavailable</code> / <code>never_attached</code> for threads with NULL <code>environment_id</code></td><td class="ok">Verified</td><td>Live: <a href="1924/repro/03-curl-archive.txt">03-curl-archive.txt</a>, CLI <a href="1924/repro/02-cli-archive-output.txt">02-cli-archive-output.txt</a>; unit: <a href="1924/repro/vitest-output-base.txt">vitest-output-base.txt</a></td></tr>
    <tr><td><code>/archive-all</code> fails the same way, so no UI/CLI workaround</td><td class="ok">Verified</td><td><a href="1924/repro/04-curl-archive-all.txt">04-curl-archive-all.txt</a>; the app's sidebar "Archive thread" button actually calls <code>/archive-all</code> and shows the error toast (screenshot below)</td></tr>
    <tr><td>Delete works for the same thread (and destroys the transcript)</td><td class="ok">Verified</td><td>Test "DELETE /threads/:id (the only workaround) succeeds" passes on base; <a href="{pl('apps/server/src/routes/threads/base.ts',436,441)}">base.ts#L436-L441</a> handles <code>environmentId === null</code></td></tr>
    <tr><td><code>pruneDestroyedEnvironments</code> deletes destroyed envs older than 7 days with no live-thread guard</td><td class="ok">Verified</td><td><a href="{pl('packages/db/src/data/sweeps.ts',365,396)}">sweeps.ts#L365-L396</a> filters only on status+age; test "pruneDestroyedEnvironments deletes an environment that still has a live thread" passes (deleted === 1) on base</td></tr>
    <tr><td><code>threads.environment_id</code> is <code>ON DELETE SET NULL</code></td><td class="ok">Verified</td><td><a href="{pl('packages/db/src/schema.ts',564,566)}">schema.ts#L564-L566</a>; <code>foreign_keys = ON</code> in <a href="{pl('packages/db/src/connection.ts',178)}">connection.ts#L178</a>; observed live: thread row went from <code>env_9m596f8r6v</code> to NULL after the sweep</td></tr>
    <tr><td><code>sweepManagedEnvironments</code> does guard on live threads</td><td class="ok">Verified</td><td><a href="{pl('packages/db/src/data/sweeps.ts',344,363)}">sweeps.ts#L344-L363</a> (NOT EXISTS live threads)</td></tr>
    <tr><td>Archive requires the environment only to stop active runtime work, so the requirement is not load-bearing</td><td class="ok">Verified</td><td><a href="{pl('apps/server/src/services/threads/thread-archive.ts',55,61)}">thread-archive.ts#L55-L61</a>: the env is only passed to <code>requestActiveRuntimeThreadStopIfNeeded</code>, which is a no-op unless status is <code>active</code> or a live start is in flight</td></tr>
    <tr><td>The <code>never_attached</code> reason is misleading</td><td class="ok">Verified</td><td>Thread ran a real turn in <code>env_9m596f8r6v</code>; the app maps the reason to "Workspace is not available yet." (<a href="{pl('apps/app/src/lib/lifecycle-errors.ts',211,216)}">lifecycle-errors.ts#L211-L216</a>)</td></tr>
    <tr><td>Step 1-2 of the issue: "environment is later destroyed" while the thread is unarchived</td><td class="unv">Partially verified</td><td>The issue does not say how. I found one fully organic path: archive → 5-min grace elapses → env destroyed → unarchive (allowed, thread stays <code>idle</code>/read-only). Other paths may exist (project deletion, orphan cleanup), not enumerated.</td></tr>
    <tr><td>The two reporter threads <code>thr_vyaz3wdwjv</code>, <code>thr_ijwvxv9hy6</code></td><td class="unv">Unverified</td><td>Reporter's install; not accessible</td></tr>
  </table>

  <h2>3. Environment</h2>
  <ul>
    <li>bb <code>c7c66423d55c320bab9103218f0ffef1a8191331</code> (main, 2026-08-20); no later commit on <code>origin/main</code> at investigation time</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, codex-cli 0.148.0 (provider <code>codex</code>, one tiny real turn)</li>
    <li>Dev instance: App http://localhost:15833, Server http://localhost:23833, Host daemon 127.0.0.1:31833, data dir <code>~/.bb-dev/projects-bb-.claude-worktrees-wf_926b3193-f6c-1-b219d2e1621b</code> (deleted after the run)</li>
    <li>Scratch project repo <code>/tmp/bb-1924-qa</code>, project <code>proj_c7kzwebk9y</code>, host <code>host_uwsnsqh85d</code>, thread <code>thr_kfdy8qhyfj</code>, environment <code>env_9m596f8r6v</code></li>
  </ul>

  <h2>4. Minimal reproduction</h2>
  <h3>4a. Unit-level (fastest, deterministic)</h3>
  <ol>
    <li>Save the test below as <code>apps/server/test/threads/issue-1924-archive-pruned-environment.test.ts</code> (also at <a href="1924/repro/issue-1924-archive-pruned-environment.test.ts">1924/repro/</a>).</li>
    <li>Run: <pre>cd apps/server &amp;&amp; pnpm exec vitest run test/threads/issue-1924-archive-pruned-environment.test.ts</pre></li>
    <li>Expected: all 4 tests pass. Actual on <code>c7c66423d</code>: 2 fail, both with <code>expected 409 to be 200</code>:
<pre>{vitest_base}</pre></li>
  </ol>
  <details><summary>Repro test source</summary><pre>{test_src}</pre></details>

  <h3>4b. Live, end to end (dev instance + CLI + app)</h3>
  <ol>
    <li>Start a dev instance and create a project from a scratch git repo (<code>scripts/bb-dev-app current</code>; <code>POST /api/v1/projects</code>).</li>
    <li>Spawn a thread in a new managed worktree and let it go idle:
<pre>bb thread spawn --project proj_c7kzwebk9y --new-environment worktree --provider codex --prompt "Reply only with ok." --title "Issue 1924 repro"
bb thread wait thr_kfdy8qhyfj --status idle      # environmentId = env_9m596f8r6v</pre></li>
    <li>Archive it once, wait out the 5-minute retire grace window (<a href="1924/repro/wait-destroyed.sh">wait-destroyed.sh</a>), then unarchive it. The environment is now <code>destroyed</code> and the thread is unarchived and idle (a normal "oops, unarchive" flow):
<pre>bb thread archive thr_kfdy8qhyfj          # Thread thr_kfdy8qhyfj archived
# ... 14:19:44 retiring / 14:19:54 destroyed
bb thread unarchive thr_kfdy8qhyfj        # Thread thr_kfdy8qhyfj unarchived
curl -s $BB_SERVER_URL/api/v1/environments/env_9m596f8r6v   # ..."status":"destroyed"...</pre>
      Control: at this point <code>bb thread archive</code> / <code>unarchive</code> still work, because the environment row exists.</li>
    <li>Simulate the 7-day TTL and let the 10-second periodic sweep run:
<pre>sqlite3 &lt;data-dir&gt;/bb.db "UPDATE environments SET updated_at = updated_at - 8*24*60*60*1000 WHERE id='env_9m596f8r6v';"
sleep 15
sqlite3 &lt;data-dir&gt;/bb.db "SELECT count(*) FROM environments WHERE id='env_9m596f8r6v'; SELECT id, environment_id, archived_at, status FROM threads WHERE id='thr_kfdy8qhyfj';"
# 0
# thr_kfdy8qhyfj|||idle        &lt;-- environment_id is now NULL</pre></li>
    <li>Try to archive:
<pre>$ bb thread archive thr_kfdy8qhyfj
Error: Failed to archive thread thr_kfdy8qhyfj: HTTP 409: Thread environment is unavailable

$ curl -s -i -X POST $BB_SERVER_URL/api/v1/threads/thr_kfdy8qhyfj/archive
HTTP/1.1 409 Conflict
{{"code":"thread_environment_unavailable","message":"Thread environment is unavailable","details":{{"reason":"never_attached","environmentStatus":null}}}}

$ curl -s -X POST $BB_SERVER_URL/api/v1/threads/thr_kfdy8qhyfj/archive-all
{{"code":"thread_environment_unavailable","message":"Thread environment is unavailable","details":{{"reason":"never_attached","environmentStatus":null}}}}</pre>
      Expected: <code>200 {{"ok":true}}</code> and <code>archivedAt</code> set.</li>
  </ol>
  <figure><img src="assets/1924-before.png" alt="Thread page before archiving"><figcaption>The affected thread (<code>environment_id</code> NULL) looks like a perfectly normal idle thread; composer enabled, one completed turn.</figcaption></figure>
  <figure><img src="assets/1924-click-archive.png" alt="Hovering the sidebar row reveals the Archive thread button"><figcaption>Triggering it: hover the sidebar row, click the "Archive thread" (box) icon.</figcaption></figure>
  <figure><img src="assets/1924-after-archive-click.png" alt="Toast: Failed to archive thread. Workspace is not available yet."><figcaption>The bug: toast "Failed to archive thread. Workspace is not available yet." The browser console logs <code>409 (Conflict) .../threads/thr_kfdy8qhyfj/archive-all</code>. The thread stays in the sidebar.</figcaption></figure>
  <figure><img src="assets/1924-archived-with-fix.png" alt="Same thread archived after applying the prototype fix"><figcaption>Same thread after restarting the server with the prototype fix (section 6) and re-issuing the archive: "Thread is archived", row gone from the sidebar, Unarchive still available.</figcaption></figure>
  <p>Repro files: <a href="1924/repro/">1924/repro/</a> (test, CLI/curl outputs, vitest logs, prototype diff, wait script).</p>

  <h2>5. Root cause</h2>
  <p>Two cooperating defects:</p>
  <ol>
    <li><strong>The sweep manufactures the state.</strong> <a href="{pl('packages/db/src/data/sweeps.ts',365,396)}">pruneDestroyedEnvironments</a> selects <code>status = 'destroyed' AND updated_at &lt; now - 7d</code> and hard-deletes those rows. Unlike its sibling <a href="{pl('packages/db/src/data/sweeps.ts',344,363)}">sweepManagedEnvironments</a> it has no <code>NOT EXISTS (live threads)</code> guard. Because <a href="{pl('packages/db/src/schema.ts',564,566)}">threads.environment_id</a> is <code>ON DELETE SET NULL</code> (and <code>PRAGMA foreign_keys = ON</code>), an unarchived thread pointing at that row silently becomes <code>environment_id = NULL</code>. It runs from <a href="{pl('apps/server/src/services/system/periodic-sweeps.ts',514,517)}">periodic-sweeps.ts</a> every 10 s.</li>
    <li><strong>Archive cannot handle the state.</strong> <a href="{pl('apps/server/src/routes/threads/actions.ts',643,675)}">routes.archive</a>, <a href="{pl('apps/server/src/services/threads/thread-archive.ts',84,104)}">archiveThreadAndHiddenSourceForks</a> (per hidden fork) and <a href="{pl('apps/server/src/services/threads/thread-archive.ts',143,195)}">archiveThreadAndChildren</a> (per thread, used by <code>/archive-all</code>) all call <a href="{pl('apps/server/src/services/threads/thread-command-environment.ts',27,42)}">requireThreadHostCommandEnvironment</a>, which throws <code>thread_environment_unavailable / never_attached</code> whenever <code>environmentId === null</code>. The only consumer of the result inside archive is <a href="{pl('apps/server/src/services/threads/thread-archive.ts',55,61)}">requestActiveRuntimeThreadStopIfNeeded</a>, which early-returns unless the thread is <code>active</code> or has a live start in flight — neither is possible for a thread whose environment no longer exists. The delete route (<a href="{pl('apps/server/src/routes/threads/base.ts',436,441)}">base.ts#L436</a>) and the stop route (<a href="{pl('apps/server/src/routes/threads/actions.ts',463,473)}">actions.ts#L463</a>) already branch on <code>environmentId === null</code>; archive is the odd one out.</li>
  </ol>
  <p>The <code>never_attached</code> reason and the app's "Workspace is not available yet." copy (<a href="{pl('apps/app/src/lib/lifecycle-errors.ts',211,216)}">lifecycle-errors.ts</a>) are both wrong for this state: the server cannot distinguish "never had an environment" from "had one, row pruned" because the pointer is gone. Not a regression: <code>git log -S</code> shows archive has required an environment since <code>c35a71024</code> (2026-05-27) and the prune sweep has existed since <code>ebc001ab1</code> (2026-06-06).</p>
  <p><strong>How the state arises organically</strong> (the issue leaves this implicit): archive → environment <code>retiring</code> → after <code>MANAGED_ENVIRONMENT_RETIRE_GRACE_MS</code> (5 min, <a href="{pl('apps/server/src/constants.ts',15)}">constants.ts#L15</a>) it is destroyed → user unarchives (permitted; see comment at <a href="{pl('apps/server/src/routes/threads/actions.ts',688,694)}">actions.ts#L688</a>, thread becomes read-only) → 7 days later the row is pruned. Any other route to a destroyed environment with a live thread (project/worktree removal, orphan cleanup) lands in the same place.</p>
  <p><strong>Secondary observation:</strong> in <code>archiveThreadAndHiddenSourceForks</code> the throw happens inside the fork loop <em>after</em> the source thread was already archived, so a pruned hidden fork leaves the parent archived and the fork not — a partial, non-atomic archive with a 409 back to the client.</p>

  <h2>6. Proposed fix (first principles)</h2>
  <p>Confident. Prototype (<a href="1924/repro/prototype-fix.diff">prototype-fix.diff</a>, 3 files, server only, no wire change so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump) — makes the repro test pass, <code>pnpm exec turbo run typecheck --filter=@bb/server</code> clean, 12 archive-related test files (21 tests) still green, and the live thread became archivable after <code>pnpm dev:restart-server</code> (<a href="1924/repro/05-curl-archive-with-fix.txt">05-curl-archive-with-fix.txt</a>):</p>
  <ol>
    <li><code>thread-command-environment.ts</code>: add <code>resolveThreadHostCommandEnvironment</code> returning <code>null</code> for a NULL pointer (still <code>requireEnvironment</code> for a dangling non-NULL id).</li>
    <li><code>thread-archive.ts</code>: make <code>ArchiveThreadWithLifecycleEffectsArgs.environment</code> nullable and skip <code>requestActiveRuntimeThreadStopIfNeeded</code> when null; use the resolver for hidden forks and in <code>archiveThreadAndChildren</code> (only add non-null envs to <code>affectedEnvironmentIds</code>). Every other archive effect (terminal close, provider archive command, event pruning, plugin event, child release) runs unchanged.</li>
    <li><code>routes/threads/actions.ts</code>: <code>routes.archive</code> uses the resolver. <code>wouldCleanupEnvironment</code> already takes a nullable id.</li>
  </ol>
  <details><summary>Prototype diff</summary><pre>{diff_src}</pre></details>
  <p>Also recommended, to stop re-manufacturing the state: add the same <code>NOT EXISTS (SELECT 1 FROM threads WHERE environment_id = environments.id AND archived_at IS NULL AND deleted_at IS NULL)</code> guard to <code>pruneDestroyedEnvironments</code>. Trade-off: destroyed rows for live threads are then retained indefinitely (tiny rows; they are pruned once the thread is archived/deleted). Note that the guard alone does not repair already-stripped threads, and it would never fire for threads that genuinely never attached, so the archive-side change is the necessary one. Consider also making the app copy for <code>never_attached</code> not say "yet" when the thread is idle.</p>
  <p>Risk: a thread that is <code>active</code> with <code>environmentId === null</code> would now be archived without a runtime stop request; I could not construct that state (a thread gets its environment before its first turn starts), and delete already behaves this way.</p>

  <h2>7. PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>8. Related issues</h2>
  <ul>
    <li>Same <code>never_attached</code>-for-pruned-environment confusion will affect every other route that uses <code>requireThreadHostCommandEnvironment</code>/<code>requireThreadCommandEnvironment</code> on such a thread (terminals, host-files, plan cancel, turn submit), but those genuinely need an environment; archive is the one that does not.</li>
  </ul>

  <h2>9. Appendix</h2>
  <h3>Commands run (abridged)</h3>
  <pre>pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
cd apps/server &amp;&amp; pnpm exec vitest run test/threads/issue-1924-archive-pruned-environment.test.ts   # 2 failed on base
scripts/bb-dev-app current                                   # App :15833 Server :23833 Host daemon :31833
curl -s -X POST http://localhost:23833/api/v1/projects -H 'content-type: application/json' -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/bb-1924-qa","hostId":"host_uwsnsqh85d"}}}}'
node packages/scripts/dist/commands/run-cli.js thread spawn --project proj_c7kzwebk9y --new-environment worktree --provider codex --prompt "Reply only with ok." --title "Issue 1924 repro" --json
node packages/scripts/dist/commands/run-cli.js thread wait thr_kfdy8qhyfj --status idle
node packages/scripts/dist/commands/run-cli.js thread archive thr_kfdy8qhyfj
bash 1924/repro/wait-destroyed.sh http://localhost:23833 env_9m596f8r6v     # destroyed at 14:19:54
node packages/scripts/dist/commands/run-cli.js thread unarchive thr_kfdy8qhyfj
sqlite3 bb.db "UPDATE environments SET updated_at = updated_at - 8*24*60*60*1000 WHERE id='env_9m596f8r6v';"
node packages/scripts/dist/commands/run-cli.js thread archive thr_kfdy8qhyfj  # HTTP 409
curl -s -i -X POST http://localhost:23833/api/v1/threads/thr_kfdy8qhyfj/archive      # 409
curl -s -X POST http://localhost:23833/api/v1/threads/thr_kfdy8qhyfj/archive-all     # 409
# apply prototype-fix.diff; pnpm dev:restart-server; curl ... /archive -> 200 {{"ok":true}}
pnpm exec turbo run typecheck --filter=@bb/server
cd apps/server &amp;&amp; pnpm exec vitest run -t "archive"       # 12 files / 21 tests passed with fix</pre>
  <h3>Artifacts</h3>
  <ul>
    <li><a href="1924/repro/01-thread-spawn.json">01-thread-spawn.json</a> — spawn response (note <code>environmentId: null</code> while <code>starting</code>)</li>
    <li><a href="1924/repro/02-cli-archive-output.txt">02-cli-archive-output.txt</a>, <a href="1924/repro/03-curl-archive.txt">03-curl-archive.txt</a>, <a href="1924/repro/04-curl-archive-all.txt">04-curl-archive-all.txt</a> — the failure</li>
    <li><a href="1924/repro/05-curl-archive-with-fix.txt">05-curl-archive-with-fix.txt</a> — success after prototype fix</li>
    <li><a href="1924/repro/vitest-output-base.txt">vitest-output-base.txt</a>, <a href="1924/repro/vitest-output-with-fix.txt">vitest-output-with-fix.txt</a></li>
    <li><a href="1924/repro/prototype-fix.diff">prototype-fix.diff</a>, <a href="1924/repro/wait-destroyed.sh">wait-destroyed.sh</a>, <a href="1924/repro/build-report.py">build-report.py</a></li>
  </ul>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/1924.html").write_text(page)
print("ok")
