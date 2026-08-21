#!/usr/bin/env python3
"""Builds /tmp/bb-reports/issues/2066.html from the repro artifacts."""
import html, pathlib, re

R = pathlib.Path("/tmp/bb-reports/issues/2066/repro")
BASE = "fcada5a3b88302acb9944aa74b11db4ecaa215a0"
P = f"https://github.com/get-bb/bb/blob/{BASE}/"

def esc(s): return html.escape(s, quote=False)
def strip_ansi(s): return re.sub(r"\x1b\[[0-9;]*m", "", s)
def f(name): return (R / name).read_text()

route_test = esc(f("repro-2066-timeline-cache-retention.test.ts"))
unit_test = esc(f("repro-2066-unit.test.ts"))
adv_test = esc(f("pr-2067-adversarial.test.ts"))
unit_pr_test = esc(f("repro-2066-unit-pr2067.test.ts"))
unit_fix_test = esc(f("repro-2066-unit-after-fix.test.ts"))
proposed_diff = esc(f("proposed-fix-2066.diff"))
live_loop = esc(f("live-loop.sh"))
heap_gc = esc(f("heap-after-gc.mjs"))
measure = esc(f("measure.sh"))

route_log = esc(strip_ansi(f("route-test-base.log")))
route_log = "\n".join(l for l in route_log.splitlines() if l.strip() and "zoxide" not in l and "_ZO_DOCTOR" not in l and "ajeetdsouza" not in l and "Please ensure" not in l and "If the issue persists" not in l)
unit_log = esc(strip_ansi(f("unit-test-base.log")))
unit_log = "\n".join(l for l in unit_log.splitlines() if l.strip() and "zoxide" not in l and "_ZO_DOCTOR" not in l and "ajeetdsouza" not in l and "Please ensure" not in l and "If the issue persists" not in l)
measure_logs = esc(f("measure-base.log") + f("measure-base-run2.log") + f("measure-pr2067.log"))
measure_revise = esc(f("revise/measure-base.log") + "\n" + f("revise/measure-pr2067.log") + "\n" + f("revise/measure-proposed-fix.log"))
unit_variants_log = esc(f("pr2067-unit-variants.log"))
proposed_tests_log = esc(f("proposed-fix-tests.log"))
slow_line = esc(f("slow-build-log-line.txt").strip())
pr_diff = esc(f("pr-2067.diff"))

def csv_rows(name, picks):
    lines = f(name).strip().splitlines()
    out = [lines[0]]
    for i in picks:
        out.append(lines[i])
    return esc("\n".join(out))

live_base = csv_rows("live-base.csv", [1, 10, 50, 100])
live_pr = csv_rows("live-pr2067.csv", [1, 10, 50, 100])

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #2066 Timeline cache retains obsolete revisions for the same request shape</title>
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
  .pill.med {{ background:var(--warn); color:#fff; border-color:var(--warn); }}
  .verdict {{ font-weight:600; }}
  .v-repro {{ color:var(--high); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; max-height:520px; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; background:#fff; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:6px; }}
  details summary {{ cursor:pointer; color:var(--accent); }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#2066 · Timeline cache retains obsolete revisions for the same request shape</h1>
  <p class="meta">
    <span class="pill">Bug / perf</span> <span class="pill med">Priority: Medium</span> <span class="pill">Effort: low</span> <span class="pill">perf</span> <span class="pill">threads</span>
    <a href="https://github.com/get-bb/bb/issues/2066">open on GitHub</a>
    <span>2026-08-21 · base <code>fcada5a3b</code></span>
  </p>
  <p><strong>Verdict:</strong> <span class="verdict v-repro">REPRODUCED</span> · <strong>Root-cause confidence:</strong> high</p>
  <p><strong>Linked PR:</strong> <a href="https://github.com/get-bb/bb/pull/2067">#2067</a> (draft) — review verdict: <strong>REQUEST CHANGES (minor; the fix itself is correct and measured effective)</strong>.</p>

  <h2>1. TL;DR</h2>
  <p>The bb server memoizes built thread-timeline responses in a 128-entry LRU so that refetching an idle thread is cheap. The cache key includes the thread's high-water event sequence (<code>maxSeq</code>). A thread's <code>maxSeq</code> only ever increases, so the moment an event is appended the previous entry can never be looked up again, but it stays strongly referenced until 127 more entries push it out. During a streaming turn the web client refetches the same window after every event batch (at least every 50 ms, up to 1 s on slow builds: <a href="{P}apps/app/src/hooks/cache-owners/realtime-cache-registry.ts#L179-L180">realtime-cache-registry.ts:179-180</a> clamps the trailing delay between 50 ms and 1,000 ms scaled by the observed fetch duration), so one active thread fills all 128 slots with dead revisions within a few seconds and keeps them there. This is bounded (128 × one response object), not a leak, but it is pure waste: on a seeded 9,001-event thread 100 append+refetch rounds grew the server's GC'd V8 heap by 19–22 MB on <code>fcada5a3b</code> versus 3.6 MB with PR #2067 applied. Larger threads (the reporter's had 1,400-event windows) retain proportionally more. The issue's core claim is correct; its secondary numbers (&quot;response payloads 1.1–4.8 MiB&quot;) appear to be a misreading of the <code>eventDataBytes</code> field of the slow-build log (input event JSON, not the response).</p>

  <h2>2. Claims vs findings</h2>
  <table><tr><th>Claim from the issue</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>The cache keys entries by request params <em>and</em> <code>maxSeq</code>.</td><td class="ok">Verified</td><td><a href="{P}apps/server/src/services/threads/timeline-cache.ts#L126-L130"><code>buildThreadTimelineCacheKey</code></a> returns <code>`${{maxSeq}}|${{paramsKey}}`</code>; the route passes it at <a href="{P}apps/server/src/routes/threads/data.ts#L358-L360">data.ts:358</a>.</td></tr>
    <tr><td>Every appended event creates a new key and the obsolete revision stays resident until global LRU eviction.</td><td class="ok">Verified</td><td>Route-level test against the real <code>GET /threads/:id/timeline</code>: after 150 append+fetch rounds on one thread <code>cache.size === 128</code> (only 1 entry is reachable). Unit test: 2 revisions → size 2. See §4.</td></tr>
    <tr><td>Obsolete entries are unreachable by lookup (so retaining them has no value).</td><td class="ok">Verified</td><td><code>maxSeq</code> is <code>MAX(sequence)</code> (<a href="{P}packages/db/src/data/events.ts#L3065-L3077">events.ts:3065</a>) and is monotonic: even message-edit, the one flow that deletes events, first appends a <code>system/operation</code> event above the old max and then deletes the suffix below it (<a href="{P}apps/server/src/services/threads/thread-edit-message.ts#L554-L578">thread-edit-message.ts:554-578</a>). Pruning never lowers it (doc comment, <a href="{P}apps/server/src/services/threads/timeline-cache.ts#L16-L23">timeline-cache.ts:16</a>).</td></tr>
    <tr><td>Regression assertion fails with <code>2 !== 1</code> before the fix.</td><td class="ok">Verified</td><td><code>AssertionError: expected 2 to be 1</code> on <code>fcada5a3b</code> (§4, unit test).</td></tr>
    <tr><td>Active thread stayed below the projected-row cutoff, so revisions were cacheable.</td><td class="ok">Verified (in general)</td><td>Cap is 200 rows (<a href="{P}apps/server/src/services/threads/timeline-cache.ts#L33">L33</a>). The seeded 9,001-event thread's latest window is 99 rows / 107 KB JSON; in the live loop rows stayed ≤ 200 for the first 100 appended items. The 200-row cap only excludes <em>large</em> expanded turns; ordinary streaming turns are cached on every event.</td></tr>
    <tr><td>&quot;Response payloads around 1.1–4.8 MiB&quot; in server logs.</td><td class="no">Refuted as stated</td><td>The server never logs response size. The slow-build log (<a href="{P}apps/server/src/services/threads/timeline-build-log.ts#L93-L112">timeline-build-log.ts:93-112</a>) logs <code>eventDataBytes</code> — the JSON size of the <em>input events</em> in the window. On my thread that field was 459,376 bytes for a 107,571-byte response (4.3:1). The reporter's 1.1–4.8 MiB is almost certainly <code>eventDataBytes</code>; the cached objects were likely a quarter of that per revision.</td></tr>
    <tr><td>Desktop app at 1.5–1.7 GB, server 300–650 MB, caused/amplified by this retention.</td><td class="unv">Unverified (plausible contributor, not shown to be dominant)</td><td>No heap snapshot in the issue. Measured here: 128 dead revisions of a 100–200-row response ≈ 20 MB of heap. For a 1,400-event window the per-revision object is larger (perhaps 0.3–1 MB), so 128 revisions could plausibly reach 40–130 MB. It cannot explain 300–650 MB on its own; the same incident also had 1.34 s builds decoding 1.1–4.8 MiB of events per request (see #1749, #1129).</td></tr>
    <tr><td>Not a duplicate of #1749.</td><td class="ok">Verified</td><td>#1749 is about the event-budget calibration of the window size; this is about response retention in the cache. Related, not duplicate.</td></tr>
    <tr><td>Fix is localized and low effort; does not change response data or cacheability.</td><td class="ok">Verified</td><td>PR #2067 touches one service file, one route call site and one test; all timeline/delta/public-thread tests pass (§7).</td></tr>
  </table>

  <h2>3. Environment</h2>
  <ul>
    <li>bb base commit <code>fcada5a3b88302acb9944aa74b11db4ecaa215a0</code> (main, 2026-08-21); <code>origin/main</code> has no later commits touching <code>apps/server/src/services/threads/timeline-cache.ts</code> or <code>routes/threads/data.ts</code>, so the bug is still present on main.</li>
    <li>macOS 26.5.2 (25F84), Apple Silicon, 36 GB RAM; Node v22.23.1; codex-cli 0.149.0 (no provider turn was needed — events were inserted directly).</li>
    <li>Isolated dev instance from this worktree: App <code>:12143</code>, Server <code>:20143</code>, host daemon <code>:28143</code>, data dir <code>~/.bb-dev/bb-machines-bee.getbb.app-checkouts-bb-.claude-worktrees-wf_21e66a79-f02-17-e0641bf7a98d</code> (deleted at cleanup). Seeded with <code>pnpm seed:perf -- --projects 1 --threads 6 --events 30000 --seed 7</code> (22,436 event rows; largest thread <code>thr_6zik7e8uvr</code> = 9,001 events / 5.2 MB of event JSON).</li>
    <li>Revision pass: second isolated worktree (<code>f02-23</code>): App <code>:12532</code>, Server <code>:20532</code>, host daemon <code>:28532</code>, data dir <code>~/.bb-dev/…-wf_21e66a79-f02-23-9a71be3ce607</code> (deleted at cleanup), seeded with the same command (same thread/environment/provider-thread ids, confirming the seed is deterministic). The independent verifier used a third (<code>f02-21</code>, server <code>:25775</code>).</li>
    <li>Vitest 4.1.1 via <code>pnpm exec vitest run</code> inside <code>apps/server</code>; in-memory SQLite through the repo's <code>withTestHarness</code>.</li>
  </ul>

  <h2>4. Minimal reproduction</h2>
  <h3>4a. Unit level (the issue's own steps) — fails on <code>fcada5a3b</code></h3>
  <ol>
    <li>Save <a href="2066/repro/repro-2066-unit.test.ts">repro-2066-unit.test.ts</a> as <code>apps/server/test/services/threads/repro-2066-unit.test.ts</code>.</li>
    <li>Run it from <code>apps/server</code>:<pre>pnpm exec vitest run test/services/threads/repro-2066-unit.test.ts

expected: both tests pass (cache.size === 1 after a newer revision of the same shape)
actual:
{unit_log}</pre></li>
  </ol>
  <details><summary>repro-2066-unit.test.ts</summary><pre>{unit_test}</pre></details>
  <p><strong>Scope of this file:</strong> it calls <code>getOrBuild(buildThreadTimelineCacheKey(shape), build)</code>, i.e. the <em>base</em> string-key signature, so it only demonstrates the bug on <code>fcada5a3b</code>. Any fix changes that signature (PR #2067 takes <code>{{ paramsKey, revisionKey }}</code>, the proposed fix in §6 takes <code>{{ paramsKey, maxSeq }}</code>), and against either this file throws <code>TypeError: Cannot read properties of undefined (reading 'value')</code> rather than passing. The same two scenarios rewritten for each new signature are <a href="2066/repro/repro-2066-unit-pr2067.test.ts">repro-2066-unit-pr2067.test.ts</a> (passes on the PR branch, 2/2; <a href="2066/repro/pr2067-unit-variants.log">log</a>, which also shows the base-signature file's TypeError on that branch) and <a href="2066/repro/repro-2066-unit-after-fix.test.ts">repro-2066-unit-after-fix.test.ts</a> (passes on base + <a href="2066/repro/proposed-fix-2066.diff">proposed-fix-2066.diff</a>, 2/2; <a href="2066/repro/proposed-fix-tests.log">log</a>). The signature-independent fail-before/pass-after evidence is the route-level test in §4b.</p>
  <details><summary>repro-2066-unit-pr2067.test.ts</summary><pre>{unit_pr_test}</pre></details>
  <details><summary>repro-2066-unit-after-fix.test.ts</summary><pre>{unit_fix_test}</pre></details>
  <details><summary>pr2067-unit-variants.log (PR branch: PR-signature file passes, base-signature file throws)</summary><pre>{unit_variants_log}</pre></details>

  <h3>4b. Route level — the real <code>GET /api/v1/threads/:id/timeline</code> against in-memory SQLite</h3>
  <p>This drives the real route handler (real key construction, real row cap, real LRU). The only instrumentation is a <code>vi.mock</code> wrapper around <code>createThreadTimelineCache</code> so the test can read <code>.size</code> of the instance the route creates. One completed turn with a 24 KB assistant message, then a second turn to which 150 <code>agentMessage</code> items are appended one at a time, refetching the same window after each append (what the web client does during streaming, throttled to ≥50 ms in <a href="{P}apps/app/src/hooks/cache-owners/realtime-cache-registry.ts#L179">realtime-cache-registry.ts:179</a>).</p>
  <ol>
    <li>Save <a href="2066/repro/repro-2066-timeline-cache-retention.test.ts">repro-2066-timeline-cache-retention.test.ts</a> as <code>apps/server/test/public/repro-2066-timeline-cache-retention.test.ts</code>.</li>
    <li>Run from <code>apps/server</code>:<pre>pnpm exec vitest run test/public/repro-2066-timeline-cache-retention.test.ts

expected: cache.size === 1 (only the newest maxSeq can ever be requested again)
actual:
{route_log}</pre></li>
  </ol>
  <details><summary>repro-2066-timeline-cache-retention.test.ts</summary><pre>{route_test}</pre></details>
  <p>This file drives the route through HTTP and never names the cache signature, so it is the one that runs unchanged before and after. With PR #2067 cherry-picked onto <code>fcada5a3b</code> it passes (<a href="2066/repro/route-test-pr2067-single.log">log</a>, and again in <a href="2066/repro/pr2067-unit-variants.log">pr2067-unit-variants.log</a>); with the proposed fix from §6 applied it passes too (<a href="2066/repro/proposed-fix-tests.log">proposed-fix-tests.log</a>).</p>

  <h3>4c. Live instance — heap growth on a seeded 9,001-event thread</h3>
  <p>Fresh server each run, 3 warm fetches, force a full GC through the inspector and read <code>Runtime.getHeapUsage</code>; then 100 rounds of &quot;insert one <code>agentMessage</code> event into the dev SQLite DB, GET the timeline&quot;; then GC + read again. Scripts: <a href="2066/repro/measure.sh">measure.sh</a>, <a href="2066/repro/live-loop.sh">live-loop.sh</a>, <a href="2066/repro/heap-after-gc.mjs">heap-after-gc.mjs</a>.</p>
  <p><strong>To run it yourself</strong> (nothing is tied to a particular checkout: <code>measure.sh</code> derives the worktree from <code>git rev-parse --show-toplevel</code> and the data dir / server URL from <code>scripts/bb-dev-app status</code>, and uses the inspector on <code>127.0.0.1:9229</code>):</p>
  <pre>cd &lt;your bb worktree at fcada5a3b&gt;
pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
scripts/bb-dev-app current &amp;&amp; pnpm dev:stop               # creates the per-worktree data dir
pnpm seed:perf -- --projects 1 --threads 6 --events 30000 --seed 7   # deterministic: thr_6zik7e8uvr / env_866bjs4xjm / 8e22443c-… are stable
/tmp/bb-reports/issues/2066/repro/measure.sh base 100
git fetch origin pull/2067/head:pr-2067 &amp;&amp; git checkout -B pr-2067-on-base fcada5a3b &amp;&amp; git cherry-pick 206096e4b
/tmp/bb-reports/issues/2066/repro/measure.sh pr2067 100
pnpm dev:stop</pre>
  <p>Original runs (author's first worktree, <code>f02-17</code>, server :20143):</p>
  <pre>{measure_logs}</pre>
  <p>Re-run for this revision with the portable <code>measure.sh</code> in a fresh worktree (<code>f02-23</code>, server :20532, data dir re-seeded with the same command), plus the proposed fix from §6 (<a href="2066/repro/revise/">2066/repro/revise/</a>):</p>
  <pre>{measure_revise}</pre>
  <figure><img src="assets/2066-heap.svg" alt="Bar chart: GC'd heap before and after 100 rounds across eight runs. Base grows by 19.4, 21.8, 19.3 and 21.7 MB; PR #2067 grows by 3.6, 6.0 and 3.6 MB; the proposed fix grows by 6.9 MB."><figcaption>Post-GC V8 heap of the bb server process before vs after 100 append+refetch rounds, across the author's two original runs, the independent verifier's run (<code>2066/verify/</code>), and the re-run for this revision. Base retains ~19–22 MB (100 dead revisions of a 100–200-row response, ~200 KB each in-heap); with PR #2067 or the proposed fix the growth is 3.6–6.9 MB (the separate 4-deep <code>timelineLatestRowsCache</code> ring, the 100 extra events in the window, plus noise). Process RSS (in the CSVs) is not a useful signal here — V8 had not collected in any run.</figcaption></figure>
  <p>Per-round samples (<a href="2066/repro/live-base.csv">live-base.csv</a>, <a href="2066/repro/live-pr2067.csv">live-pr2067.csv</a>; revise re-run: <a href="2066/repro/revise/live-base.csv">live-base.csv</a>, <a href="2066/repro/revise/live-pr2067.csv">live-pr2067.csv</a>, <a href="2066/repro/revise/live-proposed-fix.csv">live-proposed-fix.csv</a>): every response was 99–199 rows, i.e. under the 200-row cap, so every revision was stored. The response bytes per round are byte-identical across branches (the fix does not change response data).</p>
  <pre>base:
{live_base}

PR #2067:
{live_pr}</pre>
  <p>Repro files: <a href="2066/repro/">2066/repro/</a></p>

  <h2>5. Root cause</h2>
  <p>The cache (<a href="{P}apps/server/src/services/threads/timeline-cache.ts#L52-L85">timeline-cache.ts:52-85</a>) is a plain <code>Map&lt;string, ThreadTimelineResponse&gt;</code> with LRU re-insertion and a 128-entry bound:</p>
  <pre>getOrBuild(key, build) {{
  const cached = entries.get(key);
  if (cached !== undefined) {{ entries.delete(key); entries.set(key, cached); return cached; }}
  const value = build();
  if (value.rows.length &lt;= maxCacheableRows) {{
    entries.set(key, value);
    while (entries.size &gt; maxEntries) {{ /* evict oldest */ }}
  }}
  return value;
}}</pre>
  <p>The key is <code>`${{maxSeq}}|${{paramsKey}}`</code> (<a href="{P}apps/server/src/services/threads/timeline-cache.ts#L126-L130">L126-130</a>), and the route computes <code>maxSeq</code> from the database on every request (<a href="{P}apps/server/src/routes/threads/data.ts#L335">data.ts:335</a>). Because <code>maxSeq = MAX(sequence)</code> never decreases, an entry keyed by an older <code>maxSeq</code> is unreachable the moment a newer one is stored, yet nothing removes it: the design deliberately uses the key change as the invalidation mechanism (&quot;Keying on the thread high-water maxSeq makes invalidation implicit&quot;, <a href="{P}apps/server/src/services/threads/timeline-cache.ts#L16-L23">L16-23</a>) and relies on the row cap (&quot;an expanded active turn produces hundreds of rows AND a maxSeq that changes on every event, so caching it only thrashes the LRU&quot;, <a href="{P}apps/server/src/services/threads/timeline-cache.ts#L25-L29">L25-29</a>) to keep streaming revisions out.</p>
  <p>That second assumption is where the reasoning breaks: the 200-row cap excludes only <em>large</em> expanded turns. A typical streaming turn on a long thread projects to well under 200 rows (the seeded thread: 99 rows at rest, 199 after 100 appended items), so every event-driven refetch stores a fresh full response. The client refetches after every event batch, so one viewed streaming thread produces ~128 revisions in seconds and from then on holds all 128 LRU slots with entries that can never hit. The symptom (server heap proportional to 128 × response size, even though only one response is useful) follows directly.</p>
  <p><strong>Related but separate mechanisms, so the reader does not conflate them:</strong></p>
  <ul>
    <li><code>timelineLatestRowsCache</code> (<a href="{P}apps/server/src/services/threads/timeline-latest-rows-cache.ts#L23-L24">timeline-latest-rows-cache.ts:23-24</a>) keeps a 4-deep ring of <em>rows</em> per params key for delta computation, 64 keys max. It intentionally keeps a few revisions and shares the <code>rows</code> arrays by reference with the response cache (<a href="{P}apps/server/src/routes/threads/data.ts#L411">data.ts:411</a>), so it is not double-counting the newest revision. It is already keyed the right way (params key → revisions) — the same shape PR #2067 gives the response cache.</li>
    <li>&quot;Older&quot; pages are also keyed by <code>maxSeq</code>, so every appended event invalidates every cached older page of that thread too, even though their content rarely changes. That is a cold-rebuild cost, not a retention cost, and out of scope here.</li>
    <li>The reporter's 300–650 MB server footprint also includes the build path itself (decoding 1.1–4.8 MiB of event JSON per request at 1.4k events/window; see #1749 and #1129). This issue's fix bounds the retained responses; it does not make builds cheaper.</li>
  </ul>

  <h2>6. Proposed fix (first principles)</h2>
  <p>Key the map by the request shape (<code>paramsKey</code>, which already exists for the delta cache) and store the revision alongside the value; treat a different revision as a miss that <em>replaces</em> the slot. This is exactly what PR #2067 does. I would make one simplification: pass <code>maxSeq</code> as a number rather than a second string that embeds the params key again.</p>
  <pre>// timeline-cache.ts
const entries = new Map&lt;string, {{ maxSeq: number; value: ThreadTimelineResponse }}&gt;();

getOrBuild({{ paramsKey, maxSeq }}, build) {{
  const cached = entries.get(paramsKey);
  if (cached?.maxSeq === maxSeq) {{ entries.delete(paramsKey); entries.set(paramsKey, cached); return cached.value; }}
  const value = build();
  entries.delete(paramsKey);                  // a newer revision supersedes the old one even if uncacheable
  if (value.rows.length &lt;= maxCacheableRows) {{
    entries.set(paramsKey, {{ maxSeq, value }});
    while (entries.size &gt; maxEntries) {{ /* evict oldest */ }}
  }}
  return value;
}}

// data.ts
const full = timelineCache.getOrBuild({{ paramsKey, maxSeq }}, () =&gt; ...);   // paramsKey computed once, above</pre>
  <p><code>buildThreadTimelineCacheKey</code> then has no remaining caller and can be deleted (the repo's simplicity rule). Correctness argument: all inputs that select the projection are still in <code>paramsKey</code>; the hit condition is unchanged (<code>paramsKey</code> equal and <code>maxSeq</code> equal); the only behavioral difference is that stale revisions are dropped eagerly, and they were unreachable anyway. Risk: if <code>maxSeq</code> were ever allowed to decrease (e.g. a future rewind that deletes a suffix <em>without</em> appending a marker event), both the old and the new design would serve stale rows for an equal <code>maxSeq</code>; that is pre-existing and should be guarded at the event-deletion site, not here. Tests: the route test in §4b fails before (<code>128 !== 1</code>) and passes after without modification; the two unit scenarios from §4a, rewritten for the <code>{{ paramsKey, maxSeq }}</code> signature (<a href="2066/repro/repro-2066-unit-after-fix.test.ts">repro-2066-unit-after-fix.test.ts</a>), pass after (the base-signature file in §4a cannot run against any fix, see the note there).</p>
  <p><strong>Implemented and checked</strong> (branch <code>proposed-fix-2066</code> on <code>fcada5a3b</code>, <a href="2066/repro/proposed-fix-2066.diff">proposed-fix-2066.diff</a>: <code>timeline-cache.ts</code>, one call site in <code>data.ts</code>, and <code>timeline-cache.test.ts</code> adapted — <code>buildThreadTimelineCacheKey</code> and the <code>maxSeq</code> field of <code>ThreadTimelineCacheKeyArgs</code> are gone, the key-builder tests target <code>buildThreadTimelineParamsKey</code>, and the oversized-replacement and stale-revision cases are added): <code>repro-2066-unit-after-fix</code> 2/2, route test 1/1, <code>timeline-cache.test.ts</code> 9/9, <code>timeline-latest-rows-cache</code>, <code>public-thread-timeline-delta</code> and <code>public-thread-timeline-output-preview</code> all pass (25/25, <a href="2066/repro/proposed-fix-tests.log">log</a>); <code>pnpm exec turbo run typecheck --filter=@bb/server</code> passes (<a href="2066/repro/proposed-fix-typecheck.log">log</a>); ESLint clean on the three files. Live measurement (§4c): +6.9 MB over 100 rounds versus +21.7 MB for base in the same session.</p>
  <details><summary>proposed-fix-2066.diff</summary><pre>{proposed_diff}</pre></details>
  <details><summary>proposed-fix-tests.log</summary><pre>{proposed_tests_log}</pre></details>

  <h2>7. PR review — #2067 &quot;fix(server): retain one timeline revision per request shape&quot;</h2>
  <p><strong>Status:</strong> draft, from fork <code>Yazington/bb</code>, single commit <code>206096e4b</code>, based on <code>6be45053b</code> (68 commits behind the base commit); no CI has run on it (&quot;no checks reported&quot;). It cherry-picks onto <code>fcada5a3b</code> with no conflicts (branch <code>pr-2067-on-base</code> in my worktree; <a href="2066/repro/pr-2067.diff">diff</a>).</p>
  <p><strong>What it changes:</strong> <code>getOrBuild</code> takes <code>{{ paramsKey, revisionKey }}</code>, the map is keyed by <code>paramsKey</code> and stores <code>{{ revisionKey, value }}</code>; a hit requires the stored <code>revisionKey</code> to equal the requested one; a miss deletes the slot before deciding whether the new value is cacheable; the route computes <code>paramsKey</code> once and passes both keys. Tests rewritten for the new signature plus two new ones (replace-same-shape → size 1; distinct shapes → size 2). Doc comment updated.</p>
  <p><strong>Root cause or symptom?</strong> Root cause. It removes the dead-revision retention at the cache layer, on the server side where the policy belongs. No wire shapes change, so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump is needed. No casts, no <code>unknown</code>, no behavior change to responses or cacheability thresholds.</p>
  <h3>Findings</h3>
  <table><tr><th>Where</th><th>Severity</th><th>Finding</th></tr>
    <tr><td>PR description, &quot;How you verified&quot;</td><td>minor (accuracy)</td><td>Claims regression coverage for &quot;oversized replacements&quot; and &quot;7/7 passed&quot;. The test file has 7 tests, but none covers a small cacheable revision being superseded by an oversized one; the existing &quot;does not cache responses above the row cap&quot; test uses the same oversized value twice. I wrote that case (<a href="2066/repro/pr-2067-adversarial.test.ts">pr-2067-adversarial.test.ts</a>); the code handles it (size goes 1 → 0), so add the test rather than claim it.</td></tr>
    <tr><td><code>apps/server/src/services/threads/timeline-cache.ts</code> L42-45, L56-59; <code>routes/threads/data.ts</code> L361-366</td><td>minor (simplicity)</td><td><code>revisionKey</code> is <code>buildThreadTimelineCacheKey(...)</code> = <code>`${{maxSeq}}|${{paramsKey}}`</code>, which re-embeds the params key the map is already keyed by. Passing <code>maxSeq: number</code> and storing it (as <code>timelineLatestRowsCache</code> already does) is simpler, removes a string build per request, and lets <code>buildThreadTimelineCacheKey</code> be deleted along with the two tests that only exercise it (&quot;differs when any projection input differs&quot;, &quot;distinguishes older-page cursors&quot; can target <code>buildThreadTimelineParamsKey</code> instead).</td></tr>
    <tr><td><code>timeline-cache.ts</code> doc comment L25-28</td><td>nit</td><td>The rewritten rationale for the row cap drops the observation that the cap is what keeps <em>large</em> streaming revisions out; worth keeping one sentence that the cap is still needed for size, while the per-shape slot is what bounds count.</td></tr>
    <tr><td>Branch hygiene</td><td>process</td><td>Draft, 68 commits behind, no CI. Needs a rebase onto current <code>main</code>, ready-for-review, and the PR template's &quot;tests that fail before and pass after&quot; (the new replace test does fail before — verified in §4a).</td></tr>
  </table>
  <h3>Tests I ran on <code>pr-2067-on-base</code></h3>
  <ul>
    <li><code>pnpm exec vitest run test/public/repro-2066-timeline-cache-retention.test.ts</code> — passes (size 1 after 150 rounds); fails on base with 128.</li>
    <li>PR's <code>test/services/threads/timeline-cache.test.ts</code> (7) + my adversarial file (4: oversized replacement evicts, replacement becomes MRU, stale-revision request never returns the newer value, 1000 revisions → 1 entry) — 11/11 pass (<a href="2066/repro/pr2067-adversarial.log">log</a>).</li>
    <li><code>repro-2066-unit-pr2067.test.ts</code> (the §4a scenarios in the PR's signature) — 2/2 pass; the base-signature <code>repro-2066-unit.test.ts</code> throws <code>TypeError</code> on this branch as expected (<a href="2066/repro/pr2067-unit-variants.log">log</a>: 14 passed / 2 failed, the 2 being that file).</li>
    <li><code>test/public test/services/threads test/threads</code> — 74 files, 695 tests pass (<a href="2066/repro/pr2067-server-subset.log">log</a>).</li>
    <li><code>pnpm exec turbo run typecheck --filter=@bb/server</code> — pass; ESLint on the three changed files — clean.</li>
    <li>Live measurement (§4c): heap growth over 100 rounds drops from +19.4/+21.8 MB (base) to +3.6 MB; re-run for this revision: +21.7 MB → +3.6 MB; independent verifier: +19.3 MB → +6.0 MB.</li>
  </ul>
  <p><strong>Verdict: REQUEST CHANGES (minor).</strong> The change is correct, at the right layer, and measurably fixes the retention. Before merge: add the oversized-replacement test the description already claims, consider passing <code>maxSeq</code> instead of a redundant <code>revisionKey</code> string and deleting <code>buildThreadTimelineCacheKey</code>, rebase, and take it out of draft so CI runs.</p>
  <details><summary>PR #2067 diff as applied onto fcada5a3b</summary><pre>{pr_diff}</pre></details>
  <details><summary>pr-2067-adversarial.test.ts</summary><pre>{adv_test}</pre></details>

  <h2>8. Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1749">#1749</a> timelineWindowEventBudget assumes 0.06 ms/event — same thread class (long active threads, slow builds); explains the 1.34 s builds in the reporter's logs, which this issue does not address.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1129">#1129</a> (closed) Large finished turns can OOM bb-server during timeline projection — the build-path memory story; complementary.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1131">#1131</a> Synchronous SQLite on the event loop — why repeated cold rebuilds hurt every client.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1301">#1301</a> Thread timeline never unmounts history (renderer side) — likely the bigger share of the reporter's 670 MB renderer number.</li>
    <li>Origin of the cache: <a href="https://github.com/get-bb/bb/pull/201">#201</a> &quot;Timeline performance: incremental delta updates + response caching&quot; (2026-06-18).</li>
  </ul>

  <h2>9. Appendix</h2>
  <h3>Slow-build log line from my instance (shows which byte count the server logs)</h3>
  <pre>{slow_line}</pre>
  <p><code>eventDataBytes: 459376</code> for a window whose HTTP response was 107,571 bytes (99 rows). There is no response-size field anywhere in the server's logging (<code>grep -rn "responseBytes|payloadBytes|content-length" apps/server/src</code> only finds compression/static-file headers).</p>
  <h3>Commands run</h3>
  <pre>git checkout -B repro-2066 fcada5a3b
pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
cd apps/server &amp;&amp; pnpm exec vitest run test/services/threads/repro-2066-unit.test.ts      # fails: 2!==1, 128!==1
cd apps/server &amp;&amp; pnpm exec vitest run test/public/repro-2066-timeline-cache-retention.test.ts   # fails: 128!==1
scripts/bb-dev-app current          # App :12143  Server :20143  Host daemon :28143
pnpm dev:stop &amp;&amp; pnpm seed:perf -- --projects 1 --threads 6 --events 30000 --seed 7
sqlite3 &lt;data-dir&gt;/bb.db "select thread_id,count(*),sum(length(data)),max(sequence) from events group by thread_id order by 2 desc"
/tmp/bb-reports/issues/2066/repro/measure.sh base 100
git fetch origin pull/2067/head:pr-2067 &amp;&amp; git checkout -B pr-2067-on-base fcada5a3b &amp;&amp; git cherry-pick 206096e4b
/tmp/bb-reports/issues/2066/repro/measure.sh pr2067 100
git checkout repro-2066 &amp;&amp; /tmp/bb-reports/issues/2066/repro/measure.sh base-run2 100
cd apps/server &amp;&amp; pnpm exec vitest run test/services/threads/pr-2067-adversarial.test.ts test/services/threads/timeline-cache.test.ts   # on PR branch
cd apps/server &amp;&amp; pnpm exec vitest run test/public test/services/threads test/threads                                                  # on PR branch
pnpm exec turbo run typecheck --filter=@bb/server
pnpm dev:stop; rm -rf &lt;data-dir&gt;

# revision pass (fresh worktree f02-23, server :20532)
git checkout -B revise-2066 fcada5a3b &amp;&amp; pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
cd apps/server &amp;&amp; pnpm exec vitest run test/services/threads/repro-2066-unit.test.ts test/public/repro-2066-timeline-cache-retention.test.ts   # base: 3 failed (2!==1, 128!==1, 128!==1)
git fetch origin pull/2067/head:pr-2067 &amp;&amp; git checkout -B pr-2067-on-base fcada5a3b &amp;&amp; git cherry-pick 206096e4b
cd apps/server &amp;&amp; pnpm exec vitest run --reporter=verbose test/services/threads/repro-2066-unit-pr2067.test.ts test/services/threads/repro-2066-unit.test.ts test/public/repro-2066-timeline-cache-retention.test.ts test/services/threads/pr-2067-adversarial.test.ts test/services/threads/timeline-cache.test.ts   # 14 passed, 2 failed (base-signature file: TypeError)
git checkout -B proposed-fix-2066 fcada5a3b &amp;&amp; git apply /tmp/bb-reports/issues/2066/repro/proposed-fix-2066.diff
cd apps/server &amp;&amp; pnpm exec vitest run --reporter=verbose test/services/threads/repro-2066-unit-after-fix.test.ts test/public/repro-2066-timeline-cache-retention.test.ts test/services/threads/timeline-cache.test.ts test/public/public-thread-timeline-delta.test.ts test/public/public-thread-timeline-output-preview.test.ts test/services/threads/timeline-latest-rows-cache.test.ts   # 25 passed
pnpm exec turbo run typecheck --filter=@bb/server   # pass
scripts/bb-dev-app current &amp;&amp; pnpm dev:stop &amp;&amp; pnpm seed:perf -- --projects 1 --threads 6 --events 30000 --seed 7
git checkout revise-2066 &amp;&amp; OUT_DIR=/tmp/bb-reports/issues/2066/repro/revise /tmp/bb-reports/issues/2066/repro/measure.sh base 100          # +21.7 MB
git checkout pr-2067-on-base &amp;&amp; OUT_DIR=… measure.sh pr2067 100                                                                          # +3.6 MB
git checkout proposed-fix-2066 &amp;&amp; OUT_DIR=… measure.sh proposed-fix 100                                                                  # +6.9 MB
pnpm dev:stop; rm -rf &lt;data-dir&gt;</pre>
  <h3>live-loop.sh</h3><pre>{live_loop}</pre>
  <h3>heap-after-gc.mjs</h3><pre>{heap_gc}</pre>
  <h3>measure.sh</h3><pre>{measure}</pre>
  <p>Other artifacts: <a href="2066/repro/seed-perf.log">seed-perf.log</a>, <a href="2066/repro/timeline-thr_6zik7e8uvr.json">timeline-thr_6zik7e8uvr.json</a> (the 107 KB at-rest response), <a href="2066/repro/route-test-base.log">route-test-base.log</a>, <a href="2066/repro/unit-test-base.log">unit-test-base.log</a>, <a href="2066/repro/pr2067-typecheck.log">pr2067-typecheck.log</a>, <a href="2066/repro/pr2067-unit-variants.log">pr2067-unit-variants.log</a>, <a href="2066/repro/proposed-fix-tests.log">proposed-fix-tests.log</a>, <a href="2066/repro/proposed-fix-typecheck.log">proposed-fix-typecheck.log</a>, <a href="2066/repro/revise/">revise/</a> (re-run logs and CSVs), <a href="2066/verify/">verify/</a> (independent verifier's logs).</p>

  <h2>10. Verification</h2>
  <p>An independent verifier followed §4a and §4b literally in a separate worktree at <code>fcada5a3b</code> (fresh install + build): both failed exactly as shown, including the identical <code>[2066] first-response bytes=24859 rows(last)=152 rounds=150 cache.size=128</code> line. For §4c the verifier had to edit four hardcoded lines of the original <code>measure.sh</code> (worktree path, DB path, port) and then reproduced the measurement on their own isolated instance: base <code>160.1 → 179.4 MB</code> (+19.3), PR #2067 <code>159.8 → 165.8 MB</code> (+6.0) (<a href="2066/verify/">logs</a>). All root-cause code references, the <code>origin/main</code> not-fixed check, the PR diff / merge-base / draft status, and the &quot;oversized replacement&quot; test-coverage finding were confirmed.</p>
  <p><strong>What changed in this revision:</strong></p>
  <ul>
    <li><strong>Major (fixed):</strong> §6 claimed the §4a unit tests &quot;fail before and pass after&quot;. That was false: the §4a file uses the base string-key signature and throws <code>TypeError</code> against PR #2067 (and would against any fix). Re-ran on the PR branch to confirm (<a href="2066/repro/pr2067-unit-variants.log">log</a>), rewrote the sentence, added <a href="2066/repro/repro-2066-unit-pr2067.test.ts">repro-2066-unit-pr2067.test.ts</a> (passes 2/2 on the PR branch) and <a href="2066/repro/repro-2066-unit-after-fix.test.ts">repro-2066-unit-after-fix.test.ts</a>, and actually implemented the proposed fix (<a href="2066/repro/proposed-fix-2066.diff">diff</a>) so its pass-after claims are backed by runs (25/25 tests, typecheck, live measurement +6.9 MB). The route-level test (§4b) is now identified as the signature-independent fail-before/pass-after evidence.</li>
    <li><strong>Minor (fixed):</strong> <code>measure.sh</code> no longer hardcodes the worktree, data dir or port; it reads them from <code>git rev-parse --show-toplevel</code> and <code>scripts/bb-dev-app status</code>, checks the inspector port after stopping any previous instance, and documents the seed prerequisite. Verified by running it unmodified in a third worktree (<code>f02-23</code>, port :20532): base +21.7 MB, PR #2067 +3.6 MB (<a href="2066/repro/revise/">revise/</a>). The chart now shows all eight runs.</li>
    <li><strong>Minor (fixed):</strong> TL;DR now states the client refetch cadence as &quot;at least every 50 ms, up to 1 s on slow builds&quot; with the exact constants cited.</li>
    <li>Also corrected in passing: the repro unit tests used <code>status: &quot;running&quot;</code>, which is not a <code>ThreadStatus</code> (vitest does not typecheck, so it ran anyway); changed to <code>&quot;active&quot;</code> in all three unit files so they pass <code>turbo typecheck</code>. The base-run logs were re-captured after this change and are unchanged in substance (<code>2 !== 1</code>, <code>128 !== 1</code>).</li>
  </ul>
</main></body></html>
"""
pathlib.Path("/tmp/bb-reports/issues/2066.html").write_text(page)
print("wrote /tmp/bb-reports/issues/2066.html", len(page))
