import html, pathlib, json

R = pathlib.Path("/tmp/bb-reports/issues/1301/repro")
OUT = pathlib.Path("/tmp/bb-reports/issues/1301.html")
BASE = "16ceb3a540f81c1189efaffb27a39b1d9443abf5"

def esc(p):
    return html.escape(pathlib.Path(p).read_text())

def pre(text):
    return "<pre>" + html.escape(text) + "</pre>"

def link(path, l1, l2=None):
    frag = f"#L{l1}" + (f"-L{l2}" if l2 else "")
    return f'<a href="https://github.com/get-bb/bb/blob/{BASE}/{path}{frag}"><code>{path}{frag}</code></a>'

walk = pathlib.Path("/tmp/bb-reports/issues/1301-walk-pages.log").read_text()
out02 = (R / "browser-02-output.log").read_text()
out03 = (R / "browser-03-output.log").read_text()
out04 = (R / "browser-04-output.log").read_text()
out04 = out04.split("=== pageLate")[0]  # the late section had no page to load
out05 = (R / "browser-05-output.log").read_text()
out06 = (R / "browser-06-output.log").read_text()
out07 = (R / "browser-07-output.log").read_text()
seed = pathlib.Path("/tmp/bb-reports/issues/1301-seed.log").read_text()
issue_test_out = (R / "issue-1301-test-output.log").read_text()

lt03 = json.loads(out03.split("LONGTASKS ")[1].split("\n")[0])
lt05 = json.loads(out05.split("LONGTASKS ")[1].split("\n")[0])
lt07 = json.loads(out07.split("LONGTASKS ")[1].split("\n")[0])
def ltsum(lt):
    d = [x["dur"] for x in lt]
    return f"{len(d)} long tasks, min {min(d)} ms, median {sorted(d)[len(d)//2]} ms, max {max(d)} ms, total {sum(d)} ms"

doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1301 thread timeline never unmounts history</title>
<style>
  :root {{ --canvas:#fafaf8; --ink:#1a1a1a; --muted:#666; --line:#e2e2de; --accent:#0052cc; --high:#b60205; --ok:#1a7f37; --warn:#9a6700; }}
  body {{ margin:0; background:var(--canvas); color:var(--ink); font:16px/1.55 system-ui,-apple-system,Segoe UI,sans-serif; }}
  main {{ max-width:900px; margin:0 auto; padding:40px 24px 80px; }}
  h1 {{ font-size:26px; line-height:1.25; margin:0 0 6px; }}
  h2 {{ font-size:18px; margin:36px 0 10px; padding-top:20px; border-top:1px solid var(--line); }}
  h3 {{ font-size:15px; margin:22px 0 8px; }}
  .meta {{ color:var(--muted); font-size:14px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }}
  .pill {{ display:inline-block; padding:1px 8px; border-radius:999px; font-size:12px; border:1px solid var(--line); }}
  .pill.high {{ background:var(--high); color:#fff; border-color:var(--high); }}
  .pill.ok {{ background:var(--ok); color:#fff; border-color:var(--ok); }}
  .pill.warn {{ background:var(--warn); color:#fff; border-color:var(--warn); }}
  .verdict {{ font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; background:#fff; }}
  figcaption {{ font-size:13px; color:var(--muted); margin-top:6px; }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; max-height:520px; }}
  a {{ color:var(--accent); }}
  .grid {{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }} @media (max-width:700px){{ .grid{{grid-template-columns:1fr;}} }}
  .v-ok {{ color:var(--ok); font-weight:600; }} .v-bad {{ color:var(--high); font-weight:600; }} .v-unk {{ color:var(--warn); font-weight:600; }}
  details summary {{ cursor:pointer; color:var(--accent); }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1301 · Thread timeline never unmounts history: 22k DOM nodes and 250-600ms long tasks after scrolling a large thread</h1>
  <p class="meta">
    <span class="pill">Type: Bug (perf)</span> <span class="pill warn">Priority: not set on issue</span> <span class="pill">Effort: not set on issue</span>
    <span class="pill">perf</span>
    <a href="https://github.com/get-bb/bb/issues/1301">open on GitHub</a>
    <span>investigated 2026-08-18</span>
    <span>base commit <code>{BASE[:9]}</code> (main)</span>
  </p>
  <p class="verdict">Verdict: <span class="pill high">REPRODUCED</span> &nbsp; Root-cause confidence: <span class="pill ok">high</span></p>

  <h2>TL;DR</h2>
  <p>On a big thread the web app pages history in from the server just fine (anchor-based <code>timeline?beforeAnchorSeq=…</code>, ~10 pages of ~35–55 ms / 75–170 KB each on this machine). But every page the user scrolls into is <em>prepended</em> to a single in-memory array (<code>loadedTimeline.rows</code>) and <code>ThreadTimelineRows</code> renders that entire array as real React components and real DOM. Nothing is windowed, virtualised, or collapsed, so the DOM grows monotonically: on the seeded 9,001-event thread at a 390×844 viewport I measured 2,403 → 21,082 DOM nodes and 6,552 → 68,302 px of scroll height after reaching the top, exactly the shape the issue describes. Each prepended page costs one synchronous long task of ~280–470 ms (dev build, desktop CPU) made of mounting ~150 rows (~4,000 nodes) plus forced layout of the ever-larger document (<code>readOverflowMeasurement</code> in a <code>useLayoutEffect</code> is the largest attributed JS frame). The same accumulation happens at desktop widths (measured 21,182 nodes, long tasks up to 589 ms). Open PR <a href="https://github.com/get-bb/bb/pull/1384">#1384</a> (not linked to the issue) adds an in-flow windowed list for compact viewports and, with main merged in, bounds the DOM to ~1.7–2.2k nodes and long tasks to ~60–170 ms on the same repro; it does not touch desktop and has a real remount-on-threshold defect (details below).</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim (issue)</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>Opening the 9,001-event seeded thread starts at ~2.3k DOM nodes; initial page ~109 KB / ~50 ms</td><td class="v-ok">Verified</td><td>2,403 nodes, 84 rows mounted at load; <code>GET /timeline</code> = 109,302 bytes in 58 ms (curl), 92 rows.</td></tr>
    <tr><td>Scrolling to the top grows the DOM monotonically to ~22k nodes and ~75k px scroll height; nothing is unmounted</td><td class="v-ok">Verified</td><td>21,082 nodes / 820 mounted rows / 68,302 px after reaching the top; count never decreases across samples (browser-02, browser-03 logs). Numbers differ slightly from the issue because the seed fixture on this run is 8 threads / 34,536 events, not the 400k base + jumbo append.</td></tr>
    <tr><td>Every older-page render is a 250–600 ms synchronous long task (desktop speed, dev build)</td><td class="v-ok">Verified</td><td>PerformanceObserver <code>longtask</code>: {html.escape(ltsum(lt03))} across the 10 older pages at 390 px width; {html.escape(ltsum(lt07))} at 1280 px width. Dev build (Vite, React dev runtime), Chromium headless.</td></tr>
    <tr><td>Server-side pagination is already good (~10 KB / ~40 ms per page); the problem is purely client accumulation</td><td class="v-ok">Verified (sizes larger than claimed)</td><td>Walking all cursors: 11 pages, 943 rows, 6–54 ms each, but 72–167 KB per page (not ~10 KB) — the seeded assistant messages carry code blocks. Total 1.24 MB for the whole thread. Client accumulation is the mechanism (root cause below).</td></tr>
    <tr><td>Multiply ~4× for phone CPUs</td><td class="v-unk">Unverified</td><td>No phone hardware in this environment; a 4× CPU slowdown would put the measured 280–470 ms tasks in the 1–2 s range, plausible but not measured.</td></tr>
    <tr><td>Comment: a 44,246-event / 131.7 MiB production conversation; latest-page projection reads 1.7–2.1 MiB and blocks the server 270–3,578 ms</td><td class="v-unk">Unverified / out of scope</td><td>Server-side read cost is tracked in #1131 / #1207 per the comment; on this fixture the latest page is 109 KB / 58 ms so nothing here contradicts or confirms the production numbers.</td></tr>
    <tr><td>Suggested approach: window the list keyed on stable anchor ids; paging protocol needs no changes</td><td class="v-ok">Consistent with code</td><td>Row ids are stable (<code>thr_…:user-seed:8182</code> style anchors) and PR #1384 windows without protocol changes.</td></tr>
  </table>

  <h2>Environment</h2>
  <table>
    <tr><th>Item</th><th>Value</th></tr>
    <tr><td>bb commit</td><td><code>{BASE}</code> (main, "Revert 'Stop clipping two-digit ordered list markers'")</td></tr>
    <tr><td>OS / Node</td><td>Linux 7.0.0-29-generic (Ubuntu), Node v24.18.0, pnpm workspace</td></tr>
    <tr><td>Browser</td><td>Playwright Chromium (headless, via <code>dev-browser</code> CLI), viewport 390×844 (mobile) and 1280×900 (desktop). Vite dev build (React development runtime, so absolute times are inflated vs. production; the shape of the problem is unchanged).</td></tr>
    <tr><td>Dev instance</td><td><code>scripts/bb-dev-app current</code>: App <code>http://localhost:13028</code>, Server <code>http://localhost:21028</code>, host daemon <code>127.0.0.1:29028</code>, data dir <code>~/.bb-dev/projects-bb-.claude-worktrees-wf_debcf606-e4a-19-286d462cc7e4</code></td></tr>
    <tr><td>Fixture</td><td><code>pnpm seed:perf -- --projects 1 --threads 8 --events 60000 --seed 42</code> → project <code>proj_mgvp7iamvh</code>, largest thread <code>thr_wfjb5qctw4</code> with 9,001 event rows (same size as the issue's thread)</td></tr>
    <tr><td>Providers</td><td>Not exercised; the seeded thread is archived and static, no agent turns were run.</td></tr>
  </table>

  <h2>Minimal reproduction</h2>
  <ol>
    <li>Start the dev instance once so the seed can attach to the local host, stop it, seed, and restart:
{pre('''scripts/bb-dev-app current          # prints App/Server URLs + data dir
pnpm dev:stop
pnpm seed:perf -- --projects 1 --threads 8 --events 60000 --seed 42
scripts/bb-dev-app current''')}
      Seed output:
{pre(seed.split("bb seed-perf-db")[1].strip())}
      Find the largest thread and its project:
{pre('''sqlite3 <data dir>/bb.db "select thread_id, count(*) c from events group by thread_id order by c desc limit 1;"
# thr_wfjb5qctw4|9001
sqlite3 <data dir>/bb.db "select project_id from threads where id='thr_wfjb5qctw4';"
# proj_mgvp7iamvh''')}
    </li>
    <li>(Optional, proves the server side is fine.) Walk every timeline page with <a href="1301/repro/1301-walk-pages.mjs">1301-walk-pages.mjs</a> — <b>Expected and actual</b>: 11 pages, all under 60 ms:
{pre(walk)}
    </li>
    <li>Open <code>http://localhost:13028/projects/proj_mgvp7iamvh/threads/thr_wfjb5qctw4</code> at a 390×844 viewport (script <a href="1301/repro/browser-01-open.js">browser-01-open.js</a>). <b>Expected/actual</b>: 84 rows, 2,403 DOM nodes, scroll height 6,552 px.
      <figure><img src="assets/1301-initial.png" alt="Thread just opened at mobile width" width="390"><figcaption>Before: the thread just after load, scrolled to the bottom (2,403 DOM nodes, 84 timeline rows mounted).</figcaption></figure>
    </li>
    <li>Hold scroll-up until the first message while sampling DOM size and long tasks (script <a href="1301/repro/browser-03-wheel-scroll.js">browser-03-wheel-scroll.js</a>; a variant that sets <code>scrollTop = 0</code> step by step is <a href="1301/repro/browser-02-scroll-history.js">browser-02-scroll-history.js</a>).
      <br><b>Expected</b>: mounted DOM stays roughly constant (only what is near the viewport), scrolling stays under 50 ms per frame.
      <br><b>Actual</b> (verbatim, wheel variant):
{pre(out03)}
      Step-wise variant (one <code>scrollTop=0</code> then 1.5 s wait per sample) shows the monotonic growth per page:
{pre(out02)}
      <div class="grid">
        <figure><img src="assets/1301-mid-scroll.png" alt="Mid scroll" width="390"><figcaption>The moment the bug shows: mid-history after several pages have been prepended. Visually fine, but the whole history below is still mounted.</figcaption></figure>
        <figure><img src="assets/1301-top-of-history.png" alt="Top of history" width="390"><figcaption>Top of history reached: 820 rows / 21,082 nodes / 68,302 px all mounted.</figcaption></figure>
        <figure><img src="assets/1301-after-scroll-top.png" alt="After scrollTop=0 variant" width="390"><figcaption>Step-wise variant end state (same numbers).</figcaption></figure>
      </div>
    </li>
    <li>CPU-profile one prepend via CDP (script <a href="1301/repro/browser-04-profile.js">browser-04-profile.js</a>; raw <code>.cpuprofile</code> files in <a href="1301/repro/">1301/repro/</a>). Top self-time frames for the first two older pages:
{pre(out04)}
      <p><code>(program)</code> is native work the JS profiler cannot attribute (style/layout/paint of the growing tree). <code>readOverflowMeasurement</code> is a <code>scrollHeight</code>/<code>clientHeight</code> read inside a <code>useLayoutEffect</code>, so its "self time" is a forced synchronous layout of the whole document. The rest is React mounting ~150 rows' worth of components (jsx runtime + react-dom) and markdown parsing.</p>
    </li>
    <li>Unit-level repro that fails on main (<a href="1301/repro/ThreadTimelineRows.issue-1301.test.tsx">ThreadTimelineRows.issue-1301.test.tsx</a>, drop it into <code>apps/app/src/components/thread/timeline/</code> and run <code>pnpm exec vitest run src/components/thread/timeline/ThreadTimelineRows.issue-1301.test.tsx</code> from <code>apps/app</code>). The failing assertion is <code>expect(withContent.length).toBeLessThan(200)</code>: all 800 rows are mounted with real content.
{pre(esc(R / "ThreadTimelineRows.issue-1301.test.tsx"))}
      Output on main:
{pre(issue_test_out)}
    </li>
  </ol>

  <h2>Root cause</h2>
  <p>Two pieces of client code combine to produce the symptom; neither has a bug in the "wrong output" sense — the design simply has no upper bound.</p>
  <h3>1. Older pages are accumulated into one array</h3>
  <p>{link("apps/app/src/components/thread/timeline/useThreadTimelineController.ts", 227, 236)} — <code>prependOlderTimelineRows</code> concatenates every fetched page in front of what is already loaded, and {link("apps/app/src/components/thread/timeline/useThreadTimelineController.ts", 496, 515)} stores the result in <code>loadedTimeline.rows</code>. There is no eviction, cap, or "distance from viewport" notion anywhere in the controller. Rows are only dropped when the latest window becomes non-contiguous (<code>isLatestTimelineWindowContiguous</code>) or the surface key changes.</p>
{pre('''export function prependOlderTimelineRows({ loadedRows, olderRows }) {
  const rows: TimelineRow[] = [];
  appendTimelineRowsPreservingOrder(rows, olderRows);
  appendTimelineRowsPreservingOrder(rows, loadedRows);
  return rows;
}''')}
  <p>Auto-loading makes this fast to trigger: {link("apps/app/src/components/thread/timeline/useAutoLoadOlderRows.ts", 9, 9)} prefetches the next page whenever the sentinel is within 600 px of the viewport, so a flick to the top fetches page after page.</p>
  <h3>2. Every loaded row is rendered as real DOM</h3>
  <p>{link("apps/app/src/components/thread/timeline/ThreadTimelineRows.tsx", 1906, 1928)} — <code>TimelineRowsList</code> maps <em>all</em> items to <code>&lt;div data-timeline-row-id&gt;&lt;MemoizedTimelineRowView …/&gt;&lt;/div&gt;</code>. Memoisation (and identity preservation in the controller) keeps already-mounted rows from re-rendering, so React work per page is roughly O(page), but the browser's style/layout cost is against the whole subtree, and DOM/heap memory is O(everything ever loaded). Each conversation row is a full markdown render (~25 nodes per row on this fixture) plus a message action bar, so 820 rows ≈ 21k nodes.</p>
  <h3>Why the per-page long task is 250–600 ms</h3>
  <ul>
    <li>Mounting ~85–110 rows (~4k nodes) of markdown/JSX in one commit (React dev runtime in the dev build roughly doubles this).</li>
    <li>{link("apps/app/src/components/thread/timeline/conversation-message-overflow.tsx", 135, 135)} — every newly mounted conversation row measures <code>scrollHeight</code>/<code>clientHeight</code> in a <code>useLayoutEffect</code>. The first read forces layout of the whole (now larger) document inside the same task; the profile attributes 100–157 ms of self time to it per page.</li>
    <li>{link("apps/app/src/components/ui/height-transition.tsx", 299, 299)} — the list is wrapped in <code>AutoHeightContainer</code>, which reads <code>inner.offsetHeight</code> and animates the wrapper height on every content change, adding another layout read on prepend.</li>
    <li>The bottom-anchored scroll body captures/restores <code>scrollHeight</code> around the prepend (more layout reads).</li>
  </ul>
  <p>Because layout cost scales with total mounted DOM, later pages are slower than earlier ones (296 ms for the first page vs. 418–472 ms for the last ones in the wheel run) even though pages have similar row counts. This is why the issue calls it "a series of visible freezes": each is a single sync task with no yielding.</p>
  <h3>Deeper / adjacent issues</h3>
  <ul>
    <li>The accumulation is not mobile-specific. At 1280 px width the same run reaches 21,182 nodes and long tasks up to 589 ms. #1304 (composer keystroke cost scales with mounted timeline size) is the same root cause seen from the composer.</li>
    <li>Memory: the loaded rows array also grows without bound (1.24 MB of JSON for this thread; the comment's 131 MiB production thread would be far worse) and is retained per surface for the lifetime of the thread view.</li>
  </ul>

  <h2>Proposed fix (first principles)</h2>
  <p>Confidence is high on the mechanism, so a fix direction is reasonable to state. Two independent layers, both client-only (the paging protocol is fine):</p>
  <ol>
    <li><b>Bound what is rendered</b> — window the top-level <code>TimelineRowsList</code> so only rows near the viewport (± ~1 viewport of margin) mount real content; rows outside keep a fixed-height in-flow placeholder sized from their last measured height (estimate before first measurement). Keying on the existing stable row ids means realised rows keep identity across streaming updates. This is exactly what PR #1384 does; the essential requirements it should meet are: no absolute positioning (so native scroll anchoring and existing bottom-anchoring keep working), height placeholders in normal flow, realisation on IntersectionObserver, and pinning rows the user has interacted with (expanded tool calls, selections). It should apply at all viewport widths, not only <code>&lt; 768px</code>, and must not swap wrapper component types when it turns on/off (see PR review).</li>
    <li><b>Bound what is loaded</b> (optional, memory) — cap <code>loadedTimeline.rows</code> at N pages and drop pages far from the viewport, keeping both cursors, so scrolling back down re-fetches. This is more invasive (the controller currently assumes the loaded rows are a contiguous prefix ending at the live window) and windowing alone removes the user-visible freezes, so it can be a follow-up.</li>
    <li><b>Reduce per-page commit cost</b> regardless: batch the overflow measurement so a page of new rows does one layout read (e.g. via the shared ResizeObserver only, dropping the synchronous first read, or measuring in one <code>requestAnimationFrame</code>), and skip <code>AutoHeightContainer</code>'s height animation for prepends. These shave the constant factor but do not fix the unbounded growth.</li>
  </ol>
  <p>Risks: windowing breaks find-in-page and screen-reader linear reading for derealised rows, needs care with scroll restoration on prepend (placeholder estimate vs real height), and interacts with the streaming path (active turn rows must never derealise). All are addressed, with varying complexity, in #1384.</p>

  <h2>PR review — #1384 "Window large mobile timelines" (open, not linked to #1301)</h2>
  <p><a href="https://github.com/get-bb/bb/pull/1384">PR #1384</a> by SawyerHood (agent-generated, GPT-5.6 + Claude), branch <code>bb/mobile-timeline-virtualization</code>, 8 commits, +1,887/−37 across <code>ThreadTimelineRows.tsx</code>, <code>ThreadTimelineRows.actions.test.tsx</code>, <code>useScrollToSearchedMessage.ts</code>. Full diff saved at <a href="1301/repro/pr1384.diff">pr1384.diff</a>. It is not linked from the issue but is the only open work that addresses it, so it is reviewed here.</p>
  <h3>What it changes</h3>
  <ul>
    <li>When <code>spacing === "top-level" &amp;&amp; isCompactViewport (&lt;768px) &amp;&amp; bottomAnchor &amp;&amp; IntersectionObserver &amp;&amp; items.length &gt;= 40</code>, each row is wrapped in <code>TimelineWindowedListItem</code>: an in-flow <code>div</code> that renders children only while "realized" and otherwise a fixed-height, <code>aria-hidden</code> placeholder (estimate 120 px conversation / 40 px other, replaced by measured height on derealise).</li>
    <li>An IntersectionObserver with 1,000 px root margin realises/derealises. While the scroll body reports an active scroll (<code>data-scrollbar-scrolling</code>), above-viewport realisations are compensated by shrinking earlier placeholders ("donor" scheme, two <code>flushSync</code> commits in one task) so no <code>scrollTop</code> write kills WebKit momentum; otherwise a capture/<code>flushSync</code>/restore of the first visible row's top is used. An idle pass (300 ms) mounts insolvent realisations and re-budgets never-measured estimates to the running average.</li>
    <li>Interaction pins (click/focus capture, cap 24) keep touched rows mounted; terminal auto-expanded row ids are accumulated so evicted rows re-expand on remount; search targets and the unread divider are always realised; <code>useScrollToSearchedMessage</code> waits for the target to be realised.</li>
    <li>Moves <code>AutoHeightContainer</code> inside <code>TimelineRowsList</code> for the non-windowed path only (windowed path has no height animation wrapper).</li>
  </ul>
  <h3>Does it address the root cause?</h3>
  <p>Yes for compact viewports: it bounds mounted content (layer 1 above). It does not bound the loaded rows array (layer 2, acceptable) and does nothing for widths ≥768 px.</p>
  <h3>Tests I ran</h3>
  <ul>
    <li>Merged <code>main@{BASE[:9]}</code> into the PR branch. One conflict in <code>ThreadTimelineRows.tsx</code>: main added <code>snapRevision={{heightSnapRevision}}</code> to <code>AutoHeightContainer</code> (#1568) while the PR moved that container into <code>TimelineRowsList</code>. Resolved by threading a <code>heightSnapRevision</code> prop. The PR needs this rebase before it can merge.</li>
    <li><code>pnpm exec turbo run typecheck --filter=@bb/app</code>: pass. <code>vitest run src/components/thread/timeline/ src/components/ui/bottom-anchored-scroll-body</code>: 22 files / 204 tests pass; the PR's 3 windowing tests pass.</li>
    <li>Same browser repro on the merged branch at 390×844 (<a href="1301/repro/browser-05-pr1384-wheel-scroll.js">browser-05</a>):
{pre(out05)}
      DOM bounded at ~1.7k nodes (was 21k), 16–33 realised rows, {html.escape(ltsum(lt05))} (was {html.escape(ltsum(lt03))}). Remaining long tasks are the per-page prepend of ~90 placeholder wrappers plus realisation of rows entering the window.</li>
    <li>Scroll back down from the top in bursts, checking after 600 ms idle for placeholders intersecting the viewport (<a href="1301/repro/browser-06-pr1384-scroll-down.js">browser-06</a>): 17 samples, <code>blankVisible</code> = 0 in every sample, DOM 1.7–2.2k nodes. Scroll height fluctuates by ~1.7k px as estimates are corrected but I did not observe visible position jumps in Chromium (WebKit momentum behaviour, which the PR is mostly about, cannot be checked here).</li>
    <li>Desktop width on the merged branch (<a href="1301/repro/browser-07-pr1384-desktop.js">browser-07</a>): unchanged from main — <code>windowed:false</code>, 21,182 nodes, {html.escape(ltsum(lt07))}.
{pre(out07)}
    </li>
    <li>Hostile unit test (<a href="1301/repro/ThreadTimelineRows.pr1384-threshold.test.tsx">ThreadTimelineRows.pr1384-threshold.test.tsx</a>): render 39 rows on a compact viewport, then re-render with 40 rows. <b>Fails</b>: the wrapper for <code>message_0</code> is a different DOM node after the 40th row lands (the whole list is unmounted and remounted). Assertion: <code>expect(after).toBe(before)</code>.</li>
  </ul>
  <div class="grid">
    <figure><img src="assets/1301-pr1384-mid-scroll.png" alt="PR 1384 mid scroll" width="390"><figcaption>PR #1384 (main merged), mid history: only ~30 rows realised, rest are placeholders; nothing blank in view.</figcaption></figure>
    <figure><img src="assets/1301-pr1384-top-of-history.png" alt="PR 1384 top of history" width="390"><figcaption>PR #1384 at the top of history: 820 wrappers, 16 realised, 1,675 DOM nodes.</figcaption></figure>
  </div>
  <h3>Findings</h3>
  <table>
    <tr><th>#</th><th>Where</th><th>Severity</th><th>Finding</th></tr>
    <tr><td>1</td><td><code>ThreadTimelineRows.tsx</code> <code>shouldWindow</code> (PR diff ~L2184-2190) and the two return branches of <code>TimelineRowsList</code></td><td class="v-bad">High</td><td>Windowing toggles by swapping the per-row wrapper element type (<code>&lt;div&gt;</code> ↔ <code>&lt;TimelineWindowedListItem&gt;</code>) under the same key. When <code>items.length</code> crosses 40 (every mobile thread does this mid-conversation as messages stream in), or the viewport crosses 768 px (tablet rotate, desktop resize, split view), React unmounts and remounts <em>every</em> row: expanded tool-call/turn state, in-progress text selection, "show more" reveals and scroll geometry are lost, and the remount is itself a large sync task at the worst moment. Repro test above fails. Fix: always render the same wrapper component and make it a no-op passthrough (always realised) when windowing is off, or key the list on <code>shouldWindow</code> deliberately and document the reset.</td></tr>
    <tr><td>2</td><td><code>shouldWindow</code> requires <code>useIsCompactViewport()</code></td><td class="v-bad">Medium</td><td>Only <code>&lt;768px</code> is windowed. The unbounded growth (and #1304's composer cost) is identical at desktop widths — measured 21k nodes / 589 ms tasks on the PR branch at 1280 px. The PR title scopes to mobile, but the WebKit-momentum machinery is the hard part; enabling the window on desktop is mostly removing the guard, and shipping it mobile-only leaves the issue open.</td></tr>
    <tr><td>3</td><td>Base drift; <code>AutoHeightContainer</code></td><td class="v-unk">Medium (mergeability)</td><td>Branch is 151 commits behind main and conflicts with #1568's <code>snapRevision</code>. The PR also removes <code>AutoHeightContainer</code> from the windowed path entirely, so the height-snap-on-turn-completion behaviour from #1568 does not apply on mobile once windowed. Whether that is acceptable needs a deliberate call; my merge only threads the prop through the non-windowed path.</td></tr>
    <tr><td>4</td><td><code>TimelineRowsList</code> hooks: <code>useIsCompactViewport</code>, <code>useBottomAnchoredScroll</code>, <code>useStore</code>, <code>useLocation</code>, several <code>useMemo</code>s</td><td>Low</td><td><code>TimelineRowsList</code> is also rendered recursively for nested (turn/delegation) lists where <code>shouldWindow</code> is always false, so every nested list now subscribes to the media query and router and computes search/unread/anchor indices it never uses. Cheap individually, but the file is now ~3,150 lines with the windowing state machine inline; extracting <code>useTimelineWindow</code> to its own module would keep the nested path free of it.</td></tr>
    <tr><td>5</td><td><code>estimateTimelineListItemHeight</code> (120 / 40 px), <code>TIMELINE_WINDOW_REBUDGET_*</code></td><td>Low</td><td>Static estimates seed placeholders; on this fixture assistant messages are 300–900 px, so <code>scrollHeight</code> swings by ~1.7 kpx during a scroll (69,374 → 68,302 → 70,073 in my runs) as estimates are replaced. In Chromium this was invisible; on WebKit the PR's donor scheme is designed for it. Worth keeping the iOS drift check from the PR description as an automated Playwright/WebKit test rather than a one-off measurement.</td></tr>
    <tr><td>6</td><td>Placeholders are <code>aria-hidden</code> with empty content</td><td>Low (inherent)</td><td>Find-in-page and assistive tech cannot reach derealised rows; the in-app search deep link is handled. Acceptable trade-off for a virtualised list but should be stated in the PR.</td></tr>
    <tr><td>7</td><td>Type/contract hygiene</td><td>Low</td><td>No <code>as any</code>/<code>unknown</code> smuggling found; only a <code>{{ top, bottom }} as DOMRect</code> in tests. No server/daemon boundary or protocol changes (client only), so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> concern.</td></tr>
  </table>
  <h3>Verdict</h3>
  <p><b>REQUEST CHANGES.</b> The approach is right and it demonstrably fixes the measured problem on compact viewports (21k → 1.7k nodes, 280–470 ms → 60–170 ms tasks on the same repro). But it must be rebased onto main, finding 1 (full remount when windowing switches on at 40 items or on a viewport-width change) needs fixing with a test, and it should either enable the window at all widths or explicitly leave #1301 open for desktop.</p>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/1304">#1304</a> Composer keystroke cost scales with the mounted timeline size — same root cause (mounted DOM grows without bound).</li>
    <li><a href="https://github.com/get-bb/bb/issues/1300">#1300</a> the seeded perf fixture (<code>pnpm seed:perf</code>) used here.</li>
    <li><a href="https://github.com/get-bb/bb/issues/1131">#1131</a>, <a href="https://github.com/get-bb/bb/issues/1207">#1207</a> server-side timeline read isolation (referenced in the issue comment; separate mechanism).</li>
    <li><a href="https://github.com/get-bb/bb/issues/1616">#1616</a> iOS Safari performance audit (broader mobile perf list).</li>
    <li><a href="https://github.com/get-bb/bb/pull/898">#898</a> "Fix long thread timeline scroll stalls" and <a href="https://github.com/get-bb/bb/pull/1285">#1285</a> re-render amplifiers — earlier constant-factor fixes; neither bounds mounted DOM.</li>
    <li><a href="https://github.com/get-bb/bb/pull/1384">#1384</a> Window large mobile timelines (reviewed above).</li>
  </ul>

  <h2>Appendix</h2>
  <details><summary>Commands run (in order)</summary>
{pre('''# worktree setup
pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build
# dev instance + fixture
scripts/bb-dev-app current ; pnpm dev:stop
pnpm seed:perf -- --projects 1 --threads 8 --events 60000 --seed 42
scripts/bb-dev-app current
sqlite3 <data>/bb.db "select thread_id, count(*) c from events group by thread_id order by c desc limit 8;"
curl -s -o /tmp/1301-latest.json -w 'status=%{http_code} bytes=%{size_download} time=%{time_total}\\n' http://localhost:21028/api/v1/threads/thr_wfjb5qctw4/timeline
node /tmp/bb-reports/issues/1301-walk-pages.mjs
# browser (dev-browser CLI, Playwright Chromium headless)
dev-browser --browser bb1301 --headless --timeout 120 run browser-01-open.js
dev-browser --browser bb1301 --headless --timeout 300 run browser-02-scroll-history.js
dev-browser --browser bb1301 --headless --timeout 300 run browser-03-wheel-scroll.js
dev-browser --browser bb1301 --headless --timeout 300 run browser-04-profile.js
# unit repro on main
cd apps/app && pnpm exec vitest run src/components/thread/timeline/ThreadTimelineRows.issue-1301.test.tsx
# PR 1384
git fetch origin pull/1384/head:pr-1384 ; git checkout -b pr-1384-merge pr-1384 ; git merge 16ceb3a54   # 1 conflict, resolved
pnpm install --frozen-lockfile --prefer-offline ; pnpm exec turbo run typecheck --filter=@bb/app
cd apps/app && pnpm exec vitest run src/components/thread/timeline/ src/components/ui/bottom-anchored-scroll-body
scripts/bb-dev-app current
dev-browser ... run browser-05-pr1384-wheel-scroll.js ; browser-06-pr1384-scroll-down.js ; browser-07-pr1384-desktop.js
cd apps/app && pnpm exec vitest run src/components/thread/timeline/ThreadTimelineRows.pr1384-threshold.test.tsx   # fails (finding 1)
git checkout 16ceb3a54 ; pnpm dev:stop''')}
  </details>
  <details><summary>Latest-page fetch (curl)</summary>{pre('''status=200 bytes=109302 time=0.058081
rows 92 olderCursor {"anchorSeq":8182,"anchorId":"thr_wfjb5qctw4:user-seed:8182"} kinds conversation 35, turn 17, work 40''')}</details>
  <details><summary>Scroll-down check on PR branch (browser-06 output)</summary>{pre(out06)}</details>
  <details><summary>Hostile PR test: threshold remount (source)</summary>{pre(esc(R / "ThreadTimelineRows.pr1384-threshold.test.tsx"))}</details>
  <details><summary>Page walker script (1301-walk-pages.mjs)</summary>{pre(esc("/tmp/bb-reports/issues/1301-walk-pages.mjs"))}</details>
  <details><summary>Browser scripts</summary>
    <p>browser-01-open.js</p>{pre(esc(R / "browser-01-open.js"))}
    <p>browser-03-wheel-scroll.js</p>{pre(esc(R / "browser-03-wheel-scroll.js"))}
    <p>browser-04-profile.js</p>{pre(esc(R / "browser-04-profile.js"))}
  </details>
  <p class="meta">Artifacts: <a href="1301/repro/">1301/repro/</a> (scripts, logs, cpuprofiles, diff, tests) · screenshots in <a href="assets/">assets/</a> (<code>1301-*.png</code>). Report written by an agent (Claude); numbers are from a dev build on desktop hardware.</p>
</main></body></html>
"""
OUT.write_text(doc)
print(OUT, len(doc))
