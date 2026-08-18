import html, pathlib
D = pathlib.Path("/tmp/bb-reports/issues/1595")
def esc(p): return html.escape(pathlib.Path(p).read_text())
def esc_s(s): return html.escape(s)

test_src = esc(D/"repro/git-bare-layout-1595.test.ts")
vitest_base = (D/"vitest-base.escaped").read_text()
diff = esc(D/"repro/prototype-fix.diff")
probe = esc(D/"repro/make-bare-layout.out")
branches_bare = esc(D/"branches-bare.json")
branches_plain = esc(D/"branches-plain.json")
branches_fixed = esc(D/"branches-bare-prototype-fix.json")
spawn_log = esc(D/"spawn-worktree-bare-log.txt")
spawn_show = esc(D/"spawn-worktree-bare-show.txt")
spawn_fixed_log = esc(D/"spawn-worktree-bare-prototype-fix-log.txt")
create_project = esc(D/"create-project.json")

BASE = "16ceb3a540f81c1189efaffb27a39b1d9443abf5"
def L(path, a, b=None, label=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    lab = label or f"{path}{frag.replace('#','')}".replace("L", ":L", 1) if False else (label or f"{path}#{frag[1:]}")
    return f'<a href="https://github.com/get-bb/bb/blob/{BASE}/{path}{frag}"><code>{lab}</code></a>'

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1595 bare repo + worktrees layout is not detected as a git repository</title>
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
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1595 · Bare repo + worktrees layout is not detected as a git repository</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill medium">Medium</span> <span class="pill">Effort: Small</span>
    <span class="pill">workspaces</span>
    <a href="https://github.com/get-bb/bb/issues/1595">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>{BASE}</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> Some git users keep a project as a folder that contains a <em>bare</em> clone (a repository with no checked-out files, here <code>.bare/</code>), a one-line <code>.git</code> file that says <code>gitdir: ./.bare</code>, and one sibling folder per branch created with <code>git worktree add</code>. The folder root is a real git repository as far as git is concerned (<code>git rev-parse --git-dir</code>, <code>git worktree list</code>, <code>git symbolic-ref HEAD</code> all work), but it is <em>not a work tree</em>: there is no checkout in the root itself.</p>
  <p>When such a root is registered as a bb project source, bb's host daemon decides the path is "not a git repository". Every git-gated feature that keys off the <em>project source</em> then turns off: the "New worktree" option in the environment picker is disabled, <code>GET /api/v1/projects/:id/branches</code> returns <code>checkout.kind = "unknown"</code> with reason <code>"Path is not a git repository"</code>, and if you bypass the UI (CLI <code>bb thread spawn --new-environment worktree</code>) provisioning fails with <code>not_git_repo</code>: "Cannot create a worktree because the source is not a Git repository".</p>
  <p>The cause is exactly what the reporter guessed: the single helper <code>detectGitRepo()</code> in <code>packages/host-workspace/src/git.ts</code> runs <code>git rev-parse --is-inside-work-tree</code> and treats <code>false</code> as "not git". A bare repository answers <code>false</code> with exit code 0. Every gate (<code>ensureGitRepo</code>, <code>readGitRepositoryState</code>, <code>getCheckoutRef</code>, <code>host.list_branches</code>, <code>createWorktree</code>) sits on that one helper. Note the reporter's proposed fallback <code>--is-inside-git-dir</code> does <em>not</em> work for this layout (it prints <code>false</code> in the root, because the root only <em>points at</em> the git dir); <code>--is-bare-repository</code> or <code>--git-dir</code> do. A prototype fix (distinguish "work tree" from "bare source" and let bare sources through the source-side gates) makes the branches endpoint, the picker, and end-to-end worktree provisioning work on this layout, with all host-workspace and host-daemon tests still passing.</p>
  <p>The second half of the issue ("Existing worktree" only lists bb-managed environments, not <code>git worktree list</code> output) is accurate but is a feature request rather than a bug, and it is already tracked as <a href="https://github.com/get-bb/bb/issues/1624">#1624</a>.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Only "Work locally" is available; "New worktree" is disabled for a bare-root project</td><td class="ok">Verified</td><td>Screenshot <a href="assets/1595-picker-open.png">1595-picker-open.png</a>; DOM dump shows <code>New worktree</code> with <code>data-disabled="true"</code>. Control project (plain clone of the same origin) has it enabled (<a href="assets/1595-picker-plain-control.png">control</a>).</td></tr>
    <tr><td>Disabled reason text is "Project source is not a git repository"</td><td class="unv">Version-dependent</td><td>That was the string in v0.37.0. Since <code>893a05ae6</code> ("Allow Tasks dispatch without requiring Git", #1396, in v0.38.0) the app renders <code>"New worktrees require a Git repository with at least one commit"</code> for the same <code>checkout.kind === "unknown"</code> response ({L("apps/app/src/views/root-compose-environment-selection.ts",37,38)}). Same bug, different label.</td></tr>
    <tr><td>"Existing worktree" says "No worktrees in this project yet" although 4 worktrees exist</td><td class="ok">Verified (by design)</td><td>The reuse list is built from bb <em>environments</em> (thread → environment buckets in <code>root-compose-environment-selection.ts</code>, rendered by <code>WorktreePicker</code>), never from <code>git worktree list</code>. In my repro that row is only enabled once a (failed) bb worktree env exists. Feature request, tracked as #1624.</td></tr>
    <tr><td>Root is a valid git repository but not a work tree (<code>--is-inside-work-tree</code> = false/exit 0, <code>--is-bare-repository</code> = true)</td><td class="ok">Verified</td><td><a href="1595/repro/make-bare-layout.out">make-bare-layout.out</a>, git 2.53.0.</td></tr>
    <tr><td>Detection is a single helper using <code>rev-parse --is-inside-work-tree</code></td><td class="ok">Verified</td><td>{L("packages/host-workspace/src/git.ts",590,599)} <code>detectGitRepo</code>; the daemon bundle snippet in the issue is its minified form.</td></tr>
    <tr><td>All git gates use it, so a bare root gets <code>isGitRepo: false</code></td><td class="ok">Verified</td><td><code>ensureGitRepo</code>, <code>readGitRepositoryState</code>, <code>getCheckoutRef</code>, <code>getCurrentBranch</code>, <code>listHostBranches</code>, <code>createWorktree</code> and <code>provision.ts</code> all call it (Root cause). Failed env from CLI spawn has <code>"isGitRepo":false</code>.</td></tr>
    <tr><td>Falling back to <code>--is-inside-git-dir</code> would cover this layout</td><td class="no">Refuted</td><td><code>git rev-parse --is-inside-git-dir</code> prints <code>false</code> in the bare root (the root is not <em>inside</em> <code>.bare/</code>; the <code>.git</code> file merely points there). <code>--is-bare-repository</code> (true) or <code>--git-dir</code> (succeeds) are the working checks.</td></tr>
    <tr><td>There is already a <code>listWorktrees()</code> that could feed the reuse list</td><td class="ok">Verified, with a caveat</td><td>{L("packages/host-workspace/src/workspace.ts",1350,1355)} exists but is a <em>private</em> method of <code>WorkspaceManager</code>, used for temp-worktree cleanup and branch lookup; it is not exposed through any host RPC.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18) checked out in worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-18</code>. <code>origin/main</code> is 5 commits ahead (<code>a108fa7ef</code>); none touch <code>packages/host-workspace</code> or <code>host-branches.ts</code>, so the bug is still present there.</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, git 2.53.0, codex-cli 0.147.0 (provider <code>codex</code>).</li>
    <li>Dev instance: app <code>:14008</code>, server <code>:22008</code>, host daemon <code>:30008</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-18-4ec3be00bc05</code>, machine <code>host_by68ynypfv</code> ("bee").</li>
    <li>Projects: <code>proj_mcn754hcb8</code> "cosmos" → <code>/tmp/bb-1595/cosmos</code> (bare layout); control <code>proj_87t2bdjuvh</code> "plain" → <code>/tmp/bb-1595/plain</code> (ordinary clone of the same origin).</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>1. Build the layout (30 s, no bb needed)</h3>
  <p>Script <a href="1595/repro/make-bare-layout.sh">1595/repro/make-bare-layout.sh</a> creates <code>/tmp/bb-1595/{{origin,cosmos}}</code> exactly like the issue (<code>cosmos/.bare</code>, <code>cosmos/.git</code> = <code>gitdir: ./.bare</code>, worktrees <code>feature-a</code>, <code>feature-b</code>) and prints the git probes. Output (<a href="1595/repro/make-bare-layout.out">make-bare-layout.out</a>):</p>
  <pre>$ /tmp/bb-reports/issues/1595/repro/make-bare-layout.sh /tmp/bb-1595
{probe}</pre>
  <p>Note <code>--is-inside-work-tree</code> = <code>false</code> with exit 0 (this is what bb checks), <code>--is-inside-git-dir</code> = <code>false</code> (the reporter's suggested fallback would not help), <code>--is-bare-repository</code> = <code>true</code>.</p>

  <h3>2. Unit-level repro (fails on main)</h3>
  <p><a href="1595/repro/git-bare-layout-1595.test.ts">1595/repro/git-bare-layout-1595.test.ts</a>, copy to <code>packages/host-workspace/test/</code> and run <code>pnpm exec vitest run test/git-bare-layout-1595.test.ts</code> from <code>packages/host-workspace</code>. It builds the same layout in a temp dir and asserts what the daemon relies on. On <code>16ceb3a54</code> three of four assertions fail (<a href="1595/repro/vitest-base.txt">vitest-base.txt</a>): <code>readGitRepositoryState</code> returns <code>not_git</code> (expected <code>has_commits</code>), <code>getCheckoutRef</code> returns <code>{{kind:"unknown", reason:"Path is not a git repository"}}</code>, and <code>createWorktree</code> rejects with <code>WorkspaceError not_git_repo</code>. The first test (git itself sees a repo) passes, proving the layout is valid.</p>
  <pre>{vitest_base}</pre>
  <details><summary>Test source</summary><pre>{test_src}</pre></details>

  <h3>3. API repro against a running instance</h3>
  <ol>
    <li>Start your dev instance (<code>scripts/bb-dev-app current</code>) and get the host id (<code>BB_SERVER_URL=http://localhost:&lt;server&gt; pnpm bb:dev machine list</code>).</li>
    <li>Register the bare root as a project:
<pre>$ curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
    -d '{{"name":"cosmos","source":{{"type":"local_path","path":"/tmp/bb-1595/cosmos","hostId":"host_by68ynypfv"}}}}'
{create_project}</pre>
    Note bb <em>did</em> read <code>gitRemoteUrl</code> from the bare repo (<code>project.inspect</code> runs <code>git remote get-url origin</code> without a work-tree gate, {L("apps/host-daemon/src/command-handlers/project.ts",49,60)}), so bb is already inconsistent about whether this path is a repository.</li>
    <li>Ask for branches (this is what the environment picker calls):
<pre>$ curl -s "$BB_SERVER_URL/api/v1/projects/proj_mcn754hcb8/branches?hostId=host_by68ynypfv"
{branches_bare}</pre>
    <b>Expected</b> (control, plain clone of the same origin, <code>proj_87t2bdjuvh</code>):
<pre>{branches_plain}</pre>
    <b>Actual</b>: <code>checkout.kind = "unknown"</code>, reason <code>"Path is not a git repository"</code>, no branches. The app maps <code>unknown</code> to the disabled "New worktree" row ({L("apps/app/src/views/root-compose-environment-selection.ts",112,125)}).</li>
    <li>Bypass the UI and try to provision a worktree anyway:
<pre>$ BB_SERVER_URL=http://localhost:22008 pnpm bb:dev thread spawn --project proj_mcn754hcb8 --machine host_by68ynypfv \\
    --new-environment worktree --provider codex --title bare-wt --prompt "Reply only with ok." --json
  "id": "thr_jdknfv2g3g",
$ pnpm bb:dev thread show thr_jdknfv2g3g
{spawn_show}
$ pnpm bb:dev thread log thr_jdknfv2g3g
{spawn_log}</pre>
    The environment record ends as <code>"isGitRepo":false,"status":"error"</code> (<a href="1595/spawn-worktree-bare-env.json">spawn-worktree-bare-env.json</a>).</li>
  </ol>

  <h3>4. Visual repro</h3>
  <figure><img src="assets/1595-compose-before.png" alt="compose view for cosmos before opening the picker"><figcaption>Before: new-thread composer for project "cosmos" (bare layout), environment picker closed, showing "Work locally".</figcaption></figure>
  <figure><img src="assets/1595-picker-open.png" alt="environment picker with New worktree disabled"><figcaption>Bug: clicking "Work locally" opens the environment picker. "New worktree" is greyed out with "New worktrees require a Git repository with at least one commit" (v0.37.0 showed "Project source is not a git repository" here). "Existing worktree" is enabled only because my failed CLI spawn above created a bb environment; the four real git worktrees are not listed.</figcaption></figure>
  <figure><img src="assets/1595-picker-plain-control.png" alt="control picker with New worktree enabled"><figcaption>Control: same origin as an ordinary clone; "New worktree" is enabled and "Existing worktree" reads "No worktrees in this project yet".</figcaption></figure>
  <figure><img src="assets/1595-picker-prototype-fix.png" alt="picker after prototype fix"><figcaption>After the prototype fix (below), on the same bare-layout project: "New worktree" is enabled and a real worktree thread provisioned and answered.</figcaption></figure>

  <h2>Root cause</h2>
  <p>{L("packages/host-workspace/src/git.ts",590,599)}:</p>
  <pre>export async function detectGitRepo(cwd, options = {{}}): Promise&lt;boolean&gt; {{
  const result = await runGit(["rev-parse", "--is-inside-work-tree"], {{ cwd, allowFailure: true, ... }});
  return result.exitCode === 0 &amp;&amp; trimOutput(result.stdout) === "true";
}}</pre>
  <p><code>git rev-parse --is-inside-work-tree</code> answers the question "is cwd inside a checkout?", not "is cwd a git repository?". In a bare repository (including a directory whose <code>.git</code> file points at a bare gitdir) git exits 0 and prints <code>false</code>. Everything downstream conflates the two questions:</p>
  <ul>
    <li>{L("packages/host-workspace/src/git.ts",602,614)} <code>ensureGitRepo</code> throws <code>not_git_repo</code>; used by <code>readDefaultBranch</code>, <code>readDefaultBranchRefs</code>, <code>hasRef</code>, <code>hasUncommittedChanges</code>, <code>getWorkspaceGitOperation</code>, and every <code>Workspace</code> git method.</li>
    <li>{L("packages/host-workspace/src/git.ts",618,629)} <code>readGitRepositoryState</code> returns <code>"not_git"</code>, which {L("packages/host-workspace/src/provisioning.ts",346,357)} <code>createWorktree</code> turns into the "Cannot create a worktree because the source is not a Git repository" error seen in the CLI repro.</li>
    <li>{L("packages/host-workspace/src/git.ts",670,676)} <code>getCheckoutRef</code> returns <code>{{kind:"unknown", reason:"Path is not a git repository"}}</code>.</li>
    <li>{L("apps/host-daemon/src/command-handlers/host-branches.ts",133,158)} <code>listHostBranches</code> short-circuits on <code>detectGitRepo</code> and returns the empty payload with that <code>checkout</code>; the server route {L("apps/server/src/routes/projects.ts",832,858)} forwards it; the app's {L("apps/app/src/views/root-compose-environment-selection.ts",112,125)} maps <code>unknown</code> → disabled reason; {L("apps/app/src/components/pickers/EnvironmentPicker.tsx",513,521)} renders "New worktree" disabled.</li>
    <li>{L("packages/host-workspace/src/provision.ts",692,694)} marks any unmanaged workspace at that path <code>isGitRepo=false</code>, which also hides the git UI for a "Work locally" thread at the root (arguably correct there, since there is no checkout to diff).</li>
  </ul>
  <p>Why the symptom follows: the picker's only signal for "can I create a worktree from this source?" is <code>checkout.kind</code> from <code>host.list_branches</code>, and the daemon answers "unknown / not a git repository" for any bare source. Independently, even a direct provisioning request dies at <code>readGitRepositoryState</code>. Both roads pass through <code>detectGitRepo</code>.</p>
  <p><b>Deeper issue.</b> bb uses one boolean (<code>isGitRepo</code>) for two different capabilities: "this path can be a <em>source</em> for worktrees / branch listing" (needs a git dir, bare is fine) and "this path is a <em>workspace</em> with a checkout" (needs a work tree: <code>git status</code>, diffs, commits all fail in a bare repo with <code>fatal: this operation must be run in a work tree</code>). A fix that simply flips <code>detectGitRepo</code> to also accept bare would make <code>hasUncommittedChanges</code>/<code>getWorkspaceGitOperation</code> (both called by <code>listHostBranches</code>) throw <code>git_command_failed</code>, and would enable diff/commit UI on a bare-root local workspace. The two notions have to be separated.</p>
  <p>Introduced by <code>9cd0484b3</code> (2026-04-06) and unchanged since; not a regression.</p>

  <h2>Proposed fix (first principles)</h2>
  <p>Confidence high; a prototype is in <a href="1595/repro/prototype-fix.diff">1595/repro/prototype-fix.diff</a> and was exercised end to end (below). Shape:</p>
  <ol>
    <li>In <code>packages/host-workspace/src/git.ts</code> add <code>detectGitRepoKind(cwd) → "work-tree" | "bare" | "none"</code> using one call, <code>git rev-parse --is-inside-work-tree --is-bare-repository</code> (exit ≠ 0 → none). Keep <code>detectGitRepo</code> = work-tree only (workspace semantics: diffs, status, commits) and add <code>detectGitSource</code> = work-tree or bare (source semantics).</li>
    <li>Use the source variant where the path is a <em>source</em>: <code>readGitRepositoryState</code> (→ <code>createWorktree</code>), <code>getCheckoutRef</code>, <code>ensureGitRepo</code> callers that only read refs (<code>readDefaultBranch</code>, <code>readDefaultBranchRefs</code>, <code>hasRef</code>, <code>listBranches</code>), and the gate in <code>listHostBranches</code>.</li>
    <li>Make the two work-tree-only helpers that <code>listHostBranches</code> also calls tolerate bare: <code>hasUncommittedChanges</code> → <code>false</code>, <code>getWorkspaceGitOperation</code> → <code>{{kind:"none"}}</code>.</li>
    <li>Leave <code>provision.ts</code>'s <code>isGitRepo</code> (workspace) semantics alone so a "Work locally" thread at the bare root keeps the git UI off. No wire shape changes, so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump is needed; the disabled-reason strings in the app also stay valid.</li>
    <li>Add the repro test (adjusted to the final helper names) to <code>packages/host-workspace/test/</code>.</li>
  </ol>
  <p>What could go wrong: <code>ensureGitRepo</code> is also used by <code>Workspace</code> methods; if it is widened to bare, a caller that reaches those methods with a bare path would now fail with <code>git_command_failed</code> from <code>git status</code>/<code>diff</code> instead of a clean <code>not_git_repo</code>. Server routes gate on <code>environment.isGitRepo</code> (still false for bare workspaces) so this is unreachable today, but a cleaner variant keeps <code>ensureGitRepo</code> as-is and adds <code>ensureGitSource</code> for the ref-reading helpers. Also, a bare clone made with <code>git clone --bare</code> has no <code>refs/remotes/origin/*</code> and no fetch refspec, so <code>remoteBranches</code> is empty and <code>defaultWorktreeBaseBranch</code> falls back to the local <code>main</code> (visible in the fixed output); that is correct behaviour, not a bug. Worktree layouts where the root <em>is</em> the bare dir (no <code>.git</code> file, e.g. <code>~/cosmos.git/</code>) are covered by the same <code>--is-bare-repository</code> check.</p>
  <p>Evidence the prototype works (host-workspace + host-daemon rebuilt, dev instance restarted): the branches endpoint on the same project now returns</p>
  <pre>{branches_fixed}</pre>
  <p>and the same CLI spawn provisions and runs (<a href="1595/spawn-worktree-bare-prototype-fix-log.txt">log</a>):</p>
  <pre>{spawn_fixed_log}</pre>
  <p><code>git -C /tmp/bb-1595/cosmos worktree list</code> afterwards shows the new bb worktree registered next to <code>feature-a</code>/<code>feature-b</code>. Repro test: 4/4 pass with the prototype (<a href="1595/repro/vitest-prototype-fix.txt">vitest-prototype-fix.txt</a>); <code>turbo run test --filter=@bb/host-workspace --filter=@bb/host-daemon</code>: 217 + 582 tests pass (<a href="1595/prototype-tests.txt">prototype-tests.txt</a>).</p>
  <details><summary>Prototype diff (not a polished PR; <code>ensureGitRepo</code> widened for brevity, see caveat above)</summary><pre>{diff}</pre></details>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1624">#1624</a> Support discovered worktrees and continuing existing branches — covers the second half of this issue (list <code>git worktree list</code> output in "Existing worktree").</li>
    <li>PR <a href="https://github.com/get-bb/bb/pull/1396">#1396</a> (<code>893a05ae6</code>) changed the disabled-reason wording from "Project source is not a git repository" to "New worktrees require a Git repository with at least one commit"; the underlying <code>checkout.kind === "unknown"</code> path is unchanged.</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
  <pre>git checkout 16ceb3a54 &amp;&amp; pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
/tmp/bb-reports/issues/1595/repro/make-bare-layout.sh /tmp/bb-1595
scripts/bb-dev-app current                     # app :14008 server :22008 daemon :30008
BB_SERVER_URL=http://localhost:22008 pnpm bb:dev machine list      # host_by68ynypfv
curl -s -X POST http://localhost:22008/api/v1/projects -H 'content-type: application/json' -d '{{"name":"cosmos","source":{{"type":"local_path","path":"/tmp/bb-1595/cosmos","hostId":"host_by68ynypfv"}}}}'
curl -s "http://localhost:22008/api/v1/projects/proj_mcn754hcb8/branches?hostId=host_by68ynypfv"
git clone -q /tmp/bb-1595/origin /tmp/bb-1595/plain   # control project proj_87t2bdjuvh, same branches call
BB_SERVER_URL=http://localhost:22008 node packages/scripts/dist/commands/run-cli.js thread spawn --project proj_mcn754hcb8 --machine host_by68ynypfv --new-environment worktree --provider codex --title bare-wt --prompt "Reply only with ok." --json
... thread show / thread log thr_jdknfv2g3g ; curl .../environments/env_kixveknw74
cd packages/host-workspace &amp;&amp; pnpm exec vitest run test/git-bare-layout-1595.test.ts     # 3 failed / 1 passed on base
git checkout -b bb/1595-prototype ; apply prototype diff ; vitest again (4 passed)
pnpm exec turbo run test --filter=@bb/host-workspace --filter=@bb/host-daemon --force
pnpm exec turbo run build --filter=@bb/host-daemon ; pnpm dev:stop ; scripts/bb-dev-app current
curl .../projects/proj_mcn754hcb8/branches?hostId=host_by68ynypfv   # now lists branches
... thread spawn again → thr_rnwsxwbgd7 idle, "ok"
dev-browser --browser bb1595 --headless run 1595/browser-picker*.js   # screenshots
pnpm dev:stop</pre>
  <h3>Files</h3>
  <ul>
    <li><a href="1595/create-project.json">create-project.json</a>, <a href="1595/branches-bare.json">branches-bare.json</a>, <a href="1595/branches-plain.json">branches-plain.json</a>, <a href="1595/branches-bare-prototype-fix.json">branches-bare-prototype-fix.json</a></li>
    <li><a href="1595/spawn-worktree-bare-show.txt">spawn-worktree-bare-show.txt</a>, <a href="1595/spawn-worktree-bare-log.txt">spawn-worktree-bare-log.txt</a>, <a href="1595/spawn-worktree-bare-env.json">spawn-worktree-bare-env.json</a>, <a href="1595/spawn-worktree-bare-prototype-fix-show.txt">…-prototype-fix-show.txt</a>, <a href="1595/spawn-worktree-bare-prototype-fix-log.txt">…-prototype-fix-log.txt</a></li>
    <li><a href="1595/repro/">repro/</a>: <code>make-bare-layout.sh</code>, <code>git-bare-layout-1595.test.ts</code>, <code>vitest-base.txt</code>, <code>vitest-prototype-fix.txt</code>, <code>prototype-fix.diff</code></li>
    <li>Browser scripts: <a href="1595/browser-picker2.js">browser-picker2.js</a> (bare project), <a href="1595/browser-picker3.js">browser-picker3.js</a> (control)</li>
  </ul>
</main></body></html>
"""
(pathlib.Path("/tmp/bb-reports/issues/1595.html")).write_text(page)
print("ok", len(page))
