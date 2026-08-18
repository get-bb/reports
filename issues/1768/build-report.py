#!/usr/bin/env python3
"""Assembles /tmp/bb-reports/issues/1768.html from the repro artifacts (HTML-escaped)."""
import html, pathlib

R = pathlib.Path("/tmp/bb-reports/issues/1768/repro")
WT = pathlib.Path("/home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-3")
BASE = "16ceb3a540f81c1189efaffb27a39b1d9443abf5"


def esc(s: str) -> str:
    return html.escape(s, quote=False)


def art(name: str, head: int | None = None) -> str:
    text = (R / name).read_text()
    if head is not None:
        lines = text.splitlines()
        if len(lines) > head:
            text = "\n".join(lines[:head]) + f"\n… ({len(lines) - head} more lines, see repro/{name})"
    return esc(text)


def src(path: str, start: int, end: int) -> str:
    lines = (WT / path).read_text().splitlines()
    out = []
    for i in range(start, end + 1):
        out.append(f"{i:5d}  {lines[i - 1]}")
    return esc("\n".join(out))


def perma(path: str, start: int, end: int | None = None) -> str:
    frag = f"#L{start}" + (f"-L{end}" if end else "")
    label = f"{path}:{start}" + (f"-{end}" if end else "")
    return f'<a href="https://github.com/get-bb/bb/blob/{BASE}/{path}{frag}"><code>{label}</code></a>'


page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1768 child-thread notifications unfindable after the fact</title>
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
  .pill.low {{ background:#eee; }}
  .verdict {{ font-weight:600; }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1768 · Child-thread notifications are unfindable after the fact: search misses them and thread log defaults to 100 events</h1>
  <p class="meta">
    <span class="pill">Bug / UX</span> <span class="pill low">Low</span> <span class="pill">Effort: Small</span>
    <span class="pill">threads</span> <span class="pill">cli</span>
    <a href="https://github.com/get-bb/bb/issues/1768">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>{BASE}</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-partial">Verdict: PARTIALLY REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> When a child thread finishes, bb writes a message that starts with <code>[bb system]</code> into its parent thread (stored as an ordinary <code>client/turn/requested</code> event with <code>initiator: "system"</code>; when two or more children settle inside a 2 s window they are merged into one <code>Child thread updates:</code> list). The reporter, an orchestrator, later wanted to check "was I told my worker died?" using two CLI tools: <code>bb thread search</code> (full-text search over threads) and <code>bb thread log</code> (dump a thread's history).</p>
  <p><b>Claim 1 (search cannot find them) is refuted on main.</b> The <code>[bb system]</code> messages are written to the FTS index at insert time (as <code>user_message</code> <em>segments</em> — a segment is one indexed row of text, here one user/system message) and <code>bb thread search "Child thread updates" --json</code> found both of my orchestrator's batched notifications live (<code>active.total 1</code>, matches at seq 19 and 144). The only ways to get zero hits that I found: the parent thread is <em>hidden</em> (<code>visibility: hidden</code>, e.g. inherited from a hidden orchestrator; search filters <code>t.visibility = 'visible'</code>), or the message text simply never contained the phrase (single-child notifications say <code>@thread:X failed.</code>, not "Child thread updates:"). The reporter's <code>hits: 0</code> output does not correspond to any string the CLI prints, so their exact command/output is unverifiable.</p>
  <p><b>Claim 2 (log silently truncates) is verified, but the mechanism is different from what the issue says, and worse.</b> The human-readable <code>bb thread log</code> (default) is not "the last 100 events": it is the timeline API's default page — the <b>newest 20 user-message segments</b> (capped further by a 1500-event budget) — and the CLI ignores the <code>timelinePage.hasOlderRows</code> flag the server returns, so nothing marks the cut. <code>bb thread log --json</code> is capped at 100 events, but the query is <em>ascending by sequence with LIMIT</em>, so it returns the <b>oldest</b> 100 events and silently drops the newest — on my 180-event orchestrator the default JSON stopped at seq 129 and did not contain the two newer notifications at seq 144 and 183. <code>--limit</code> on the human formats is rejected outright. Additionally the minimal format collapses every notification that was delivered while a turn was active (steer) inside the "Worked for" block; only <code>--format verbose</code> shows them (in my run 2 of 3 <code>[bb system]</code> messages appear in minimal, 3 of 3 in verbose; the verifier's longer run showed 2 vs 5).</p>
  <p>Net: the "did my worker die" question <em>is</em> answerable today with <code>bb thread search &lt;child id&gt;</code> or <code>bb thread log --json --limit &lt;big&gt;</code>, but the defaults of <code>bb thread log</code> make a negative grep look authoritative when it is a window (and, for JSON, the wrong end of the window).</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Parent receives batched <code>[bb system] Child thread updates:</code> message reporting both a failed and a completed child</td><td class="ok">Verified</td><td>Live: parent <code>thr_kjmpu6p3i2</code> received exactly the issue's wording at seq 19 — <code>- @thread:thr_v3x33nrebs failed.</code> / <code>- @thread:thr_feiwytz7k8 completed.</code> (<code>systemMessageKind: child-outcome-batch</code>) — after one bad-model child and one ok child spawned back-to-back; a second batch (two bad-model children spawned in parallel) at seq 144; a single-child <code>@thread:thr_va35e367eg failed.</code> at seq 183 delivered as a steer during an active turn. <a href="1768/repro/16-parent-log-verbose-after-batch.txt">verbose log</a>, <a href="1768/repro/13-parent-log-json-all.json">all events</a>. Note batching is timing-dependent (2 s window): the verifier's sequential spawns produced two single-child messages instead.</td></tr>
    <tr><td><code>bb thread search "Child thread updates" --json</code> returns 0 hits even for a parent that received it</td><td class="no">Refuted on main (visible thread)</td><td>Live search found the batched messages: <code>active.total = 1</code>, matches <code>sourceKind: user_message</code> at <code>sourceSeq</code> 19 and 144 (<a href="1768/repro/09-search-variants-after-batch.txt">09-search-variants-after-batch.txt</a>; verifier reproduced independently: total 1, seq 310). Unit test at the DB layer also passes (<a href="1768/repro/issue-1768-search-repro.test.ts">test</a>). Indexing happens in <code>appendStoredThreadEventsInTransaction</code> → <code>upsertThreadSearchSegments</code> for every <code>client/turn/requested</code> regardless of initiator ({perma("packages/db/src/data/events.ts", 467, 478)}, {perma("packages/db/src/data/events.ts", 718, 723)}). Zero hits happens if the parent is <em>hidden</em> ({perma("packages/db/src/data/threads.ts", 950)}; second unit test) or if the parent only ever received single-child messages (no such phrase). The literal <code>hits: 0</code> output does not exist in the CLI (it prints <code>{{active:{{total,results}},archived:…}}</code>).</td></tr>
    <tr><td>"…including for the parent thread that had received the message minutes earlier, and whose own <code>bb thread log</code> shows it 23 times"</td><td class="unv">Unverified / refuted with caveat</td><td>If the human log really printed the phrase 23 times, the message was stored as <code>client/turn/requested</code> and therefore indexed (there is no other write path: {perma("packages/db/src/data/events.ts", 668, 724)}). The only code path that then still yields <code>total 0</code> is the parent being non-visible (<code>t.visibility = 'visible'</code> filter, {perma("packages/db/src/data/threads.ts", 950)}) — e.g. an orchestrator spawned with <code>--visibility hidden</code>, whose children inherit that. I could not confirm the reporter's thread visibility. On a visible parent I could not make search miss a message the log shows.</td></tr>
    <tr><td>"Whatever search indexes, it is not these"</td><td class="no">Refuted</td><td>Segments table for the parent contains all three <code>[bb system]</code> messages as <code>user_message</code> rows; searching <code>bb system</code>, <code>failed</code>, <code>thr_v3x33nrebs</code>, <code>completed</code> all hit them (<a href="1768/repro/07-search-variants.txt">07</a>, <a href="1768/repro/09-search-variants-after-batch.txt">09</a>).</td></tr>
    <tr><td><code>bb thread log --help</code> documents <code>--limit</code> as "json format only (default 100)"</td><td class="ok">Verified</td><td><a href="1768/repro/17-thread-log-help.txt">17-thread-log-help.txt</a>; {perma("apps/cli/src/commands/thread/show.ts", 441, 448)}.</td></tr>
    <tr><td>Default human-readable output is capped at 100 events with no indication and no paging flag</td><td class="unv">Partly wrong mechanism, right conclusion</td><td>Human formats call <code>GET /threads/:id/timeline</code> with the default page = latest <b>20 user-message segments</b> / 1500-event budget, not 100 events ({perma("apps/cli/src/commands/thread/show.ts", 470, 482)}, {perma("apps/server/src/routes/threads/data.ts", 144, 180)}, {perma("apps/server/src/services/threads/timeline.ts", 169)}). The response carries <code>timelinePage.hasOlderRows</code> ({perma("packages/server-contract/src/api/threads.ts", 713, 721)}) which the CLI never prints. <code>--limit</code> in human formats errors: <code>--limit and --after-seq are only supported with --format json</code>. Test <a href="1768/repro/issue-1768-thread-log-truncation.test.ts">issue-1768-thread-log-truncation.test.ts</a>: 25-turn thread → page has 20 segments, <code>hasOlderRows: true</code>, first turn (the notification) absent from the text, no marker.</td></tr>
    <tr><td>Grepping the log checks "a recent window while looking like it is checking history"</td><td class="ok">Verified for human formats; <b>inverted</b> for <code>--json</code></td><td><code>--json</code> default returns the <b>oldest</b> 100 events (ascending + LIMIT, {perma("packages/db/src/data/events.ts", 1095, 1113)}, {perma("apps/server/src/routes/threads/data.ts", 479, 488)}). Live: default JSON returned seq 1–129 of a 180-event thread whose max seq is 236; the notifications at seq 144 and 183 were not in it (<a href="1768/repro/14-log-checks.txt">14-log-checks.txt</a>).</td></tr>
    <tr><td>Three parents with 201/147/3 children returned 0 matches (ambiguous)</td><td class="unv">Unverifiable</td><td>Reporter explicitly does not claim non-delivery. Consistent with either window above. Note also that <code>queueParentSystemMessage</code> silently returns <code>false</code> (no event, no log line) when the parent has a pending interaction or is archived ({perma("apps/server/src/services/threads/parent-system-messages.ts", 414, 424)}), so a truly-never-delivered case is possible and would be indistinguishable after the fact.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>{BASE}</code> (main, 2026-08-18), checked out detached in worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-3</code>. <code>git fetch origin main</code>: 5 commits ahead; the only one touching a relevant file is <code>511d7db64</code> (events.ts, item-settlement idempotency — unrelated to search indexing or event listing). Not fixed on origin/main.</li>
    <li>Linux 7.0.0-29-generic, node v24.18.0, provider <code>codex</code> (codex-cli 0.147.0, model gpt-5.6-sol).</li>
    <li>Dev instance: app <code>:14672</code>, server <code>:22672</code>, host daemon <code>:30672</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_570fde41-63f-3-f1c30c1878a8</code> (deleted at the end). Project <code>proj_jyevf2557d</code> (local path <code>/tmp/bb-1768-scratch</code>, host <code>host_vvjjb88hue</code>). Parent <code>thr_kjmpu6p3i2</code>; children <code>thr_v3x33nrebs</code> (bad model → error) + <code>thr_feiwytz7k8</code> (ok → idle) → batched notification seq 19; <code>thr_3x4b52fnah</code> + <code>thr_vzm6xr4wyu</code> (bad model, spawned in parallel) → batched notification seq 144; <code>thr_va35e367eg</code> (bad model, spawned while the parent was mid-turn) → single-child steer notification seq 183.</li>
    <li>CLI: <code>node packages/scripts/dist/commands/run-cli.js</code> with <code>BB_SERVER_URL=http://localhost:22672</code> (what <code>pnpm bb:dev</code> runs). Below, <code>bb</code> means that. If your shell runs inside another bb thread, unset <code>BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_PROJECT_ID</code> first (<a href="1768/repro/00-env.sh">00-env.sh</a>) or <code>--parent-self</code> targets the wrong server.</li>
    <li>Sequence numbers are sparse (e.g. 180 events, max seq 236): streaming delta rows are pruned after a turn settles, so <code>seq</code> gaps are normal and "oldest 100 events = seq 1–129" is consistent.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. Live: notifications are searchable; the default logs hide them</h3>
  <p>All scripts live in <a href="1768/repro/">1768/repro/</a>, take the CLI from <code>$CLI</code> (default <code>node packages/scripts/dist/commands/run-cli.js</code>, i.e. run them from the repo root) and ids from <code>PARENT</code>/<code>PROJECT</code>/<code>CHILD</code>, and write outputs to <code>$OUT_DIR</code> (default: the script's own directory).</p>
  <ol>
    <li>Build + start: <code>pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build &amp;&amp; scripts/bb-dev-app current</code>; then <code>eval "$(scripts/bb-dev-app env)"</code>. Create a project (see Appendix) and note its id.</li>
    <li>Spawn an idle parent and wait for it: <pre>bb thread spawn --project proj_jyevf2557d --provider codex --permission-mode accept-edits --title "1768 orchestrator" --prompt "Reply only with ok." --json | grep '"id"'
  "id": "thr_kjmpu6p3i2",
bb thread wait thr_kjmpu6p3i2 --status idle</pre></li>
    <li>Spawn one child that fails (nonexistent model) and one that completes, as the parent (<code>--parent-self</code> reads <code>BB_THREAD_ID</code>; <a href="1768/repro/step3-spawn-children.sh">step3-spawn-children.sh</a>): <pre>export BB_THREAD_ID=thr_kjmpu6p3i2
bb thread spawn --project proj_jyevf2557d --provider codex --permission-mode accept-edits --parent-self --title "1768 child bad-model" --model does-not-exist-model --prompt "Reply only with ok." --json | grep '"id"'
  "id": "thr_v3x33nrebs",
bb thread spawn --project proj_jyevf2557d --provider codex --permission-mode accept-edits --parent-self --title "1768 child ok" --prompt "Reply only with ok." --json | grep '"id"'
  "id": "thr_feiwytz7k8",
unset BB_THREAD_ID; bb thread wait thr_kjmpu6p3i2 --status idle</pre>
    In my run both settled inside the 2 s batch window and the parent got exactly the issue's message (<a href="1768/repro/03-parent-log-minimal.txt">03-parent-log-minimal.txt</a>): <pre>{esc(chr(10).join((R / "03-parent-log-minimal.txt").read_text().splitlines()[14:23]))}</pre>
    <b>Batching is timing-dependent</b> (<code>CHILD_THREAD_TURN_NOTIFICATION_BATCH_DELAY_MS = 2_000</code>, {perma("apps/server/src/services/threads/child-thread-notifications.ts", 77)}): the verifier's sequential spawns produced two single-child <code>@thread:X failed.</code> messages instead, and then <code>search "Child thread updates"</code> legitimately returned 0 because the phrase never existed. Check what you actually got before searching: <pre>bb thread log thr_kjmpu6p3i2 --json --limit 100000 | grep -c 'Child thread updates'</pre> If that prints 0, spawn two bad-model children <em>in parallel</em> (<a href="1768/repro/spawn-batch-children.sh">spawn-batch-children.sh</a>, which backgrounds both spawns and <code>wait</code>s) — that reliably lands both failures inside the window (my run: <a href="1768/repro/08-spawn-batch-children.txt">08-spawn-batch-children.txt</a> → <code>thr_3x4b52fnah</code>, <code>thr_vzm6xr4wyu</code>, batched at seq 144).</li>
    <li>Grow the parent past 100 events so the JSON window matters (<a href="1768/repro/filler-turns.sh">filler-turns.sh</a>: three small tool-using prompts via <code>POST /threads/:id/send</code>; my run: 62 → 88 → 114 events), <em>then</em> run <a href="1768/repro/spawn-batch-children.sh">spawn-batch-children.sh</a> for the second batch and, optionally, <a href="1768/repro/midturn-child.sh">midturn-child.sh</a> (starts a 75 s filler turn, then spawns a bad-model child so its notification is delivered as a <em>steer</em> while the parent is busy; my run: <code>thr_va35e367eg</code>, seq 183, <code>target.kind: "auto"</code>). Wait for <code>bb thread wait thr_kjmpu6p3i2 --status idle</code>.</li>
    <li>Search (<code>CHILD=thr_v3x33nrebs bash search-variants.sh</code>, <a href="1768/repro/search-variants.sh">script</a>). <b>Expected per issue:</b> 0 hits. <b>Actual</b> (given the phrase exists on a visible thread): every <code>[bb system]</code> message is found as a <code>user_message</code> segment.
<pre>{art("09-search-variants-after-batch.txt")}</pre></li>
    <li>Log windows (<code>PARENT=thr_kjmpu6p3i2 bash log-checks.sh</code>, <a href="1768/repro/log-checks.sh">script</a>). <b>Expected per issue:</b> default = last 100 events. <b>Actual:</b> JSON default = <em>oldest</em> 100 (seq 1–129 of max 236; the notifications at seq 144 and 183 are not in it, only the old seq 19 one is); human <code>--limit</code> rejected; minimal format shows 2 of the 3 <code>[bb system]</code> messages (the mid-turn steer one is collapsed):
<pre>{art("14-log-checks.txt")}</pre></li>
    <li>Human log, minimal (<a href="1768/repro/15-parent-log-minimal-after-batch.txt">full</a>) — note there is no line saying how many rows/segments were returned or whether older rows exist, and the seq-183 <code>@thread:thr_va35e367eg failed.</code> message is missing (it appears only in <a href="1768/repro/16-parent-log-verbose-after-batch.txt">verbose</a>, indented under "Worked for", see Appendix):
<pre>{art("15-parent-log-minimal-after-batch.txt", 40)}</pre></li>
  </ol>

  <h3>B. Unit-level: the timeline page and the JSON limit both silently drop the notification</h3>
  <p><a href="1768/repro/issue-1768-thread-log-truncation.test.ts">apps/server/test/public/issue-1768-thread-log-truncation.test.ts</a> — run from <code>apps/server</code>: <code>pnpm exec vitest run test/public/issue-1768-thread-log-truncation.test.ts</code>. Test 1 is a characterization test (passes on main): 25 turns where turn 1 is a <code>[bb system] Child thread updates:</code> message → default timeline page has <code>segmentLimit 20 / returnedSegmentCount 20 / hasOlderRows true</code>, formatted text contains prompts 6–25 only, no "older"/"truncated" marker; <code>/events?limit=100</code> on a 104-event thread returns seq 1–100 (newest turn dropped). Test 2 asserts the desired behavior (the human text mentions omitted rows) and <b>fails on main</b> — that is the assertion <code>expect(text.toLowerCase()).toMatch(/older|omitted|truncat/)</code>. Output: <a href="1768/repro/10-vitest-thread-log-truncation.txt">10-vitest-thread-log-truncation.txt</a>.</p>
<pre>{esc((R / "issue-1768-thread-log-truncation.test.ts").read_text())}</pre>
  <p><a href="1768/repro/issue-1768-search-repro.test.ts">packages/db/test/data/issue-1768-repro.test.ts</a> — run from <code>packages/db</code>: <code>pnpm exec vitest run test/data/issue-1768-repro.test.ts</code>. Both pass on main: a system-initiated <code>client/turn/requested</code> with the batched text is indexed and found for a visible thread; the identical message on a <code>visibility: "hidden"</code> thread is indexed but returns <code>total 0</code>. Output: <a href="1768/repro/11-vitest-search-repro.txt">11-vitest-search-repro.txt</a>.</p>
<pre>{esc((R / "issue-1768-search-repro.test.ts").read_text())}</pre>

  <h2>Root cause</h2>
  <h3>1. Search does index the notifications (claim refuted)</h3>
  <p>Every stored event passes through <code>appendStoredThreadEventsInTransaction</code> ({perma("packages/db/src/data/events.ts", 668, 724)}), which after the <code>INSERT INTO events</code> calls <code>upsertThreadSearchSegments</code> with the segments produced by <code>listThreadSearchSegmentsForStoredEventArgs</code>: <code>client/turn/requested</code> → a <code>user_message</code> segment from the visible prompt text (any initiator), <code>item/completed</code> agent messages → <code>assistant_message</code>, legacy <code>system/manager/user_message</code> → <code>system_message</code>:</p>
<pre>{src("packages/db/src/data/events.ts", 467, 497)}</pre>
<pre>{src("packages/db/src/data/events.ts", 716, 724)}</pre>
  <p>Parent system messages are built as plain <code>{{type:"text", text, mentions}}</code> input with no <code>agent-only</code> visibility ({perma("apps/server/src/services/threads/parent-system-messages.ts", 143, 168)}) and appended as <code>client/turn/requested</code> with <code>initiator: "system"</code> ({perma("apps/server/src/services/threads/parent-system-messages.ts", 226, 245)}), so they land in the index as <code>user_message</code> segments — which is exactly what the live search returned. The FTS query is an OR of prefix tokens per segment, and threads must match every token in some segment. The one filter that can hide a real hit is thread visibility:</p>
<pre>{src("packages/db/src/data/threads.ts", 940, 953)}</pre>
  <p>Hidden threads (created with <code>--visibility hidden</code>, or children inheriting a hidden parent) are never returned. Also, only 3 matches per thread are surfaced (<code>THREAD_SEARCH_MATCHES_PER_THREAD = 3</code>, {perma("packages/db/src/data/threads.ts", 54)}), so search answers "which threads got such a message", not "how many times".</p>

  <h3>2. <code>bb thread log</code> windows differ by format and neither is announced</h3>
  <p>The CLI has two completely different backends behind one command:</p>
<pre>{src("apps/cli/src/commands/thread/show.ts", 426, 482)}</pre>
  <ul>
    <li><b>Human formats</b> → <code>GET /threads/:id/timeline</code> with the default page: <code>kind: "latest"</code>, <code>segmentLimit = THREAD_TIMELINE_DEFAULT_SEGMENT_LIMIT = 20</code> ({perma("apps/server/src/services/threads/timeline.ts", 169)}) — a segment is a user-message row — plus the <code>timelineWindowEventBudget</code> (1500 events, {perma("packages/domain/src/feature-flags.ts", 37)}). The server reports the truncation in <code>timelinePage</code> (<code>segmentLimit</code>, <code>returnedSegmentCount</code>, <code>hasOlderRows</code>, <code>olderCursor</code>; {perma("packages/server-contract/src/api/threads.ts", 713, 721)}) but the CLI reads only <code>timeline.rows</code>. It also refuses <code>--limit</code>/<code>--after-seq</code> in these formats although the API supports <code>segmentLimit</code> (max 100) and <code>beforeAnchorSeq</code>/<code>beforeAnchorId</code> cursors ({perma("apps/server/src/routes/threads/data.ts", 144, 180)}). The minimal text format additionally collapses <em>every</em> row that occurred while a turn was active into the "Worked for" block — including any <code>[bb system]</code> notification delivered as a steer during that turn — so on a busy orchestrator the minimal grep undercounts by however many notifications arrived mid-turn (my run: 2 of 3 visible; verifier's run: 2 of 5). Only <code>--format verbose</code> (<code>includeNestedRows</code>) prints them.</li>
    <li><b><code>--json</code></b> → <code>GET /threads/:id/events?limit=100</code>. The route and query:</li>
  </ul>
<pre>{src("apps/server/src/routes/threads/data.ts", 479, 488)}
{src("packages/db/src/data/events.ts", 1095, 1113)}</pre>
  <p><code>ORDER BY sequence ASC LIMIT 100</code> with no <code>afterSeq</code> means the default JSON is the <em>beginning</em> of the thread. For an orchestrator with hundreds of children, <code>bb thread log --json | grep "Child thread updates"</code> checks the first 100 events and nothing else, which explains "0 matches on parents that also hit the event cap" without any indexing bug (live: seq 144 and 183 absent from the default window, <a href="1768/repro/14-log-checks.txt">14-log-checks.txt</a>). Nothing in the output says the list was cut.</p>

  <h3>Deeper issue</h3>
  <p><code>queueParentSystemMessage</code> returns <code>false</code> silently — no event, no log line — when the parent has a pending interaction or is archived/deleted ({perma("apps/server/src/services/threads/parent-system-messages.ts", 414, 424)}); <code>flushChildThreadTurnNotificationBatch</code> only logs on thrown errors ({perma("apps/server/src/services/threads/child-thread-notifications.ts", 412, 442)}). So a genuinely undelivered outcome leaves no trace, and no read-side tool can ever distinguish it from a truncated view. Related: #1650.</p>

  <h2>Proposed fix (first principles)</h2>
  <ol>
    <li><b>Make truncation visible in <code>bb thread log</code>.</b> In <code>apps/cli/src/commands/thread/show.ts</code>, after <code>formatThreadTimelineText</code>, print a trailer when <code>timeline.timelinePage.hasOlderRows</code> is true, e.g. <code>(showing newest 20 of more user-message segments; older rows omitted — use --segments N or --all)</code>. Add <code>--segments &lt;n&gt;</code> (maps to <code>segmentLimit</code>, max 100) and <code>--all</code> (loop on <code>olderCursor</code> via <code>beforeAnchorSeq/beforeAnchorId</code> until <code>hasOlderRows</code> is false, prepend pages). Nothing crosses the server/daemon boundary; the API already supports it. Risk: <code>--all</code> on huge threads is slow — print pages as they arrive.</li>
    <li><b>Fix the JSON default direction or say what it is.</b> Either document in <code>--help</code> that <code>--limit</code> returns the <em>oldest</em> N events from <code>--after-seq</code> (and add <code>--tail</code> that fetches the newest N — needs an <code>order=desc</code> or <code>beforeSeq</code> on <code>/events</code>, server-side change in <code>listStoredEventRows</code>), or print to stderr <code>returned 100 events (seq 1–180); more exist, pass --after-seq 180</code>. The latter is a one-liner: <code>events.length === limit</code> ⇒ warn.</li>
    <li><b>Direct query.</b> Add <code>bb thread notifications &lt;id&gt;</code> (or <code>bb thread log --system</code>) backed by a targeted DB query: <code>events WHERE thread_id=? AND type='client/turn/requested' AND json_extract(data,'$.initiator')='system'</code>, exposing <code>systemMessageKind</code>/<code>systemMessageSubject</code> (already stamped: <code>child-failed</code>, <code>child-completed</code>, <code>child-outcome-batch</code>, subject thread id/count) — that answers "was I told worker X died" exactly and needs no text grep. Also make the silent <code>return false</code> paths in <code>queueParentSystemMessage</code> at least log at info with the parent id and reason.</li>
    <li>Search: no indexing change needed. Optionally document that hidden threads are excluded, or add <code>--include-hidden</code> to <code>bb thread search</code>.</li>
  </ol>

  <h2>PR review</h2>
  <p>No linked open PRs.</p>

  <h2>Related issues</h2>
  <ul>
    <li>#1706 — queued thread messages "vanish": that report independently documents the same <code>bb thread log</code> windowing (newest 20 segments vs oldest 100 JSON events) as a source of false negatives.</li>
    <li>#1650 — messages to a thread blocked on AskUserQuestion are dropped; the same pending-interaction guard silently drops parent system messages here.</li>
    <li>#1655 — threads awaiting user interaction are invisible to the CLI.</li>
    <li>#1749 — timelineWindowEventBudget calibration (the other cap on the human-format page).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Commands run</h3>
<pre>git checkout --detach 16ceb3a54
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
scripts/bb-dev-app current                      # App :14672, Server :22672, daemon :30672
export BB_SERVER_URL=http://localhost:22672 BB_HOST_DAEMON_PORT=30672
unset BB_THREAD_ID BB_ENVIRONMENT_ID BB_THREAD_STORAGE BB_PROJECT_ID BB_CLI
bb machine list                                  # host_vvjjb88hue
mkdir -p /tmp/bb-1768-scratch &amp;&amp; git -C /tmp/bb-1768-scratch init &amp;&amp; git -C /tmp/bb-1768-scratch commit --allow-empty -m init
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{{"name":"qa-1768","source":{{"type":"local_path","path":"/tmp/bb-1768-scratch","hostId":"host_vvjjb88hue"}}}}'   # proj_jyevf2557d
bb thread spawn --project proj_jyevf2557d --provider codex --permission-mode accept-edits --title "1768 orchestrator" --prompt "Reply only with ok." --json   # thr_kjmpu6p3i2
bb thread wait thr_kjmpu6p3i2 --status idle
PARENT=thr_kjmpu6p3i2 PROJECT=proj_jyevf2557d bash repro/step3-spawn-children.sh   # thr_v3x33nrebs (bad model), thr_feiwytz7k8 (ok)
bb thread wait thr_kjmpu6p3i2 --status idle
bb thread log thr_kjmpu6p3i2 --json --limit 100000 &gt; repro/02-parent-events.json ; bb thread log thr_kjmpu6p3i2 &gt; repro/03-...; --format verbose &gt; repro/04-...
bb thread search "Child thread updates" --json &gt; repro/05-... ; bb thread search "bb system" --json &gt; repro/06-...
CHILD=thr_v3x33nrebs bash repro/search-variants.sh &gt; repro/07-search-variants.txt
PARENT=thr_kjmpu6p3i2 bash repro/filler-turns.sh                                    # 62 -&gt; 88 -&gt; 114 events
PARENT=thr_kjmpu6p3i2 PROJECT=proj_jyevf2557d bash repro/spawn-batch-children.sh   # thr_3x4b52fnah thr_vzm6xr4wyu (parallel) -&gt; batch at seq 144
PARENT=thr_kjmpu6p3i2 PROJECT=proj_jyevf2557d bash repro/midturn-child.sh          # thr_va35e367eg -&gt; steer notification at seq 183
CHILD=thr_v3x33nrebs bash repro/search-variants.sh &gt; repro/09-search-variants-after-batch.txt
PARENT=thr_kjmpu6p3i2 bash repro/log-checks.sh &gt; repro/14-log-checks.txt
PARENT=thr_kjmpu6p3i2 PROJECT=proj_jyevf2557d bash repro/save-artifacts.sh
(cd apps/server &amp;&amp; pnpm exec vitest run test/public/issue-1768-thread-log-truncation.test.ts)
(cd packages/db &amp;&amp; pnpm exec vitest run test/data/issue-1768-repro.test.ts)
pnpm dev:stop</pre>
  <h3>Search right after step 3 (only the first batched notification existed)</h3>
<pre>{art("07-search-variants.txt")}</pre>
  <h3>Verbose log excerpt: the steer-delivered notification only shows nested</h3>
<pre>{esc(chr(10).join((R / "16-parent-log-verbose-after-batch.txt").read_text().splitlines()[122:147]))}</pre>
  <h3>vitest output</h3>
<pre>{art("10-vitest-thread-log-truncation.txt", 60)}</pre>
<pre>{art("11-vitest-search-repro.txt")}</pre>
  <h3>Help text</h3>
<pre>{art("17-thread-log-help.txt")}
{art("18-thread-search-help.txt")}</pre>
  <h3>All artifacts</h3>
  <ul>
    <li><a href="1768/repro/01-spawn-parent.json">01-spawn-parent.json</a>, <a href="1768/repro/02-child-bad.json">02-child-bad.json</a>, <a href="1768/repro/03-child-ok.json">03-child-ok.json</a>, <a href="1768/repro/02-parent-events.json">02-parent-events.json</a> (all events right after step 3), <a href="1768/repro/03-parent-log-minimal.txt">03</a>/<a href="1768/repro/04-parent-log-verbose.txt">04</a> logs after step 3, <a href="1768/repro/05-search-child-thread-updates.json">05</a>/<a href="1768/repro/06-search-bb-system.json">06</a> raw search JSON after step 3, <a href="1768/repro/08-batch-child-1.json">08-batch-child-1/2.json</a>, <a href="1768/repro/08c-midturn-child.json">08c-midturn-child.json</a>, <a href="1768/repro/12-parent-log-json-default.json">12-parent-log-json-default.json</a>, <a href="1768/repro/13-parent-log-json-all.json">13-parent-log-json-all.json</a>, <a href="1768/repro/19-thread-list.txt">19-thread-list.txt</a>.</li>
    <li>Scripts: <a href="1768/repro/00-env.sh">00-env.sh</a>, <a href="1768/repro/bb1768.sh">bb1768.sh</a> (CLI wrapper), <a href="1768/repro/step3-spawn-children.sh">step3-spawn-children.sh</a>, <a href="1768/repro/filler-turns.sh">filler-turns.sh</a>, <a href="1768/repro/spawn-batch-children.sh">spawn-batch-children.sh</a>, <a href="1768/repro/midturn-child.sh">midturn-child.sh</a>, <a href="1768/repro/search-variants.sh">search-variants.sh</a>, <a href="1768/repro/log-checks.sh">log-checks.sh</a>, <a href="1768/repro/save-artifacts.sh">save-artifacts.sh</a>.</li>
    <li>Verifier's independent run (kept as-is): <a href="1768/verify/">1768/verify/</a>.</li>
  </ul>

  <h2>Verification</h2>
  <p>An independent verifier followed the reproduction on their own worktree/instance at <code>16ceb3a54</code>. Steps 1–3 worked verbatim; their sequential bad-model spawns did <em>not</em> batch (two single-child messages, <code>search "Child thread updates"</code> → 0 because the phrase never existed), while spawning two children in parallel produced the batched text and search found it (total 1, seq 310) — confirming that <code>[bb system]</code> messages are indexed. The log checks reproduced exactly (default <code>--json</code> = oldest 100 events, human <code>--limit</code> rejected, minimal 2 vs verbose 5 <code>[bb system]</code> lines); both vitest files behaved as stated; not fixed on origin/main. Their artifacts are in <a href="1768/verify/">1768/verify/</a>.</p>
  <p>Changes made in this revision in response: (1) the FTS-indexing excerpt/permalink previously pointed at <code>events.ts#L553-L585</code> (which is <code>appendDaemonEventsInTransaction</code> at the base commit; the numbers came from a later HEAD); it now shows <code>listThreadSearchSegmentsForStoredEventArgs</code> (L467–497) and the <code>upsertThreadSearchSegments</code> call in <code>appendStoredThreadEventsInTransaction</code> (L716–724), re-extracted from <code>16ceb3a54</code>. (2) The batch step now spawns the two children in parallel, states that batching is a 2 s race, and tells the reader to confirm the phrase exists before searching; the whole live run was redone from scratch on a fresh instance (parent <code>thr_kjmpu6p3i2</code>) and every artifact under <code>1768/repro/</code> was regenerated in place, including new <code>filler-turns.sh</code> (to push the thread past 100 events) and <code>midturn-child.sh</code> (steer-delivered notification). (3) All scripts now take <code>$CLI</code>/<code>PARENT</code>/<code>PROJECT</code>/<code>CHILD</code>/<code>OUT_DIR</code> instead of hardcoded worktree paths and ids. (4) Added the "log shows it 23 times" claim row. (5) Explained sparse <code>seq</code> numbers and defined "segment" on first use. (6) Rephrased the minimal-vs-verbose finding as "every mid-turn notification is collapsed" with both my (2/3) and the verifier's (2/5) counts.</p>
</main></body></html>
"""

pathlib.Path("/tmp/bb-reports/issues/1768.html").write_text(page)
print("wrote", len(page), "bytes")
