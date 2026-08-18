import html, pathlib

R = pathlib.Path("/tmp/bb-reports/issues/1776/repro")
test_src = (R / "Issue1776NewAutomationSeed.repro.test.tsx").read_text()
# show only the test body (after the mock harness) inline; full file is linked
marker = 'describe("issue #1776'
test_excerpt = test_src[test_src.index(marker):]
vitest_out = (R / "vitest-output.txt").read_text()
import re
ansi = re.compile(r"\x1b\[[0-9;]*m")
vitest_out = ansi.sub("", vitest_out)
# trim the giant DOM dump if any
lines = vitest_out.splitlines()
keep = [l for l in lines if l.strip()]
vitest_short = "\n".join(keep[:6] + ["..."] + keep[-22:])
step2 = (R / "step2-click-new-automation.js").read_text()
step3 = (R / "step3-click-with-existing-draft.js").read_text()

E = html.escape
BASE = "16ceb3a540f81c1189efaffb27a39b1d9443abf5"
def L(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="https://github.com/get-bb/bb/blob/{BASE}/{path}{frag}">{E(path)}{frag}</a>'

doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1776 Clicking "Create automation" doesn't create an automation</title>
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
  .v-repro {{ color:var(--high); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
  .shots {{ display:flex; gap:16px; flex-wrap:wrap; }} .shots figure {{ flex:1 1 260px; margin:0; }} .shots img {{ max-height:560px; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1776 · Clicking "Create automation" doesn't create an automation</h1>
  <p class="meta">
    <span class="pill">Type: untyped (reads as Bug / UX)</span> <span class="pill">Priority: untriaged</span> <span class="pill">Effort: unset (est. Small)</span>
    <span class="pill">area: automations plugin</span> <span class="pill">area: app composer</span>
    <a href="https://github.com/get-bb/bb/issues/1776">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>{BASE}</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>What the user sees.</b> On the <em>Automations</em> page there is one primary button, labelled <b>New automation</b> (there is no button literally labelled "Create automation" anywhere in the app; the issue paraphrases). Clicking it does not open a form or create anything: it navigates to the root <em>New thread</em> composer. That is exactly what the one-line issue says: "It just takes you to the Create thread UI".</p>
  <p><b>What is actually going on.</b> The button is, by design, a "create via chat" affordance: it is supposed to land you on the New thread composer <em>pre-filled with</em> <code>Create a new bb automation to </code> so you finish the sentence and an agent uses the automations skill / <code>bb automation create</code> CLI to build it. Two things make that read as "does nothing": (1) nothing on the Automations page or in the composer says this is how automations are created (no tooltip, no banner, the button icon is a chat bubble but the label is "New automation"), and (2) the pre-fill is applied with a "restore only if the draft is empty" rule. bb persists your New thread draft in <code>localStorage</code>; if you ever typed anything into New thread and left it, the automation prefix is silently dropped and you land on the New thread page showing your old draft. In that state there is literally no trace of "automation" on screen. I reproduced both states in the browser on the base commit and wrote a vitest that fails on main for state (2).</p>
  <p><b>Why.</b> <code>plugins/automations/app.tsx</code> calls the plugin SDK's <code>navigate.toCompose({{ focusPrompt: true, initialPrompt: "Create a new bb automation to " }})</code>. <code>useBbNavigate().toCompose</code> (<code>apps/app/src/lib/plugin-sdk-hooks.ts</code>) pushes <code>/</code> with that state and no <code>replaceInitialPrompt</code> flag (the SDK contract has no way to ask for it), so <code>RootComposeView</code> uses <code>restorePromptDraftIfEmpty</code>, a no-op whenever a draft exists. The first-party "New skill" button uses <code>replaceInitialPrompt: true</code>, so it does not have this problem; the automations plugin cannot.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>There is a "Create automation" button</td><td class="unv">Partially — label is "New automation"</td><td><code>grep -rniE "create (an )?automation"</code> over the repo finds no UI label; the only Automations page action is <code>&lt;ResourceCreateButton label="New automation"&gt;</code> ({L("plugins/automations/overview-view.tsx", 477, 481)}). Screenshot 01.</td></tr>
    <tr><td>Clicking it does not create an automation</td><td class="ok">Verified</td><td>The click handler is <code>navigate.toCompose(...)</code> ({L("plugins/automations/app.tsx", 575, 583)}); nothing calls <code>automations_create</code>. No row is created (list stays "No automations installed").</td></tr>
    <tr><td>It "just takes you to the Create thread UI"</td><td class="ok">Verified, two flavours</td><td>Empty draft: lands on New thread with the composer pre-filled <code>Create a new bb automation to </code> (screenshot 03). Existing draft: lands on New thread showing the old draft, no automation seed at all (screenshot 05; vitest fails on main).</td></tr>
    <tr><td>(implicit) this is a regression</td><td class="no">Refuted</td><td>Create-via-chat has been the design since #845/#888 (Aug 2026, "Separate Automations from Extensions"); no form ever existed. Nothing on <code>origin/main</code> after the base commit touches this path (<code>git log 16ceb3a54..origin/main -- plugins/automations apps/app/src/views/RootComposeView.tsx apps/app/src/lib/plugin-sdk-hooks.ts</code> is empty for these files).</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>{BASE}</code> (main, 2026-08-18), worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-47</code> checked out detached at the base commit.</li>
    <li>Linux 7.0.0-29-generic (Ubuntu), node v24.18.0, pnpm workspace build via <code>pnpm exec turbo run build</code>. No provider turns were run (the bug is entirely client-side).</li>
    <li>Dev instance: <code>scripts/bb-dev-app current</code> → App <code>http://localhost:17447</code>, Server <code>http://localhost:25447</code>, Host daemon <code>http://127.0.0.1:33447</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-47-d47fa26f8b11</code>. Host <code>host_ym5k45cue2</code>, one project <code>proj_ce6uayq5y6</code> ("qa", local path <code>/tmp/bb-1776-qa</code>) so the root route renders the composer instead of the empty-welcome screen.</li>
    <li>Browser: headless Chromium via <code>dev-browser</code> (Playwright), viewport 1400×900.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. Browser, empty draft (what a fresh user sees)</h3>
  <ol>
    <li>Build and start a dev instance: <code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code>. Create one project so the root page shows the composer (Appendix has the curl).</li>
    <li>Open <code>http://localhost:&lt;app port&gt;/automations</code>. Observe the only action is <b>New automation</b> (screenshot 01).</li>
    <li>Click <b>New automation</b>.</li>
  </ol>
  <p><b>Expected</b> (reporter's expectation): an automation is created, or at least a create flow (form / dialog / clearly labelled agent handoff) starts. <b>Actual</b>: the URL becomes <code>/</code> (the New thread page); the composer contains <code>Create a new bb automation to </code>; nothing explains that you are supposed to finish the sentence and send it to an agent. Script: <a href="1776/repro/step2-click-new-automation.js">1776/repro/step2-click-new-automation.js</a>. Output:</p>
  <pre>$ dev-browser --browser bb1776 --headless run /tmp/bb-reports/issues/1776/repro/step2-click-new-automation.js
url after click: http://localhost:17447/
composer text: "Create a new bb automation to "
localStorage draft keys: [["bb.promptbox.contents-draft-3","{{\\"text\\":\\"Create a new bb automation to \\",\\"attachments\\":[]}}"]]</pre>
  <div class="shots">
    <figure><img src="assets/1776-01-automations-page.png" alt="Automations page"><figcaption>01 — Before: the Automations page on the base commit. The only create affordance is the "New automation" split button (top right).</figcaption></figure>
    <figure><img src="assets/1776-02-hover-new-automation.png" alt="hovering New automation"><figcaption>02 — Triggering it: cursor on "New automation" just before the click.</figcaption></figure>
    <figure><img src="assets/1776-03-after-click-empty-draft.png" alt="root composer with automation prefix"><figcaption>03 — After the click, empty-draft case: we are on the New thread page ("/"). The composer holds "Create a new bb automation to " and nothing else indicates an automation flow.</figcaption></figure>
  </div>

  <h3>B. Browser, a New thread draft already exists (the seed is dropped)</h3>
  <ol>
    <li>Go to <code>/</code> (New thread), type anything in the composer, e.g. <code>fix the flaky test</code>, and do not send it (bb persists it as the New thread draft).</li>
    <li>Navigate to <code>/automations</code> and click <b>New automation</b>.</li>
  </ol>
  <p><b>Expected</b>: the automation prompt is visible (or the button explains what will happen). <b>Actual</b>: New thread page with the old draft <code>fix the flaky test</code>; the automation prefix is silently discarded. Script: <a href="1776/repro/step3-click-with-existing-draft.js">1776/repro/step3-click-with-existing-draft.js</a>. Output:</p>
  <pre>$ dev-browser --browser bb1776 --headless run /tmp/bb-reports/issues/1776/repro/step3-click-with-existing-draft.js
url after click: http://localhost:17447/
composer text: "fix the flaky test"</pre>
  <div class="shots">
    <figure><img src="assets/1776-04-existing-draft.png" alt="New thread with a typed draft"><figcaption>04 — Before: New thread composer holding a draft ("fix the flaky test").</figcaption></figure>
    <figure><img src="assets/1776-05-after-click-existing-draft.png" alt="after New automation click with existing draft"><figcaption>05 — After clicking "New automation" from /automations: same New thread page, same draft, no automation text anywhere. This is the literal "just takes you to the Create thread UI" state.</figcaption></figure>
  </div>

  <h3>C. Unit-level repro (vitest, fails on main)</h3>
  <p>File: <a href="1776/repro/Issue1776NewAutomationSeed.repro.test.tsx">1776/repro/Issue1776NewAutomationSeed.repro.test.tsx</a> (place it at <code>apps/app/src/components/plugin/Issue1776NewAutomationSeed.repro.test.tsx</code>; the mock harness at the top is copied verbatim from <code>PluginNewThreadComposer.test.tsx</code> in the same directory). It renders the real <code>RootComposeView</code> in a memory router with exactly the location state that <code>useBbNavigate().toCompose</code> produces for the automations button, once with an empty persisted draft (passes) and once with a leftover draft (fails: the composer keeps the draft). Run: <code>cd apps/app &amp;&amp; pnpm exec vitest run src/components/plugin/Issue1776NewAutomationSeed.repro.test.tsx</code>. Test body:</p>
  <pre>{E(test_excerpt)}</pre>
  <p>Output (<a href="1776/repro/vitest-output.txt">full log</a>): the second test fails with <code>expected 'fix the flaky test' to contain 'Create a new bb automation to '</code>.</p>
  <pre>{E(vitest_short)}</pre>

  <h2>Root cause</h2>
  <p><b>1. The button is a chat handoff, and nothing tells the user.</b> The Automations page action is a <code>ResourceCreateButton</code> whose primary click calls <code>onCreate()</code> with no template ({L("packages/shared-ui/src/components/ui/resource/toolbar.tsx", 621, 631)}); the plugin wires it to <code>createViaChat</code>:</p>
  <pre>{E('''const createViaChat = useCallback(
  (prompt?: string) => {
    navigate.toCompose({
      focusPrompt: true,
      initialPrompt: prompt ?? CREATE_AUTOMATION_PROMPT,   // "Create a new bb automation to "
    });
  },
  [navigate],
);''')}</pre>
  <p>({L("plugins/automations/app.tsx", 575, 583)}, prefix at {L("plugins/automations/overview-view.tsx", 57, 57)}.) There is no direct-create UI (form/dialog) in the plugin: creation is meant to happen through an agent thread that runs <code>bb automation create</code> (the plugin ships the <code>automations</code> skill for that; CLI at {L("plugins/automations/src/cli.ts", 568, 568)}). The page copy ("Manage scheduled bb work…"), the button label ("New automation"), and the landing page (a bare composer) never say so, so a user reasonably concludes the button is broken.</p>

  <p><b>2. The seed is applied "only if the draft is empty", and the plugin cannot ask otherwise.</b> <code>toCompose</code> in the SDK bridge builds location state without <code>replaceInitialPrompt</code> unless the caller is already on an automation <em>edit</em> route ({L("apps/app/src/lib/plugin-sdk-hooks.ts", 313, 333)}):</p>
  <pre>{E('''void navigate(getRootComposeRoutePath(), {
  ...(replacesAutomationEditRoute ? { replace: true } : {}),
  state: {
    focusPrompt: options?.focusPrompt ?? false,
    initialPrompt: options?.initialPrompt ?? "",
    ...(replacesAutomationEditRoute ? { replaceInitialPrompt: true } : {}),
  },
});''')}</pre>
  <p><code>RootComposeView</code> then does ({L("apps/app/src/views/RootComposeView.tsx", 923, 941)}):</p>
  <pre>{E('''const initialPrompt = readInitialPromptFromLocationState(location.state);
if (initialPrompt === null) return;
const nextDraft = { text: initialPrompt, mentions: [], attachments: [] };
if (shouldReplaceInitialPromptFromLocationState(location.state)) {
  setPromptDraft(nextDraft);
} else {
  restorePromptDraftIfEmpty(nextDraft);   // no-op when a draft exists
}
navigate(getRootComposeRoutePath() + location.search, { replace: true, state: { focusPrompt: true } });''')}</pre>
  <p>and <code>restorePromptDraftIfEmpty</code> returns early when the persisted <code>new-thread</code> draft is non-empty ({L("apps/app/src/hooks/usePromptDraftStorage.ts", 207, 224)}). The persisted draft key is <code>bb.promptbox.contents-draft-3</code> in <code>localStorage</code>, so any abandoned New thread text (from any earlier session) permanently disables the automation seed until the user clears it by hand. The plugin SDK contract <code>toCompose(options?: {{ initialPrompt?: string; focusPrompt?: boolean }})</code> ({L("packages/plugin-sdk/src/app-contract.ts", 1362, 1362)}) exposes no way to request replacement, whereas the first-party Skills "New skill" button passes <code>replaceInitialPrompt: true</code> directly ({L("apps/app/src/components/tools/SkillsLibrary.tsx", 498, 507)}) and Plugins "New plugin" replaces when a template is chosen ({L("apps/app/src/components/plugin/PluginsOverview.tsx", 155, 163)}). Same "New X" button, three different behaviours.</p>

  <p><b>Why the symptom follows.</b> Click → route change to <code>/</code> → composer either shows an unexplained half-sentence (state A) or the user's old draft (state B). Neither creates an automation nor tells the user how one gets created, so from the outside "the button just opens New thread" is an accurate description. Deeper issue: the create-via-chat pattern relies on the agent knowing the automations skill and the user picking a project; the UI never sets that expectation.</p>

  <h2>Proposed fix (first principles)</h2>
  <ol>
    <li><b>Make the seed authoritative for explicit create actions.</b> Add an opt-in to the SDK bridge so a plugin can request replacement (e.g. <code>toCompose({{ initialPrompt, focusPrompt, replaceDraft: true }})</code>; new SDK surface must ship as <code>experimental_</code>-prefixed per AGENTS.md, or alternatively have <code>toCompose</code> always set <code>replaceInitialPrompt: true</code> when <code>initialPrompt</code> is non-empty, matching Skills). Then pass it from <code>createViaChat</code> in <code>plugins/automations/app.tsx</code>. Risk: replacing silently discards a user's unsent New thread draft; mitigate by only replacing when the existing draft is not itself a create-prefix, or by showing the usual draft-restore affordance. This is app-only; no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump.</li>
    <li><b>Explain the handoff.</b> Either relabel the button (e.g. "New automation with agent" / tooltip "Opens a thread that creates the automation for you") or, better, render a small dismissible callout on the composer when it was seeded by a create action ("bb will ask an agent to create this automation. Describe what it should do and when.") — the dead <code>createDraftKind</code> state field that Skills already sends ({L("apps/app/src/components/tools/SkillsLibrary.tsx", 504, 504)}) is the natural carrier for that.</li>
    <li>Optionally, add a direct path for users who do not want a chat: a minimal create dialog (name, schedule, prompt, project) that calls the existing <code>automations_create</code> RPC ({L("plugins/automations/src/rpc.ts", 95, 95)}). This is a product decision; 1+2 alone would already make the button match its label.</li>
    <li>Regression test: the vitest in section C (assert the seed wins over a leftover draft), plus one asserting the callout renders when the seed came from a create action.</li>
  </ol>

  <h2>PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1685">#1685</a> (closed by #1694): infinite render loop when clicking "New plugin" — same root-composer seed effect; the fix kept the <code>restoreIfEmpty</code> path for the plain button, which is the path automations always take.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1676">#1676</a>: reload flashes on the Tasks empty state / plugin route chrome (adjacent plugin-panel navigation polish).</li>
    <li><a href="https://github.com/get-bb/bb/issues/1679">#1679</a>: plugin nav panels cannot describe their route depth (plugin ↔ app-shell contract gaps of the same kind as the missing <code>replaceInitialPrompt</code> option).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
  <pre>{E('''gh issue view 1776 --repo get-bb/bb --json title,body,labels,state,createdAt,author,comments,url
# body: "It just takes you to the \\"Create thread\\" UI :) "  (no comments, no labels)
git fetch origin main; git checkout 16ceb3a54
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
grep -rniE "create (an )?automation" --include=*.tsx --include=*.ts --include=*.md .   # no UI label
grep -rn "ResourceCreateButton" packages/shared-ui plugins/automations apps/app/src
git log --oneline -S"CREATE_AUTOMATION_PROMPT" -- plugins/automations apps/app/src
git log --oneline 16ceb3a54..origin/main -- plugins/automations apps/app/src/views/RootComposeView.tsx apps/app/src/lib/plugin-sdk-hooks.ts   # empty
scripts/bb-dev-app current      # App :17447, Server :25447, Host daemon :33447
mkdir -p /tmp/bb-1776-qa && cd /tmp/bb-1776-qa && git init && echo hi > README.md && git add . && git commit -m init
curl -s http://localhost:25447/api/v1/hosts    # host_ym5k45cue2
curl -s -X POST http://localhost:25447/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/bb-1776-qa","hostId":"host_ym5k45cue2"}}'   # proj_ce6uayq5y6
dev-browser --browser bb1776 --headless --idle-timeout 10m run /tmp/bb-reports/issues/1776/repro/step1-automations-page.js
dev-browser --browser bb1776 --headless --idle-timeout 10m run /tmp/bb-reports/issues/1776/repro/step2-click-new-automation.js
dev-browser --browser bb1776 --headless --idle-timeout 10m run /tmp/bb-reports/issues/1776/repro/step3-click-with-existing-draft.js
cd apps/app && pnpm exec vitest run src/components/plugin/Issue1776NewAutomationSeed.repro.test.tsx
pnpm dev:stop''')}</pre>
  <h3>Browser scripts</h3>
  <p><a href="1776/repro/step2-click-new-automation.js">step2-click-new-automation.js</a>:</p>
  <pre>{E(step2)}</pre>
  <p><a href="1776/repro/step3-click-with-existing-draft.js">step3-click-with-existing-draft.js</a>:</p>
  <pre>{E(step3)}</pre>
  <h3>Things checked and ruled out</h3>
  <ul>
    <li>No RPC/network error on click: the button never calls the server; the automations list stays empty because nothing is meant to be created at that point.</li>
    <li>The composer "plus" menu has an "Automation" action that inserts the provider <code>/automation </code> command ({L("apps/app/src/components/promptbox/PromptBoxActionsMenu.tsx", 55, 63)}); it is a separate entry point and not what the issue describes.</li>
    <li>The 5 commits on <code>origin/main</code> after the base commit (up to <code>a108fa7ef</code>) do not touch the automations overview, the SDK <code>toCompose</code> bridge, or the root-composer seed effect.</li>
  </ul>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/1776.html").write_text(doc)
print("ok", len(doc))
