#!/usr/bin/env python3
"""Revision pass: patches build-report.py (the report generator) in place."""
import pathlib

p = pathlib.Path("/tmp/bb-reports/issues/2066/repro/build-report.py")
s = p.read_text()


def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (s.count(old), old[:80])
    s = s.replace(old, new)


# --- new artifact reads
rep('''adv_test = esc(f("pr-2067-adversarial.test.ts"))
''', '''adv_test = esc(f("pr-2067-adversarial.test.ts"))
unit_pr_test = esc(f("repro-2066-unit-pr2067.test.ts"))
unit_fix_test = esc(f("repro-2066-unit-after-fix.test.ts"))
proposed_diff = esc(f("proposed-fix-2066.diff"))
''')
rep('''measure_logs = esc(f("measure-base.log") + f("measure-base-run2.log") + f("measure-pr2067.log"))
''', '''measure_logs = esc(f("measure-base.log") + f("measure-base-run2.log") + f("measure-pr2067.log"))
measure_revise = esc(f("revise/measure-base.log") + "\\n" + f("revise/measure-pr2067.log") + "\\n" + f("revise/measure-proposed-fix.log"))
unit_variants_log = esc(f("pr2067-unit-variants.log"))
proposed_tests_log = esc(f("proposed-fix-tests.log"))
''')

# --- TL;DR refetch interval
rep('''During a streaming turn the web client refetches the same window after every event batch (about every 50–200 ms), so''',
    '''During a streaming turn the web client refetches the same window after every event batch (at least every 50 ms, up to 1 s on slow builds: <a href="{P}apps/app/src/hooks/cache-owners/realtime-cache-registry.ts#L179-L180">realtime-cache-registry.ts:179-180</a> clamps the trailing delay between 50 ms and 1,000 ms scaled by the observed fetch duration), so''')

# --- §4a: note on signature + after-fix variants
rep('''  <details><summary>repro-2066-unit.test.ts</summary><pre>{unit_test}</pre></details>

  <h3>4b.''', '''  <details><summary>repro-2066-unit.test.ts</summary><pre>{unit_test}</pre></details>
  <p><strong>Scope of this file:</strong> it calls <code>getOrBuild(buildThreadTimelineCacheKey(shape), build)</code>, i.e. the <em>base</em> string-key signature, so it only demonstrates the bug on <code>fcada5a3b</code>. Any fix changes that signature (PR #2067 takes <code>{{ paramsKey, revisionKey }}</code>, the proposed fix in §6 takes <code>{{ paramsKey, maxSeq }}</code>), and against either this file throws <code>TypeError: Cannot read properties of undefined (reading 'value')</code> rather than passing. The same two scenarios rewritten for each new signature are <a href="2066/repro/repro-2066-unit-pr2067.test.ts">repro-2066-unit-pr2067.test.ts</a> (passes on the PR branch, 2/2; <a href="2066/repro/pr2067-unit-variants.log">log</a>, which also shows the base-signature file's TypeError on that branch) and <a href="2066/repro/repro-2066-unit-after-fix.test.ts">repro-2066-unit-after-fix.test.ts</a> (passes on base + <a href="2066/repro/proposed-fix-2066.diff">proposed-fix-2066.diff</a>, 2/2; <a href="2066/repro/proposed-fix-tests.log">log</a>). The signature-independent fail-before/pass-after evidence is the route-level test in §4b.</p>
  <details><summary>repro-2066-unit-pr2067.test.ts</summary><pre>{unit_pr_test}</pre></details>
  <details><summary>repro-2066-unit-after-fix.test.ts</summary><pre>{unit_fix_test}</pre></details>
  <details><summary>pr2067-unit-variants.log (PR branch: PR-signature file passes, base-signature file throws)</summary><pre>{unit_variants_log}</pre></details>

  <h3>4b.''')

# --- §4b pass-after statement
rep('''  <p>With PR #2067 cherry-picked onto <code>fcada5a3b</code> the same file passes (<a href="2066/repro/route-test-pr2067-single.log">log</a>).</p>''',
    '''  <p>This file drives the route through HTTP and never names the cache signature, so it is the one that runs unchanged before and after. With PR #2067 cherry-picked onto <code>fcada5a3b</code> it passes (<a href="2066/repro/route-test-pr2067-single.log">log</a>, and again in <a href="2066/repro/pr2067-unit-variants.log">pr2067-unit-variants.log</a>); with the proposed fix from §6 applied it passes too (<a href="2066/repro/proposed-fix-tests.log">proposed-fix-tests.log</a>).</p>''')

# --- §4c portability note + revise run
rep('''  <h3>4c. Live instance — heap growth on a seeded 9,001-event thread</h3>
  <p>Fresh server each run, 3 warm fetches, force a full GC through the inspector and read <code>Runtime.getHeapUsage</code>; then 100 rounds of &quot;insert one <code>agentMessage</code> event into the dev SQLite DB, GET the timeline&quot;; then GC + read again. Scripts: <a href="2066/repro/measure.sh">measure.sh</a>, <a href="2066/repro/live-loop.sh">live-loop.sh</a>, <a href="2066/repro/heap-after-gc.mjs">heap-after-gc.mjs</a>.</p>
  <pre>{measure_logs}</pre>''',
    '''  <h3>4c. Live instance — heap growth on a seeded 9,001-event thread</h3>
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
  <pre>{measure_revise}</pre>''')

rep('''  <figure><img src="assets/2066-heap.svg" alt="Bar chart: GC'd heap before and after 100 rounds. Base grows 159.8→179.2 MB and 159.5→181.3 MB; PR #2067 grows 160.0→163.6 MB."><figcaption>Post-GC V8 heap of the bb server process before vs after 100 append+refetch rounds. Base retains ~20 MB (100 dead revisions of a 100–200-row response, ~200 KB each in-heap); with PR #2067 the growth is 3.6 MB (the separate 4-deep <code>timelineLatestRowsCache</code> ring plus noise). Process RSS (in the CSVs) is not a useful signal here — V8 had not collected in either run.</figcaption></figure>
  <p>Per-round samples (<a href="2066/repro/live-base.csv">live-base.csv</a>, <a href="2066/repro/live-pr2067.csv">live-pr2067.csv</a>): every response was 99–199 rows, i.e. under the 200-row cap, so every revision was stored.</p>''',
    '''  <figure><img src="assets/2066-heap.svg" alt="Bar chart: GC'd heap before and after 100 rounds across eight runs. Base grows by 19.4, 21.8, 19.3 and 21.7 MB; PR #2067 grows by 3.6, 6.0 and 3.6 MB; the proposed fix grows by 6.9 MB."><figcaption>Post-GC V8 heap of the bb server process before vs after 100 append+refetch rounds, across the author's two original runs, the independent verifier's run (<code>2066/verify/</code>), and the re-run for this revision. Base retains ~19–22 MB (100 dead revisions of a 100–200-row response, ~200 KB each in-heap); with PR #2067 or the proposed fix the growth is 3.6–6.9 MB (the separate 4-deep <code>timelineLatestRowsCache</code> ring, the 100 extra events in the window, plus noise). Process RSS (in the CSVs) is not a useful signal here — V8 had not collected in any run.</figcaption></figure>
  <p>Per-round samples (<a href="2066/repro/live-base.csv">live-base.csv</a>, <a href="2066/repro/live-pr2067.csv">live-pr2067.csv</a>; revise re-run: <a href="2066/repro/revise/live-base.csv">live-base.csv</a>, <a href="2066/repro/revise/live-pr2067.csv">live-pr2067.csv</a>, <a href="2066/repro/revise/live-proposed-fix.csv">live-proposed-fix.csv</a>): every response was 99–199 rows, i.e. under the 200-row cap, so every revision was stored. The response bytes per round are byte-identical across branches (the fix does not change response data).</p>''')

# --- §6 tests sentence + artifact
rep('''Tests: the two unit tests in §4a and the route test in §4b fail before and pass after.</p>''',
    '''Tests: the route test in §4b fails before (<code>128 !== 1</code>) and passes after without modification; the two unit scenarios from §4a, rewritten for the <code>{{ paramsKey, maxSeq }}</code> signature (<a href="2066/repro/repro-2066-unit-after-fix.test.ts">repro-2066-unit-after-fix.test.ts</a>), pass after (the base-signature file in §4a cannot run against any fix, see the note there).</p>
  <p><strong>Implemented and checked</strong> (branch <code>proposed-fix-2066</code> on <code>fcada5a3b</code>, <a href="2066/repro/proposed-fix-2066.diff">proposed-fix-2066.diff</a>: <code>timeline-cache.ts</code>, one call site in <code>data.ts</code>, and <code>timeline-cache.test.ts</code> adapted — <code>buildThreadTimelineCacheKey</code> and the <code>maxSeq</code> field of <code>ThreadTimelineCacheKeyArgs</code> are gone, the key-builder tests target <code>buildThreadTimelineParamsKey</code>, and the oversized-replacement and stale-revision cases are added): <code>repro-2066-unit-after-fix</code> 2/2, route test 1/1, <code>timeline-cache.test.ts</code> 9/9, <code>timeline-latest-rows-cache</code>, <code>public-thread-timeline-delta</code> and <code>public-thread-timeline-output-preview</code> all pass (25/25, <a href="2066/repro/proposed-fix-tests.log">log</a>); <code>pnpm exec turbo run typecheck --filter=@bb/server</code> passes (<a href="2066/repro/proposed-fix-typecheck.log">log</a>); ESLint clean on the three files. Live measurement (§4c): +6.9 MB over 100 rounds versus +21.7 MB for base in the same session.</p>
  <details><summary>proposed-fix-2066.diff</summary><pre>{proposed_diff}</pre></details>
  <details><summary>proposed-fix-tests.log</summary><pre>{proposed_tests_log}</pre></details>''')

# --- §7 tests list
rep('''    <li>PR's <code>test/services/threads/timeline-cache.test.ts</code> (7) + my adversarial file (4: oversized replacement evicts, replacement becomes MRU, stale-revision request never returns the newer value, 1000 revisions → 1 entry) — 11/11 pass (<a href="2066/repro/pr2067-adversarial.log">log</a>).</li>''',
    '''    <li>PR's <code>test/services/threads/timeline-cache.test.ts</code> (7) + my adversarial file (4: oversized replacement evicts, replacement becomes MRU, stale-revision request never returns the newer value, 1000 revisions → 1 entry) — 11/11 pass (<a href="2066/repro/pr2067-adversarial.log">log</a>).</li>
    <li><code>repro-2066-unit-pr2067.test.ts</code> (the §4a scenarios in the PR's signature) — 2/2 pass; the base-signature <code>repro-2066-unit.test.ts</code> throws <code>TypeError</code> on this branch as expected (<a href="2066/repro/pr2067-unit-variants.log">log</a>: 14 passed / 2 failed, the 2 being that file).</li>''')
rep('''    <li>Live measurement (§4c): heap growth over 100 rounds drops from +19.4/+21.8 MB to +3.6 MB.</li>''',
    '''    <li>Live measurement (§4c): heap growth over 100 rounds drops from +19.4/+21.8 MB (base) to +3.6 MB; re-run for this revision: +21.7 MB → +3.6 MB; independent verifier: +19.3 MB → +6.0 MB.</li>''')

# --- Commands run appendix
rep('''pnpm dev:stop; rm -rf &lt;data-dir&gt;</pre>''',
    '''pnpm dev:stop; rm -rf &lt;data-dir&gt;

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
pnpm dev:stop; rm -rf &lt;data-dir&gt;</pre>''')

# --- Other artifacts line + Verification section at the end
rep('''  <p>Other artifacts: <a href="2066/repro/seed-perf.log">seed-perf.log</a>, <a href="2066/repro/timeline-thr_6zik7e8uvr.json">timeline-thr_6zik7e8uvr.json</a> (the 107 KB at-rest response), <a href="2066/repro/route-test-base.log">route-test-base.log</a>, <a href="2066/repro/unit-test-base.log">unit-test-base.log</a>, <a href="2066/repro/pr2067-typecheck.log">pr2067-typecheck.log</a>.</p>
</main></body></html>''',
    '''  <p>Other artifacts: <a href="2066/repro/seed-perf.log">seed-perf.log</a>, <a href="2066/repro/timeline-thr_6zik7e8uvr.json">timeline-thr_6zik7e8uvr.json</a> (the 107 KB at-rest response), <a href="2066/repro/route-test-base.log">route-test-base.log</a>, <a href="2066/repro/unit-test-base.log">unit-test-base.log</a>, <a href="2066/repro/pr2067-typecheck.log">pr2067-typecheck.log</a>, <a href="2066/repro/pr2067-unit-variants.log">pr2067-unit-variants.log</a>, <a href="2066/repro/proposed-fix-tests.log">proposed-fix-tests.log</a>, <a href="2066/repro/proposed-fix-typecheck.log">proposed-fix-typecheck.log</a>, <a href="2066/repro/revise/">revise/</a> (re-run logs and CSVs), <a href="2066/verify/">verify/</a> (independent verifier's logs).</p>

  <h2>10. Verification</h2>
  <p>An independent verifier followed §4a and §4b literally in a separate worktree at <code>fcada5a3b</code> (fresh install + build): both failed exactly as shown, including the identical <code>[2066] first-response bytes=24859 rows(last)=152 rounds=150 cache.size=128</code> line. For §4c the verifier had to edit four hardcoded lines of the original <code>measure.sh</code> (worktree path, DB path, port) and then reproduced the measurement on their own isolated instance: base <code>160.1 → 179.4 MB</code> (+19.3), PR #2067 <code>159.8 → 165.8 MB</code> (+6.0) (<a href="2066/verify/">logs</a>). All root-cause code references, the <code>origin/main</code> not-fixed check, the PR diff / merge-base / draft status, and the &quot;oversized replacement&quot; test-coverage finding were confirmed.</p>
  <p><strong>What changed in this revision:</strong></p>
  <ul>
    <li><strong>Major (fixed):</strong> §6 claimed the §4a unit tests &quot;fail before and pass after&quot;. That was false: the §4a file uses the base string-key signature and throws <code>TypeError</code> against PR #2067 (and would against any fix). Re-ran on the PR branch to confirm (<a href="2066/repro/pr2067-unit-variants.log">log</a>), rewrote the sentence, added <a href="2066/repro/repro-2066-unit-pr2067.test.ts">repro-2066-unit-pr2067.test.ts</a> (passes 2/2 on the PR branch) and <a href="2066/repro/repro-2066-unit-after-fix.test.ts">repro-2066-unit-after-fix.test.ts</a>, and actually implemented the proposed fix (<a href="2066/repro/proposed-fix-2066.diff">diff</a>) so its pass-after claims are backed by runs (25/25 tests, typecheck, live measurement +6.9 MB). The route-level test (§4b) is now identified as the signature-independent fail-before/pass-after evidence.</li>
    <li><strong>Minor (fixed):</strong> <code>measure.sh</code> no longer hardcodes the worktree, data dir or port; it reads them from <code>git rev-parse --show-toplevel</code> and <code>scripts/bb-dev-app status</code>, checks the inspector port after stopping any previous instance, and documents the seed prerequisite. Verified by running it unmodified in a third worktree (<code>f02-23</code>, port :20532): base +21.7 MB, PR #2067 +3.6 MB (<a href="2066/repro/revise/">revise/</a>). The chart now shows all eight runs.</li>
    <li><strong>Minor (fixed):</strong> TL;DR now states the client refetch cadence as &quot;at least every 50 ms, up to 1 s on slow builds&quot; with the exact constants cited.</li>
    <li>Also corrected in passing: the repro unit tests used <code>status: &quot;running&quot;</code>, which is not a <code>ThreadStatus</code> (vitest does not typecheck, so it ran anyway); changed to <code>&quot;active&quot;</code> in all three unit files so they pass <code>turbo typecheck</code>. The base-run logs were re-captured after this change and are unchanged in substance (<code>2 !== 1</code>, <code>128 !== 1</code>).</li>
  </ul>
</main></body></html>''')

p.write_text(s)
print("patched")
