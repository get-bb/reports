#!/usr/bin/env python3
"""Builds /tmp/bb-reports/issues/1529.html from the repro artifacts (escapes HTML)."""
import html, pathlib

R = pathlib.Path("/tmp/bb-reports/issues/1529/repro")
def esc(s): return html.escape(s, quote=False)
def file(name, limit=None):
    t = (R / name).read_text()
    if limit and len(t) > limit:
        t = t[:limit] + f"\n... [truncated, {len(t)-limit} more chars, see repro/{name}]"
    return esc(t)

BASE = "16ceb3a540f81c1189efaffb27a39b1d9443abf5"
def gh(path, a=None, b=None):
    u = f"https://github.com/get-bb/bb/blob/{BASE}/{path}"
    if a: u += f"#L{a}" + (f"-L{b}" if b else "")
    return u

acp_wire = "\n".join(l[:400] for l in (R/"acp-cursor-updates.ndjson").read_text().splitlines())
acp_false = "\n".join(l[:400] for l in (R/"acp-cursor-false-updates.ndjson").read_text().splitlines())
thread_log = (R/"bb-cursor-thread-log.txt").read_text()

CURSOR_EXCERPT = r'''// cursor-agent 2026.08.11-e8db854, index.js (minified; reformatted). BashState.execute — the
// persistent-shell executor behind the Shell tool. `n` = per-call options, `t` = command.
m = n?.workingDirectory ?? this.cwd;                     // (1) stored cwd from the last state dump
...
b = Ie(E, y, { env: p, stdio: [c ? "pipe" : "ignore", "pipe", "pipe", "pipe", "pipe"],
               cwd: m, detached: !0 }, I, n?.signal);   // (2) child_process.spawn(bash, ..., {cwd: m})
...
b.on("error", async (e) => { await k(); d.throw(e); });  // (3) spawn ENOENT -> throw into the output iterator
...
// on close, after a successful run, the state dump's first line ($PWD) becomes the new cwd:
const { cwd: n, rest: r } = be(t); this.state = r; n?.startsWith("/") && (this.cwd = n);   // (4)

// ZshState.execute is identical:  u = n?.workingDirectory ?? this.cwd; ... cwd: u ...
//   h.on("error", (e) => { o.throw(e) });   ...   n?.startsWith("/") && (this.state = r, this.cwd = n)

// Consumer (ShellExecutor foreground stream): the thrown error is not converted into an exit event
try {
  for await (const t of D) { ... else if ("exit" === t.type) { ... yield exit event ... } }
} catch (n) {
  if (!(n instanceof B.SandboxUnsupportedError)) throw n;   // (5) rethrown: no `exit` event ever emitted
  ...
}'''

NODE_OUT = '''$ node --version
v24.18.0
$ node repro/node-spawn-deleted-cwd.mjs
event: error  -> ENOENT spawn /bin/bash spawn /bin/bash ENOENT
event: close  -> code=-2 signal=null'''

doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1529 persistent shell session wedges silently when its stored cwd is deleted</title>
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
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; white-space:pre-wrap; word-break:break-word; }}
  a {{ color:var(--accent); }}
  .v {{ color:var(--ok); font-weight:600; }} .r {{ color:var(--high); font-weight:600; }} .u {{ color:var(--warn); font-weight:600; }}
  details summary {{ cursor:pointer; color:var(--muted); font-size:14px; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1529 · Persistent shell session wedges silently when its stored cwd is deleted (git worktree remove); all subsequent spawns return no exit status</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill high">Priority: High (agent-fleet outage)</span> <span class="pill">Effort: Small (bb side) / upstream</span>
    <span class="pill">workspaces</span> <span class="pill">provider: acp-cursor</span>
    <a href="https://github.com/get-bb/bb/issues/1529">open on GitHub</a>
    <span>investigated 2026-08-18</span>
    <span>base commit <code>{BASE[:9]}</code> (main)</span>
  </p>
  <p class="verdict">Verdict: <span class="pill ok">REPRODUCED</span> &nbsp; Root-cause confidence: <span class="pill ok">high</span> &nbsp; Owner: <strong>upstream Cursor CLI</strong> (bb ships it as <code>acp-cursor</code>); bb has a secondary bug that hides the failure.</p>

  <h2>1. TL;DR</h2>
  <p>The "persistent shell session" in the report is <strong>Cursor's <code>Shell</code> tool</strong> (bb provider <code>acp-cursor</code>, which launches <code>cursor-agent acp</code>). Neither the bb server nor the host daemon owns that shell: bb has no shell tool of its own for agents, and bb's ACP bridge advertises <code>terminal: false</code>. The wedge reproduces 100% with the raw <code>cursor-agent</code> CLI outside bb (2026.08.11-e8db854) and, identically, through a bb thread. Cursor's executor stores the cwd from the previous command's state dump and spawns every new command with <code>child_process.spawn(shell, ..., {{cwd: storedCwd}})</code>. Once that directory is deleted, Node emits <code>error: spawn /bin/bash ENOENT</code>; Cursor forwards it as a thrown error instead of an <code>exit</code> event, so the model gets <em>"The shell command returned no exit status…"</em>, and because the stored cwd is only updated after a <em>successful</em> state dump, it stays pointed at the dead directory forever. Passing <code>working_directory</code> bypasses the stored cwd, the run succeeds, and the state dump repoints the cwd, which is exactly the reporter's "override heals the session" observation.</p>
  <p>Codex, Claude Code and Grok Build (default tool set) are <strong>not</strong> affected: none of them re-spawn from a persisted cwd (Grok even logs "persistent shell cwd no longer exists; falling back to request working directory"). <strong>bb-side finding:</strong> for these failed calls Cursor's ACP adapter sends <code>tool_call_update {{status:"completed"}}</code> with no output, and bb's translator fabricates <code>exitCode: 0</code> from the status alone, so the bb timeline/CLI shows "Ran echo hi; git status — exit code 0" for a command that never ran. The same code path also reports <code>exit code 0</code> for Cursor commands that really exited non-zero (Cursor sends <code>status:"completed", rawOutput.exitCode: 1</code>).</p>

  <h2>2. Claims vs findings</h2>
  <table>
    <tr><th>Claim (issue)</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Deleting the persistent shell's stored cwd (<code>git worktree remove --force</code>) wedges the session; every subsequent command returns no exit status, no output, no error text</td><td class="v">Verified</td><td>Raw cursor-agent run: steps 3 and 4 return <code>spawnError: "The shell command returned no exit status, so its result is unknown…"</code> (repro/cursor-run.ndjson). Same in a bb acp-cursor thread (repro/bb-cursor-thread-log.txt). Note: the model does receive an error <em>sentence</em> from Cursor's server, but no exit code, no stdout/stderr, and no hint about the cwd.</td></tr>
    <tr><td>Reproduction is 100% reliable and disposable</td><td class="v">Verified</td><td>3/3 runs (stream-json CLI, ACP direct, through bb) wedged on the very next command.</td></tr>
    <tr><td>Nothing self-heals; only an explicit <code>working_directory</code> override recovers, and it fully heals the session with cwd persisted at the override target</td><td class="v">Verified</td><td>Step 5 (<code>pwd</code> with <code>workingDirectory=/tmp/bb1529/base</code>) succeeded; step 6 without override succeeded again with cwd <code>/tmp/bb1529/base</code>. Mechanism: <code>this.cwd</code> is rewritten from the state dump only after a successful spawn (Cursor executor, see §6).</td></tr>
    <tr><td>The fault is in the session-spawn path when the stored cwd no longer exists</td><td class="v">Verified</td><td>Node emits <code>spawn /bin/bash ENOENT</code> for a missing <code>cwd</code>; Cursor's <code>on("error")</code> handler throws into the output stream and no <code>exit</code> event is produced (repro/node-spawn-deleted-cwd.mjs + minified source excerpt).</td></tr>
    <tr><td>Wedges hit a "coordinator thread" and a "background session that inherited the removed worktree as cwd"; app restart recovered</td><td class="u">Unverified (plausible)</td><td>Cannot replay the incident. Consistent with the mechanism: any Cursor thread whose stored cwd is deleted wedges; a fresh <code>cursor-agent</code> process starts with a fresh cwd, which is what an app restart gives.</td></tr>
    <tr><td>Implicit: this is a bb bug ("bb app 0.37.0")</td><td class="r">Refuted (partly)</td><td>The shell is Cursor's; bb neither spawns nor tracks it (bb ACP bridge: <code>terminal:false</code>, <a href="{gh('plugins/provider-acp/src/bridge/agent-connection.ts',122)}">agent-connection.ts:122</a>). bb <em>does</em> mislabel the failed calls as <code>exit code 0</code> (§6b), which hides the failure from anyone watching the bb UI/CLI.</td></tr>
    <tr><td>Environment: macOS 25.5.0 Apple Silicon</td><td class="v">Verified as not OS-specific</td><td>Reproduced on Linux x86_64 with bash; the executor has identical logic for zsh (macOS default) and bash.</td></tr>
  </table>

  <h2>3. Environment</h2>
  <pre>bb: main @ {BASE} (worktree /home/sawyer/projects/bb/.claude/worktrees/wf_debcf606-e4a-14)
OS: Linux bee 7.0.0-29-generic x86_64 (Ubuntu), SHELL=/bin/bash
node: v24.18.0
cursor-agent: 2026.08.11-e8db854 (~/.local/share/cursor-agent/versions/2026.08.11-e8db854), model in runs: "Cursor Grok 4.6 High Fast" / auto
codex-cli 0.147.0 · claude 2.1.234 · grok 1.0.3 (1a29d5bc12)
bb dev instance: App http://localhost:12031 · Server http://localhost:20031 · Host daemon http://127.0.0.1:28031
data dir: /home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_debcf606-e4a-14-4bf7674784c2
bb project: proj_tau8244si4 ("qa", local_path /tmp/bb1529/base on host_4safbhghrf) · thread thr_pvxfiskgsx (acp-cursor)</pre>

  <h2>4. Minimal reproduction</h2>
  <h3>4a. Raw Cursor CLI (no bb involved) — proves the owner</h3>
  <ol>
    <li>Create a scratch repo with one worktree: <code>bash repro/setup.sh</code>
<pre>{file('setup.sh')}</pre></li>
    <li>Prompt (repro/prompt.txt) — one command per tool call, then a working-directory override:
<pre>{file('prompt.txt')}</pre></li>
    <li>Run headless cursor-agent with stream-json output: <code>bash repro/run-cursor.sh</code>
<pre>{file('run-cursor.sh')}</pre></li>
    <li><strong>Expected:</strong> steps 3–6 all print output with an exit code (or a clear "cwd no longer exists" error).<br>
        <strong>Actual</strong> (repro/cursor-run-summary.txt, condensed from cursor-run.ndjson):
<pre>{file('cursor-run-summary.txt')}</pre>
    The model's own final report (verbatim from cursor-run.ndjson):
<pre>Step 3: The shell command returned no exit status, so its result is unknown — do not assume it ran or succeeded. If this repeats, the execution environment may need to be restarted.  (no exit status shown)
Step 4: (same)
Step 5: Exit code: 0 / Command output: /tmp/bb1529/base / Command completed in 153 ms. / Shell state (cwd, env vars) persists for subsequent calls. Current directory: /tmp/bb1529/base
Step 6: Exit code: 0 / Command output: after-override / Command completed in 151 ms.</pre></li>
  </ol>

  <h3>4b. Through bb (acp-cursor thread) — same wedge, plus bb mislabels it</h3>
  <ol>
    <li>Start a dev instance (<code>scripts/bb-dev-app current</code>), create the project on the scratch repo (curl in the brief; here <code>proj_tau8244si4</code>).</li>
    <li><code>bash repro/run-bb-cursor.sh proj_tau8244si4</code> (spawns an <code>acp-cursor</code> thread with the same prompt, permission mode <code>full</code>), then <code>bb thread wait &lt;id&gt;</code> and <code>bb thread log &lt;id&gt; --format verbose</code>.</li>
    <li><strong>Actual</strong> (repro/bb-cursor-thread-log.txt): the commands that never ran are shown as <em>completed, exit code 0</em>, while the assistant text says "no exit status":
<pre>{esc(thread_log[thread_log.index('── Worked for'):thread_log.index('## Step 5')])}</pre></li>
  </ol>
  <figure><img src="assets/1529-bb-thread-report.png" alt="bb thread view: prompt, then assistant report saying steps 3 and 4 returned no exit status while steps 5 and 6 succeeded"><figcaption>bb app, thread thr_pvxfiskgsx (acp-cursor). The agent's report: steps 3/4 "returned no exit status", step 5 with the working-directory override succeeded, step 6 works again afterwards.</figcaption></figure>
  <figure><img src="assets/1529-bb-thread-commands.png" alt="bb thread view with the Worked-for section expanded: six 'Ran …' rows all rendered as normal completed commands, including 'Ran echo hi; git status' and 'Ran echo alive' which never executed"><figcaption>Same thread, "Worked for 39s" expanded: <code>Ran echo hi; git status</code> and <code>Ran echo alive</code> are rendered like every successful command (bb recorded <code>status: completed, exitCode: 0</code> for them — see event seq 73/83 in repro/bb-cursor-thread-events.json).</figcaption></figure>

  <h3>4c. Raw ACP wire (what bb actually receives)</h3>
  <p><code>bash repro/run-acp-cursor.sh</code> drives <code>cursor-agent acp</code> with a 60-line JSON-RPC client (repro/acp-client.mjs), the same process/args bb uses (<a href="{gh('packages/agent-runtime/src/acp-launch-specs.ts',14,24)}">acp-launch-specs.ts:14-24</a>). The two wedged calls complete with <em>no</em> <code>rawOutput</code>/<code>content</code>:</p>
<pre>{esc(acp_wire)}</pre>
  <p>Control: a genuinely failing command (<code>false</code>) is also reported as <code>status:"completed"</code>, with the real code only inside <code>rawOutput.exitCode</code>:</p>
<pre>{esc(acp_false)}</pre>

  <h3>4d. Unit-level repro of the bb-side half (fails on main)</h3>
  <p><code>plugins/provider-acp/src/issue-1529-repro.test.ts</code> (also saved as <a href="1529/repro/issue-1529-repro.test.ts">repro/issue-1529-repro.test.ts</a>). Run from <code>plugins/provider-acp</code>: <code>pnpm exec vitest run src/issue-1529-repro.test.ts</code>.</p>
<pre>{file('issue-1529-repro.test.ts')}</pre>
  <p>Result on main (repro/vitest-1529.txt): both assertions fail — <code>expected +0 to be undefined</code> (exit code fabricated for a call with no result) and <code>expected +0 to be 1</code> (real non-zero exit code from <code>rawOutput</code> ignored).</p>

  <h3>4e. Cross-provider control</h3>
  <table>
    <tr><th>Provider (raw CLI, same prompt)</th><th>Result</th><th>Artifact</th></tr>
    <tr><td>Cursor <code>cursor-agent</code> 2026.08.11</td><td class="r">Wedged after worktree removal; override heals</td><td>repro/cursor-run.ndjson</td></tr>
    <tr><td>Codex 0.147.0 (<code>codex exec</code>)</td><td class="v">Unaffected — every command runs in the workdir, exit_code 0</td><td>repro/codex-run.ndjson</td></tr>
    <tr><td>Claude Code 2.1.234 (<code>claude -p</code>)</td><td class="v">Unaffected — Bash tool refuses to leave the project ("Shell cwd was reset to /tmp/bb1529/base")</td><td>repro/claude-run.ndjson</td></tr>
    <tr><td>Grok Build 1.0.3 (<code>grok -p</code>, default <code>run_terminal_command</code>)</td><td class="v">Unaffected — falls back to the request working directory (binary string: "persistent shell cwd no longer exists; falling back to request working directory")</td><td>repro/grok-run.ndjson</td></tr>
  </table>

  <h2>5. Root cause</h2>
  <h3>5a. Upstream (Cursor CLI): stored cwd is trusted blindly and never repaired</h3>
  <p>Cursor's Shell tool is not a long-lived shell process. Each call spawns a fresh <code>bash</code>/<code>zsh</code>, replays an environment snapshot on fd 3, runs the command, and dumps a new snapshot (first line: <code>$PWD</code>) on fd 4. The executor keeps <code>this.cwd</code>/<code>this.state</code> between calls:</p>
<pre>{esc(CURSOR_EXCERPT)}</pre>
  <ol>
    <li>(1) The spawn cwd is the override if given, otherwise the persisted cwd.</li>
    <li>(2) Node's <code>spawn()</code> with a non-existent <code>cwd</code> fails at fork/exec time — <code>error</code> event with <code>ENOENT</code>, then <code>close(-2)</code>; there is no <code>spawn</code>/<code>exit</code> event. Verified:
<pre>{esc(NODE_OUT)}</pre></li>
    <li>(3)/(5) The <code>error</code> is thrown into the async output iterator; the consumer only converts <code>exit</code>-typed items into an exit event and rethrows anything except <code>SandboxUnsupportedError</code>. The tool call therefore ends without an exit event; Cursor's backend renders that as <em>"The shell command returned no exit status…"</em> (that string is not in the client binary).</li>
    <li>(4) <code>this.cwd</code> is only rewritten from a successful state dump. Because the spawn never succeeds, the dead cwd is sticky: <strong>every later call without an override fails the same way</strong>. An override spawns in a valid directory, the dump's <code>$PWD</code> becomes the new stored cwd, and the session is healed — exactly the reporter's discriminator.</li>
  </ol>
  <p>Why the reporter saw pure silence rather than an ENOENT: the ENOENT text is swallowed on the client (the <code>spawnError</code> that reaches the model has <code>command: ""</code>, <code>workingDirectory: ""</code> and only the generic sentence).</p>

  <h3>5b. bb: ACP status is turned into a fabricated exit code</h3>
  <p><a href="{gh('plugins/provider-acp/src/event-translation.ts',218,237)}">plugins/provider-acp/src/event-translation.ts:218-237</a> and <a href="{gh('plugins/provider-acp/src/event-translation.ts',268,289)}">:268-289</a>:</p>
<pre>...(status === "completed" || status === "failed"
  ? {{ exitCode: status === "failed" ? 1 : 0 }}
  : {{}}),</pre>
  <p>ACP's <code>tool_call_update</code> has no exit-code field, and Cursor reports both "no result" and "exited 1" as <code>status:"completed"</code>, so bb records <code>exitCode: 0</code> for both. <code>exitCode</code> is optional on the <code>commandExecution</code> item (<a href="{gh('packages/domain/src/provider-event.ts',317,331)}">provider-event.ts:317-331</a>), so nothing forces a value here. Cursor <em>does</em> ship <code>rawOutput.exitCode</code> on real completions, and bb already reads <code>rawOutput</code> for text (<code>extractAcpToolCallOutputText</code>), but ignores its exit code.</p>

  <h3>5c. Deeper issue</h3>
  <p>The class of failure — "workspace directory deleted under a running agent" — is systemic in bb workflows (worktree churn is the norm). Related open item <a href="https://github.com/get-bb/bb/issues/1647">#1647</a> / closed <a href="https://github.com/get-bb/bb/issues/1769">#1769</a> (processes left running with a cwd that no longer exists). bb cannot fix Cursor's executor, but it can stop hiding the failure and can give the agent a way out (see §6).</p>

  <h2>6. Proposed fix</h2>
  <h3>Upstream (file with Cursor; bb should reference the repro)</h3>
  <p>In <code>BashState.execute</code>/<code>ZshState.execute</code>: before spawning, <code>stat</code> the resolved cwd; if missing, fall back (request/session working directory, then nearest existing ancestor, then home), reset <code>this.cwd</code>, and prepend a warning line to the output ("shell working directory X no longer exists; running in Y"). Additionally convert the spawn <code>error</code> into an <code>exit</code> item with the ENOENT text and non-zero code so the model always gets a status. Grok Build already does exactly this ("falling back to request working directory").</p>
  <h3>bb (small, contained to <code>plugins/provider-acp/src/event-translation.ts</code>)</h3>
  <ol>
    <li>Add a helper <code>extractAcpExitCode(event)</code>: return <code>event.rawOutput.exitCode</code> when it is a finite number; otherwise <code>undefined</code>.</li>
    <li>In <code>translateAcpToolCallItem</code> and <code>completeAcpStartedToolItem</code>: use that value; if absent and <code>status === "failed"</code> keep the current <code>1</code>; if absent and <code>status === "completed"</code> <strong>omit <code>exitCode</code></strong> instead of writing <code>0</code>. Optionally, when a completed <code>execute</code> call has neither content nor <code>rawOutput</code>, map its status to <code>failed</code> so the timeline shows it as such (verify this does not misfire for agents that legitimately send empty completions — check the fake ACP agent fixtures in <code>plugins/provider-acp/src/bridge/</code>).</li>
    <li>Turn <code>issue-1529-repro.test.ts</code> into permanent tests (both assertions), and update the existing expectation at <code>event-translation.test.ts:520</code> if it relied on the fabricated 0. No protocol change (bb-internal translation only), so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump.</li>
    <li>Optional mitigation for the wedge itself, without touching the provider: bb's Cursor-specific instructions could tell the agent that if the Shell tool reports "returned no exit status", it should retry once with an explicit <code>working_directory</code> set to the workspace root. This is guidance, not a fix; keep it out of the server if product policy prefers not to special-case a provider.</li>
  </ol>
  <p>What could go wrong: other ACP agents may not populate <code>rawOutput.exitCode</code>; the change must degrade to "unknown" (omitted), never invent a code. UI code that assumes <code>exitCode</code> is present for completed commands should be checked (<code>packages/thread-view</code>, <code>apps/app</code> command rows) — the field is already optional in the schema.</p>

  <h2>7. PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>8. Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1647">#1647</a> Deleting a worktree environment leaves its processes running (open) — same "cwd deleted under a live agent" family.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1769">#1769</a> Deleting a worktree environment leaves its processes running with a cwd that no longer exists (closed 2026-08-18).</li>
    <li><a href="https://github.com/get-bb/bb/issues/1714">#1714</a> A tool call that completes in a later turn shows as pending — ACP tool-status translation neighbour.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1604">#1604</a> Idle agent processes are never reclaimed for non-Codex providers.</li>
  </ul>

  <h2>9. Appendix</h2>
  <details><summary>Commands run (chronological, condensed)</summary>
<pre>gh issue view 1529 --repo get-bb/bb --json ...
pnpm install --frozen-lockfile --prefer-offline ; pnpm exec turbo run build
grep -rn "working_directory|persistent shell|no exit status" (bb repo)          # no bb-owned shell tool
strings -n 20 ~/.grok/downloads/grok-linux-x86_64 &gt; /tmp/1529-grok-strings.txt  # found "Shell state (cwd, env vars) persists..." (Cursor tool profile) and grok's cwd fallback
grep -ao ... ~/.local/share/cursor-agent/versions/2026.08.11-e8db854/index.js    # BashState/ZshState executors, buildResult, foreground stream consumer
bash repro/setup.sh ; bash repro/run-grok.sh ; bash repro/run-cursor.sh ; bash repro/run-others.sh ; bash repro/run-claude.sh
node repro/node-spawn-deleted-cwd.mjs
scripts/bb-dev-app current ; curl -X POST $BB_SERVER_URL/api/v1/projects ... ; bash repro/run-bb-cursor.sh proj_tau8244si4
bb thread wait thr_pvxfiskgsx ; bb thread log thr_pvxfiskgsx --format verbose ; --json --limit 500
bash repro/run-acp-cursor.sh ; node repro/acp-client.mjs /tmp/bb1529/base repro/prompt-false.txt
dev-browser --headless run repro/shot*.js
cd plugins/provider-acp &amp;&amp; pnpm exec vitest run src/issue-1529-repro.test.ts
pnpm dev:stop</pre></details>
  <details><summary>repro/acp-client.mjs</summary><pre>{file('acp-client.mjs')}</pre></details>
  <details><summary>repro/node-spawn-deleted-cwd.mjs</summary><pre>{file('node-spawn-deleted-cwd.mjs')}</pre></details>
  <details><summary>repro/run-others.sh / run-claude.sh</summary><pre>{file('run-others.sh')}
{file('run-claude.sh')}</pre></details>
  <details><summary>Full bb thread log (repro/bb-cursor-thread-log.txt)</summary><pre>{esc(thread_log)}</pre></details>
  <details><summary>vitest output (repro/vitest-1529.txt)</summary><pre>{file('vitest-1529.txt')}</pre></details>
  <p class="meta">All artifacts: <a href="1529/repro/">1529/repro/</a> — cursor-run.ndjson, acp-cursor-updates.ndjson, acp-cursor-false-updates.ndjson, bb-cursor-thread-events.json, codex-run.ndjson, claude-run.ndjson, grok-run.ndjson.</p>
</main></body></html>
'''
pathlib.Path("/tmp/bb-reports/issues/1529.html").write_text(doc)
print("wrote", len(doc))
