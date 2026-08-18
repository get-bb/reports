import shutil
p='/tmp/bb-reports/issues/1654/build-report.py'
shutil.copy(p, '/tmp/bb-reports/issues/1654/verify/build-report.py.before-rev2')
s=open(p).read()
def rep(old,new,count=1):
    global s
    assert s.count(old)==count, (s.count(old), old[:80])
    s=s.replace(old,new)

# --- file loading: new logs
rep('''log_233 = esc("run-preserve-mtime-2.1.233.log")
''','''log_233 = esc("run-preserve-mtime-2.1.233.log")
log_sdk_default = esc("run-default-sdk-bundled-2.1.197.log")
log_sdk_mtime = esc("run-preserve-mtime-sdk-bundled-2.1.197.log")
restart = esc("bb-e2e-server-restart.txt")
''')

# --- TL;DR glosses
rep('''and that process memoizes the OAuth token it loaded at startup. The CLI only drops that memo before a request when it notices a change of the <b>mtime of <code>&lt;config dir&gt;/.credentials.json</code></b>,''',
'''and that process memoizes the OAuth token it loaded at startup (memoize = compute once, keep the value in memory and reuse it). The CLI only drops that memo before a request when it notices a change of the <b>mtime (last-modified timestamp) of <code>&lt;config dir&gt;/.credentials.json</code></b>,''')
rep('''<p>On this Linux machine with Claude Code 2.1.233 and 2.1.234 the plain scenario does <b>not</b> reproduce:''',
'''<p>On this Linux machine with the Claude Code binary bb actually spawns (<code>claude</code> on PATH, 2.1.234; also checked 2.1.233 and the Agent SDK's bundled 2.1.197) the plain scenario does <b>not</b> reproduce:''')

# --- claims table: restart verified directly
rep('''<tr><td>Restarting the bb server fixes it</td><td class="ok">Verified</td><td>A restart kills the host daemon's bridge subprocesses and their <code>claude</code> children; the next turn resumes the thread in a fresh process that reads the store at startup (repro Step 4: new process → token&nbsp;B). Also verified in bb:''',
'''<tr><td>Restarting the bb server fixes it</td><td class="ok">Verified</td><td>Done for real on a dev instance: thread <code>thr_kfwp7tkjf8</code> was served by <code>claude</code> pid 3753262; <code>pnpm dev:stop</code> + <code>scripts/bb-dev-app current</code> killed it with the host daemon, and the next <code>thread tell</code> on the same thread was served by a new pid 3756083 (<a href="1654/repro/bb-e2e-server-restart.txt">bb-e2e-server-restart.txt</a>). A new process reads the credential store at startup (repro Step 4: new process → token&nbsp;B). Also verified in bb:''')

# --- environment
rep('''<li>bb <code>16ceb3a54</code> (main, 2026-08-18), worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-14</code>.''',
'''<li>bb <code>16ceb3a54</code> (main, 2026-08-18), worktrees <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-14</code> (first pass) and <code>…/wf_570fde41-63f-9</code> (revision: repro re-run and server-restart check).''')
rep('''<code>@anthropic-ai/claude-agent-sdk</code> 0.3.197 (the version bb's plugin depends on).</li>''',
'''<code>@anthropic-ai/claude-agent-sdk</code> 0.3.197 (the version bb's plugin depends on). Note: the SDK also ships its <em>own</em> CLI (<code>@anthropic-ai/claude-agent-sdk-linux-x64</code> 0.3.197 = Claude Code <b>2.1.197</b>) and spawns it when <code>pathToClaudeCodeExecutable</code> is not set; bb never uses it — <code>resolveClaudeCodeExecutable</code> ({link('plugins/provider-claude-code/src/bridge/session-options.ts','session-options.ts')}) passes the PATH <code>claude</code>, confirmed by <code>ps</code> in both e2e transcripts (<code>/home/sawyer/.local/bin/claude …</code>). The repro script mirrors that (PATH <code>claude</code> by default, <code>REPRO_CLAUDE_BIN=sdk-bundled</code> for the SDK bundle).</li>''')
rep('''thread <code>thr_bdragpqzef</code>, host <code>host_pygkamp3h8</code>.</li>''',
'''thread <code>thr_bdragpqzef</code>, host <code>host_pygkamp3h8</code>. Second dev instance for the restart check: Server <code>:23805</code>, Host daemon <code>:31805</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_570fde41-63f-9-45ed1305f002</code>; project <code>proj_txeksunvpf</code> (<code>/tmp/bb1654-rev2-scratch</code>), thread <code>thr_kfwp7tkjf8</code>, host <code>host_ymk48rmi75</code>. Both instances were stopped and their data dirs deleted afterwards.</li>''')

# --- minimal repro
rep('''<p>The repro drives the Claude Agent SDK exactly the way bb's <code>SdkSession</code> does (streaming-input <code>query()</code>, one process, several turns) against a local mock of the Anthropic API that logs the <code>Authorization</code> header and answers 429 for token&nbsp;A and a normal SSE reply for token&nbsp;B.''',
'''<p>The repro drives the Claude Agent SDK exactly the way bb's <code>SdkSession</code> does (streaming-input <code>query()</code>: one <code>claude</code> process whose stdin receives every follow-up message, so one process serves several turns) against a local mock of the Anthropic API that logs the <code>Authorization</code> header and answers 429 (rate limited) for token&nbsp;A and a normal SSE reply (Server-Sent Events, the streaming HTTP response format the real API uses) for token&nbsp;B. It spawns the same binary bb does: <code>claude</code> on PATH (2.1.234 here), overridable with <code>REPRO_CLAUDE_BIN=&lt;path&gt;</code>; <code>REPRO_CLAUDE_BIN=sdk-bundled</code> uses the SDK's bundled 2.1.197 for comparison only.''')
rep('''<li>Plain flow (login rewrites the credentials file): <code>node plugins/provider-claude-code/repro-1654.mjs</code>. <b>Expected</b> (and observed): turn 2 on the live process already uses token&nbsp;B → exit&nbsp;0, "NOT reproduced".</li>''',
'''<li>Plain flow (login rewrites the credentials file): <code>node plugins/provider-claude-code/repro-1654.mjs</code> (prints which binary it runs; 2.1.234 retries the 429 ten times with backoff, so the first turn takes ~2–3&nbsp;min). <b>Expected</b> (and observed): turn 2 on the live process already uses token&nbsp;B → exit&nbsp;0, "NOT reproduced".</li>''')
rep('''<li>Optional: <code>REPRO_CLAUDE_BIN=~/.local/share/claude/versions/2.1.233 REPRO_MODE=preserve-mtime node …</code> to run against another CLI version (2.1.233 retries a 429 ten times with backoff, so it takes several minutes).</li>
  </ol>''',
'''<li>Optional: <code>REPRO_CLAUDE_BIN=~/.local/share/claude/versions/2.1.233 REPRO_MODE=preserve-mtime node …</code> for another CLI version (<a href="1654/repro/run-preserve-mtime-2.1.233.log">run-preserve-mtime-2.1.233.log</a>, same result), or <code>REPRO_CLAUDE_BIN=sdk-bundled</code> for the SDK's own 2.1.197 (<a href="1654/repro/run-default-sdk-bundled-2.1.197.log">default</a>, <a href="1654/repro/run-preserve-mtime-sdk-bundled-2.1.197.log">preserve-mtime</a>; identical verdicts, that build just does not retry the 429). <a href="1654/repro/run-all.py">run-all.py</a> runs all five variants and writes these logs.</li>
  </ol>''')
rep('''<h3>Output of step 4 (the pinned-token case), Claude Code 2.1.234</h3>''','''<h3>Output of step 4 (the pinned-token case), Claude Code 2.1.234 (<a href="1654/repro/run-preserve-mtime-2.1.234.log">run-preserve-mtime-2.1.234.log</a>)</h3>''')
rep('''<h3>Output of step 3 (plain file rewrite, not reproduced), Claude Code 2.1.234</h3>''','''<h3>Output of step 3 (plain file rewrite, not reproduced), Claude Code 2.1.234 (<a href="1654/repro/run-default-2.1.234.log">run-default-2.1.234.log</a>)</h3>''')

# --- e2e section: add restart transcript
rep('''<h3>bb end-to-end: the provider process really is long-lived</h3>''','''<h3>bb end-to-end: the provider process really is long-lived, and a bb restart replaces it</h3>''')
old_e2e_p = s[s.index('<p>On a dev instance at <code>16ceb3a54</code> I spawned'):]
old_e2e_p = old_e2e_p[:old_e2e_p.index('</p>')+4]
rep(old_e2e_p, old_e2e_p + '''
  <p>Second e2e check (revision): the same flow, but with a real bb restart in between (<a href="1654/repro/bb-e2e-server-restart.txt">bb-e2e-server-restart.txt</a>): <code>pnpm dev:stop</code> killed the host daemon and with it <code>claude</code> pid 3753262; after <code>scripts/bb-dev-app current</code> the next message on the same thread was served by a new pid 3756083. That is the "restart bb" step from the issue, done rather than inferred.</p>
  <pre>{restart}</pre>''')

# --- root cause glosses
rep('''<code>getClaudeAIOAuthTokens</code> (<code>ua = iu(() =&gt; … al().read()?.claudeAiOauth …)</code>) and its async twin are memoized. Before each API request''',
'''<code>getClaudeAIOAuthTokens</code> (<code>ua = iu(() =&gt; … al().read()?.claudeAiOauth …)</code>) and its async twin are memoized (wrapped in a cache: the first call reads the store, later calls return the remembered value until <code>.cache.clear()</code>). Before each API request''')
rep('''treat that flag like <code>streamEnded</code>: settle, <code>emitSessionReplacement</code>, and <code>start(providerThreadId)</code> a fresh SDK session''',
'''treat that flag like <code>streamEnded</code>: settle the old session (finish/close it and resolve anything waiting on it), <code>emitSessionReplacement</code> (the existing notification that tells the server a new process now backs this thread), and <code>start(providerThreadId)</code> a fresh SDK session''')

# --- related issues: correct changelog claim
rep('''<li>Claude Code changelog 2.1.234: usage-limit 429s are no longer retried in-process (1 call vs 11 in 2.1.233), and "continue automatically at usage limit" was added; neither invalidates the token cache.</li>''',
'''<li>Claude Code changelog 2.1.234: "Claude Code now continues your session automatically when a claude.ai usage limit resets" — this does not invalidate the token cache. (Correction from the first draft: the real 2.1.234 binary still retries a usage-limit 429 ten times in-process, exactly like 2.1.233; the "single call" behaviour seen earlier belonged to the SDK-bundled 2.1.197, which bb does not run.)</li>''')

# --- appendix commands
rep('''node plugins/provider-claude-code/repro-1654.mjs                                    # -> run-default-2.1.234.log
REPRO_MODE=success-first node plugins/provider-claude-code/repro-1654.mjs           # 200 on turn 1: still reloads on turn 2 (Linux)
REPRO_MODE=preserve-mtime node plugins/provider-claude-code/repro-1654.mjs          # -> run-preserve-mtime-2.1.234.log (BUG REPRODUCED)
REPRO_CLAUDE_BIN=~/.local/share/claude/versions/2.1.233 node plugins/provider-claude-code/repro-1654.mjs   # 11 calls per 429 turn, reloads on turn 2
REPRO_MODE=preserve-mtime REPRO_CLAUDE_BIN=~/.local/share/claude/versions/2.1.233 node …                # -> run-preserve-mtime-2.1.233.log''',
'''node plugins/provider-claude-code/repro-1654.mjs                                    # PATH claude 2.1.234 -> run-default-2.1.234.log
REPRO_MODE=success-first node plugins/provider-claude-code/repro-1654.mjs           # 200 on turn 1: still reloads on turn 2 (Linux)
REPRO_MODE=preserve-mtime node plugins/provider-claude-code/repro-1654.mjs          # -> run-preserve-mtime-2.1.234.log (BUG REPRODUCED)
REPRO_CLAUDE_BIN=~/.local/share/claude/versions/2.1.233 node plugins/provider-claude-code/repro-1654.mjs   # 11 calls per 429 turn, reloads on turn 2
REPRO_MODE=preserve-mtime REPRO_CLAUDE_BIN=~/.local/share/claude/versions/2.1.233 node …                # -> run-preserve-mtime-2.1.233.log
REPRO_CLAUDE_BIN=sdk-bundled node …  /  REPRO_MODE=preserve-mtime REPRO_CLAUDE_BIN=sdk-bundled node …  # SDK's own 2.1.197 -> run-*-sdk-bundled-2.1.197.log
python3 /tmp/bb-reports/issues/1654/repro/run-all.py plugins/provider-claude-code/repro-1654.mjs         # all five of the above, writes the logs''')
rep('''pnpm bb:dev thread stop thr_bdragpqzef --json ; tell again ; pstree again   # new claude pid''',
'''pnpm bb:dev thread stop thr_bdragpqzef --json ; tell again ; pstree again   # new claude pid
# revision (second worktree/instance): server-restart check
node packages/scripts/dist/commands/run-cli.js thread spawn --project proj_txeksunvpf --provider claude-code --permission-mode accept-edits --title "1654 restart check" --prompt "Reply only with ok." --json ; thread wait
pstree -p -T &lt;host daemon pid&gt; | grep claude ; ps -o pid,ppid,etimes,lstart,args -p &lt;bridge&gt;,&lt;claude&gt;
pnpm dev:stop ; scripts/bb-dev-app current ; thread tell thr_kfwp7tkjf8 "Reply only with ok." ; thread wait ; pstree again   # new claude pid 3756083''')
rep('''<h3>Claude Code CLI credential-cache excerpts (2.1.234 linux, 2.1.234/2.1.233 darwin)</h3>''',
'''<h3>Claude Code CLI credential-cache excerpts (2.1.234 linux, 2.1.234/2.1.233 darwin) (<a href="1654/repro/claude-cli-credential-cache-excerpts.txt">file</a>)</h3>''')
rep('''<h3>2.1.233 preserve-mtime run (same result: 11 retried calls per 429 turn, live process pinned to token A, new process uses token B)</h3>
  <pre>{log_233}</pre>
</main></body></html>''',
'''<h3>2.1.233 preserve-mtime run (<a href="1654/repro/run-preserve-mtime-2.1.233.log">run-preserve-mtime-2.1.233.log</a>; same result: 11 retried calls per 429 turn, live process pinned to token A, new process uses token B)</h3>
  <pre>{log_233}</pre>
  <h3>SDK-bundled Claude Code 2.1.197 (not what bb runs; comparison only)</h3>
  <p>Default (<a href="1654/repro/run-default-sdk-bundled-2.1.197.log">run-default-sdk-bundled-2.1.197.log</a>): NOT reproduced, 1 call per 429 turn. Preserve-mtime (<a href="1654/repro/run-preserve-mtime-sdk-bundled-2.1.197.log">run-preserve-mtime-sdk-bundled-2.1.197.log</a>): BUG REPRODUCED. Same verdicts as 2.1.233/2.1.234; the only difference is that this build does not retry the 429 in-process.</p>
  <pre>{log_sdk_mtime}</pre>

  <h2>Verification</h2>
  <p>An independent verifier followed the repro steps literally in a fresh worktree at <code>16ceb3a54</code> and got the same verdicts (plain → exit 0 NOT reproduced; preserve-mtime → exit 1 BUG REPRODUCED), reproduced the same-pid / <code>bb thread stop</code> → new-pid e2e on their own dev instance, confirmed the CLI excerpts against <code>strings</code> of the linux 2.1.234 and darwin binaries, checked all permalinks, and confirmed origin/main (<code>16ceb3a54..a108fa7ef</code>) contains no fix. They found one substantive error: the first draft's default runs did not use Claude Code 2.1.234 — without <code>pathToClaudeCodeExecutable</code> the Agent SDK spawns its own bundled CLI (2.1.197), so the two "2.1.234" logs were mislabeled and the derived claim that 2.1.234 "no longer retries usage-limit 429s (1 call vs 11)" was wrong. Changes in this revision:</p>
  <ul>
    <li>The repro script now resolves the binary the way bb does (PATH <code>claude</code>, override with <code>REPRO_CLAUDE_BIN</code>, <code>sdk-bundled</code> for the SDK CLI) and prints the binary and <code>claude --version</code> at the top; <code>run-default-2.1.234.log</code> and <code>run-preserve-mtime-2.1.234.log</code> were regenerated with the real 2.1.234 (11 calls per 429 turn; verdicts unchanged), and the 2.1.197 runs were saved under their own names.</li>
    <li>Excerpts §4, the Related-issues changelog entry and the Environment section were corrected: 2.1.233 and 2.1.234 both retry a 429 ten times; none of the three versions invalidates the token cache on 429.</li>
    <li>"Restarting the bb server fixes it" is now verified directly (real <code>pnpm dev:stop</code>/restart, new <code>claude</code> pid on the same thread, <code>bb-e2e-server-restart.txt</code>) instead of by proxy.</li>
    <li>All repro artifacts are linked (2.1.233 log, <code>run-all.py</code>, new logs); short glosses added for mtime, memoize, streaming input, SSE, settle/emitSessionReplacement.</li>
  </ul>
</main></body></html>''')
open(p,'w').write(s)
print("ok")
