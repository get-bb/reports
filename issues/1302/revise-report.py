import pathlib
p = pathlib.Path('/tmp/bb-reports/issues/1302/build-report.py'); s = p.read_text()
def rep(old, new, count=1):
    global s
    assert s.count(old) >= 1, old[:80]
    s = s.replace(old, new, count)

# TL;DR concurrency wording
rep("spawning two threads produced 8 refetches (1.09&nbsp;MB); three concurrent one-line turns produced 4 refetches (546&nbsp;KB; in-flight dedupe absorbed the other two). All of the issue's numbers reproduce within a few percent.",
    "spawning two threads produced 8 refetches (1.09&nbsp;MB; the verifier's re-run: 6 / 819&nbsp;KB); three concurrent one-line turns produced 4 refetches (546&nbsp;KB) in my run and 2 (273&nbsp;KB) in the verifier's, because react-query's in-flight dedupe absorbs transitions that land while a bootstrap fetch is still outstanding, so under concurrency the count is anywhere from 2 to 2×N per batch of N turns depending on timing. All of the issue's numbers reproduce within a few percent.")

# Claims table row
rep("Refetches multiply (exp. B: 3 concurrent turns → 4 refetches; spawning 2 threads → 8).",
    "Refetches multiply, but the multiplier is timing dependent (exp. B: 3 concurrent turns → 4 refetches in my run, 2 in the verifier's; spawning 2 threads → 8 in my run, 6 in the verifier's; the ceiling is 2 per turn, the floor is 2 per batch when all transitions land inside one in-flight fetch).")

# Environment wrapper bullet
rep("<li>CLI wrapper: <a href=\"1302/repro/1302-bb.sh\">1302/repro/1302-bb.sh</a> (set <code>BB_REPO</code>; it evaluates <code>scripts/bb-dev-app env</code> from that worktree and unsets <code>BB_THREAD_ID</code>).",
    "<li>CLI wrapper: <a href=\"1302/repro/1302-bb.sh\">1302/repro/1302-bb.sh</a> (set <code>BB_REPO</code> to your worktree; it <b>always</b> evaluates <code>scripts/bb-dev-app env</code> from that worktree, after unsetting every inherited <code>BB_*</code> variable). <b>Warning:</b> a shell opened from inside a bb agent thread already exports <code>BB_SERVER_URL</code> (the user's real instance on <code>:38886</code>) and <code>BB_THREAD_ID</code>; the first version of this wrapper honoured a pre-set <code>BB_SERVER_URL</code> and the verifier caught it listing the real instance's hosts. The fixed wrapper (and <code>1302-wait-idle.sh</code>) ignore inherited values and print <code>bb -&gt; &lt;url&gt;</code> on stderr so you can see which server every command hits; use <code>BB_DEV_SERVER_URL=…</code> to override deliberately. Verified after the fix: with <code>BB_SERVER_URL=http://127.0.0.1:38886</code> exported, <code>1302-bb.sh machine list</code> printed <code>bb -&gt; http://localhost:22777</code> and returned only that instance's host (<a href=\"1302/verify/wrapper-isolation-check.txt\">wrapper-isolation-check.txt</a>).")

# Repro step 3 note about 503
rep("""  --title "1302 target" --prompt "Reply only with ok." --json                                                # -&gt; thr_mfe9vetq34</pre></li>""",
    """  --title "1302 target" --prompt "Reply only with ok." --json                                                # -&gt; thr_mfe9vetq34</pre>
      If the spawn returns <code>HTTP 503: Unable to load codex models to resolve the default</code>, that is a transient <code>provider.list_models</code> timeout on a loaded machine (the verifier hit it twice at load 120+); just retry the same command.</li>""")

# Exp B paragraph
rep("""      Six status transitions in ~2.5&nbsp;s produced 4 bootstrap downloads (546&nbsp;KB, <a href="1302/repro/send3-concurrent-api-log.txt">send3-concurrent-api-log.txt</a>); the two "missing" ones were absorbed by react-query's in-flight dedupe. Sibling transitions also refetch the open thread's child/fork lists and PR state (project-scoped list invalidation from the same rule).</li>""",
    """      Six status transitions in ~2.5&nbsp;s produced 4 bootstrap downloads (546&nbsp;KB, <a href="1302/repro/send3-concurrent-api-log.txt">send3-concurrent-api-log.txt</a>); the two "missing" ones were absorbed by react-query's in-flight dedupe. <b>This number is timing dependent, not a constant.</b> The independent verifier's re-run of the same script produced only 2 bootstrap downloads (273,212&nbsp;B; <a href="1302/verify/send3-concurrent-api-log.txt">verify/send3-concurrent-api-log.txt</a>) because all three turns started within a few ms and all three ended within ~200&nbsp;ms of each other, so each batch of three transitions was absorbed by one in-flight fetch. Spawning two siblings, whose transitions are spread over ~15&nbsp;s, refetched 8× (1.09&nbsp;MB) in my run and 6× (818,776&nbsp;B; <a href="1302/verify/spawn2-api-log.txt">verify/spawn2-api-log.txt</a>) in the verifier's. The rule is: every <code>status-changed</code> push that arrives while no bootstrap fetch is in flight starts a new full download, so N concurrent turns cost between 2 and 2×N downloads. Sibling transitions also refetch the open thread's child/fork lists and PR state (project-scoped list invalidation from the same rule).</li>""")

# Screenshot caption
rep("""<figcaption>Thread <code>thr_mfe9vetq34</code> after the exp. A send; the fetch log above was captured on this page.</figcaption>""",
    """<figcaption>Thread <code>thr_mfe9vetq34</code> at the end of the run (after the spawn prompt, the exp. A send and the exp. B concurrent send, hence three "Reply only with ok." exchanges). The fetch logs above were captured on this page.</figcaption>""")

# Permalink fix
rep("""Because <code>flush</code> is <code>immediate</code> ({L("apps/app/src/hooks/realtime-cache-effects.ts",262,270)}) the 50&nbsp;ms debounce""",
    """Because <code>flush</code> is <code>immediate</code>, <code>handleChanged</code>'s <code>case "thread"</code> branch calls <code>invalidationScheduler.flush()</code> instead of <code>schedule()</code> ({L("apps/app/src/hooks/realtime-cache-effects.ts",256,262)}, predicate <code>shouldFlushThreadChangesImmediately</code> at {L("apps/app/src/hooks/cache-owners/realtime-cache-registry.ts",614,620)}), so the 50&nbsp;ms debounce""")

# Notes: 503 note
rep("""passing <code>--machine host_eg4qqky6xx</code> works.</li>""",
    """passing <code>--machine host_eg4qqky6xx</code> works. Separately, <code>bb thread spawn --provider codex</code> can fail transiently with <code>HTTP 503: Unable to load codex models to resolve the default</code> (dev.log: <code>provider.list_models command_timeout</code>) when the machine is heavily loaded; retry.</li>""")

# Verification subsection before </main>
rep("""  <pre>{prof}</pre>
</main></body></html>""",
    """  <pre>{prof}</pre>

  <h2>Verification</h2>
  <p>An independent verifier re-ran the minimal reproduction from a fresh worktree at <code>16ceb3a54</code> (own instance: app <code>:12041</code>, server <code>:20041</code>, daemon <code>:28041</code>) and a reviser then re-checked the findings from a third worktree (server <code>:22777</code>). What was confirmed and what changed:</p>
  <ul>
    <li><b>Confirmed as written:</b> seed (12 projects / 1,200 threads / 402,298 events, server stopped), bootstrap size 133,602&nbsp;B / 10,775&nbsp;B gzip for 12 projects / 129 threads (report: 133,614 / 10,770), first row 1,002&nbsp;B with the same 28 keys, exp. A = exactly 2 <code>sidebar-bootstrap</code> GETs per single <code>bb thread tell</code> (134,860&nbsp;B at turn start, 134,856&nbsp;B at turn end; 269,716 of 281,654 bytes; <a href="1302/verify/send1-api-log.txt">verify/send1-api-log.txt</a>), spawning two siblings = 6 refetches / 818,776&nbsp;B, unit test 1 passed, every root-cause code excerpt matches the tree, <code>git log 16ceb3a54..origin/main</code> touches none of the cited paths (not fixed on main), both screenshots are real 1400×900 PNGs.</li>
    <li><b>Fixed (major):</b> <a href="1302/repro/1302-bb.sh">1302-bb.sh</a> previously only ran <code>scripts/bb-dev-app env</code> when <code>BB_SERVER_URL</code> was unset, so from a shell that inherits <code>BB_SERVER_URL</code> (any bb agent thread) it silently targeted the user's real instance; the verifier's equivalent wrapper listed the real hosts (<code>bee</code>, <code>Sawyer's MacBook Air</code>) instead of <code>seed-host</code>. The wrapper and <a href="1302/repro/1302-wait-idle.sh">1302-wait-idle.sh</a> now unset all inherited <code>BB_*</code>, always evaluate the worktree's <code>bb-dev-app env</code>, and echo the target URL. Re-tested with <code>BB_SERVER_URL=http://127.0.0.1:38886</code> exported: <code>machine list</code> went to <code>:22777</code> and returned only that instance's host (<a href="1302/verify/wrapper-isolation-check.txt">wrapper-isolation-check.txt</a>).</li>
    <li><b>Corrected (minor):</b> exp. B's "3 concurrent turns → 4 refetches" is now stated as a timing-dependent range (verifier measured 2 / 273&nbsp;KB for the tells and 6 / 819&nbsp;KB for the two spawns; <a href="1302/verify/send3-concurrent-api-log.txt">verify/send3-concurrent-api-log.txt</a>, <a href="1302/verify/spawn2-api-log.txt">verify/spawn2-api-log.txt</a>). The TL;DR and claims table were updated to match.</li>
    <li><b>Corrected (minor):</b> the "flush is immediate" permalink pointed at the <code>environment</code>/<code>host</code> branch (L262–L270); it now points at the <code>case "thread"</code> branch <code>realtime-cache-effects.ts#L256-L262</code> and the predicate <code>realtime-cache-registry.ts#L614-L620</code>, re-checked with <code>sed -n</code> at <code>16ceb3a54</code>.</li>
    <li><b>Corrected (minor):</b> the second screenshot's caption now says it was captured at the end of the run (three exchanges visible), and the repro notes mention the transient <code>HTTP 503: Unable to load codex models</code> spawn failure and that a retry is enough.</li>
  </ul>
</main></body></html>""")
p.write_text(s)
print("patched")
