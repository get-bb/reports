#!/usr/bin/env python3
"""Assemble /tmp/bb-reports/issues/1770.html from the template + escaped repro artifacts."""
import html, pathlib

R = pathlib.Path("/tmp/bb-reports/issues/1770/repro")
def esc(p): return html.escape((R / p).read_text())

test_src = esc("issue-1770-local-base-branch.test.ts")
unit_out = esc("unit-test-main.out")
setup_out = esc("1770-setup-repos.out")
main_res = esc("spawn-main-result.out")
main2_res = esc("spawn-main2-result.out")
default_res = esc("spawn-default-result.out")
origin_res = esc("spawn-origin-result.out")
setup_sh = esc("1770-setup-repos.sh")
inspect_sh = esc("1770-inspect.sh")

BASE = "https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/"
def L(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="{BASE}{path}{frag}">{path}{frag.replace("#","#")}</a>'

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1770 --base-branch resolves against the stale local ref</title>
<style>
  :root {{ --canvas:#fafaf8; --ink:#1a1a1a; --muted:#666; --line:#e2e2de; --accent:#0052cc; --high:#b60205; --ok:#0e8a16; --warn:#b26a00; --med:#d4a72c; }}
  body {{ margin:0; background:var(--canvas); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; }}
  main {{ max-width:900px; margin:0 auto; padding:40px 24px 80px; }}
  h1 {{ font-size:26px; line-height:1.25; margin:0 0 6px; }}
  h2 {{ font-size:18px; margin:36px 0 10px; padding-top:20px; border-top:1px solid var(--line); }}
  h3 {{ font-size:15px; margin:22px 0 6px; }}
  .meta {{ color:var(--muted); font-size:14px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }}
  .pill {{ display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); }}
  .pill.high {{ background:var(--high); color:#fff; border-color:var(--high); }}
  .pill.med {{ background:var(--med); color:#1a1a1a; border-color:var(--med); }}
  .verdict {{ font-weight:600; }}
  .v-repro {{ color:var(--high); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:6px; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1770 · --base-branch resolves against the stale local ref, so spawned worktrees silently start behind</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill med">Medium</span> <span class="pill">Effort: Small</span>
    <span class="pill">cli</span> <span class="pill">workspaces</span>
    <a href="https://github.com/get-bb/bb/issues/1770">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> A bb "managed worktree" is a fresh <code>git worktree</code> that bb creates next to your project checkout so an agent can work on its own branch. When you spawn a thread with <code>bb thread spawn --new-environment worktree --base-branch main</code>, the string <code>main</code> travels unchanged from the CLI, through the server, to the host daemon, which finally runs <code>git worktree add -B &lt;new-branch&gt; &lt;dir&gt; main</code>. Git resolves a bare <code>main</code> to the <em>local</em> branch <code>refs/heads/main</code> in the project checkout. Nothing on this path runs <code>git fetch</code>, and nothing compares local <code>main</code> with <code>origin/main</code>. So if the project checkout has not been pulled in a while, every spawned worktree starts on that old commit and the CLI prints nothing about it.</p>
  <p>I reproduced this exactly on my dev instance: with a project checkout whose local <code>main</code> was one commit behind its remote, <code>--base-branch main</code> produced a worktree at the stale commit (twice: once before and once after the remote-tracking ref had been refreshed), while omitting <code>--base-branch</code> or passing <code>--base-branch origin/main</code> both produced a worktree at the remote tip and showed a "Fetching origin/main" step in the provisioning transcript. A two-case vitest at the exact daemon code path (<code>createWorktree</code>) fails on the base commit for <code>main</code> and passes for <code>origin/main</code>.</p>
  <p>The irony is that bb already has the right behaviour, just not for this flag: the <em>default</em> (no <code>--base-branch</code>) path asks the daemon to fetch, compares local vs origin default branch, and picks <code>origin/&lt;default&gt;</code> when local is behind; and a remote-qualified name (<code>origin/main</code>) is fetched immediately before <code>git worktree add</code>. A plain branch name is the one input that gets neither treatment. This is not a regression: the fetch logic was added in June 2026 (commits <code>36450e50c</code>, <code>7d3a1a9de</code>) deliberately for remote-qualified names only, and no commit on <code>origin/main</code> after the base commit touches it, so the bug is still present.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td><code>--base-branch main</code> creates the worktree from local <code>main</code> without fetching</td><td class="ok">Verified</td><td>Live repro (thr_vvsz3czv3d, thr_k8a4h2we5k): worktree HEAD = local <code>main</code> (A), remote is at B; provisioning transcript has no <code>git-fetch-*</code> step. Code: <code>createWorktree</code> only fetches when the name contains a remote prefix ({L("packages/host-workspace/src/provisioning.ts",250,279)}).</td></tr>
    <tr><td>Nothing warns the caller / no resolved base commit printed</td><td class="ok">Verified (mostly)</td><td><code>bb thread spawn --json</code> prints only the thread record (no environment, no SHA). The provisioning transcript in the app and in the thread event log does contain <code>Using branch: … (4f3c21b)</code> — a short SHA, but no comparison against the remote and nothing on the CLI's stdout.</td></tr>
    <tr><td>Reproduced on bb 0.38.0</td><td class="unv">Unverifiable, but consistent</td><td>I tested at <code>16ceb3a54</code> (main, 2026-08-18) and code paths match; the behaviour is unchanged since <code>7d3a1a9de</code> (June 2026), which predates 0.38.0.</td></tr>
    <tr><td>7 of 12 checkouts on the reporter's machine were behind by up to 89 commits</td><td class="unv">Unverifiable</td><td>Reporter's local measurement; not needed to reproduce the mechanism.</td></tr>
    <tr><td>Anecdote: worker on a 65-commit-stale main would have ported shorter test files and left 6 assertions out</td><td class="unv">Unverifiable</td><td>Plausible consequence; not reproduced.</td></tr>
    <tr><td>Implicit: this is the only base-branch path affected</td><td class="no">Refuted</td><td>Omitting <code>--base-branch</code> is <em>not</em> affected (smart default picks <code>origin/main</code> when local is behind, verified: thr_j372x3cj2f). <code>--base-branch origin/main</code> is fetched and fresh (thr_cvhxdu946z). Only plain local names hit the bug. Automations (<code>bb automation create … --base-branch</code>) and the SDK/API <code>baseBranch: {{kind:"named"}}</code> share the same path.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18), worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-1</code> checked out detached at the base commit. Note: the worktree was handed to me at <code>a108fa7ef</code> (origin/main, 5 commits later); I moved back to <code>16ceb3a54</code> before running the live repro. None of the intervening commits touch the files involved (<code>git log 16ceb3a54..origin/main -- packages/host-workspace/src/provisioning.ts apps/server/src/services/projects/worktree-base-branch.ts apps/server/src/services/threads/thread-create.ts apps/cli/src/commands/thread/spawn.ts</code> is empty).</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, git (system), codex-cli 0.147.0 (provider <code>codex</code>, model gpt-5.6-sol; each turn was "Reply only with ok.")</li>
    <li>Dev instance: app <code>:17232</code>, server <code>:25232</code>, host daemon <code>:33232</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-1-58cb0d589e3c</code>, host <code>host_hs77scf38b</code>, project <code>proj_pwhvqn62tm</code> (local path <code>/tmp/1770-qa</code>).</li>
    <li>Threads: <code>thr_vvsz3czv3d</code> (--base-branch main, env <code>env_gaysy9znea</code>), <code>thr_j372x3cj2f</code> (no --base-branch, env <code>env_3sntf792nd</code>), <code>thr_k8a4h2we5k</code> (--base-branch main again after origin/main was refreshed, env <code>env_6vvjdyw44i</code>), <code>thr_cvhxdu946z</code> (--base-branch origin/main, env <code>env_6pme5rgfem</code>).</li>
    <li>CLI wrapper: <a href="1770/repro/1770-bb.sh">1770/repro/1770-bb.sh</a> (<code>BB_REPO=&lt;your bb worktree&gt; ./1770-bb.sh &lt;args&gt;</code>; evaluates <code>scripts/bb-dev-app env</code> and runs <code>packages/scripts/dist/commands/run-cli.js</code>). Below, <code>bb</code> means this wrapper.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. Unit-level (no dev instance, ~1 s): the daemon function that runs <code>git worktree add</code></h3>
  <p>File: <a href="1770/repro/issue-1770-local-base-branch.test.ts">1770/repro/issue-1770-local-base-branch.test.ts</a>. Copy it to <code>packages/host-workspace/test/</code> and run it from <code>packages/host-workspace</code>. It builds a bare "origin", a local checkout at commit A, pushes commit B to origin from a second clone (so the checkout is 1 behind), then calls <code>createWorktree</code> exactly as the host daemon does for <code>bb thread spawn --base-branch main</code>. The first test <b>fails on the base commit</b> at line 91: <code>origin/main</code> in the checkout is still A after provisioning (no fetch was run), and (line 92, not reached) the worktree HEAD is A, not B. The second test is a control that passes: <code>baseBranch: "origin/main"</code> is fetched and lands on B.</p>
  <pre>{test_src}</pre>
  <pre>$ cd packages/host-workspace &amp;&amp; pnpm exec vitest run test/issue-1770-local-base-branch.test.ts
{unit_out}</pre>

  <h3>B. End to end with the CLI (needs a running dev instance and one tiny codex turn per spawn)</h3>
  <ol>
    <li>Build and start your instance: <code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code>. Then <code>export BB_REPO=$PWD</code>.</li>
    <li>Create a checkout that is one commit behind its remote: <a href="1770/repro/1770-setup-repos.sh">1770/repro/1770-setup-repos.sh</a>.
<pre>$ /tmp/bb-reports/issues/1770/repro/1770-setup-repos.sh
{setup_out}</pre></li>
    <li>Register it as a project (host id from <code>bb machine list --json</code>):
<pre>$ curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
    -d '{{"name":"qa-1770","source":{{"type":"local_path","path":"/tmp/1770-qa","hostId":"host_hs77scf38b"}}}}'
{{"id":"proj_pwhvqn62tm", … "gitRemoteUrl":"/tmp/1770-remote.git", …}}</pre></li>
    <li>Spawn with an explicit local base branch (what the issue does):
<pre>$ bb thread spawn --project proj_pwhvqn62tm --new-environment worktree --base-branch main \\
    --provider codex --permission-mode accept-edits --title "1770 base-branch main" --prompt "Reply only with ok." --json
{{ "id": "thr_vvsz3czv3d", "environmentId": null, "status": "starting", … }}     # nothing about the base commit
$ bb thread show thr_vvsz3czv3d --json | grep -E '"path"|baseBranch'
    "path": "…/worktrees/env_gaysy9znea/1770-qa",
    "baseBranch": "main",</pre></li>
    <li>Compare the worktree with the refs (<a href="1770/repro/1770-inspect.sh">1770/repro/1770-inspect.sh</a>):
<pre>$ /tmp/bb-reports/issues/1770/repro/1770-inspect.sh &lt;path from thread show&gt;
{main_res}</pre>
    <b>Expected</b>: the worktree starts at B (<code>a27e3eb</code>, the commit on the remote), or at least the checkout's <code>origin/main</code> is refreshed and the caller is told the base is behind. <b>Actual</b>: worktree HEAD is A (<code>4f3c21b</code>), <code>remote.txt</code> is missing, <code>origin/main</code> in the checkout was not even refreshed (still A) — no fetch happened at all.</li>
    <li>Provisioning transcript for that thread (from <code>system/thread-provisioning</code> events; also visible in the app under "Provisioned thread"): no fetch step, straight to <code>git worktree add</code>. Raw JSON: <a href="1770/repro/spawn-main-provisioning-transcript.txt">spawn-main-provisioning-transcript.txt</a>.
<pre>Preparing worktree
Creating worktree
HEAD is now at 4f3c21b A: initial
Preparing worktree (new branch 'bb/1770-base-branch-main-thr_vvsz3czv3d')
Created worktree
Using workspace: …/worktrees/env_gaysy9znea/1770-qa
Using branch: bb/1770-base-branch-main-thr_vvsz3czv3d (4f3c21b)</pre></li>
  </ol>
  <figure>
    <img src="assets/1770-transcript-base-branch-main.png" alt="Thread spawned with --base-branch main: provisioning transcript with no fetch step and HEAD at 4f3c21b">
    <figcaption><b>Bug.</b> Thread <code>1770 base-branch main</code> in the app with the "Provisioned thread" row expanded. Look at the transcript: there is no "Fetching" line, and <code>HEAD is now at 4f3c21b A: initial</code> — the stale local commit. Nothing says the remote is ahead.</figcaption>
  </figure>

  <h3>Controls (same project, same moment)</h3>
  <p><b>C1. Omit <code>--base-branch</code></b> → the server's smart default resolves to <code>origin/main</code> (the transcript shows "Fetching origin/main"), and the worktree is at B. Output: <a href="1770/repro/spawn-default-result.out">spawn-default-result.out</a>, transcript <a href="1770/repro/spawn-default-provisioning-transcript.txt">spawn-default-provisioning-transcript.txt</a>.</p>
  <pre>{default_res}</pre>
  <figure>
    <img src="assets/1770-transcript-default-base.png" alt="Thread spawned without --base-branch: transcript shows Fetching origin/main and HEAD at a27e3eb">
    <figcaption><b>Control.</b> Same project, no <code>--base-branch</code>. Compare with the previous screenshot: the transcript now shows <code>Fetching origin/main</code> / <code>Fetched origin/main</code> and <code>HEAD is now at a27e3eb B: pushed by someone else</code>.</figcaption>
  </figure>
  <p><b>C2. <code>--base-branch main</code> again, now that C1's fetch has refreshed <code>origin/main</code> in the checkout</b> (this is precisely the reporter's state: local main 583ce1f, origin/main c319d1a "3 ahead"). Still stale — the flag reads local <code>main</code> regardless of what the remote-tracking ref says. Output: <a href="1770/repro/spawn-main2-result.out">spawn-main2-result.out</a>.</p>
  <pre>{main2_res}</pre>
  <p><b>C3. <code>--base-branch origin/main</code></b> → fetched, fresh (B). Output: <a href="1770/repro/spawn-origin-result.out">spawn-origin-result.out</a>.</p>
  <pre>{origin_res}</pre>

  <h2>Root cause</h2>
  <p><b>The string is passed through untouched.</b> The CLI wraps the flag as <code>{{ kind: "named", name: "main" }}</code> ({L("apps/cli/src/commands/thread/spawn.ts",108,112)}). On the server, <code>resolveManagedDefaultBaseBranchForCreate</code> returns early for a named spec — the "smart" resolution (fetch + compare local vs origin default) only runs for <code>{{ kind: "default" }}</code> ({L("apps/server/src/services/threads/thread-create.ts",378,397)}):</p>
  <pre>async function resolveManagedDefaultBaseBranchForCreate(deps, args): Promise&lt;BaseBranchSpec&gt; {{
  if (args.baseBranch.kind === "named") {{
    return args.baseBranch;                       // &lt;-- "main" is not inspected
  }}
  … callHostRetryableOnlineRpc({{ type: "host.list_branches", … }})   // daemon runs `git fetch --all --prune` here
  return resolveManagedDefaultBaseBranchSpec(result);                  // picks origin/&lt;default&gt; when local is behind
}}</pre>
  <p>The smart default policy lives in <code>resolveDefaultWorktreeBaseBranch</code> ({L("apps/server/src/services/projects/worktree-base-branch.ts",10,26)}): when <code>defaultBranchRelation</code> is <code>equal</code> or <code>local-behind</code> it returns <code>originDefaultBranch</code> (e.g. <code>origin/main</code>), which is why the no-flag control was fresh. <code>baseBranchSpecToStoredName</code> then flattens the spec to a plain string for the daemon command ({L("apps/server/src/services/threads/thread-create-helpers.ts",24,28)}, {L("apps/server/src/services/threads/thread-create-helpers.ts",135,146)}).</p>
  <p><b>The daemon fetches only remote-qualified names.</b> In <code>createWorktree</code> ({L("packages/host-workspace/src/provisioning.ts",364,388)}) the base is used verbatim as the start point of <code>git worktree add -B &lt;branch&gt; &lt;target&gt; &lt;base&gt;</code>. Just before, <code>fetchRemoteBaseBranch</code> is called, but it delegates to <code>resolveRemoteBaseBranch</code>, which returns <code>null</code> (skip) for any name without a <code>/</code> or whose prefix is not a configured remote ({L("packages/host-workspace/src/provisioning.ts",250,279)}):</p>
  <pre>async function resolveRemoteBaseBranch(sourcePath, baseBranch, signal) {{
  if (!baseBranch.includes("/")) {{
    return null;                                  // &lt;-- "main": no fetch, no comparison
  }}
  const remotes = (await runGit(["remote"], …)).stdout…;
  const matchingRemotes = remotes.filter((remote) =&gt; baseBranch.startsWith(`${{remote}}/`) …);
  …
}}
…
await fetchRemoteBaseBranch({{ sourcePath, baseBranch, … }});      // no-op for "main"
const gitArgs = ["worktree", "add", "-B", args.branchName, args.targetPath, baseBranch];   // git resolves "main" -&gt; refs/heads/main</pre>
  <p>Git's ref resolution order for a bare name is <code>refs/&lt;name&gt;</code>, <code>refs/tags/&lt;name&gt;</code>, <code>refs/heads/&lt;name&gt;</code>, <code>refs/remotes/&lt;name&gt;</code>… so as long as a local branch <code>main</code> exists (it always does for a project checkout on <code>main</code>), <code>origin/main</code> is never considered, even when the remote-tracking ref is already ahead (control C2).</p>
  <p><b>Why nothing warns.</b> The only place the resolved commit surfaces is the daemon's transcript step <code>Using branch: &lt;branch&gt; (&lt;short sha&gt;)</code>, which is stored in <code>system/thread-provisioning</code> events and shown in the app; the CLI's <code>thread spawn</code> prints the thread record only, and <code>bb thread show</code> / <code>bb environment show</code> report <code>baseBranch: "main"</code> as a name, never as a commit or a relation to the remote. There is no "behind" check anywhere on the named path.</p>
  <p><b>History.</b> <code>36450e50c</code> (#153, "Always seed new worktrees from the fresh remote default") introduced the smart default and the <code>list_branches</code> fetch; <code>7d3a1a9de</code> ("Fetch remote base before creating worktree") added the pre-<code>worktree add</code> fetch for remote-qualified names only, with a regression test using <code>origin/main</code>. Explicit local names were left alone by design; the issue is that the design surprises users, and the docs (<code>docs/worktrees.md</code>: "Pass <code>--base-branch &lt;name&gt;</code> only when you need a specific base") and the CLI help ("Base branch for new managed worktrees") do not say that a bare name means the local branch as-is with no fetch.</p>
  <p><b>Deeper issue.</b> Base-branch semantics differ per path: default → fetched, remote-preferred; <code>origin/x</code> → fetched; <code>x</code> → local, unfetched. Anything that names a branch (CLI <code>--base-branch</code>, automations <code>--base-branch</code>, SDK <code>baseBranch: {{kind:"named"}}</code>, and forks which pass the source environment's local branch name in {L("apps/server/src/services/threads/thread-fork.ts",85,96)}) inherits the third behaviour.</p>

  <h2>Proposed fix (first principles)</h2>
  <ol>
    <li><b>Make a plain <code>--base-branch &lt;name&gt;</code> get the same treatment as the default.</b> In <code>resolveManagedDefaultBaseBranchForCreate</code> (server, {L("apps/server/src/services/threads/thread-create.ts",378,397)}), do not return early for <code>named</code>: call <code>host.list_branches</code> (which already runs <code>git fetch --all --prune</code>) and, when the named branch is the checkout's default branch, apply <code>resolveDefaultWorktreeBaseBranch</code>: <code>equal</code>/<code>local-behind</code> → <code>origin/&lt;name&gt;</code>; ahead/diverged → keep local. This fixes the reporter's exact case (<code>--base-branch main</code>) with server-only changes, no daemon or protocol change, and preserves "I want my local diverged main" semantics. For non-default named branches the daemon currently only reports the relation for the default branch, so either (a) extend <code>host.list_branches</code> to return the relation for <code>selectedBranch</code> (wire change → bump <code>HOST_DAEMON_PROTOCOL_VERSION</code>), or (b) accept that non-default local names stay local and document it.</li>
    <li><b>Alternatively/additionally, in the daemon</b> ({L("packages/host-workspace/src/provisioning.ts",364,388)}): when the base has no remote prefix, look up its upstream (<code>git rev-parse --abbrev-ref &lt;base&gt;@{{upstream}}</code>), fetch that ref (reuse <code>fetchRemoteBaseBranch</code>), compute <code>git rev-list --left-right --count &lt;base&gt;...&lt;upstream&gt;</code>, and if the local branch is behind-only, use the upstream as the start point; otherwise keep local. Emit transcript steps either way (<code>base-resolved</code>: "Base main is 3 commits behind origin/main; using origin/main" / "Base main is ahead of origin/main; using local"). This is host-local git plumbing, so it fits the daemon side of the boundary and needs no protocol bump (transcript <code>key</code> is a free string). Risk: this would also change <code>thread fork</code>, which intentionally bases on the source environment's local branch — gate it on a flag from the server (e.g. <code>preferUpstreamWhenBehind: true</code> for user-named bases, false for forks) if that matters; that flag would be a wire change and require the protocol bump. Fetch failures on this path must degrade to a warning step, not fail provisioning, so offline hosts still work.</li>
    <li><b>Print the resolved base regardless.</b> Have the daemon emit the resolved base commit and relation in the transcript, and have <code>bb thread spawn</code> (non-<code>--json</code> and <code>--json</code>) and <code>bb environment show</code> expose the environment's base branch <em>and</em> base commit once provisioning finishes, so a caller can assert <code>baseCommit == origin/main</code> without the manual <code>git fetch &amp;&amp; rev-parse</code> boilerplate. Update <code>docs/worktrees.md</code>, <code>bb-guide-threads.md</code>, and the <code>--base-branch</code> help text to state precisely which ref a bare name resolves to.</li>
  </ol>
  <p>Regression tests: the failing test above (expect a fetch and a fresh HEAD for <code>main</code> when local is behind), plus a case where local <code>main</code> is ahead/diverged and must stay local, and the existing <code>origin/main</code> test.</p>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue (searched <code>gh pr list --search "base-branch fetch worktree"</code>; nothing relevant).</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1624">#1624</a>: support discovered worktrees and continuing existing branches (adjacent worktree/base semantics).</li>
    <li>Commits <code>36450e50c</code> (#153) and <code>7d3a1a9de</code>: the existing fetch/smart-default work this issue asks to extend to plain names.</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
  <pre># worktree /home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-1, detached at 16ceb3a54
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
git fetch origin main; git log 16ceb3a54..origin/main --oneline -- packages/host-workspace/src/provisioning.ts apps/server/src/services/projects/worktree-base-branch.ts apps/server/src/services/threads/thread-create.ts apps/cli/src/commands/thread/spawn.ts   # empty
cp 1770/repro/issue-1770-local-base-branch.test.ts packages/host-workspace/test/ &amp;&amp; cd packages/host-workspace &amp;&amp; pnpm exec vitest run test/issue-1770-local-base-branch.test.ts
scripts/bb-dev-app current                      # app :17232, server :25232, daemon :33232
export BB_REPO=/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-1
1770/repro/1770-setup-repos.sh
1770/repro/1770-bb.sh machine list --json      # host_hs77scf38b
curl -s -X POST http://localhost:25232/api/v1/projects -H 'content-type: application/json' -d '{{"name":"qa-1770","source":{{"type":"local_path","path":"/tmp/1770-qa","hostId":"host_hs77scf38b"}}}}'   # proj_pwhvqn62tm
1770/repro/1770-bb.sh thread spawn --project proj_pwhvqn62tm --new-environment worktree --base-branch main        --provider codex --permission-mode accept-edits --title "1770 base-branch main"        --prompt "Reply only with ok." --json   # thr_vvsz3czv3d
1770/repro/1770-bb.sh thread spawn --project proj_pwhvqn62tm --new-environment worktree                           --provider codex --permission-mode accept-edits --title "1770 default base"            --prompt "Reply only with ok." --json   # thr_j372x3cj2f
1770/repro/1770-bb.sh thread spawn --project proj_pwhvqn62tm --new-environment worktree --base-branch main        --provider codex --permission-mode accept-edits --title "1770 base-branch main (2nd)"  --prompt "Reply only with ok." --json   # thr_k8a4h2we5k
1770/repro/1770-bb.sh thread spawn --project proj_pwhvqn62tm --new-environment worktree --base-branch origin/main --provider codex --permission-mode accept-edits --title "1770 base-branch origin/main" --prompt "Reply only with ok." --json   # thr_cvhxdu946z
1770/repro/1770-bb.sh thread show &lt;thr&gt; --json | grep -E '"path"|baseBranch'
1770/repro/1770-inspect.sh &lt;worktree path&gt;
sqlite3 &lt;data dir&gt;/bb.db "select data from events where environment_id='&lt;env&gt;' and type='system/thread-provisioning' order by sequence"
dev-browser --browser bb1770 --headless run 1770/repro/shot1.js     # screenshots
pnpm dev:stop</pre>
  <h3>Setup script</h3>
  <pre>{setup_sh}</pre>
  <h3>Inspect script</h3>
  <pre>{inspect_sh}</pre>
  <h3>Artifacts</h3>
  <ul>
    <li><a href="1770/repro/unit-test-main.out">unit-test-main.out</a>, <a href="1770/repro/1770-setup-repos.out">1770-setup-repos.out</a>, <a href="1770/repro/create-project.out">create-project.out</a>, <a href="1770/repro/spawn-main.out">spawn-main.out</a></li>
    <li><a href="1770/repro/spawn-main-result.out">spawn-main-result.out</a>, <a href="1770/repro/spawn-main2-result.out">spawn-main2-result.out</a>, <a href="1770/repro/spawn-default-result.out">spawn-default-result.out</a>, <a href="1770/repro/spawn-origin-result.out">spawn-origin-result.out</a></li>
    <li>Provisioning transcripts: <a href="1770/repro/spawn-main-provisioning-transcript.txt">main</a>, <a href="1770/repro/spawn-main2-provisioning-transcript.txt">main (2nd)</a>, <a href="1770/repro/spawn-default-provisioning-transcript.txt">default</a></li>
    <li>Build/install logs: <a href="1770/install.log">install.log</a>; screenshots script <a href="1770/repro/shot1.js">shot1.js</a></li>
  </ul>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/1770.html").write_text(page)
print("wrote", len(page))
