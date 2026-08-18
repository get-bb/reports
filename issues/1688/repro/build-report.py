import html, pathlib, re
R = pathlib.Path("/tmp/bb-reports/issues/1688/repro")
ansi = re.compile(r'\x1b\[[0-9;]*m')
def esc(p): return html.escape(ansi.sub('', (R / p).read_text()))
test_src = esc("issue-1688-grok-4.6-primary.test.ts")
cli_out = esc("cli-provider-models-acp-cursor.txt")
cli_sel = esc("cli-provider-models-selected-model.txt")
vit_main = esc("vitest-main.txt")
vit_fix = esc("vitest-with-fix.txt")
fix_diff = esc("proposed-fix.diff")
merge_tree = esc("pr-1687-merge-tree.txt")
grok_lines = html.escape("\n".join(l for l in (R / "cursor-agent-list-models.txt").read_text().splitlines() if "grok" in l))
PL = "https://github.com/get-bb/bb/blob/16ceb3a540f81c1189efaffb27a39b1d9443abf5/"
GITCO = "git " + "checkout"
doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1688 Cursor Grok 4.6 is hidden from the primary model picker</title>
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
  .pill.low {{ background:#eef; }}
  .verdict {{ font-weight:600; }}
  .v-repro {{ color:var(--ok); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1688 · Cursor Grok 4.6 is hidden from the primary model picker</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill low">Low</span> <span class="pill">Effort: Small</span>
    <span class="pill">providers</span> <span class="pill">provider-acp</span>
    <a href="https://github.com/get-bb/bb/issues/1688">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>16ceb3a540f81c1189efaffb27a39b1d9443abf5</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked PRs: <a href="https://github.com/get-bb/bb/pull/1687">#1687</a> (already CLOSED as obsolete on 2026-08-18; reviewed below anyway)</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> bb does not know Cursor's model list itself; it asks the Cursor CLI (<code>cursor-agent --list-models</code>) at picker time. That list has ~200 raw ids (<code>cursor-grok-4.6-low</code>, <code>cursor-grok-4.6-medium-fast</code>, …) which bb's ACP bridge folds into "families" (one row per model, with a reasoning ladder and a Fast-mode toggle). The picker then shows only a short curated subset of those families up front and pushes the rest behind a "More models" row. Which families are "up front" is <b>not</b> discovered: it is a hard-coded list of family ids (<code>primaryModels</code>) that ships inside bb.</p>
  <p>The user sees "Cursor Grok 4.5" in the Cursor tab of the model picker (and in <code>bb provider models acp-cursor</code>) but no "Cursor Grok 4.6", even though Cursor already offers Grok 4.6 (with low/medium/high/xhigh efforts and fast variants). Grok 4.6 is there, but only under "More models"; the CLI omits it unless <code>--selected-model cursor-grok-4.6-medium</code> is passed. The reason is exactly what the issue says: the hard-coded list <code>BUILT_IN_ACP_LAUNCH_SPECS["acp-cursor"].modelCli.primaryModels</code> in <code>packages/agent-runtime/src/acp-launch-specs.ts</code> still names <code>cursor-grok-4.5-medium</code>. Since <code>splitPrimaryModels</code> matches by exact family id, the newer family cannot be primary until someone edits that string. This is a stale-constant bug, not a parsing or discovery bug; the deeper issue is that the "recommended models" policy is pinned to exact version ids and silently rots every time Cursor ships a new family (same thing happened for Grok 4.5 in #933).</p>
  <p>Reproduced on <code>16ceb3a54</code> with the real Cursor CLI (2026.08.11-e8db854) both via the CLI and in the app, plus a vitest that fails on main and passes with a one-line change. The linked PR #1687 makes the right one-line change but to a file (<code>packages/agent-runtime/src/acp/profiles.ts</code>) that no longer exists on main (removed in #1640), so it cannot merge (GitHub reports <code>CONFLICTING</code>); it was closed as obsolete. Nothing on <code>origin/main</code> after the base commit fixes this.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Cursor CLI advertises the Grok 4.6 family</td><td class="ok">Verified</td><td><code>cursor-agent --list-models</code> (2026.08.11-e8db854) prints 9 <code>cursor-grok-4.6-*</code> ids (low/medium/high/xhigh, some with <code>-fast</code>). Full output: <a href="1688/repro/cursor-agent-list-models.txt">cursor-agent-list-models.txt</a>.</td></tr>
    <tr><td>bb's built-in primary list still names <code>cursor-grok-4.5-medium</code></td><td class="ok">Verified</td><td><a href="{PL}packages/agent-runtime/src/acp-launch-specs.ts#L30-L37">acp-launch-specs.ts#L30-L37</a>. Note the issue and PR still point at <code>packages/agent-runtime/src/acp/profiles.ts</code>, which was deleted by #1640 (<code>c5b53caab</code>); the list moved, unchanged, to <code>acp-launch-specs.ts</code>.</td></tr>
    <tr><td><code>bb provider models acp-cursor</code> omits Grok 4.6</td><td class="ok">Verified</td><td>Output below: six rows, Grok 4.5 is second, no 4.6 (<a href="1688/repro/cli-provider-models-acp-cursor.txt">cli-provider-models-acp-cursor.txt</a>).</td></tr>
    <tr><td>App puts Grok 4.6 under "More models"</td><td class="ok">Verified</td><td>Screenshots <a href="assets/1688-picker-primary.png">1688-picker-primary.png</a> and <a href="assets/1688-picker-more-models.png">1688-picker-more-models.png</a>: "Cursor Grok 4.6" is the third entry of the More-models submenu.</td></tr>
    <tr><td>CLI shows it only with <code>--selected-model cursor-grok-4.6-medium</code></td><td class="ok">Verified</td><td>Output below (<a href="1688/repro/cli-provider-models-selected-model.txt">cli-provider-models-selected-model.txt</a>); <code>includeSelectedOnlyModel</code> in <a href="{PL}apps/cli/src/commands/provider.ts#L110-L123">apps/cli/src/commands/provider.ts#L110-L123</a> prepends the selected-only match.</td></tr>
    <tr><td>Grok 4.6 is "classified as a selected-only model"</td><td class="ok">Verified</td><td>The bridge's <code>splitPrimaryModels</code> puts every family whose id is not in <code>primaryModels</code> into <code>selectedOnlyModels</code>; the Grok 4.6 family id is <code>cursor-grok-4.6-medium</code>. Vitest below asserts this and fails on main.</td></tr>
    <tr><td>Grok 4.5 remains primary</td><td class="ok">Verified</td><td>Cursor still lists <code>cursor-grok-4.5-{{low,medium,high}}[-fast]</code>, so the family id <code>cursor-grok-4.5-medium</code> still matches and stays second in the picker.</td></tr>
    <tr><td>Recursive tool-schema failure (#1612) is separate</td><td class="ok">Verified</td><td>#1612 is a per-turn provider error and was closed by #1613 (<code>c25298f69</code>, on origin/main after the base commit). This issue is purely picker classification.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18), worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-38</code>. Dev instance from <code>scripts/bb-dev-app current</code>: app <code>:12192</code>, server <code>:20192</code>, host daemon <code>:28192</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-38-d4107868aa99</code>. Machine <code>host_ifkswh6bau</code> ("bee"), project <code>proj_9aupqh2ndm</code> (local path <code>/tmp/bb-1688-scratch</code>).</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0. Cursor CLI <code>cursor-agent 2026.08.11-e8db854</code> at <code>/home/sawyer/.local/bin/cursor-agent</code>. Providers on the machine: codex, claude-code, pi, acp-cursor, acp-grok.</li>
    <li>No Cursor turn was run; model discovery only spawns <code>cursor-agent --list-models</code>.</li>
    <li><code>git log 16ceb3a54..origin/main -- packages/agent-runtime/src/acp-launch-specs.ts plugins/provider-acp/src/bridge/model-catalog.ts</code> is empty: not fixed after the base commit.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. CLI (needs the Cursor CLI on PATH)</h3>
  <ol>
    <li>Build and start a dev instance: <code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code>. Export the printed env: <code>export BB_SERVER_URL=http://localhost:&lt;server port&gt;</code>.</li>
    <li>Confirm Cursor offers Grok 4.6: <code>cursor-agent --list-models | grep grok</code>
<pre>{grok_lines}</pre></li>
    <li>Ask bb for the Cursor picker list: <code>node packages/scripts/dist/commands/run-cli.js provider models acp-cursor</code></li>
  </ol>
  <p><b>Expected</b>: a "Cursor Grok 4.6" row (family id <code>cursor-grok-4.6-medium</code>) in the default list. <b>Actual</b>:</p>
  <pre>{cli_out}</pre>
  <p>Only when the caller already knows the id does it show up (prepended by the CLI's <code>includeSelectedOnlyModel</code>):</p>
  <pre>$ node packages/scripts/dist/commands/run-cli.js provider models acp-cursor --selected-model cursor-grok-4.6-medium
{cli_sel}</pre>

  <h3>B. App</h3>
  <p>Open the app, click <b>New thread</b>, click the provider/model button in the composer ("Provider, model and reasoning"), select the <b>Cursor</b> tab.</p>
  <figure><img src="assets/1688-picker-primary.png" alt="Cursor tab of the model picker"><figcaption>Cursor tab of the model picker on <code>16ceb3a54</code>. Primary list is Auto, Cursor Grok 4.5, GPT-5.6 Sol, Claude Opus 5, Claude Fable 5, Composer 2.5, then a "More models" row. No Grok 4.6.</figcaption></figure>
  <figure><img src="assets/1688-picker-more-models.png" alt="More models submenu with Cursor Grok 4.6"><figcaption>After clicking "More models": "Cursor Grok 4.6" is the third hidden entry (between GPT-5.2 and Gemini 3.7 Flash), i.e. it was discovered and folded correctly but classified as selected-only.</figcaption></figure>
  <p>Browser driver scripts used: <a href="1688/repro/browser-cursor-picker.js">browser-cursor-picker.js</a>, <a href="1688/repro/browser-more-models.js">browser-more-models.js</a> (dev-browser).</p>

  <h3>C. Unit-level repro (fails on main)</h3>
  <p>File: <a href="1688/repro/issue-1688-grok-4.6-primary.test.ts">plugins/provider-acp/src/bridge/issue-1688-grok-4.6-primary.test.ts</a>, fixture <a href="1688/repro/issue-1688-cursor-list-models.txt">issue-1688-cursor-list-models.txt</a> (the captured <code>cursor-agent --list-models</code> output; copy both into <code>plugins/provider-acp/src/bridge/</code>). It runs the exact pipeline the bridge's <code>model/list</code> handler runs, with the exact built-in policy.</p>
  <pre>{test_src}</pre>
  <p>Run from <code>plugins/provider-acp</code>: <code>pnpm exec vitest run src/bridge/issue-1688-grok-4.6-primary.test.ts</code>. The first test passes (proves the family id is <code>cursor-grok-4.6-medium</code> with ladder low/medium/high/xhigh); the second fails because <code>cursor-grok-4.6-medium</code> is in <code>selectedOnlyModels</code> (<a href="1688/repro/vitest-main.txt">vitest-main.txt</a>):</p>
  <pre>{vit_main}</pre>
  <p>With the one-line change from <a href="1688/repro/proposed-fix.diff">proposed-fix.diff</a> applied (and the 4.5 sanity assertion dropped, since it is intentionally replaced) both tests pass (<a href="1688/repro/vitest-with-fix.txt">vitest-with-fix.txt</a>):</p>
  <pre>{fix_diff}</pre>
  <pre>{vit_fix}</pre>

  <h2>Root cause</h2>
  <p><b>Where the list comes from.</b> The bundled Cursor provider has no server-side entry; when the runtime packs the ACP bridge's provider statics it falls back to a hard-coded table (<a href="{PL}packages/agent-runtime/src/provider-registry.ts#L158-L163">provider-registry.ts#L158-L163</a>) whose Cursor entry pins the picker's default families by exact family id (<a href="{PL}packages/agent-runtime/src/acp-launch-specs.ts#L26-L38">acp-launch-specs.ts#L26-L38</a>):</p>
  <pre>modelCli: {{
  listArgs: ["--list-models"],
  selectFlag: "--model",
  // Family ids (the default variant's raw id), not raw variant ids: the
  // catalog folds effort and the `-fast` tail into one entry per family.
  primaryModels: [
    "auto",
    "cursor-grok-4.5-medium",      // &lt;-- stale: Cursor now ships Grok 4.6
    "gpt-5.6-sol-medium",
    "claude-opus-5-thinking-medium",
    "claude-fable-5-thinking-medium",
    "composer-2.5",
  ],
}},</pre>
  <p><b>How it is applied.</b> The spec becomes an <code>AcpAgentProfile</code>; <code>buildAcpModelListParams</code> copies <code>primaryModels</code> into the bridge's <code>model/list</code> params (<a href="{PL}plugins/provider-acp/src/session-params.ts#L212-L232">session-params.ts#L212-L232</a>). In the bridge, <code>handleModelList</code> spawns the list command, folds the raw ids into families with <code>buildAgentModelCatalog</code>, then calls <code>splitPrimaryModels(models, params.primaryModels)</code> (<a href="{PL}plugins/provider-acp/src/bridge/bridge.ts#L2124-L2143">bridge.ts#L2124-L2143</a>). That split is a pure exact-id lookup (<a href="{PL}plugins/provider-acp/src/bridge/model-catalog.ts#L570-L590">model-catalog.ts#L570-L590</a>):</p>
  <pre>const primaryIds = new Set(primaryModels);
const modelsById = new Map(catalogModels.map((model) =&gt; [model.id, model]));
const models = primaryModels.flatMap((id) =&gt; {{
  const model = modelsById.get(id);
  return model ? [model] : [];
}});
…
const selectedOnlyModels = catalogModels.filter(
  (model) =&gt; !primaryIds.has(model.id),
);</pre>
  <p><b>Why the family id is <code>cursor-grok-4.6-medium</code>.</b> <code>buildAgentModelCatalog</code> keys a family by the raw id of its default variant: the non-fast "medium" member when present (<a href="{PL}plugins/provider-acp/src/bridge/model-catalog.ts#L494-L502">model-catalog.ts#L494-L502</a>). Cursor lists <code>cursor-grok-4.6-medium</code>, so the family is <code>cursor-grok-4.6-medium</code> / "Cursor Grok 4.6" with efforts low/medium/high/xhigh (first test above). That id is not in <code>primaryModels</code>, so it lands in <code>selectedOnlyModels</code>. The server passes both arrays through (<a href="{PL}apps/server/src/services/system/execution-options.ts#L340-L351">execution-options.ts#L340-L351</a>), the app renders <code>selectedOnlyModels</code> behind "More models" (<a href="{PL}apps/app/src/components/pickers/ModelReasoningPicker.tsx#L214">ModelReasoningPicker.tsx#L214</a>), and the CLI hides them unless <code>--selected-model</code> names one (<a href="{PL}apps/cli/src/commands/provider.ts#L110-L123">provider.ts#L110-L123</a>). The symptom follows directly.</p>
  <p><b>Deeper issue.</b> The "recommended" policy is a version-pinned constant maintained by hand. Cursor released Grok 4.5 → #933 / <code>9daeffb7f</code> edited the constant; Grok 4.6 → this issue. Nothing detects the rot (an all-miss list falls back to the full picker, a partial miss silently drops the entry), and the pinned ids live in <code>packages/agent-runtime</code> (host-daemon side) even though AGENTS.md says the server owns product defaults such as tool/model lists. Neither is a blocker for the one-line fix, but the fix will rot again on the next Cursor release.</p>

  <h2>Proposed fix (first principles)</h2>
  <ol>
    <li><b>Immediate</b>: in <code>packages/agent-runtime/src/acp-launch-specs.ts</code> replace <code>"cursor-grok-4.5-medium"</code> with <code>"cursor-grok-4.6-medium"</code> (<a href="1688/repro/proposed-fix.diff">proposed-fix.diff</a>). Grok 4.5 moves to "More models" and stays selectable; existing threads pinned to a 4.5 id are unaffected because <code>splitPrimaryModels</code> only classifies, and the CLI/app re-include a selected model. No <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump: <code>primaryModels</code> is already <code>string[]</code> on the wire, only a value changes (same as <code>9daeffb7f</code>). No test in the repo pins the 4.5 id (<code>grep -rn cursor-grok-4.5</code> hits only the spec). Add the vitest above (drop the 4.5 sanity assertion) so the next drift is at least visible when the fixture is refreshed.</li>
    <li><b>Durable</b> (optional, larger): stop pinning versions. Either (a) let <code>primaryModels</code> entries be family-prefix patterns (e.g. <code>cursor-grok-*</code>, <code>gpt-5.6-sol-*</code>) and pick the highest version present per pattern in <code>splitPrimaryModels</code>, or (b) keep exact ids but move the table to the server (product policy) so it can be updated without a daemon release, and add a startup/CI check that logs when a listed id matches nothing in the live catalog. Risk with (a): version comparison across Cursor's ad-hoc naming (<code>gpt-5.6-sol</code> vs <code>gpt-5.6-luna</code>, <code>claude-opus-5-thinking</code>) needs care; a simple numeric-suffix comparison inside one family prefix is enough for the Grok case. Option (a) would also change the meaning of an existing wire field and so needs a <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump.</li>
  </ol>

  <h2>PR review</h2>
  <h3>#1687 · Promote Cursor Grok 4.6 in the model picker (state: CLOSED 2026-08-18, mergeable: CONFLICTING)</h3>
  <p><b>What it changes.</b> One line: <code>packages/agent-runtime/src/acp/profiles.ts</code> <code>"cursor-grok-4.5-medium"</code> → <code>"cursor-grok-4.6-medium"</code>. Head <code>d25224295</code>, based on <code>ba4265453</code> (before #1640).</p>
  <p><b>Does it address the root cause?</b> The intent is exactly the immediate fix (the value is the correct family id; I verified it against the real catalog in the vitest). But the file it edits was deleted on main by #1640 (<code>c5b53caab</code>): git rename-detects it against <code>plugins/provider-acp/src/profiles.ts</code>, which no longer contains any <code>primaryModels</code>, and the merge conflicts (<a href="1688/repro/pr-1687-merge-tree.txt">pr-1687-merge-tree.txt</a>):</p>
  <pre>{merge_tree}</pre>
  <p>Even if the conflict were resolved by dropping the hunk, the PR would change nothing, because the live policy is now in <code>packages/agent-runtime/src/acp-launch-specs.ts#L32</code>. So on today's main it does <b>not</b> fix the issue.</p>
  <p><b>Findings.</b></p>
  <ul>
    <li><b>Blocking</b> — <code>packages/agent-runtime/src/acp/profiles.ts:63</code>: target file does not exist at <code>16ceb3a54</code>; PR is unmergeable and, rebased naively, a no-op. Needs to be re-targeted at <code>packages/agent-runtime/src/acp-launch-specs.ts:32</code>.</li>
    <li><b>Minor</b> — no test. The PR argues a model-specific assertion "would duplicate the policy value". That is true of a trivial assertion, but a fixture-driven test (real <code>--list-models</code> output through <code>buildAgentModelCatalog</code> + <code>splitPrimaryModels</code>) is what would have caught this exact drift and the id-vs-family-id mistake the #933 PR description warns about. Suggest adding one.</li>
    <li><b>OK</b> — no protocol bump needed (value change inside an existing <code>string[]</code>); no casts; no behavior change beyond the intended reorder; Grok 4.5 stays selectable under More models.</li>
    <li><b>Note</b> — the description's "Verified with a source-built dev server where <code>bb provider models acp-cursor --json</code> returns Cursor Grok 4.6 as the second primary model" can only have been true on the pre-#1640 base the branch was cut from.</li>
  </ul>
  <p><b>Tests I ran.</b> Fetched <code>pull/1687/head</code>; <code>gh pr view --json mergeable</code> → <code>CONFLICTING</code>; <code>git merge-tree --write-tree 16ceb3a54 pr-1687</code> → content conflict on the renamed file. Applied the equivalent one-line change to <code>acp-launch-specs.ts</code> in my worktree instead: repro vitest goes red → green (section C); reverted afterwards.</p>
  <p><b>Verdict: CLOSE</b> (already closed by the maintainer as obsolete; agree). A fresh PR against <code>acp-launch-specs.ts</code> with the fixture test is a MERGE-quality change.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/933">#933</a> / <code>9daeffb7f</code>: the previous instance of the same rot (Grok 4.5, GPT-5.6 Sol, Opus 5 hidden under More models); its PR description documents the family-id rule used here.</li>
    <li><a href="https://github.com/get-bb/bb/pull/1640">#1640</a> (<code>c5b53caab</code>): moved the Cursor policy from <code>packages/agent-runtime/src/acp/profiles.ts</code> to <code>packages/agent-runtime/src/acp-launch-specs.ts</code>; the reason #1687 conflicts.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1612">#1612</a>: recursive tool schemas broke every Grok 4.6 turn (fixed by #1613 on origin/main); explicitly out of scope here, but promoting 4.6 in the picker only makes sense once that fix ships.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1231">#1231</a>: Cursor model discovery could launch the wrong executable (why the spec uses <code>cursor-agent</code>, not <code>agent</code>).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
  <pre>gh issue view 1688 --json title,body,state,labels,comments
gh pr view 1687; gh pr diff 1687; gh pr view 1687 --json mergeable,mergeStateStatus,headRefOid,comments
{GITCO} 16ceb3a54 &amp;&amp; pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
git fetch origin main; git log 16ceb3a54..origin/main -- packages/agent-runtime/src/acp-launch-specs.ts plugins/provider-acp/src/bridge/model-catalog.ts   # empty
grep -rn "primaryModels" --include=*.ts apps packages plugins | grep -v node_modules
git log --oneline -S"cursor-grok-4.5-medium"      # c5b53caab (#1640), 9daeffb7f (#937 / #933)
git ls-tree 16ceb3a54 -- packages/agent-runtime/src/acp/profiles.ts   # empty: file gone
cursor-agent --version; cursor-agent --list-models &gt; 1688/repro/cursor-agent-list-models.txt
scripts/bb-dev-app current; export BB_SERVER_URL=http://localhost:20192 BB_HOST_DAEMON_PORT=28192 BB_PROJECT_ID=proj_personal
node packages/scripts/dist/commands/run-cli.js machine list --json
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/bb-1688-scratch","hostId":"host_ifkswh6bau"}}}}'
node packages/scripts/dist/commands/run-cli.js provider models acp-cursor
node packages/scripts/dist/commands/run-cli.js provider models acp-cursor --json
node packages/scripts/dist/commands/run-cli.js provider models acp-cursor --selected-model cursor-grok-4.6-medium
dev-browser --browser bb1688 --headless run 1688/repro/browser-cursor-picker.js
dev-browser --browser bb1688 --headless run 1688/repro/browser-more-models.js
cd plugins/provider-acp &amp;&amp; pnpm exec vitest run src/bridge/issue-1688-grok-4.6-primary.test.ts   # fails on main
sed -i 's/"cursor-grok-4.5-medium",/"cursor-grok-4.6-medium",/' packages/agent-runtime/src/acp-launch-specs.ts &amp;&amp; (re-run vitest: passes) &amp;&amp; {GITCO} packages/agent-runtime/src/acp-launch-specs.ts
git fetch origin pull/1687/head:pr-1687; git merge-tree --write-tree 16ceb3a54 pr-1687
pnpm dev:stop</pre>
  <h3>Family view of the Cursor catalog as returned to the CLI (<code>--json</code>, condensed)</h3>
  <pre>auto                           | Auto           | medium                          | default: medium
cursor-grok-4.5-medium         | Cursor Grok 4.5| low,medium,high                 | default: medium
gpt-5.6-sol-medium             | GPT-5.6 Sol    | none,low,medium,high,xhigh,max  | default: medium
claude-opus-5-thinking-medium  | Claude Opus 5  | none,low,medium,high,xhigh,max  | default: medium
claude-fable-5-thinking-medium | Claude Fable 5 | none,low,medium,high,xhigh,max  | default: medium
composer-2.5                   | Composer 2.5   | medium                          | default: medium</pre>
  <p>Full JSON: <a href="1688/repro/cli-provider-models-acp-cursor.json">cli-provider-models-acp-cursor.json</a>. Selected-only families seen in the app's More-models submenu (accessibility snapshot): Codex 5.3, GPT-5.2, <b>Cursor Grok 4.6</b>, Gemini 3.7 Flash, Claude Sonnet 5, GPT-5.6 Luna, Claude Opus 4.8, GPT-5.5, GPT-5.6 Terra, …</p>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/1688.html").write_text(doc)
print(len(doc))
