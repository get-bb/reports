#!/usr/bin/env python3
"""Builds /tmp/bb-reports/issues/2160.html from the repro artifacts."""
import html
import pathlib

R = pathlib.Path('/tmp/bb-reports/issues/2160/repro')
test_src = (R / 'model-switch.repro.test.ts').read_text()
unit_main = (R / 'unit-test-main.clean.log').read_text()
lines = unit_main.splitlines()
start = next(i for i, l in enumerate(lines) if 'Failed Tests' in l)
unit_main_trim = "\n".join(lines[start:start + 75])
patch = (R / 'prototype-fix.patch').read_text()
pi_models = (R / 'pi-assistant-models.txt').read_text()
bb_models = (R / 'bb-turn-models.txt').read_text()
e = html.escape
SHA = 'fcada5a3b88302acb9944aa74b11db4ecaa215a0'
NL = "\n"


def pl(path, a, b=None):
    frag = f"#L{a}" + (f"-L{b}" if b else "")
    return f'<a href="https://github.com/get-bb/bb/blob/{SHA}/{path}{frag}">{path}{frag}</a>'


pm = pi_models.splitlines()
bm = bb_models.splitlines()

CONTRACT = '''/**
 * The runtime never diffs these options. They ride every command; the bridge
 * reconciles internally (apply live where it can, rebuild its provider
 * session where it must) and a rebuild is always reported via the
 * `session/replaced` notification — never silent.
 */'''
RECONF = '''    if (settingsChange !== "session") {
      // Live settings ride on the next turn command; record them without
      // replacing the session (which would kill its background tasks).
      setThreadRuntimeConfig(args.threadId, { ...currentConfig, options: nextOptions });
      return;
    }'''
START = '''    const configuredModel = resolveConfiguredModel(services.modelRuntime, this.options.model);
    ...
    const { session } = await createAgentSessionFromServices({
      services,
      sessionManager: ...,
      ...(configuredModel ? { model: configuredModel } : {}),
      ...(this.options.thinkingLevel ? { thinkingLevel: this.options.thinkingLevel } : {}),
      customTools,
    });'''
COMPACTION_ENTRY = '''# pi-session-thr_ahgjgq8fc9.jsonl (revised run; summary text elided)
{"type": "compaction", "id": "f023936f", "timestamp": "2026-08-21T15:49:23.740Z",
 "firstKeptEntryId": "d9bce5e5", "tokensBefore": 47429,
 "usage": {"input": 305, "output": 305, "reasoning": 64, "totalTokens": 610,
           "cost": {"input": 7.625e-05, "output": 0.00061, "total": 0.00068625}}, "fromHook": false}
# original run, pi-session-thr_iyyz7w3cxf.jsonl: same shape, tokensBefore 30011, cost.input 7.625e-05 for 305 input tokens'''
REGRESSION = '''$ git log --oneline -S'classifyExecutionSettingsChange: () => "live"' -- packages/agent-runtime/src/bridge-protocol-adapter.ts
c5b53caab Agent providers as a first-class plugin surface (provider bridge protocol) (#1640)

$ git show c5b53caab -- packages/agent-runtime/src/pi/ | grep -n classifySessionExecutionSettingsChange
-import { classifySessionExecutionSettingsChange } from "../execution-options.js";
-      classifyExecutionSettingsChange: classifySessionExecutionSettingsChange,

$ git log fcada5a3b..origin/main --oneline -- packages/agent-runtime/src/pi
(empty: not fixed on origin/main as of 2026-08-21)'''
VERIFY = '''$ pnpm exec vitest run src/pi/bridge/__tests__/model-switch.repro.test.ts   # with prototype-fix.patch
 Test Files  1 passed (1)
      Tests  2 passed (2)
$ pnpm exec vitest run src/pi      # base, before adding the repro file: the 11 pre-existing suites
 Test Files  11 passed (11)
      Tests  147 passed (147)
$ pnpm exec vitest run src/pi      # with prototype-fix.patch + the repro file
 Test Files  12 passed (12)
      Tests  149 passed (149)
$ pnpm exec turbo run typecheck --filter=@bb/agent-runtime --force
 Tasks:    4 successful, 4 total
Cached:    0 cached, 4 total'''
COMMANDS = '''gh issue view 2160 --comments
pnpm install --frozen-lockfile --prefer-offline && pnpm exec turbo run build
git fetch origin main && git log fcada5a3b..origin/main --oneline -- packages/agent-runtime/src/pi
cd packages/agent-runtime && pnpm exec vitest run src/pi/bridge/__tests__/model-switch.repro.test.ts   # fails on base
scripts/bb-dev-app current ; eval "$(scripts/bb-dev-app env)"
curl -s -X POST $BB_SERVER_URL/api/v1/projects ... /tmp/bb-2160-qa
pnpm bb:dev thread spawn --provider pi --model anthropic/claude-haiku-4-5 ...      # provider/error: OAuth refresh failed (anthropic)
pnpm bb:dev thread spawn --provider pi --model openai-codex/gpt-5.4-mini ...      # provider/error: refresh_token_reused (openai-codex)
pnpm bb:dev thread spawn --provider pi --model github-copilot/gpt-5-mini ...      # original run: thr_iyyz7w3cxf
pnpm bb:dev thread tell thr_iyyz7w3cxf --model github-copilot/grok-4.6 --mode auto "Reply only with ok."   # x2
2160/repro/tell-file.sh thr_iyyz7w3cxf github-copilot/grok-4.6 /tmp/bb-2160-qa/filler.txt
pnpm bb:dev thread compact thr_iyyz7w3cxf
pnpm bb:dev thread tell thr_iyyz7w3cxf --model github-copilot/grok-4.6 --mode auto "Reply only with ok."
pnpm bb:dev thread stop thr_iyyz7w3cxf ; pnpm bb:dev thread tell ... (hung 4 min once, interrupted) ; stop ; tell again (ok, grok-4.6)
pnpm bb:dev thread spawn --provider pi --model github-copilot/grok-4.6 ...        # thr_chmuwwhpyh, grok-4.6 works fresh
doobie --headless < 2160/repro/screenshot-thread.js ; ... screenshot-picker.js
# revised run (section 4a output), same commands via the env-based helper scripts, thread thr_ahgjgq8fc9:
pnpm bb:dev thread spawn --project proj_6uckkwts97 --provider pi --model github-copilot/gpt-5-mini ...
pnpm bb:dev thread tell thr_ahgjgq8fc9 --model github-copilot/grok-4.6 --mode auto "Reply only with ok."
2160/repro/make-filler.sh ; 2160/repro/tell-file.sh thr_ahgjgq8fc9 github-copilot/grok-4.6 /tmp/bb-2160-qa/filler.txt
pnpm bb:dev thread compact thr_ahgjgq8fc9 ; pnpm bb:dev thread tell thr_ahgjgq8fc9 --model github-copilot/grok-4.6 ...
pnpm bb:dev thread stop thr_ahgjgq8fc9 ; pnpm bb:dev thread tell thr_ahgjgq8fc9 --model github-copilot/grok-4.6 ...
python3 2160/repro/bb-turn-models.py thr_ahgjgq8fc9 ; 2160/repro/pi-assistant-models.sh ~/.bb/pi-bridge-sessions/thr_ahgjgq8fc9.jsonl
pnpm dev:stop ; cleanup'''

CREATE_PROJECT = '''mkdir -p /tmp/bb-2160-qa && git -C /tmp/bb-2160-qa init -q && echo "# qa" > /tmp/bb-2160-qa/README.md \\
  && git -C /tmp/bb-2160-qa add -A && git -C /tmp/bb-2160-qa -c user.email=qa@example.com -c user.name=qa commit -qm init
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/bb-2160-qa","hostId":"<host id from: pnpm bb:dev machine list>"}}'
# -> {"id":"proj_6uckkwts97", ...}      (your id will differ; use it in the next step)
export BB_PROJECT_ID=proj_6uckkwts97'''

doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #2160 Pi keeps using previous model after model picker change until /compact</title>
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
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:6px; }}
  details summary {{ cursor:pointer; color:var(--accent); }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#2160 · Pi keeps using previous model after model picker change until /compact</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill high">Priority: High</span> <span class="pill">Effort: unset</span> <span class="pill">providers</span> <span class="pill">provider-pi</span>
    <a href="https://github.com/get-bb/bb/issues/2160">open on GitHub</a>
    <span>2026-08-21 · base <code>fcada5a3b</code></span>
  </p>
  <p><strong>Verdict:</strong> <span class="verdict no">REPRODUCED</span> (live against the real Pi SDK, twice, plus a unit test that fails on base; independently verified) · <strong>Root-cause confidence:</strong> high</p>
  <p>One sub-claim is refuted: <code>/compact</code> is <em>not</em> what resynchronises the model. Only a provider-session rebuild (<code>thread/resume</code>: after <code>bb thread stop</code>, a daemon restart, bridge recovery, or the idle-session reaper) does.</p>

  <h2>1. TL;DR</h2>
  <p>In a Pi thread, picking a different model in bb's composer changes what bb <em>records</em> (every <code>client/turn/requested</code> event carries the new model) but not what Pi <em>uses</em>: every later turn, and any manual compaction, is still sent to the model the Pi session was constructed with. The user sees "Grok 4.6" in the picker while Pi keeps billing gpt-5-mini (or, in the reporter's case, keeps billing Grok after they picked GPT).</p>
  <p>The cause is a missing piece in the Pi provider bridge. Since the provider-bridge-protocol migration (<code>c5b53caab</code>, #1640, 2026-08-17) the runtime no longer diffs execution options: it sends them on every <code>turn/start</code> and expects each bridge to reconcile them itself (the Codex and Claude bridges do). The Pi bridge reads <code>options.model</code> and <code>options.reasoningLevel</code> only when it constructs a session (<code>thread/start</code>/<code>resume</code>/<code>fork</code>); its <code>handleTurnStart</code> ignores <code>params.options</code> entirely, so <code>AgentSession.setModel</code> is never called and the session is never rebuilt. Before #1640 the legacy Pi adapter classified a model change as a "session" change, which made the runtime send <code>thread/resume</code> and rebuild the Pi session with the new model; that path was deleted and nothing replaced it.</p>
  <p>The reporter's observation that <code>/compact</code> fixed it is a coincidence: compaction is just another <code>turn/start</code> through the same handler, and I reproduced a real compaction followed by another stale-model turn. What does fix it is anything that rebuilds the Pi session; I demonstrated this with <code>bb thread stop</code> followed by a new turn.</p>

  <h2>2. Claims vs findings</h2>
  <table><tr><th>Claim from the issue</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Changing the model in bb's picker does not change the model Pi uses for new turns.</td><td class="ok">Verified</td><td>Live, three independent runs (author x2, verifier x1): thread started on <code>github-copilot/gpt-5-mini</code>, every later turn requested with <code>github-copilot/grok-4.6</code> (five in the revised run); Pi's session file records <code>github-copilot/gpt-5-mini</code> on every assistant message until the session is rebuilt (section 4a). Unit test fails on base (section 4b).</td></tr>
    <tr><td>bb's <code>client/turn/requested</code> events record the newly selected model.</td><td class="ok">Verified</td><td><code>bb-turn-models.txt</code> (revised run, <code>thr_ahgjgq8fc9</code>): seq 16, 25, 34, 41, 50 all carry <code>model=github-copilot/grok-4.6</code>; only seq 1 (the spawn) carries <code>gpt-5-mini</code>. Original run (<code>thread-events-final.json</code>): seq 12, 21, 28, 37, 44.</td></tr>
    <tr><td>The Pi session has only the initial <code>model_change</code> entry.</td><td class="ok">Verified</td><td>Session file has exactly one <code>model_change</code> (the construction one). Note: even a successful resume with a new model does not append a <code>model_change</code> (the SDK appends it only for brand-new sessions), so the per-message <code>provider</code>/<code>model</code> fields are the reliable evidence, not <code>model_change</code> entries.</td></tr>
    <tr><td>Manual compaction is the synchronisation boundary; after <code>/compact</code> Pi used the selected model.</td><td class="no">Refuted</td><td>Performed a real compaction (<code>tokensBefore=30011</code> in the original run, <code>47429</code> in the revised run, summary written both times) and sent another turn with grok-4.6 selected: Pi still answered with <code>gpt-5-mini</code> both times (and a third time for the independent verifier, <code>tokensBefore=33854</code>). No code path rebuilds or re-models the session on compaction (section 5). What resynchronised the reporter's thread was almost certainly a session rebuild (<code>thread/resume</code>) that happened around the same time: daemon restart (they run nightlies with auto-update), bridge recovery, or the idle reaper. I demonstrated that <code>bb thread stop</code> + a new turn does switch the model (revised run: seq 51 <code>thread/identity</code>, then a <code>grok-4.6</code> assistant message; original run: seq 60).</td></tr>
    <tr><td>The compaction itself used the stale model and may consume unintended quota.</td><td class="ok">Verified (code + pricing)</td><td><code>AgentSession.compact()</code> summarises with <code>this.model</code> (the stale one). The compaction entry records no model, but its usage cost (305 input tokens at $7.6e-05, i.e. $0.25/M) matches gpt-5-mini pricing, not grok-4.6.</td></tr>
    <tr><td>This was real inference, not usage-dashboard polling.</td><td class="ok">Verified</td><td>Pi's assistant messages carry <code>usage.input</code> of 106 to 47583 tokens (84 to 29958 in the original run) with the stale model name; those are real requests.</td></tr>
    <tr><td>Starting a new thread is the safest workaround.</td><td class="ok">Verified</td><td>A fresh thread constructs a new session with the picked model (<code>thr_chmuwwhpyh</code> on grok-4.6 answered as grok-4.6). A cheaper workaround that keeps history: <code>bb thread stop &lt;id&gt;</code> (release) and then send the next message; the resume rebuilds the session with the current model.</td></tr>
  </table>

  <h2>3. Environment</h2>
  <ul>
    <li>bb monorepo at <code>fcada5a3b88302acb9944aa74b11db4ecaa215a0</code> (main, 2026-08-21; packaged version 0.39.0). Reporter was on <code>0.39.1-nightly.32358956903.1</code>; both contain the regressing commit <code>c5b53caab</code>. <code>origin/main</code> (2 commits ahead) does not touch <code>packages/agent-runtime/src/pi</code>.</li>
    <li>macOS 26.5.2, node v22.23.1, bundled Pi SDK <code>@earendil-works/pi-coding-agent</code> 0.84.0 (same as the reporter's bundled Pi 0.84.0).</li>
    <li>Pi model providers authenticated on this machine: anthropic, openai-codex, github-copilot. Anthropic and openai-codex OAuth refreshes failed during the run (token reuse on the shared <code>~/.pi/agent/auth.json</code>), so the live repro switches between two <strong>github-copilot</strong> models. The bug is model-level, not provider-level, so the cross-model switch exercises the same code path as the reporter's cross-provider switch.</li>
    <li>Isolated dev instances from <code>scripts/bb-dev-app current</code>: original run App <code>:17835</code> / Server <code>:25835</code> / Host daemon <code>:33835</code>; revised run (the output shown in section 4a) App <code>:15047</code> / Server <code>:23047</code> / Host daemon <code>:31047</code>, data dir <code>~/.bb-dev/…wf_21e66a79-f02-13-8d26b48f1e80</code>; independent verifier <code>:16919</code>/<code>:24919</code>/<code>:32919</code>. All data dirs deleted at cleanup. None of the helper scripts hardcode a port: they read <code>BB_SERVER_URL</code> from <code>eval "$(scripts/bb-dev-app env)"</code>. The Pi bridge always writes session files to <code>~/.bb/pi-bridge-sessions/</code> regardless of data dir, because <code>BB_PI_BRIDGE_SESSION_DIR</code> is stripped with every other <code>BB_*</code> var from bridge children; my thread files were copied to the repro dir and then removed.</li>
  </ul>

  <h2>4. Minimal reproduction</h2>
  <h3>4a. Live (real Pi SDK, bb CLI)</h3>
  <ol>
    <li>From your bb worktree, start an isolated dev instance and load its env. Every helper script below reads <code>BB_SERVER_URL</code> / <code>BB_HOST_DAEMON_PORT</code> from this env, so run all steps from the same shell (or re-run the <code>eval</code> in each new one): <pre>scripts/bb-dev-app current            # prints App / Server / Host daemon URLs and the data dir
eval "$(scripts/bb-dev-app env)"
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE   # only needed if you run this from inside a bb thread</pre></li>
    <li>Create a scratch repo and project: <pre>{e(CREATE_PROJECT)}</pre></li>
    <li>Spawn a Pi thread on model A and wait for it to go idle (the paths below assume the report's <code>2160/repro/</code> directory; any two models you are authenticated for in Pi will do): <pre>pnpm bb:dev thread spawn --project $BB_PROJECT_ID --provider pi --model github-copilot/gpt-5-mini \\
  --reasoning-level low --title "2160 repro" --prompt "Reply only with ok." --json
# -> "id": "thr_ahgjgq8fc9"
2160/repro/wait-idle.sh thr_ahgjgq8fc9            # polls $BB_SERVER_URL until idle</pre>
<pre>08:48:39 poll 2 status=starting
08:48:43 poll 4 status=active
08:48:46 poll 5 status=idle</pre></li>
    <li>Send a new turn with model B selected (this is exactly what the composer's picker does): <pre>pnpm bb:dev thread tell thr_ahgjgq8fc9 --model github-copilot/grok-4.6 --mode auto "Reply only with ok."
2160/repro/wait-idle.sh thr_ahgjgq8fc9</pre></li>
    <li>Compare what bb recorded with what Pi used (the Pi bridge always writes its session files under <code>~/.bb/pi-bridge-sessions/</code>, even for a dev instance; see section 3): <pre>python3 2160/repro/bb-turn-models.py thr_ahgjgq8fc9                                # bb's event log, via $BB_SERVER_URL
2160/repro/pi-assistant-models.sh ~/.bb/pi-bridge-sessions/thr_ahgjgq8fc9.jsonl   # Pi's session file</pre>
<pre>expected (Pi session file): second assistant message is github-copilot/grok-4.6
actual:
{e(NL.join(pm[0:4]))}
{e(pm[4])}   &lt;-- requested as grok-4.6, answered by gpt-5-mini

bb event log for the same turns:
{e(NL.join(bm[0:10]))}</pre></li>
    <li>Test the "compaction syncs it" claim. A real compaction needs more than 20k tokens of history (Pi's default <code>keepRecentTokens</code>), so generate ~160 KB of filler, send it as one turn, then compact, then send another turn: <pre>2160/repro/make-filler.sh                                   # writes /tmp/bb-2160-qa/filler.txt (2000 lines, 164088 bytes)
2160/repro/tell-file.sh thr_ahgjgq8fc9 github-copilot/grok-4.6 /tmp/bb-2160-qa/filler.txt
2160/repro/wait-idle.sh thr_ahgjgq8fc9
pnpm bb:dev thread compact thr_ahgjgq8fc9
2160/repro/wait-idle.sh thr_ahgjgq8fc9
pnpm bb:dev thread tell thr_ahgjgq8fc9 --model github-copilot/grok-4.6 --mode auto "Reply only with ok."
2160/repro/wait-idle.sh thr_ahgjgq8fc9
2160/repro/pi-assistant-models.sh ~/.bb/pi-bridge-sessions/thr_ahgjgq8fc9.jsonl</pre>
<pre>expected: the turn after the compaction is github-copilot/grok-4.6
actual:
{e(NL.join(pm[5:10]))}   &lt;-- still gpt-5-mini after a real compaction (tokensBefore=47429, summary written)</pre>
(The filler is one ~42k-token message, larger than <code>keepRecentTokens</code>, so Pi keeps it whole and the post-compaction <code>in=</code> does not drop. That is a property of Pi's compaction cut-point, not of this bug; the compaction itself is real: a <code>compaction</code> entry with a summary was appended to the session file, and bb emitted <code>thread/compacted</code> at seq 38.)</li>
    <li>Show what <em>does</em> switch the model: release the runtime so the next turn resumes (rebuilds) the Pi session: <pre>pnpm bb:dev thread stop thr_ahgjgq8fc9
pnpm bb:dev thread tell thr_ahgjgq8fc9 --model github-copilot/grok-4.6 --mode auto "Reply only with ok."
2160/repro/wait-idle.sh thr_ahgjgq8fc9
2160/repro/pi-assistant-models.sh ~/.bb/pi-bridge-sessions/thr_ahgjgq8fc9.jsonl | tail -2
python3 2160/repro/bb-turn-models.py thr_ahgjgq8fc9 | tail -5</pre>
<pre>{e(NL.join(pm[10:]))}   &lt;-- first turn after the rebuild: grok-4.6

bb event log: seq 51 thread/identity (= thread/resume, new Pi session) precedes the grok-4.6 turn
{e(NL.join(bm[-5:]))}</pre>
The stop/resume cycle took about 6 s here and about 9 s for the independent verifier. (In the original run the first resumed turn hung once for ~4 minutes and had to be interrupted; the retry worked. That one-off is not part of this bug and not reproducible; see the caveats in section 9.)</li>
  </ol>
  <figure><img src="assets/2160-thread-view.png" alt="bb thread view showing Grok 4.6 selected in the composer while the turns above were answered by gpt-5-mini"><figcaption>The bb thread after step 7 (original run, <code>thr_iyyz7w3cxf</code>). The composer shows <strong>Grok 4.6 · Low</strong> as the thread's model, and every "ok" above it was requested with that model; Pi's session file shows all but the last one were answered by gpt-5-mini.</figcaption></figure>
  <figure><img src="assets/2160-model-picker.png" alt="bb model picker open on the Pi thread"><figcaption>The model picker (shift-cmd-M) on the same thread. Picking a model here only changes the <code>options.model</code> that rides the next <code>turn/start</code>; the Pi bridge never reads it.</figcaption></figure>

  <h3>4b. Unit-level repro (fails on base, no network)</h3>
  <p>File: <a href="2160/repro/model-switch.repro.test.ts">2160/repro/model-switch.repro.test.ts</a> (lives at <code>packages/agent-runtime/src/pi/bridge/__tests__/</code>). It drives the real bridge (<code>handleLine</code>) through the canonical JSON-RPC harness with the Pi SDK's session constructor mocked by a stand-in that tracks its model the way <code>AgentSession</code> does (<code>model</code> getter, <code>setModel</code>, <code>modelRuntime</code>). Run with:</p>
  <pre>cd packages/agent-runtime &amp;&amp; pnpm exec vitest run src/pi/bridge/__tests__/model-switch.repro.test.ts</pre>
  <p>On <code>fcada5a3b</code> both tests fail (<a href="2160/repro/unit-test-main.clean.log">full log</a>). The first assertion shows the second prompt still going to <code>xai/grok-4.6</code> with no <code>setModel</code> call and no rebuild; the second shows the compaction and both turns after a model change still on the construction model:</p>
  <pre>{e(unit_main_trim)}</pre>
  <details><summary>Test source</summary><pre>{e(test_src)}</pre></details>
  <p>Repro files: <a href="2160/repro/">2160/repro/</a>: helper scripts (<code>wait-idle.sh</code>, <code>tell-file.sh</code>, <code>make-filler.sh</code>, <code>bb-turn-models.py</code>, <code>pi-assistant-models.sh</code>; all take the server from <code>$BB_SERVER_URL</code>), the full Pi session files (<code>pi-session-thr_ahgjgq8fc9.jsonl</code> for the run shown above, <code>pi-session-thr_iyyz7w3cxf.jsonl</code> / <code>pi-session-thr_chmuwwhpyh.jsonl</code> for the original run), bb event dumps (<code>thread-events-thr_ahgjgq8fc9.json</code>, <code>thread-events-final.json</code> for the original run), logs, and the prototype patch. The verifier's independent artifacts are in <a href="2160/verify/">2160/verify/</a>.</p>

  <h2>5. Root cause</h2>
  <p><strong>The contract.</strong> Since #1640 the canonical bridge protocol declares that execution options are never diffed by the runtime; they ride every command and each bridge reconciles them:</p>
  <pre>{e(CONTRACT)}</pre>
  <p>{pl('packages/provider-bridge-protocol/src/execution-options.ts', 17, 23)}. The generic adapter the runtime uses for every bridge therefore answers <code>"live"</code> for every change ({pl('packages/agent-runtime/src/bridge-protocol-adapter.ts', 318, 319)}), and <code>reconfigureThreadIfNeeded</code> only stores the new options instead of sending <code>thread/resume</code> ({pl('packages/agent-runtime/src/runtime.ts', 971, 1001)}):</p>
  <pre>{e(RECONF)}</pre>
  <p><strong>The Pi bridge's half of the contract is missing.</strong> <code>options.model</code> and <code>options.reasoningLevel</code> are consumed in exactly one place, the session-construction mapping used by <code>thread/start</code>, <code>thread/resume</code> and <code>thread/fork</code> ({pl('packages/agent-runtime/src/pi/bridge/bridge.ts', 552, 571)} then {pl('packages/agent-runtime/src/pi/bridge/sdk-session.ts', 301, 324)}):</p>
  <pre>{e(START)}</pre>
  <p><code>handleTurnStart</code> ({pl('packages/agent-runtime/src/pi/bridge/bridge.ts', 963, 1002)}) reads <code>params.threadId</code>, <code>params.input</code> and <code>params.clientRequestId</code> and nothing else; it goes straight to <code>startPiCompaction</code> or <code>startPiPrompt</code> on whatever <code>PiSdkSession</code> is registered for the thread. <code>PiSdkSession</code> has no method that touches the model after <code>start()</code>, even though the SDK exposes <code>AgentSession.setModel(model)</code>, <code>setThinkingLevel(level)</code>, <code>model</code> and <code>modelRuntime</code>. So the live Pi <code>Agent</code> keeps <code>state.model</code> from construction, and every <code>prompt()</code> and <code>compact()</code> (which summarises with <code>this.model</code>) uses it.</p>
  <p><strong>Why compaction does not help.</strong> bb's manual compaction is a <code>turn/start</code> whose input is the standalone builtin <code>/compact</code> mention ({pl('apps/server/src/routes/threads/actions.ts', 135, 164)}); the bridge routes it to <code>session.compact()</code> on the same unchanged session ({pl('packages/agent-runtime/src/pi/bridge/bridge.ts', 977, 981)}). Nothing in the server, runtime or bridge rebuilds a session after <code>compaction_end</code>. The only things that construct a new Pi session, and thus pick up the current model, are <code>thread/start</code>, <code>thread/resume</code> and <code>thread/fork</code>. A resume is triggered by: the user releasing the thread (<code>bb thread stop</code>, verified above), a daemon/app restart, bridge-process recovery, or the idle-session reaper (30 min, behind the <code>providerSessionReaping</code> experiment which defaults to off). The reporter, on a nightly with auto-update, most plausibly hit one of those near their <code>/compact</code>.</p>
  <p><strong>How it regressed.</strong> Before <code>c5b53caab</code> (#1640, "Agent providers as a first-class plugin surface") the legacy Pi adapter was built with <code>classifyExecutionSettingsChange: classifySessionExecutionSettingsChange</code>, which returns <code>"session"</code> for any model/reasoning/serviceTier change (<code>git show c5b53caab -- packages/agent-runtime/src/pi/adapter.ts</code>). The runtime then sent <code>thread/resume</code> with the new options, and <code>startPiThreadSession</code> closed the old <code>PiSdkSession</code> and constructed a new one on the same session file with the new model. #1640 deleted the per-provider classification (every bridge is now <code>"live"</code>) and moved the responsibility into each bridge. Codex (<code>requireLiveSessionForTurn</code>, {pl('plugins/provider-codex/src/bridge/bridge.ts', 1363, 1396)}) and Claude (<code>applyLiveSessionSettings</code> calling <code>session.setModel</code>, {pl('plugins/provider-claude-code/src/bridge/bridge.ts', 580, 588)}) got that code; the Pi bridge did not.</p>
  <p><strong>Deeper issue.</strong> The same gap covers <code>reasoningLevel</code>: Pi's thinking level is also applied only at construction, so changing "Low" to "High" in the picker mid-thread is silently ignored too (not live-tested; same code path). And the Pi bridge's conformance/bridge tests never send a <code>turn/start</code> whose <code>options</code> differ from the construction options, which is why the contract gap was invisible.</p>

  <h2>6. Proposed fix (first principles)</h2>
  <p>Make the Pi bridge honour the contract: reconcile <code>options.model</code> and <code>options.reasoningLevel</code> on every <code>turn/start</code> (and <code>turn/steer</code>) before dispatching, applying them live to the existing <code>AgentSession</code>. The prototype below does this and turns both repro tests green while the 11 pre-existing Pi suites (147 tests) stay green (12 files / 149 tests with the repro file included) and <code>pnpm exec turbo run typecheck --filter=@bb/agent-runtime --force</code> passes. It is saved as <a href="2160/repro/prototype-fix.patch">2160/repro/prototype-fix.patch</a>.</p>
  <pre>{e(patch)}</pre>
  <p>What to watch when turning this into a real PR:</p>
  <ul>
    <li><strong><code>AgentSession.setModel</code> has a side effect the bridge must not ship as-is:</strong> besides <code>agent.state.model = model</code> and <code>sessionManager.appendModelChange</code>, it calls <code>settingsManager.setDefaultModelAndProvider(...)</code>, which <em>writes the user's global <code>~/.pi/agent/settings.json</code></em> (<code>defaultProvider</code>/<code>defaultModel</code>). Session construction does not do that today, so a per-thread bb pick would start rewriting the user's pi CLI default. <code>setThinkingLevel</code> likewise calls <code>setDefaultThinkingLevel</code>. Prefer the SDK's lower-level pieces (<code>modelRuntime.checkAuth</code>, then <code>session.agent.state.model = next</code> + <code>session.sessionManager.appendModelChange(...)</code> + <code>session.setThinkingLevel(session.thinkingLevel)</code> to re-clamp, and emit the <code>model_select</code> extension event), or ask upstream for a <code>setModel(model, {{ persist: false }})</code>. This is why I did not live-test the prototype against the user's Pi config.</li>
    <li>Apply before both branches of <code>handleTurnStart</code> (prompt <em>and</em> <code>/compact</code>) so the summarisation request also goes to the selected model, and in <code>handleTurnSteer</code> for parity with the Claude bridge.</li>
    <li>Keep the resolution semantics of <code>resolveConfiguredModel</code> (provider prefix authoritative; ambiguous bare ids rejected). A failed resolution should fail the turn with a clear error rather than silently keep the old model; the prototype does that via <code>sendError</code>.</li>
    <li>Mid-run arrival: <code>turn/start</code> can reach the bridge while a run is live (pi queues it as a follow-up). Setting the model on a live run is what pi's own TUI does, so applying live is fine; a rebuild strategy would not be (it would abort the run). If a rebuild is ever chosen, it must emit <code>session/replaced</code>.</li>
    <li>Add a bridge test that sends <code>turn/start</code> with a different <code>options.model</code>/<code>reasoningLevel</code> than <code>thread/start</code> (the repro test is a starting point), and ideally a conformance rule so no bridge can ship without reconciling options.</li>
    <li>No <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump needed: nothing on the server-daemon wire changes; the fix is entirely inside the bridge.</li>
  </ul>

  <h2>7. PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>8. Related issues</h2>
  <ul>
    <li>#1640: the provider-bridge-protocol migration that removed the per-provider "session" classification (regression source).</li>
    <li>#1236: "Apply Claude turn settings without replacing live sessions", the Claude-side precedent for live <code>setModel</code> reconciliation that Pi lacks.</li>
    <li>#1268: <code>session/replaced</code> must never be silent (relevant if a rebuild strategy is chosen instead).</li>
    <li>#2035 (Pi session persistence), #1103 / #1721 (manual compaction behaviour): cited by the reporter; unrelated to the model gap, but #1103/#1721 readers should know compaction also runs on the stale model.</li>
  </ul>

  <h2>9. Appendix</h2>
  <h3>Pi session file, assistant/model per message (<code>pi-assistant-models.txt</code>)</h3>
  <pre>{e(pi_models)}</pre>
  <h3>bb event log, model per requested turn (<code>bb-turn-models.txt</code>)</h3>
  <pre>{e(bb_models)}</pre>
  <h3>Compaction entry (model-less; cost matches gpt-5-mini)</h3>
  <pre>{e(COMPACTION_ENTRY)}</pre>
  <h3>Regression evidence</h3>
  <pre>{e(REGRESSION)}</pre>
  <h3>Prototype verification</h3>
  <pre>{e(VERIFY)}</pre>
  <h3>All commands run (abridged)</h3>
  <pre>{e(COMMANDS)}</pre>
  <h3>Caveats and observations outside this issue</h3>
  <ul>
    <li>One-off, not reproducible: in the original run (<code>thr_iyyz7w3cxf</code>) the first turn after <code>bb thread stop</code> + resume hung for about 4 minutes with <code>turn/started</code> but no Pi response (its session file shows an assistant message with <code>in=0 out=0</code> written when it was interrupted; bb seq 58 <code>turn/completed interrupted</code>). The retry worked in 11 s, a fresh grok-4.6 thread answered in 6 s, the revised run's stop/resume completed in ~6 s, and the independent verifier's in ~9 s. Could be a stop/resume race or copilot-side latency; not investigated further and not part of #2160.</li>
    <li><code>BB_PI_BRIDGE_SESSION_DIR</code> cannot be set for a running daemon (all <code>BB_*</code> env is stripped from bridge children), so dev instances share the real <code>~/.bb/pi-bridge-sessions</code>. Minor isolation wart for QA.</li>
    <li>Live repro used two github-copilot models rather than a cross-provider pair because the anthropic and openai-codex OAuth refreshes failed on this machine during the run. The code path (<code>options.model</code> ignored on <code>turn/start</code>) is identical.</li>
  </ul>
  <h2>10. Verification</h2>
  <p>An independent verifier (own worktree at <code>fcada5a3b</code>, own dev instance App <code>:16919</code> / Server <code>:24919</code> / daemon <code>:32919</code>) followed both repros. Unit repro: both tests fail on base exactly as in section 4b (<code>setModelCalls: []</code>, <code>rebuilt: false</code>; compaction and later prompts still on <code>xai/grok-4.6</code>), log <a href="2160/verify/unit-test-base.log">2160/verify/unit-test-base.log</a>. Live repro on <code>thr_66n5vx94kr</code>: spawn on <code>github-copilot/gpt-5-mini</code>, <code>tell --model github-copilot/grok-4.6</code> recorded as grok-4.6 by bb (seq 16) but answered by gpt-5-mini (<code>in=86 out=30</code>); a real compaction (<code>tokensBefore=33854</code>) followed by another grok-4.6 turn was still answered by gpt-5-mini (<code>in=34019</code>); <code>thread stop</code> + a new turn produced <code>thread/identity</code> (seq 51) and the next assistant messages were grok-4.6. The prototype patch applied cleanly; with it the repro tests pass and the Pi tree and <code>@bb/agent-runtime</code> typecheck are green (<a href="2160/verify/pi-suite-with-fix.log">2160/verify/pi-suite-with-fix.log</a>). The author's 4-minute hang after stop/resume did not recur.</p>
  <p><strong>Verifier findings and what changed in this revision.</strong></p>
  <ul>
    <li><em>Major: helper scripts were hardwired to the author's instance</em> (<code>wait-idle.sh</code> and <code>bb-turn-models.py</code> defaulted to <code>http://localhost:25835</code>; <code>tell-file.sh</code> hardcoded the server URL, daemon port and project id; the filler file was never shown how to create). Fixed, not just reworded: all scripts now take the server from <code>$BB_SERVER_URL</code> (set by <code>eval "$(scripts/bb-dev-app env)"</code>) or an explicit argument and fail with a clear message if neither is set; <code>tell-file.sh</code> takes <code>&lt;thread&gt; &lt;model&gt; &lt;file&gt;</code> with nothing hardcoded; a new <code>make-filler.sh</code> generates the filler. The whole live repro in section 4a was then re-run from scratch on a fresh dev instance (<code>:23047</code>) with exactly the commands now printed in the steps; the output shown is from that re-run (<code>thr_ahgjgq8fc9</code>) and matches the original run and the verifier's run (bug, compaction refutation, and stop/resume switch all reproduced).</li>
    <li><em>Minor: "12 Pi suites (149 tests)" counted the repro file.</em> Re-measured on base: 11 pre-existing files / 147 tests; 12 / 149 with the repro file. Corrected in section 6 and the appendix (<code>pi-suite-base.log</code>, <code>pi-suite-with-fix.log</code>).</li>
    <li><em>Minor: the 4-minute hang in step 7 read like part of the flow.</em> Step 7 now shows the clean re-run (stop/resume in ~6 s) and marks the hang as a one-off that neither the re-run nor the verifier reproduced; details kept in the caveats.</li>
  </ul>
</main></body></html>
"""
pathlib.Path('/tmp/bb-reports/issues/2160.html').write_text(doc)
print(len(doc))
