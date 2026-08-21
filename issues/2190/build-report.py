#!/usr/bin/env python3
"""Assemble /tmp/bb-reports/issues/2190.html from the repro artifacts."""
import html
import pathlib

R = pathlib.Path("/tmp/bb-reports/issues/2190/repro")
BASE = "fcada5a3b88302acb9944aa74b11db4ecaa215a0"
SHORT = "fcada5a3b"


def esc(s: str) -> str:
    return html.escape(s, quote=False)


def pre(path: pathlib.Path, max_lines: int | None = None) -> str:
    text = path.read_text()
    if max_lines is not None:
        lines = text.splitlines()
        if len(lines) > max_lines:
            text = "\n".join(lines[:max_lines]) + f"\n... ({len(lines) - max_lines} more lines, see repro/{path.name})"
    return f"<pre>{esc(text)}</pre>"


def perma(path: str, lines: str, label: str | None = None) -> str:
    url = f"https://github.com/get-bb/bb/blob/{BASE}/{path}#{lines}"
    return f'<a href="{url}"><code>{esc(label or (path + " " + lines))}</code></a>'


walkthrough = pre(R / "walkthrough-output.txt")
pinned = pre(R / "pinned-reader-output.txt")
exitdur = pre(R / "exit-durability-output.txt")
live_running = pre(R / "live-inspect-running.json")
live_after = pre(R / "live-inspect-after-sigterm.json", 22)
vitest_final = pre(R / "vitest-final.txt")
test_src = pre(R / "issue-2190-wal-revert.test.ts")
tool_src = pre(R / "issue-2190-wal-tool.mjs")

connection_excerpt = '''export function createConnection(
  dbPath: string = "bb.db",
  options: CreateConnectionOptions = {},
) {
  const sqlite = new Database(dbPath);
  sqlite.pragma("auto_vacuum = INCREMENTAL");
  // Enable WAL mode for better concurrent read performance
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  // WAL + NORMAL: no fsync per commit. Power loss can drop the last
  // transactions; it cannot corrupt the file. ...
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma(`cache_size = -${SQLITE_CACHE_SIZE_KIB}`);
  sqlite.pragma(`mmap_size = ${SQLITE_MMAP_SIZE_BYTES}`);
  sqlite.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
  // (no wal_autocheckpoint / journal_size_limit: SQLite defaults apply,
  //  i.e. a PASSIVE checkpoint is attempted only once the WAL holds >= 1000 pages)
'''

shutdown_excerpt = '''  const runShutdown = (): Promise<void> => {
    ...
    shutdownPromise = (async () => {
      eventLoopStallMonitor.stop();
      clearInterval(sweepInterval);
      pluginCatalogService.stopPeriodicRefresh();
      await pluginService.stopPeriodicUpdateChecks();
      await pluginService.stop().catch(...);
      const closeServer = new Promise<void>((resolve, reject) => { server.close(...) });
      await closeWebSockets();
      await closeServer;
      // <-- db.$client.close() is never called: no checkpoint at shutdown
    })();
    return shutdownPromise;
  };
  ...
  process.once("SIGTERM", () => {
    void runShutdown().finally(() => process.exit(0));
  });
'''

recover_excerpt = '''    /* Verify that the WAL header checksum is correct */
    walChecksumBytes(pWal->hdr.bigEndCksum==SQLITE_BIGENDIAN,
        aBuf, WAL_HDRSIZE-2*4, 0, pWal->hdr.aFrameCksum
    );
    if( pWal->hdr.aFrameCksum[0]!=sqlite3Get4byte(&aBuf[24])
     || pWal->hdr.aFrameCksum[1]!=sqlite3Get4byte(&aBuf[28])
    ){
      goto finished;          /* <-- WAL treated as EMPTY, no error returned */
    }
'''

doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #2190 SQLite db silently reverted to a 2-week-old state while the server was running</title>
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
  .callout {{ border-left:4px solid var(--warn); background:#fff8e6; padding:10px 14px; margin:14px 0; }}
  details summary {{ cursor:pointer; color:var(--accent); }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#2190 · SQLite db silently reverted to a 2-week-old state while the server was running (post-Aug-9 projects/threads lost; auto-update in progress)</h1>
  <p class="meta">
    <span class="pill">Bug (data loss)</span> <span class="pill high">Priority: Urgent</span> <span class="pill">Effort: not set</span> <span class="pill">desktop</span> <span class="pill">host</span>
    <a href="https://github.com/get-bb/bb/issues/2190">open on GitHub</a>
    <span>2026-08-21 · base <code>{SHORT}</code></span>
  </p>
  <p><strong>Verdict:</strong> <span class="verdict v-partial">PARTIALLY REPRODUCED</span> · <strong>Root-cause confidence:</strong> medium (mechanism and bb's contribution: high; the external trigger on the reporter's machine: not identified)</p>

  <h2>1. TL;DR</h2>
  <p>The reporter's server process stayed up, yet every project and thread created after ~Aug 9 vanished and three threads deleted before Aug 9 came back. That is exactly what a SQLite database in WAL mode looks like when the write-ahead log is <em>discarded</em>: the main <code>bb.db</code> file holds the state at the last completed checkpoint, and everything newer lived only in <code>bb.db-wal</code>. bb makes this window enormous: the server opens <code>bb.db</code> once with WAL mode and the SQLite default of a checkpoint only after 1000 WAL pages, and it never closes the handle at shutdown, so on a real dev instance the main file is still a single empty 4096-byte page after startup, after creating a project, and after a SIGTERM shutdown; all data is in the WAL. A single long-lived reader on the file (a DB GUI, a stuck <code>sqlite3</code> shell, any process holding a read transaction) pins checkpoints indefinitely; I show the main file frozen at the "Aug 9" state while the WAL grows to 34 MB. When the WAL header / wal-index then becomes unreadable for any reason, SQLite's recovery treats the WAL as empty <em>without returning an error</em>, and the very same open handle starts serving the old snapshot; the next commit rewrites the WAL from frame 1 so "replaying the WAL on a copy" can no longer show the lost rows, even though most of them are physically still in the file. I reproduce these symptoms (open handle reverts, no restart, no log line, WAL keeps its size, replay on a copy fails) and provide a forensic tool that recovers the discarded frames; in the simulated case it brings back 100% of the lost rows with <code>integrity_check = ok</code>. Two things I could <strong>not</strong> reproduce: the spontaneous trigger (no code path in bb writes, copies, closes or reopens <code>bb.db</code>, and the server is the only process that opens it), and the reporter's <code>bb.db</code> <em>mtime</em> at 15:10. In WAL mode only a checkpoint writes the main file, the simulated revert does not touch it (walkthrough step 6: <code>bb.db mtime changed: false</code>), and bb on its own would need ~1000 further WAL pages (195 commits in the walkthrough) before SQLite's auto-checkpoint writes it. So something else wrote <code>bb.db</code> in the same minute as the event, which favours an external in-place rewrite of the files over a pure WAL-invalidation. The reporter's cold copy of <code>bb.db{{,-wal,-shm}}</code> can settle this in one command (section 4F).</p>

  <h2>2. Claims vs findings</h2>
  <table><tr><th>Claim from the issue</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Server process never restarted, same pid since Aug 16, one listener on 38886</td><td class="unv">Unverified (accepted)</td><td>Cannot be checked remotely. Consistent with the mechanism: a WAL-discard is visible through the already-open handle without any restart (section 4, step 5).</td></tr>
    <tr><td>Database "silently reverted" to a ~Aug 9 state; deleted Aug 6–9 threads reappeared</td><td class="ok">Verified as a mechanism</td><td>Reproduced with bb's own <code>createConnection()</code>: after the WAL becomes unreadable the open handle returns the last-checkpoint snapshot, including a row that had been deleted after the checkpoint. No exception, no log line (walkthrough step 5).</td></tr>
    <tr><td><code>bb.db</code> mtime rewritten at ~15:10–15:11</td><td class="no">Not explained by the simulated mechanism</td><td>In WAL mode only a checkpoint writes the main file. The revert itself and the next commit do not touch <code>bb.db</code> (walkthrough step 6: <code>bb.db mtime changed: false</code>); bb issues no checkpoint of its own until SQLite's 1000-page auto-checkpoint (step 9: 195 one-row commits later) or the hourly sweep with a freelist ≥ 1024 pages. Only an explicit checkpoint (step 10, induced) changes the mtime, and a SQLite checkpoint carries the WAL's committed frames <em>into</em> <code>bb.db</code>, so it cannot be what lost the data. An mtime in the same minute as the event therefore points at an actor that wrote <code>bb.db</code> directly (in-place restore/copy/sync), see 5.3. An earlier draft of this report claimed the mtime was reproduced; that came from a <code>wal_checkpoint(PASSIVE)</code> the harness ran itself, which the verifier caught and which has been removed.</td></tr>
    <tr><td>The WAL was ~7 MB and replaying it on a copy does not surface the lost rows</td><td class="ok">Verified as a consequence</td><td>The WAL keeps its size; only the new generation is "live". Copying <code>bb.db</code>+<code>-wal</code>+<code>-shm</code> and opening the copy shows the reverted state (walkthrough step 7). The old frames are still in the file as stale frames (step 8 recovers them).</td></tr>
    <tr><td>No migration/reset/checkpoint entries in <code>server.7.log</code></td><td class="ok">Verified (expected)</td><td>bb logs nothing about WAL state. SQLite's auto-checkpoint and recovery produce no log output, and recovery of an invalid WAL header is not an error (<code>goto finished</code> in <code>walIndexRecover</code>, section 5).</td></tr>
    <tr><td>First failing call was <code>bb automation create</code> (first use of the automations plugin); "correlation only"</td><td class="no">Refuted as a cause</td><td>The automations plugin opens its own <code>~/.bb/plugins/automations/data.db</code> ({perma("apps/server/src/services/plugins/plugin-api.ts", "L654-L661")}); it never touches <code>bb.db</code>. The 404 is the first <em>observation</em> of the already-reverted state.</td></tr>
    <tr><td>Squirrel/ShipIt auto-update may be related</td><td class="unv">Unverified / unlikely</td><td>Electron/Squirrel replaces the app bundle only at quit ({perma("apps/desktop/src/desktop-auto-update.ts", "L359-L364")} sets <code>autoInstallOnAppQuit</code>); nothing in the updater touches <code>~/.bb</code>. The <code>--root</code>/<code>--path</code> mismatch is a new CLI talking to the old server and is unrelated to the database.</td></tr>
    <tr><td>Hypothesis: "a large never-checkpointed WAL was discarded (rollback instead of replay)"</td><td class="unv">Plausible; matches every symptom except the <code>bb.db</code> mtime</td><td>Two halves demonstrated separately: (a) bb never checkpoints on its own at shutdown and a pinned reader freezes the main file for as long as it lives (pinned-reader experiment); (b) an unreadable WAL header is silently treated as an empty WAL (walkthrough). Neither half writes <code>bb.db</code>, so the 15:10 mtime needs an additional actor; an in-place rewrite of the three files from an older copy explains all symptoms including the mtime (5.3). Which actor it was on the reporter's machine is unknown.</td></tr>
    <tr><td>Recreated data survived quit/relaunch and the 0.38.0 → 0.39.0 update</td><td class="unv">Unverified (mechanism consistent)</td><td>The reporter's observation itself cannot be checked remotely. The mechanism is consistent with it: a writer process that <code>process.exit(0)</code>s without <code>close()</code> leaves everything visible to the next process (exit-durability run below, 11/51/201 rows), so a plain restart is not the trigger.</td></tr>
    <tr><td>Not reproducible on demand</td><td class="ok">Verified</td><td>No bb code path can produce it; I could only induce the SQLite half by corrupting the WAL header from a second process.</td></tr>
  </table>

  <h2>3. Environment</h2>
  <ul>
    <li>bb base commit <code>{BASE}</code> (branch main as of 2026-08-21); <code>origin/main</code> at <code>15f21ade7</code> has no changes to <code>packages/db</code>, <code>apps/server/src/start-server.ts</code>, <code>apps/desktop</code> or <code>packages/bb-app</code> since the base, so nothing on main fixes this.</li>
    <li>macOS 26.5.2 (Darwin 25.5.0) arm64, Node v22.23.1, better-sqlite3 12.10.0 bundling SQLite 3.53.1. This is the identical pin of the 0.38.0 desktop build (<code>git show desktop-v0.38.0:packages/db/package.json</code> → <code>"better-sqlite3": "12.10.0"</code>), so the SQLite code paths tested here are the ones the reporter ran.</li>
    <li>Reporter: bb.app 0.38.0 (tag <code>desktop-v0.38.0</code> = <code>45145e51a</code>, 2026-08-14) which includes <a href="https://github.com/get-bb/bb/pull/1438">#1438</a> (<code>mmap_size</code>, <code>synchronous=NORMAL</code>, 2026-08-12). Neither pragma is implicated: <code>NORMAL</code> only matters on power loss and the machine did not lose power.</li>
    <li>My isolated dev instance (revised run): <code>scripts/bb-dev-app current</code> → App :16667, Server :24667, Host daemon :32667, data dir <code>~/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-14-8efb3c6392be</code> (deleted at cleanup). Ports and data dir are derived from the worktree path, so yours will differ; every command below derives them. Scratch project repo <code>/tmp/bb2190-qa-repo</code>. The independent verifier's run used ports 16384/24384/32384 and matched.</li>
    <li>Unit-level repros run from <code>packages/db</code> with <code>pnpm exec vitest run</code> / <code>pnpm exec tsx</code>; they use bb's real <code>createConnection()</code> + <code>migrate()</code> on temp directories.</li>
  </ul>

  <h2>4. Minimal reproduction</h2>
  <p>All files are in <a href="2190/repro/">2190/repro/</a>. Copy <code>issue-2190-wal-tool.mjs</code>, <code>issue-2190-walkthrough.ts</code>, <code>issue-2190-pinned-reader.ts</code>, <code>issue-2190-exit-durability.ts</code> and <code>issue-2190-wal-revert.test.ts</code> into <code>packages/db/test/</code> of a checkout at <code>{SHORT}</code>.</p>

  <h3>A. Product-level: the main file is empty; nothing is checkpointed at shutdown</h3>
  <p>Ports and the data dir are derived from your worktree, so every value below is computed rather than pasted. The whole sequence is <a href="2190/repro/issue-2190-part-a.sh">issue-2190-part-a.sh</a> (run from the repo root after step 1); the verbatim transcript of my run is <a href="2190/repro/part-a-transcript.txt">part-a-transcript.txt</a>.</p>
  <ol>
    <li>Start an isolated instance, load its URLs and find its data dir: <pre>scripts/bb-dev-app current                      # prints App/Server/Host daemon URLs and "Data dir:"
eval "$(scripts/bb-dev-app env)"                # sets BB_SERVER_URL etc.
DATA=$(scripts/bb-dev-app status | sed -n 's/^Data dir: //p')
until curl -sf "$BB_SERVER_URL/api/v1/projects" &gt;/dev/null; do sleep 1; done</pre></li>
    <li>Look at the database files: <pre>$ ls -la "$DATA"/bb.db*
4096 bb.db          &lt;-- one empty page
32768 bb.db-shm
1133032 bb.db-wal   &lt;-- schema, Personal project, plugin rows: everything</pre></li>
    <li>Create a scratch repo and a project through the real server (host id from the API), then inspect a copy of the main file alone plus the WAL:
<pre>HOST_ID=$(curl -s "$BB_SERVER_URL/api/v1/hosts" | node -e 'let s="";process.stdin.on("data",d=&gt;s+=d).on("end",()=&gt;console.log(JSON.parse(s)[0].id))')
mkdir -p /tmp/bb2190-qa-repo &amp;&amp; git -C /tmp/bb2190-qa-repo init -q
curl -s -X POST "$BB_SERVER_URL/api/v1/projects" -H 'content-type: application/json' \
  -d '{{"name":"qa-2190","source":{{"type":"local_path","path":"/tmp/bb2190-qa-repo","hostId":"'"$HOST_ID"'"}}}}'
# -&gt; {{"id":"proj_44jarbwsr6","kind":"standard","name":"qa-2190",...}}
cp 2190/repro/issue-2190-live-inspect.mjs 2190/repro/issue-2190-wal-tool.mjs packages/db/test/
node packages/db/test/issue-2190-live-inspect.mjs "$DATA"</pre>
{live_running}
      <p>Expected (for a durable store): the main file contains the schema and the project. Actual: <code>"tableCount": 0</code>, <code>"projects": "(no projects table)"</code>; all 290 frames / 52 commits are WAL-only.</p></li>
    <li>Stop the server exactly as the desktop app does: find the single process that has <code>bb.db</code> open and send it SIGTERM.
<pre>$ lsof -nP -- "$DATA/bb.db" | awk '{{print $1, $2}}' | sort -u
COMMAND PID
node 75548                                      &lt;-- the server is the only opener
$ SERVER_PID=$(lsof -nP -t -- "$DATA/bb.db" | sort -u | head -1)
$ kill -TERM "$SERVER_PID"; while kill -0 "$SERVER_PID" 2&gt;/dev/null; do sleep 0.2; done; echo "server exited"
server exited
$ ls -la "$DATA"/bb.db*
4096 bb.db                                      &lt;-- unchanged
32768 bb.db-shm
1301952 bb.db-wal                               &lt;-- grew (shutdown writes), never folded into bb.db
$ node packages/db/test/issue-2190-live-inspect.mjs "$DATA"</pre>
{live_after}
      <p>Expected: SQLite's close-time checkpoint folds the WAL into <code>bb.db</code>. Actual: <code>bb.db</code> is still 4096 bytes; the WAL grew from 290 to 316 frames. The cause is {perma("apps/server/src/start-server.ts", "L272-L319", "start-server.ts runShutdown()")}: it never calls <code>db.$client.close()</code> before <code>process.exit(0)</code>. (In this run the inspection was captured before the dev supervisor restarted the server 1 s later, so <code>lsof</code> listed no opener at that moment; the production desktop app has no such supervisor.)</p></li>
  </ol>

  <h3>B. Unit-level walkthrough with bb's connection: revert through an open handle, replay failure, recovery</h3>
  <p><code>cd packages/db &amp;&amp; pnpm exec tsx test/issue-2190-walkthrough.ts</code> (file: <a href="2190/repro/issue-2190-walkthrough.ts">issue-2190-walkthrough.ts</a>). Verbatim output:</p>
  {walkthrough}
  <p>What to look at: step 1 shows a fresh bb database has a 4096-byte main file and a 646 KB WAL. Step 3 shows the open handle sees 41 projects while the main file alone still shows the deleted "Aug 9" project. Step 4 is the only induced part: from another process the wal-index is zeroed in place and one bit of the WAL header checksum is flipped. Step 5 is the bug as the reporter saw it: same process, same handle, no restart, no exception, and the database is 12 "days" older. Step 6 is the server's next commit: it restarts the WAL at frame 1 with the same salt (<code>liveFrameCount: 5</code> of 205; the 200 stale frames hold the lost data) and, importantly, does <strong>not</strong> write <code>bb.db</code> (<code>bb.db mtime changed: false</code>). Step 7 reproduces "replaying the WAL on a copy does not surface the lost rows". Step 8 recovers all 41 projects from the stale frames. Step 9 shows what bb does on its own afterwards: 195 further one-row commits (1001 WAL pages) pass before SQLite's auto-checkpoint writes <code>bb.db</code>, and by then the stale frames are overwritten and recovery is impossible. Step 10 is explicitly induced (an explicit <code>PRAGMA wal_checkpoint(PASSIVE)</code> that bb never issues) and is the only thing in the walkthrough that changes the <code>bb.db</code> mtime; it copies the committed frames into the main file, so it is not a data-losing operation.</p>

  <h3>C. Why the main file can be weeks old: a pinned reader</h3>
  <p><code>pnpm exec tsx test/issue-2190-pinned-reader.ts</code> (file: <a href="2190/repro/issue-2190-pinned-reader.ts">issue-2190-pinned-reader.ts</a>):</p>
  {pinned}
  <p>A second process with an open read transaction holds SQLite read-lock slot 0, so every auto-checkpoint bb's writer attempts after the 1000-page threshold copies nothing (<code>nBackfill=0</code> at <code>mxFrame=8314</code>, 34 MB of WAL). An explicit <code>PRAGMA wal_checkpoint(PASSIVE)</code> issued while the reader is alive returns <code>{{"busy":0,"log":8314,"checkpointed":0}}</code> and leaves the main file untouched: a periodic passive checkpoint cannot bound the exposure in this state, but its result is exactly the signal a warning can be raised from. The moment the reader dies, one commit checkpoints everything and the main file jumps from 618 KB to 8.8 MB. This is the configuration the reporter describes (main file at Aug 9, multi-MB WAL holding Aug 9–21). Note that the reader alone loses nothing; the loss needs the second event (WAL invalidated) on top.</p>

  <h3>D. Ruling out "restart loses data"</h3>
  <p><code>pnpm exec tsx test/issue-2190-exit-durability.ts</code> — a writer that commits and then <code>process.exit(0)</code>s without <code>close()</code> (bb's shutdown), followed by a fresh process reading:</p>
  {exitdur}
  <p>All committed rows are visible; SQLite's recovery rebuilds the wal-index from the WAL (<code>nBackfillAttempted = mxFrame</code>). The Aug 16 restart for 0.38.0 cannot have caused the loss.</p>

  <h3>E. Guard test</h3>
  <p><code>pnpm exec vitest run test/issue-2190-wal-revert.test.ts</code> (file: <a href="2190/repro/issue-2190-wal-revert.test.ts">issue-2190-wal-revert.test.ts</a>) encodes B as assertions, plus the <code>createConnection()</code> defaults. On <code>{SHORT}</code> all three pass: they document the current behaviour. The first test only checks connection pragmas and that a leaked handle leaves the main file empty; it lives in <code>packages/db</code> and never calls <code>runShutdown()</code> or the sweep, so a fix in <code>apps/server</code> will not change its outcome. A fix PR needs a server-level companion (start the server against a temp data dir, write, run shutdown, assert the main file alone contains the rows). The third test now also asserts that the post-revert commit leaves the <code>bb.db</code> mtime unchanged.</p>
  {vitest_final}
  <details><summary>issue-2190-wal-revert.test.ts (inline)</summary>{test_src}</details>
  <details><summary>issue-2190-wal-tool.mjs (inline)</summary>{tool_src}</details>

  <h3>F. What the reporter should run on the cold copy (settles the trigger and may recover the data)</h3>
  <ol start="9">
    <li><pre>node issue-2190-wal-tool.mjs inspect /path/to/cold-copy/bb.db</pre>
      <ul>
        <li><code>header.checksumValid</code>, <code>liveFrameCount</code> vs <code>totalFrames</code>, and <code>generations[]</code>: a small live generation followed by a large stale one (frames with <code>isLive:false</code>) confirms the "WAL invalidated and restarted" mechanism and means the Aug 9–21 pages are still in the file. A single fully-live generation whose content is all ≤ Aug 9 would instead point at an external restore of the three files.</li>
        <li><code>shm.ckpt.nBackfill</code> / <code>nBackfillAttempted</code> / <code>aReadMark</code> from the cold <code>-shm</code>: <code>nBackfill</code> far below <code>mxFrame</code> before the incident means checkpoints were pinned.</li>
        <li><code>header.checkpointSeq</code> and <code>salt1</code> vs the stale frames' <code>salt1</code>: equal salts mean recovery after an unreadable header; <code>salt1+1</code> means a normal WAL restart (which requires a completed checkpoint and would be a different story).</li>
      </ul></li>
    <li>If stale frames exist: <pre>node issue-2190-wal-tool.mjs recover /path/to/cold-copy/bb.db /tmp/bb-2190-recovered
sqlite3 /tmp/bb-2190-recovered/bb.db 'PRAGMA integrity_check; SELECT id,name,created_at FROM projects; SELECT COUNT(*) FROM threads;'</pre>
      Frames overwritten by the post-incident generation (the first few dozen) are gone, so treat the result as best-effort and run <code>integrity_check</code>; in the simulated case hot pages were rewritten by later transactions and everything came back.</li>
    <li>At the time of the incident, <code>lsof ~/.bb/bb.db*</code> would have listed the pinning reader; <code>fs_usage -w -f filesys | grep bb.db</code> would show who wrote the WAL/shm. Worth running now if the problem recurs.</li>
  </ol>

  <h2>5. Root cause</h2>
  <h3>5.1 bb's durability posture turns any WAL loss into unbounded data loss</h3>
  <p>{perma("packages/db/src/connection.ts", "L164-L190", "packages/db/src/connection.ts createConnection()")} enables WAL and leaves the checkpoint policy at SQLite's defaults:</p>
  <pre>{esc(connection_excerpt)}</pre>
  <p>The server opens the database once ({perma("apps/server/src/start-server.ts", "L53-L56")} → {perma("apps/server/src/db.ts", "L22-L46", "initDb")}) and the shutdown path never closes it:</p>
  <pre>{esc(shutdown_excerpt)}</pre>
  <p>Consequences, all observed on the real instance (section 4A): the only thing that ever moves the main file is the auto-checkpoint when the WAL reaches 1000 pages; a fresh install's <code>bb.db</code> is a single empty page with the entire database in the WAL; SIGTERM leaves it that way; a light-usage install may never reach 1000 pages; and any reader that holds a read transaction pins even those checkpoints (section 4C). The hourly maintenance sweep ({perma("apps/server/src/services/system/periodic-sweeps.ts", "L301-L333")}) only issues <code>wal_checkpoint(PASSIVE)</code> when the freelist exceeds 1024 pages, which a small database never hits (my instance logged only <code>Incremental database vacuum skipped below freelist threshold</code>). Nothing logs WAL size, checkpoint progress or recovery.</p>

  <h3>5.2 SQLite treats an unreadable WAL as empty, silently</h3>
  <p>When a connection finds the wal-index header invalid (zeroed <code>-shm</code>, mismatching copies) it re-runs <code>walIndexRecover()</code> against the WAL file. In SQLite 3.53.1 as bundled by better-sqlite3 12.10.0 (<code>deps/sqlite3/sqlite3.c</code> at lines 68880-68892):</p>
  <pre>{esc(recover_excerpt)}</pre>
  <p>A bad magic number, page size or header checksum, or a broken frame checksum chain, ends recovery with <code>mxFrame = 0</code> (or the last valid commit) and <code>SQLITE_OK</code>. The handle that bb has had open since Aug 16 then reads pages from the main file, which is the last checkpoint. The next commit writes frame 1 again with the same salt (the salt is copied before the checksum check), so the old frames beyond the new ones are unreachable to SQLite but physically present, which is exactly why "the WAL was ~7 MB" yet "replaying it does not surface the lost rows" and why the forensic tool can still read them.</p>

  <h3>5.3 What I could not establish: the trigger</h3>
  <p>I traced every reference to the database path in the repo. Only the server process opens <code>bb.db</code> (<code>lsof</code> on the live instance confirms: one pid). Plugins get <code>plugins/&lt;id&gt;/data.db</code> ({perma("apps/server/src/services/plugins/plugin-api.ts", "L654-L661")}); plugin state snapshots copy only those files (their <code>wal_checkpoint(TRUNCATE)</code> at {perma("apps/server/src/services/plugins/plugin-state-snapshot.ts", "L180-L180")} runs on a plugin <code>data.db</code> handle); <code>bb-app</code> and the desktop app only print the path ({perma("packages/bb-app/src/launcher.ts", "L3535-L3535")}); the legacy dev-data migration renames files inside <code>~/.bb-dev</code>; the only <code>VACUUM</code> ({perma("packages/db/src/data/maintenance.ts", "L406-L426", "compactDatabase")}) runs on the server's own handle for legacy non-incremental databases and cannot revert data. No code copies, restores, deletes, truncates or reopens <code>bb.db*</code>. The Squirrel update path does not touch <code>~/.bb</code>. So the event at 15:10 came from outside bb.</p>
  <p>The <code>bb.db</code> mtime is the strongest discriminator between candidates. In WAL mode the only SQLite operation that writes the main file is a checkpoint, a checkpoint copies <em>committed WAL frames into</em> <code>bb.db</code> (data-preserving by construction), and after a WAL-invalidation bb's own handle would not checkpoint again until ~1000 new pages had accumulated (walkthrough step 9). A main file rewritten in the same minute as a data-losing event is therefore hard to attribute to SQLite at all. Candidates, re-ranked with that in mind:</p>
  <ol>
    <li><strong>An in-place rewrite of <code>~/.bb/bb.db{{,-wal,-shm}}</code> by a non-SQLite actor</strong> (dotfile sync, backup/restore agent, a "restore previous version" action, a cloud-sync client reconciling an older copy). Writing an older main file and its companion WAL/shm in place explains the mtime at 15:10, the revert through the open handle (the files are memory-mapped / re-read on the next transaction), the ~7 MB WAL that replays to the old state (it is the old WAL), and the reappearing deleted threads. Fingerprint in the cold copy: a single all-live WAL generation whose newest content is ≤ Aug 9, and <code>bb.db-shm</code>/<code>bb.db-wal</code> mtimes also at 15:10.</li>
    <li><strong>A tool that had <code>bb.db</code> open since ~Aug 9</strong> (DB browser, <code>sqlite3</code> shell, a backup agent linking SQLite) that pinned checkpoints (section 4C) and at 15:10 damaged the WAL header / wal-index (crash mid-write, unsupported VFS, an explicit "journal mode" action). This explains the revert, the WAL size and the replay failure (section 4B), but <em>not</em> the <code>bb.db</code> mtime unless the same tool also wrote the main file outside of SQLite. Fingerprint: a small live generation followed by a large stale generation with the same salt; the Aug 9–21 pages are then still in the file and <code>recover</code> may bring them back.</li>
    <li><strong>A third-party in-process plugin touching <code>bb.db</code>/<code>bb.db-shm</code> with <code>fs</code> APIs</strong>, which under POSIX advisory-lock semantics drops the server's SQLite locks and lets a second opener believe it is alone. Same fingerprint and same mtime objection as (2); it only changes who the second opener could be.</li>
  </ol>
  <p>The cold copy (section 4F) distinguishes (1) from (2)/(3) in one command. If the WAL shows a stale generation, the data is recoverable today; every further hour of use overwrites more of it.</p>

  <h2>6. Proposed fix (first principles)</h2>
  <p>bb cannot prevent another process from damaging or replacing files in <code>~/.bb</code>, but it can make the exposure window minutes instead of weeks where that is possible, and make the event loud and recoverable instead of silent where it is not. Which candidate trigger each item mitigates is stated explicitly, because they differ: under candidate (1) (external rewrite of all three files) no checkpoint policy helps and only the tripwire and backups do; under (2)/(3) with a reader pinning the WAL, passive checkpoints copy nothing (section 4C) and the value is the warning; only in the unpinned case do checkpoints bound the loss. Confident about the following:</p>
  <ol>
    <li><strong>Checkpoint at shutdown.</strong> In <code>runShutdown()</code> ({perma("apps/server/src/start-server.ts", "L272-L298")}) call <code>db.$client.close()</code> after WebSockets/plugins are stopped (and in the <code>uncaughtException</code> exit). SQLite then performs the close-time checkpoint and deletes the WAL. Mitigates: the "fresh install / light use has an empty <code>bb.db</code> for weeks" exposure (section 4A) across restarts. Does not help the reporter's case as described (the server never restarted between Aug 16 and the event, and a pinned reader blocks the close-time checkpoint too). Risk: close must run after every consumer stopped using the handle; wrap in try/catch so a failing close never blocks exit.</li>
    <li><strong>Periodic passive checkpoint with progress logging.</strong> Add a cheap sweep (e.g. every 60 s, or in <code>runPeriodicSweeps</code>) that runs <code>PRAGMA wal_checkpoint(PASSIVE)</code> and reads its <code>(busy, log, checkpointed)</code> result. Log at <code>warn</code> when <code>checkpointed &lt; log</code> for several consecutive runs ("a reader is pinning bb.db-wal at frame N; bb.db is M frames behind") and include the WAL byte size. Efficacy, honestly stated: when no reader pins the WAL this bounds the unbackfilled window to ~1 minute instead of 1000 pages. When a reader pins the WAL, as in the report's leading WAL-invalidation scenario, the checkpoint copies nothing (section 4C: <code>{{"busy":0,"log":8314,"checkpointed":0}}</code>), so the reporter's data would <em>not</em> have been safer, but there would have been a warning naming the problem within minutes of the reader appearing instead of 12 days of silence. Against an external rewrite of all three files it does nothing. Risk: none for correctness (PASSIVE never blocks writers); I/O cost is proportional to new frames only.</li>
    <li><strong>A tripwire for "the database went backwards"</strong> (mitigates every candidate, including the external rewrite). On every sweep persist a monotonic high-water mark (for example <code>MAX(events.sequence)</code> or a counter in a tiny <code>system_meta</code> row) to a sidecar file in the data dir; if the live value is ever lower than the sidecar, log an error, surface it in the UI/CLI (<code>bb doctor</code>), and stop the periodic checkpoint so post-incident writes do not overwrite the stale frames that still hold the data. The walkthrough shows a 100% recovery is possible right after the event and degrades with every later write.</li>
    <li><strong>Rolling backups</strong> (the only item that restores data under every candidate). A daily <code>VACUUM INTO '&lt;dataDir&gt;/backups/bb-YYYYMMDD.db'</code> with a small retention (e.g. 7) from the maintenance sweep. The reporter had no APFS snapshot and no bb backup; this is the only thing that turns an unexplained revert into a five-minute restore.</li>
    <li><strong>Plugin-side guard (defensive, lower confidence).</strong> Document in the plugin SDK that in-process plugins must never open <code>bb.db*</code> with <code>fs</code> (POSIX lock drop), and consider checking <code>lsof</code>-style diagnostics in <code>bb doctor</code>.</li>
  </ol>
  <p>Tests: the packages/db test in this report cannot observe a server-level fix (section 4E). A fix PR should add an <code>apps/server</code> test that boots the server against a temp data dir, writes a row, runs the shutdown path and asserts the main file alone (copy of <code>bb.db</code> without <code>-wal</code>) contains the row; a second test that the periodic checkpoint runs and that a pinned reader (open read transaction from a child process, as in <code>issue-2190-pinned-reader.ts</code>) produces the warning; and a third that the tripwire fires when <code>MAX(events.sequence)</code> drops below the sidecar value.</p>

  <h2>7. PR review</h2>
  <p>No pull requests are linked to this issue.</p>

  <h2>8. Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1919">#1919</a> (closed 2026-08-19) — <code>storage.database()</code> leaked tens of thousands of SQLite handles on plugin <code>data.db</code> files inside the server process. Different file, but it shows in-process plugins can exhaust fds and interact with SQLite file handling in the same process as <code>bb.db</code>; 0.38.0 predates the fix.</li>
    <li><a href="https://github.com/get-bb/bb/pull/1438">#1438</a> (merged 2026-08-12, shipped in 0.38.0) — introduced <code>mmap_size</code> and <code>synchronous=NORMAL</code>. Not causal here (no power loss; mmap only changes how main-file pages are read), but any fix PR should keep them in mind when adding checkpoints.</li>
    <li>No earlier report of a reverting <code>bb.db</code> was found (searched "sqlite WAL", "data loss database", "threads disappeared").</li>
  </ul>

  <h2>9. Appendix</h2>
  <h3>Commands run</h3>
  <pre>{esc('''gh issue view 2190 --repo get-bb/bb --json number,title,body,labels,comments,state,createdAt,author
pnpm install --frozen-lockfile --prefer-offline && pnpm exec turbo run build
git grep -n -l -E "journal_mode|wal_checkpoint|wal_autocheckpoint|VACUUM|\\.backup\\(" -- '*.ts' '*.js' '*.mjs'
git grep -n -E '"bb\\.db"|bb\\.db|\\.db-wal|\\.db-shm' -- '*.ts' '*.js' '*.mjs' '*.json' '*.md'
git grep -n "createConnection(" -- '*.ts'            # only apps/server/src/db.ts + seed-perf-db
git grep -n -E "\\$client\\.close\\(\\)|sqlite\\.close\\(\\)|db\\.close\\(\\)" -- apps/server/src packages/db/src   # nothing
git log --format='%h %ad %s' --date=short -S"mmap_size" -- packages/db/src/connection.ts  # d5175bdf5 2026-08-12 (#1438)
git merge-base --is-ancestor d5175bdf5 desktop-v0.38.0   # yes: 0.38.0 contains #1438
git fetch origin main; git log fcada5a3b..origin/main --oneline   # 2 unrelated commits
cd packages/db && pnpm exec vitest run test/issue-2190-wal-revert.test.ts
cd packages/db && pnpm exec tsx test/issue-2190-walkthrough.ts
cd packages/db && pnpm exec tsx test/issue-2190-pinned-reader.ts
cd packages/db && pnpm exec tsx test/issue-2190-exit-durability.ts
bash packages/db/test/issue-2190-run-all.sh        # walkthrough, pinned-reader, exit-durability, vitest -> repro/*.txt
scripts/bb-dev-app current; bash packages/db/test/issue-2190-part-a.sh   # product-level part A -> repro/part-a-transcript.txt
git show desktop-v0.38.0:packages/db/package.json | grep better-sqlite3  # "12.10.0"
pnpm dev:stop; rm -rf $DATA; lsof port check''')}</pre>
  <h3>Artifacts</h3>
  <ul>
    <li><a href="2190/repro/walkthrough-output.txt">walkthrough-output.txt</a>, <a href="2190/repro/pinned-reader-output.txt">pinned-reader-output.txt</a>, <a href="2190/repro/exit-durability-output.txt">exit-durability-output.txt</a></li>
    <li><a href="2190/repro/part-a-transcript.txt">part-a-transcript.txt</a> (verbatim product-level run), <a href="2190/repro/live-inspect-running.json">live-inspect-running.json</a>, <a href="2190/repro/live-inspect-after-sigterm.json">live-inspect-after-sigterm.json</a> (real dev instance)</li>
    <li>Runners: <a href="2190/repro/issue-2190-part-a.sh">issue-2190-part-a.sh</a>, <a href="2190/repro/issue-2190-run-all.sh">issue-2190-run-all.sh</a> (copy into <code>packages/db/test/</code>)</li>
    <li><a href="2190/repro/vitest-final.txt">vitest-final.txt</a>; <a href="2190/repro/vitest-run1.txt">vitest-run1.txt</a> is the first draft run whose helper assumed the main file had a <code>projects</code> table; its <code>no such table: projects</code> failure is what revealed that the main file holds no schema at all, and <a href="2190/repro/vitest-run2.txt">vitest-run2.txt</a> is the corrected run.</li>
    <li>Sources: <a href="2190/repro/issue-2190-wal-tool.mjs">issue-2190-wal-tool.mjs</a>, <a href="2190/repro/issue-2190-live-inspect.mjs">issue-2190-live-inspect.mjs</a>, <a href="2190/repro/issue-2190-walkthrough.ts">issue-2190-walkthrough.ts</a>, <a href="2190/repro/issue-2190-pinned-reader.ts">issue-2190-pinned-reader.ts</a>, <a href="2190/repro/issue-2190-exit-durability.ts">issue-2190-exit-durability.ts</a>, <a href="2190/repro/issue-2190-wal-revert.test.ts">issue-2190-wal-revert.test.ts</a></li>
  </ul>
  <h3>Server log of the dev instance (only database-related lines during the whole run)</h3>
  <pre>{esc('@bb/server:dev: [08:52:06] DEBUG: [server] Incremental database vacuum skipped below freelist threshold {"freelistStats":{"databaseBytes":692224,"freelistBytes":0,"freelistCount":0,"pageCount":169,"pageSize":4096}}\n@bb/host-daemon:dev: [08:52:33] INFO: [host-daemon] Disconnected from server {"serverUrl":"http://127.0.0.1:24667","code":1001,"reason":"server-shutdown"}\n@bb/server:dev: [dev-supervisor:server] Child exited unexpectedly with exit code 0. Restarting in 1s.')}</pre>
  <h3>Notes on the simulation's fidelity</h3>
  <p>The only induced step (walkthrough step 4) zeroes <code>bb.db-shm</code> in place and flips one bit in the WAL header checksum from another process. Truncating the shm to zero instead (what a second SQLite opener does when it holds the exclusive DMS lock) would SIGBUS a process that has the shm mapped, which is why the in-place variant was used; SQLite's response (recovery, empty WAL, silent fallback to the main file, same-salt restart) is identical for any cause that leaves the header unreadable. The reporter's process did not crash, which is consistent with an in-place modification rather than a truncation.</p>
  <h2>10. Verification</h2>
  <p>An independent verifier re-ran this report in a separate worktree at <code>{SHORT}</code> with its own dev instance (ports 16384/24384/32384). Part A matched (4096-byte <code>bb.db</code> after start, after project creation and after SIGTERM of the only opener); the walkthrough, pinned-reader, exit-durability and vitest runs matched step for step; every cited code location was confirmed at <code>{SHORT}</code> and <code>origin/main</code> (<code>15f21ade7</code>) has no change to the relevant paths. The verifier refuted one claim: the "<code>bb.db</code> mtime changed: true" in walkthrough step 6 came from a <code>PRAGMA wal_checkpoint(PASSIVE)</code> the harness itself ran; without it the commit after the revert does not touch <code>bb.db</code>.</p>
  <p>Changes in this revision, each re-run rather than reworded: the harness checkpoint was removed from step 6 (now prints <code>bb.db mtime changed: false</code>), and steps 9–10 were added to measure when bb would write <code>bb.db</code> on its own (195 commits / 1001 pages later, by which point recovery is impossible) versus an explicitly labelled induced checkpoint; the mtime claim row is now "Not explained by the simulated mechanism" and the TL;DR no longer lists it as reproduced; 5.3 re-ranks the trigger candidates using the mtime and notes that a SQLite checkpoint cannot both write <code>bb.db</code> and lose data; the pinned-reader experiment now issues an explicit passive checkpoint while pinned (<code>checkpointed: 0</code> of 8314) and section 6 states per candidate what each fix does and does not mitigate; section 4E and the test docblock no longer claim the packages/db test can observe a server-level fix, and the test asserts the post-revert commit leaves the mtime unchanged; Part A is fully derived (<code>DATA</code>, host id, scratch repo creation, ports) and was re-run on a fresh instance with the transcript attached; the better-sqlite3 pin (identical 12.10.0 in <code>desktop-v0.38.0</code>), the "same salt" comment and the "recreated data survived" row were corrected. Verifier artifacts live in <a href="2190/verify/">2190/verify/</a>.</p>
</main></body></html>
"""

pathlib.Path("/tmp/bb-reports/issues/2190.html").write_text(doc)
print("wrote", len(doc), "bytes")
