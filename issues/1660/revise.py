import re, sys
p = "/tmp/bb-reports/issues/1660.html"
s = open(p, encoding="utf-8").read()
orig = s

def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (s.count(old), old[:80])
    s = s.replace(old, new)

# --- header verdict: mention revision
rep('<span>investigated 2026-08-18</span>',
    '<span>investigated 2026-08-18 (revised same day after independent verification)</span>')

# --- Environment: add revision instance
rep('<li>Dev instance: App <code>http://localhost:13477</code>',
    '<li>Revision run (this version of the report): dev instance App <code>http://localhost:15803</code>, Server <code>http://localhost:23803</code>, host daemon <code>127.0.0.1:31803</code>, data dir <code>~/.bb-dev/projects-bb-.claude-worktrees-wf_debcf606-e4a-33-4322b8038a31</code>, host id <code>host_jkzcgxjdxs</code>, host daemon PID 1582592.</li>\n    <li>Original run: dev instance App <code>http://localhost:13477</code>')

# --- Repro step 1-3: dev CLI naming + host id
rep('''    <li>Start a dev instance and export its env: <pre>scripts/bb-dev-app current
eval "$(scripts/bb-dev-app env)"     # BB_SERVER_URL=http://localhost:21477 …</pre></li>''',
'''    <li>Start a dev instance and export its env. <strong>Note:</strong> in every step below, <code>bb …</code> means the dev instance's CLI, i.e. <code>pnpm bb:dev …</code> (or <code>node packages/scripts/dist/commands/run-cli.js …</code> after the first <code>pnpm bb:dev</code>), run from the repo root with the exported env — a bare <code>bb</code> would talk to your real <code>~/.bb</code> instance. <pre>scripts/bb-dev-app current
eval "$(scripts/bb-dev-app env)"     # BB_SERVER_URL=http://localhost:23803 BB_HOST_DAEMON_PORT=31803 …
pnpm bb:dev machine list             # take the host id from here (mine: host_jkzcgxjdxs)
# Name  ID               Status     Last seen
# bee   host_jkzcgxjdxs  connected  just now</pre></li>''')

rep('''    <li>Make a scratch repo and a project on it: <pre>mkdir -p /tmp/bb1660-repo &amp;&amp; cd /tmp/bb1660-repo &amp;&amp; git init -q -b main &amp;&amp; echo "# qa" &gt; README.md \\
  &amp;&amp; git add . &amp;&amp; git -c user.email=qa@example.com -c user.name=qa commit -qm init
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa1660","source":{"type":"local_path","path":"/tmp/bb1660-repo","hostId":"host_e9dcahrvyx"}}'
# → {"id":"proj_qqqpjz68py", …}</pre></li>''',
'''    <li>Make a scratch repo and a project on it (substitute <em>your</em> host id from step 1): <pre>mkdir -p /tmp/bb1660r-repo &amp;&amp; cd /tmp/bb1660r-repo &amp;&amp; git init -q -b main &amp;&amp; echo "# qa" &gt; README.md \\
  &amp;&amp; git add . &amp;&amp; git -c user.email=qa@example.com -c user.name=qa commit -qm init
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa1660r","source":{"type":"local_path","path":"/tmp/bb1660r-repo","hostId":"host_jkzcgxjdxs"}}'
# → {"id":"proj_46fcadffg4", …}</pre></li>''')

rep('''<pre>bb thread spawn --project proj_qqqpjz68py --new-environment worktree --provider claude-code \\
  --permission-mode full --title "orphan repro 1660" \\
  --prompt "Run exactly this shell command and nothing else: nohup sleep 100000 &gt;/dev/null 2&gt;&amp;1 &amp; disown ; then reply only with ok." --json
# → thr_dyb25avqn8; after the turn environmentId = env_tj4p2dg3ru
#   worktree: ~/.bb-dev/&lt;instance&gt;/worktrees/env_tj4p2dg3ru/bb1660-repo</pre></li>''',
'''<pre>pnpm bb:dev thread spawn --project proj_46fcadffg4 --new-environment worktree --provider claude-code \\
  --permission-mode full --title "orphan repro 1660" \\
  --prompt "Run exactly this shell command and nothing else: nohup sleep 100000 &gt;/dev/null 2&gt;&amp;1 &amp; disown ; then reply only with ok." --json
# → thr_g3xmvwtd84; ~40 s later the thread is idle and environmentId = env_ig2nscwucq
sqlite3 &lt;data&gt;/bb.db "select id,status,environment_id from threads where id='thr_g3xmvwtd84';"
# thr_g3xmvwtd84|idle|env_ig2nscwucq
#   worktree: &lt;data&gt;/worktrees/env_ig2nscwucq/bb1660r-repo   (&lt;data&gt; = the data dir printed by scripts/bb-dev-app current)</pre></li>''')

rep('''<pre>$ ./find-worktree-procs.sh ~/.bb-dev/&lt;instance&gt;/worktrees/env_tj4p2dg3ru
pid=1184169 ppid=1178110 cwd=…/env_tj4p2dg3ru/bb1660-repo cmd=node … (provider bridge, child of host daemon)
pid=1184228 ppid=1184169 cwd=…/env_tj4p2dg3ru/bb1660-repo cmd=/home/sawyer/.local/bin/claude --output-format stream-json …
pid=1185882 ppid=1       cwd=…/env_tj4p2dg3ru/bb1660-repo cmd=sleep 100000     &lt;-- agent's background process, ppid 1</pre></li>''',
'''<pre>$ ./find-worktree-procs.sh &lt;data&gt;/worktrees/env_ig2nscwucq
pid=1591658 ppid=1582592 pgid=1581708 sid=1581708 cwd=…/env_ig2nscwucq/bb1660r-repo cmd=node … (provider bridge, child of host daemon 1582592)
pid=1591676 ppid=1591658 pgid=1581708 sid=1581708 cwd=…/env_ig2nscwucq/bb1660r-repo cmd=/home/sawyer/.local/bin/claude --output-format stream-json …
pid=1593823 ppid=1       pgid=1593823 sid=1593772 cwd=…/env_ig2nscwucq/bb1660r-repo cmd=sleep 100000   &lt;-- agent's background process, ppid 1</pre>
    Note the <code>pgid</code>/<code>sid</code> columns: the bridge and <code>claude</code> live in the daemon's process group and session (1581708), but the agent's process is the leader of its <em>own</em> group (1593823) in its <em>own</em> session (1593772, whose leader — Claude Code's Bash-tool shell — has already exited). Claude Code spawns its Bash tool with <code>detached: true</code> (Node's <code>setsid()</code>), visible in the CLI bundle: <pre>$ strings -n 8 ~/.local/share/claude/versions/2.1.234 | grep -o '.\\{60\\}type:"bash",shellPath:e,detached:!0.\\{20\\}'
!t?.skipSnapshot)KDp(e).catch(()=&gt;{});let o,i=!1;return{type:"bash",shellPath:e,detached:!0,stdin:"pipe",</pre>
    This matters for the fix: a process-group kill aimed at the bridge cannot reach this process (see Proposed fix).</li>''')

rep('''<pre>$ bb thread archive thr_dyb25avqn8
Thread thr_dyb25avqn8 archived
$ sqlite3 &lt;data&gt;/bb.db "select id,status,retire_requested_at from environments where id='env_tj4p2dg3ru';"
env_tj4p2dg3ru|retiring|1787028007413
# … wait ~5 min …
$ sqlite3 &lt;data&gt;/bb.db "select id,status,path from environments where id='env_tj4p2dg3ru';"
env_tj4p2dg3ru|destroyed|
$ ls ~/.bb-dev/&lt;instance&gt;/worktrees/env_tj4p2dg3ru
ls: cannot access …: No such file or directory</pre></li>''',
'''<pre>$ pnpm bb:dev thread archive thr_g3xmvwtd84
Thread thr_g3xmvwtd84 archived
$ sqlite3 &lt;data&gt;/bb.db "select id,status,retire_requested_at from environments where id='env_ig2nscwucq';"
env_ig2nscwucq|retiring|1787030673745
# ~1m40s later, still retiring: the bridge and claude are still alive (archive does not stop them)
$ ps -o pid,ppid,pgid,sid,stat,etime,cmd -p 1591658,1591676,1593823
    PID    PPID    PGID     SID STAT     ELAPSED CMD
1591658 1582592 1581708 1581708 Sl         01:42 node … (provider bridge)
1591676 1591658 1581708 1581708 Sl         01:42 /home/sawyer/.local/bin/claude …
1593823       1 1593823 1593772 S          01:37 sleep 100000
# … poll `select status from environments where id='env_ig2nscwucq'` until it reads destroyed (~5m12s after archive) …
$ sqlite3 &lt;data&gt;/bb.db "select id,status,path from environments where id='env_ig2nscwucq';"
env_ig2nscwucq|destroyed|
$ ls &lt;data&gt;/worktrees/env_ig2nscwucq
ls: cannot access …: No such file or directory</pre></li>''')

rep('''<pre>$ ./find-worktree-procs.sh ~/.bb-dev/&lt;instance&gt;/worktrees/env_tj4p2dg3ru
pid=1185882 ppid=1 cwd=/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_debcf606-e4a-7-ffe168ad615c/worktrees/env_tj4p2dg3ru/bb1660-repo (deleted) cmd=sleep 100000
$ ps -o pid,ppid,stat,etime,cmd -p 1185882
    PID    PPID STAT     ELAPSED CMD
1185882       1 S          06:10 sleep 100000</pre>
    The bridge (1184169) and <code>claude</code> (1184228) did exit at destroy — <code>runtime.shutdown()</code> runs before <code>workspace.destroy()</code> — but the process the agent started did not, and bb never looked at it. Full transcript: <a href="1660/repro/live-repro-transcript.txt">repro/live-repro-transcript.txt</a>.</li>''',
'''<pre>$ ./find-worktree-procs.sh &lt;data&gt;/worktrees/env_ig2nscwucq
pid=1593823 ppid=1 pgid=1593823 sid=1593772 cwd=/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_debcf606-e4a-33-4322b8038a31/worktrees/env_ig2nscwucq/bb1660r-repo (deleted) cmd=sleep 100000
$ ps -o pid,ppid,pgid,sid,stat,etime,cmd -p 1591658,1591676,1593823
    PID    PPID    PGID     SID STAT     ELAPSED CMD
1593823       1 1593823 1593772 S          05:38 sleep 100000</pre>
    The bridge (1591658) and <code>claude</code> (1591676) did exit at destroy — <code>RuntimeManager.destroyEnvironment</code> calls <code>runtime.shutdown()</code> before <code>workspace.destroy()</code> (that ordering dates from <code>b04593eb87</code>, 2026-03-24) — but the process the agent started did not, and bb never looked at it. Transcripts: <a href="1660/repro/live-repro-transcript-revision.txt">repro/live-repro-transcript-revision.txt</a> (this run, with pgid/sid) and <a href="1660/repro/live-repro-transcript.txt">repro/live-repro-transcript.txt</a> (original run: thr_dyb25avqn8 / env_tj4p2dg3ru, same outcome).</li>''')

# unit test paragraph: mention rerun output
rep('Output: <a href="1660/repro/vitest-output.txt">repro/vitest-output.txt</a>.</p>',
    'Output: <a href="1660/repro/vitest-output.txt">repro/vitest-output.txt</a> (re-run for this revision: <a href="1660/repro/vitest-output-revision.txt">repro/vitest-output-revision.txt</a>, same failure at line 101).</p>')

# --- Root cause: bridge spawn bullet, add that Claude Code setsid's its Bash tool
rep('''so bb has no process group of its own to signal; it relies on the bridge/CLI to clean up their descendants. Whatever the agent backgrounded (<code>&amp;</code>, <code>nohup</code>, <code>setsid</code>, tool "background" modes) is reparented to PID 1 and untouched.</li>''',
'''so bb has no process group of its own to signal; it relies on the bridge/CLI to clean up their descendants. Whatever the agent backgrounded (<code>&amp;</code>, <code>nohup</code>, <code>setsid</code>, tool "background" modes) is reparented to PID 1 and untouched. In the reproduced Claude Code path the orphan is not even in the bridge's process group: Claude Code runs its Bash tool <code>detached: true</code> (new session), so the <code>sleep</code> ended up as pgid 1593823 / sid 1593772 while bridge and <code>claude</code> were pgid/sid 1581708. Owning the bridge's process group would therefore not be enough to find it.</li>''')

rep('''<p><em>Deeper issue:</em> bb has no notion of "processes belonging to an environment". Because the bridge is spawned in the daemon's process group and without a session of its own, even the provider CLI's cleanup is best-effort (see #1769: a <code>claude</code> process alive 12h46m after its environment was destroyed on 0.38.0). Reaping by cwd is a heuristic that catches the common case, but the robust fix is ownership: give each environment's provider/terminal tree its own process group or session (or a cgroup on Linux) so teardown can signal the whole tree.</p>''',
'''<p><em>Deeper issue:</em> bb has no notion of "processes belonging to an environment". The only handle it holds is the bridge PID; the bridge is spawned in the daemon's own process group and session, and provider CLIs (Claude Code at least) deliberately start tool shells in new sessions, so no ancestry-, group- or session-based signal from bb can enumerate what an agent left running. On Linux a cgroup per environment would give true ownership; portably (macOS included) the only thing that finds the reproduced orphan is a scan by cwd. #1769 additionally shows a <code>claude</code> process alive 12h46m after its environment was destroyed on 0.38.0 — that is a different path from the one reproduced here (in both my runs the bridge and <code>claude</code> exited when <code>destroyEnvironment</code> ran) and remains unexplained; a crashed/restarted daemon that lost its <code>RuntimeEntry</code> map is the obvious candidate.</p>''')

# --- Things I checked bullet: remove #1584 misattribution
rep('''Idle provider processes are now released on archive/stop (#1584, in 0.38.0), and #1604 tracks''',
    '''Provider processes are released on <code>threads.stop</code> (#1584, in 0.38.0) and on environment destroy (<code>runtime.shutdown()</code>), but <em>not</em> on archive: in the live repro the bridge and <code>claude</code> stayed alive for the whole 5-minute retiring window. #1604 tracks''')

# --- Proposed fix: reorder and correct scope of group-kill
old_fix_start = s.index('<h2>Proposed fix (first principles)</h2>')
old_fix_end = s.index('<h2>PR review</h2>')
new_fix = '''<h2>Proposed fix (first principles)</h2>
  <p>Ordered by what actually covers the reproduced case. The verifier's and my own <code>pgid</code>/<code>sid</code> readings show that the orphan is in its own session, so a process-group fix alone would <strong>not</strong> have reaped it — the cwd scan is the load-bearing change.</p>
  <ol>
    <li><strong>Reap by cwd on destroy (daemon; host-local primitive — correct layer per AGENTS.md). Covers the reproduced case.</strong> In <code>RuntimeManager.destroyEnvironment</code>, before <code>workspace.destroy()</code>, enumerate processes whose cwd is inside <code>entry.workspace.path</code> (Linux: readlink <code>/proc/*/cwd</code>, exactly what <a href="1660/repro/find-worktree-procs.sh">find-worktree-procs.sh</a> does; macOS: <code>lsof -d cwd -Fpn +D &lt;path&gt;</code> or <code>proc_pidinfo(PROC_PIDVNODEPATHINFO)</code> via a tiny helper) and SIGTERM→SIGKILL them; log the PIDs/commands. Return the reaped list in the <code>environment.destroy</code> result so the server can record a thread event ("stopped 1 process left running in this workspace: sleep 100000") — that changes the RPC result shape, so bump <code>HOST_DAEMON_PROTOCOL_VERSION</code>. Risk: killing a process the user intentionally started from that directory in another terminal; the directory is about to be <code>rm -rf</code>'d anyway, so that process is doomed to a <code>(deleted)</code> cwd regardless — log loudly rather than skip. Also run the same scan in a periodic daemon sweep against <em>already-deleted</em> managed worktree paths (env rows with status <code>destroyed</code> whose former path is under the managed worktrees root, or simply any process whose cwd is under the worktrees root and ends in <code>(deleted)</code>) so orphans from before the fix and from daemon crashes get reaped — this is what the reporter's 10-minute automation does by hand. This is the change that would make the unit repro pass.</li>
    <li><strong>Own the process tree (daemon). Defence in depth; does <em>not</em> cover the reproduced case.</strong> Spawn provider bridges and terminal shells with <code>detached: true</code> so each becomes its own process-group/session leader; on <code>runtime.shutdown()</code>/terminal close send <code>process.kill(-pid, "SIGTERM")</code> then <code>SIGKILL</code>, falling back to the direct child if the group is gone (the repo already has this exact pattern for setup scripts: <code>killSetupScriptProcess</code> in <code>packages/host-workspace/src/provisioning.ts#L218-L229</code>). This catches descendants that stayed in the bridge's group — bb terminal shells, providers that do not <code>setsid</code> their tool shells, a hung <code>claude</code> whose bridge died — but <em>not</em> the Claude Code Bash-tool case reproduced above, because that shell already runs in a new session (pgid 1593823 ≠ bridge pgid 1581708). Note also that today the bridge shares the daemon's group (in dev even the launcher's, 1581708), so a naive <code>kill(-pgid)</code> on the bridge's <em>current</em> group would kill the daemon itself; the detach must land together with the group kill. No wire change, so no protocol bump.</li>
    <li><strong>Telemetry (daemon returns raw data, server/CLI present it).</strong> Add a <code>host.resources</code> RPC returning <code>defaultReadResourceUsage()</code> plus child-process count/RSS and the count of <code>(deleted)</code>-cwd processes under the worktrees root, surface it in <code>bb status --resources</code> and <code>bb machine show</code>, and have the health monitor warn on RSS growth (e.g. &gt; 4 GB or &gt; 2× the 1-hour minimum) on every platform, not only on the Linux inotify signal. Bump the protocol version for the new RPC.</li>
    <li><strong>Ceiling.</strong> Set an explicit <code>--max-old-space-size</code> for server and daemon from the launcher (see #1748 for the cgroup-aware variant) and put a byte cap on the event-sink queue that switches to spilling to disk or refusing new turns rather than growing forever.</li>
  </ol>

  '''
s = s[:old_fix_start] + new_fix + s[old_fix_end:]

# --- Related issues: fix #1584 line and #1769 line
rep('''<li><a href="https://github.com/get-bb/bb/pull/1584">#1584</a> Release agent runtimes on thread stop (merged, in 0.38.0) — why the bridge/claude processes did die in my repro.</li>''',
'''<li><a href="https://github.com/get-bb/bb/pull/1584">#1584</a> Release agent runtimes on thread stop (merged 2026-08-14, in 0.38.0) — makes <code>threads.stop</code> release runtimes. It is <em>not</em> why the bridge/<code>claude</code> exited in my repro: the repro archives (does not stop) the thread and both processes stayed alive through the whole retiring window; they exited because <code>destroyEnvironment</code> calls <code>runtime.shutdown()</code> (code from <code>b04593eb87</code>, 2026-03-24). Listed because it is the closest existing "release provider processes" work.</li>''')
rep('''<li><a href="https://github.com/get-bb/bb/issues/1769">#1769</a> (closed as duplicate of #1647) — evidence that on 0.38.0 even the bridge + <code>claude</code> process survived destroy for 12h46m.</li>''',
'''<li><a href="https://github.com/get-bb/bb/issues/1769">#1769</a> (closed as duplicate of #1647) — evidence that on 0.38.0 even the bridge + <code>claude</code> process survived destroy for 12h46m. Not reproduced here (bridge/<code>claude</code> exited at destroy in both runs on main); the survival path is unexplained — see "Deeper issue".</li>''')

# --- Appendix commands: add revision commands
rep('''git merge-base --is-ancestor 1c3f3eff0 desktop-v0.38.0   # #1584 is in 0.38.0''',
'''git merge-base --is-ancestor 1c3f3eff0 desktop-v0.38.0   # #1584 is in 0.38.0
# revision run
pnpm bb:dev machine list
curl -s -X POST $BB_SERVER_URL/api/v1/projects … hostId host_jkzcgxjdxs
pnpm bb:dev thread spawn --project proj_46fcadffg4 --new-environment worktree --provider claude-code … --json
./find-worktree-procs.sh &lt;data&gt;/worktrees/env_ig2nscwucq ; ps -o pid,ppid,pgid,sid,etime,cmd -p …
strings -n 8 ~/.local/share/claude/versions/2.1.234 | grep -o '.\\{60\\}type:"bash",shellPath:e,detached:!0.\\{20\\}'
pnpm bb:dev thread archive thr_g3xmvwtd84 ; poll sqlite3 until status=destroyed ; ./find-worktree-procs.sh … ; ps …
git blame -L 1117,1131 apps/host-daemon/src/runtime-manager.ts ; gh pr view 1584 --json title,mergedAt
cd packages/host-workspace &amp;&amp; NO_COLOR=1 pnpm exec vitest run test/issue-1660-orphan-process.test.ts   # re-run, still fails at :101''')

# --- Artifacts list
rep('''<li><a href="1660/repro/live-repro-transcript.txt">repro/live-repro-transcript.txt</a> — full live transcript</li>''',
'''<li><a href="1660/repro/live-repro-transcript.txt">repro/live-repro-transcript.txt</a> — full live transcript (original run)</li>
    <li><a href="1660/repro/live-repro-transcript-revision.txt">repro/live-repro-transcript-revision.txt</a> — revision run with pgid/sid, retiring-window ps, blame and Claude Code <code>detached</code> evidence</li>
    <li><a href="1660/repro/vitest-output-revision.txt">repro/vitest-output-revision.txt</a> — vitest re-run for the revision</li>''')

# --- Verification subsection at end
rep('''  </ul>
</main></body></html>''',
'''  </ul>
  <h3>Verification</h3>
  <p>An independent verifier re-ran both reproductions on <code>16ceb3a54</code> (own dev instance, thread <code>thr_6pqtx3mwdh</code> / env <code>env_ynzhqp6vd5</code>; unit test in <code>packages/host-workspace/test</code>) and got the same results: bridge, <code>claude</code> and <code>sleep 100000</code> rooted in the worktree; after archive → 5-min retire → destroy the directory is gone, bridge/claude exited, <code>sleep</code> alive with <code>(deleted)</code> cwd; vitest fails at line 101. All permalinked code excerpts and related-issue states matched the tree. The verifier raised three findings, all accepted and addressed in this revision:</p>
  <ul>
    <li><strong>Major — proposed fix (1) would not reap the reproduced orphan.</strong> Confirmed independently in a fresh live run: <code>ps -o pid,ppid,pgid,sid</code> shows the orphan as pgid 1593823 / sid 1593772 while bridge and <code>claude</code> are pgid/sid 1581708, and the Claude Code binary spawns its Bash tool with <code>detached:!0</code>. The fix section is reordered: the cwd scan is now (1) and marked as the change that covers the reproduced case; the process-group fix is (2) with its scope stated explicitly. Root cause and "Deeper issue" were rewritten to match.</li>
    <li><strong>Minor — #1584 misattributed.</strong> Confirmed: <code>git blame</code> puts <code>runtime.shutdown()</code> before <code>workspace.destroy()</code> at <code>b04593eb87</code> (2026-03-24); #1584 only affects <code>threads.stop</code>; the bridge stayed alive through the retiring window in my re-run too. Related-issues entry, "Things I checked" bullet and repro step 6 corrected; the #1769 12h46m survival is now marked unexplained.</li>
    <li><strong>Minor — repro steps assumed the dev CLI/host id.</strong> Step 1 now says <code>bb</code> means <code>pnpm bb:dev</code>, shows <code>pnpm bb:dev machine list</code>, and step 2 says to substitute your own host id. Steps 2–6 were re-recorded from the revision run (<code>proj_46fcadffg4</code> / <code>thr_g3xmvwtd84</code> / <code>env_ig2nscwucq</code>) and <code>find-worktree-procs.sh</code> now prints pgid/sid.</li>
  </ul>
</main></body></html>''')

assert s != orig
open(p, "w", encoding="utf-8").write(s)
print("ok", len(s))
