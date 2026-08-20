import html, re
def esc(s): return html.escape(s)
R='/tmp/bb-reports/issues/1778/repro/'
test = open(R+'markdown-preview.issue-1778.test.tsx').read()
variants = open(R+'mdast-variants.out').read()
dump = open(R+'mdast-dump.out').read()
vitest = re.sub(r'\x1b\[[0-9;]*m','',open(R+'vitest-base.log').read())
patch = open(R+'prototype-fix.patch').read()
dom = open(R+'assistant-message-dom.txt').read()
BASE='c7c66423d55c320bab9103218f0ffef1a8191331'
def L(path,a,b=None):
    return f'https://github.com/get-bb/bb/blob/{BASE}/{path}#L{a}' + (f'-L{b}' if b else '')
body = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1778 Malformed multiline $$ math swallows the rest of the message</title>
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
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1778 · Malformed multiline <code>$$</code> math is not closed by trailing <code>$$</code>: the parser consumes the rest of the message into one <code>.katex-error</code></h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill med">Priority: Medium</span> <span class="pill">Effort: unset</span> <span class="pill">ui</span>
    <a href="https://github.com/get-bb/bb/issues/1778">open on GitHub</a>
    <span>2026-08-20 · base <code>c7c66423d</code></span>
  </p>
  <p><strong>Verdict:</strong> <span class="verdict no">REPRODUCED</span> · <strong>Root-cause confidence:</strong> high</p>

  <h2>1. TL;DR</h2>
  <p>When an assistant (or user) message contains a display formula written as <code>$$T_…</code> on one line and <code>…ms}}$$</code> at the end of the next line, bb renders everything from the second line of the formula to the end of the message as one red <code>.katex-error</code> block: the heading, list and link that follow lose all Markdown structure. In addition the first line of the formula silently disappears. The cause is in the parser bb uses for math: <code>remark-math</code> → <code>micromark-extension-math</code> treats a line that starts with <code>$$</code> and has text after it as the <em>opening fence of a display-math block</em> (the text is stored as the block's <code>meta</code>, like a code-fence info string, and is dropped from rendering), and it only accepts a closing fence that is <code>$$</code> alone on its own line. A trailing <code>$$</code> at the end of a content line is just content, so the block never closes and, like an unclosed code fence, runs to the end of the document. bb does nothing to normalise or localise this, so one malformed formula destroys the rest of the message. Reproduced on the base commit with a failing vitest and in the live app with a real Codex turn; a ~90-line pre-parse normaliser fixes it (prototype patch included).</p>

  <h2>2. Claims vs findings</h2>
  <table><tr><th>Claim from the issue</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>The given message shape renders as one giant <code>.katex-error</code> swallowing heading, list and link.</td><td class="ok">Verified</td><td>Live app screenshot (<a href="assets/1778-thread-overview.png">overview</a>); DOM dump shows a single <code>span.katex-error</code> containing the whole suffix; repro vitest fails at base.</td></tr>
    <tr><td><code>remark-math</code> treats the leading <code>$$</code> as an opening delimiter but does not recognise the trailing <code>$$</code> as closing.</td><td class="ok">Verified</td><td><code>micromark-extension-math/lib/math-flow.js</code>: <code>meta()</code> accepts any non-<code>$</code> text after the opening fence; <code>tokenizeClosingFence</code> requires <code>$$</code> + optional whitespace + EOL. mdast dump below shows one <code>math</code> node spanning lines 3–9.</td></tr>
    <tr><td>The KaTeX error is typically <code>Can't use function '$' in math mode</code>.</td><td class="ok">Verified</td><td><code>title="ParseError: KaTeX parse error: Can't use function '$' in math mode at position 32: …-}}146\\text{{ ms}}$̲$\\n\\n## Content a…"</code> in the rendered DOM.</td></tr>
    <tr><td>Observed on bb 0.38.0.</td><td class="ok">Verified (still present)</td><td>Reproduced at base c7c66423d (package version 0.39.0) and origin/main c4a3dc5fb; no commits touch the math pipeline since.</td></tr>
    <tr><td>~3,000 characters were consumed in the observed case.</td><td class="unv">Unverified</td><td>Depends on the original message; the mechanism confirms the error spans to end of document (or enclosing container).</td></tr>
    <tr><td>Existing tests only assert that a <code>.katex-error</code> exists, not that it stays local.</td><td class="ok">Verified</td><td><a href="{L('apps/app/src/components/ui/markdown-preview.test.tsx',499,508)}">markdown-preview.test.tsx#L499-L508</a> ("contains invalid TeX instead of throwing") — that case is an <em>inline</em> unclosed <code>$$</code>, which micromark leaves as literal text, so it never exercised the flow-fence path.</td></tr>
    <tr><td>(Not claimed) The first formula line is also lost.</td><td class="no">New finding</td><td>mdast dump: <code>meta: "T_{{\\text{{appearance}}\\rightarrow\\text{{chunk}}}}"</code>, <code>value</code> starts at <code>\\approx73…</code>; <code>mdast-util-math</code> ignores <code>meta</code> when building the hast <code>&lt;code class="language-math"&gt;</code>, so KaTeX never sees that line. Screenshot confirms: the red text starts at <code>\\approx73</code>.</td></tr>
  </table>

  <h2>3. Environment</h2>
  <ul>
    <li>bb worktree at <code>c4a3dc5fb</code> (origin/main, 3 mobile-only commits after base <code>c7c66423d</code>; <code>git diff c7c66423d c4a3dc5fb --stat</code> touches only <code>apps/mobile/…</code>); package version 0.39.0.</li>
    <li>Linux bee 7.0.0-29-generic x86_64, Node v24.18.0; <code>remark-math@6.0.0</code>, <code>micromark-extension-math@3.1.0</code>, <code>mdast-util-math@3.0.0</code>, <code>rehype-katex@7.0.1</code>, <code>katex@0.16.47</code>.</li>
    <li>Provider for the live repro: codex (codex-cli 0.148.0, model 5.6-Sol Medium) — one tiny echo turn plus one "ok" turn.</li>
    <li>Dev instance: App <code>http://localhost:18548</code>, Server <code>http://localhost:26548</code>, Host daemon <code>127.0.0.1:34548</code>, data dir <code>~/.bb-dev/projects-bb-.claude-worktrees-wf_926b3193-f6c-14-e735147cd39f</code> (deleted at cleanup). Headless Chrome via <code>doobie</code>.</li>
  </ul>

  <h2>4. Minimal reproduction</h2>
  <h3>4a. Unit-level (no provider needed, ~3 s)</h3>
  <ol>
    <li>Save the test below as <code>apps/app/src/components/ui/markdown-preview.issue-1778.test.tsx</code> (also at <a href="1778/repro/markdown-preview.issue-1778.test.tsx">1778/repro/markdown-preview.issue-1778.test.tsx</a>).</li>
    <li>Run <pre>cd apps/app &amp;&amp; pnpm exec vitest run src/components/ui/markdown-preview.issue-1778.test.tsx</pre></li>
    <li>Expected: the <code>&lt;h2&gt;</code>, two <code>&lt;li&gt;</code> and the link are rendered after the formula. Actual (base commit, <a href="1778/repro/vitest-base.log">vitest-base.log</a>):
<pre>{esc(vitest[vitest.find(' FAIL'):vitest.find('Test Files')].strip())}</pre>
There is no <code>h2</code> at all — the heading text lives inside the <code>.katex-error</code> span.</li>
  </ol>
  <pre>{esc(test)}</pre>

  <h3>4b. What the parser produces (mdast)</h3>
  <p>Running the exact bb remark pipeline (<code>remark-parse</code> + <code>remark-gfm</code> + <code>remark-math {{singleDollarTextMath:false}}</code>) on the issue body — script: <a href="1778/repro/mdast-dump.mjs">mdast-dump.mjs</a> (copy into <code>apps/app/</code> and run with <code>node</code>):</p>
  <pre>{esc(dump)}</pre>
  <p>One <code>math</code> node covers lines 3–9. The first TeX line is in <code>meta</code> (discarded by the renderer); the trailing <code>$$</code>, the heading and the list are in <code>value</code>.</p>
  <p>Other shapes (<a href="1778/repro/mdast-variants.mjs">mdast-variants.mjs</a>), showing exactly which ones are broken:</p>
  <pre>{esc(variants)}</pre>
  <p>A and B swallow the suffix (the issue). C silently renders an <em>empty</em> formula (meta dropped) but keeps the rest. D, E, F are fine. G (unclosed inline <code>$$</code>, the shape the existing test covers) stays literal text, which is why the existing test never caught this.</p>

  <h3>4c. Live app (what the user sees)</h3>
  <ol>
    <li><code>scripts/bb-dev-app current</code>; create a project; spawn a codex thread whose prompt asks the model to echo the issue body verbatim (<a href="1778/repro/spawn.sh">spawn.sh</a>, <a href="1778/repro/prompt.txt">prompt.txt</a>). The assistant message event contained exactly the issue body (see Appendix).</li>
    <li>Open the thread in the browser.</li>
  </ol>
  <figure><img src="assets/1778-thread-overview.png" alt="bb thread showing the bug"><figcaption>Both the user bubble (top) and the assistant message (below "Provisioned thread") show the bug: after "Before the formula." everything is one red run of raw text — <code>\\approx73\\text{{--}}146\\text{{ ms}}$$ ## Content after the formula - This should remain a list item. - [This should remain a link](https://example.com).</code> No heading, no bullets, no link, and the first formula line <code>T_{{\\text{{appearance}}…}}</code> is missing entirely.</figcaption></figure>
  <figure><img src="assets/1778-assistant-message-zoom.png" alt="zoom on the assistant message"><figcaption>Zoom on the assistant message: the single <code>span.katex-error</code>.</figcaption></figure>
  <figure><img src="assets/1778-expected-canonical-form.png" alt="canonical form renders correctly"><figcaption>Control (lower user bubble): a follow-up message with the same formula in canonical form (<code>$$</code> alone on its own lines before and after) renders the KaTeX display formula, the heading, the bullets and the link correctly. Only the delimiter placement differs.</figcaption></figure>
  <p>Rendered DOM of the assistant message (<a href="1778/repro/assistant-message-dom.txt">assistant-message-dom.txt</a>):</p>
  <pre>{esc(dom[dom.find('"html"'):].strip())}</pre>
  <p>Repro files: <a href="1778/repro/">1778/repro/</a></p>

  <h2>5. Root cause</h2>
  <p>bb's markdown renderer wires <code>remark-math</code> with only single-dollar math disabled (<a href="{L('apps/app/src/components/ui/markdown-preview.tsx',1786,1791)}">markdown-preview.tsx#L1786-L1791</a>; the mobile app does the same at <a href="{L('apps/mobile/src/markdown/parse.ts',58,63)}">apps/mobile/src/markdown/parse.ts#L58-L63</a>) and passes the message text straight to it. The tokenizer behind <code>remark-math</code> (<code>micromark-extension-math@3.1.0</code>, <code>lib/math-flow.js</code>) models <code>$$</code> display math exactly like a fenced code block:</p>
  <ul>
    <li><strong>Opening:</strong> at the start of a line, <code>$$</code> then optional whitespace then <em>meta</em>. <code>meta()</code> consumes any characters up to EOL and only bails (<code>nok</code>) if it meets another <code>$</code>. So <code>$$T_{{\\text{{appearance}}\\rightarrow\\text{{chunk}}}}</code> is a valid opening fence with meta <code>T_{{…}}</code>, whereas <code>$$x$$</code> on one line is rejected as flow (meta contains <code>$</code>) and falls through to inline text math — which is why shapes E/F work.</li>
    <li><strong>Closing:</strong> <code>tokenizeClosingFence</code> is attempted only at the start of a line: optional indent, ≥2 <code>$</code>, optional whitespace, then EOL, otherwise <code>nok</code>. <code>\\approx73\\text{{ ms}}$$</code> therefore is ordinary content (<code>contentChunk</code> consumes to EOL).</li>
    <li><strong>Termination:</strong> with no closing fence the block continues through every non-lazy line until EOF / end of the enclosing container (same as an unclosed ``` fence in CommonMark). That is the "swallows the rest of the message" symptom.</li>
    <li><strong>Meta is dropped:</strong> <code>mdast-util-math</code> stores the opening-line text as <code>node.meta</code> and builds the hast <code>&lt;pre&gt;&lt;code class="language-math math-display"&gt;</code> from <code>value</code> only (<code>exitMathFlow</code>). <code>rehype-katex</code> renders that element, so the first TeX line vanishes and KaTeX chokes on the <code>$$</code> inside the value → one <code>.katex-error</code> (default <code>throwOnError:false</code>, red <code>errorColor</code>) holding the full suffix.</li>
  </ul>
  <p>Nothing in bb pre-normalises the delimiters or post-processes an unclosed math node, so the upstream parser's fence semantics leak straight into the UI. The deeper issue is that the LaTeX convention <code>$$ … $$</code> allows the delimiters to be glued to content on either side, while CommonMark-style fences do not; LLM output uses the LaTeX convention constantly (shapes A/B/C above), so this is not an edge case. The same bug exists in the mobile renderer (<code>apps/mobile/src/markdown/parse.ts</code>), which uses the identical pipeline.</p>

  <h2>6. Proposed fix (first principles)</h2>
  <p>Fix at the point where bb hands text to the parser: add a small, pure <code>normalizeMathFences(markdown)</code> pass (in <code>apps/app/src/components/ui/</code>, shared with mobile) that rewrites LaTeX-style display spans into the canonical fence shape before <code>remark-math</code> sees them. Rules, in order, skipping fenced code blocks:</p>
  <ol>
    <li>A line matching <code>^ {{0,3}}\\$\\$[ \\t]*([^$]+)$</code> (opening with meta — exactly what micromark would treat as an opening fence) or a bare <code>$$</code> line starts a span.</li>
    <li>The span closes at the first later line that is either a bare <code>$$</code> or ends with <code>$$</code> (and does not start with it). If no such line exists, leave the text alone (it is genuinely unclosed).</li>
    <li>Emit <code>$$</code>, then the meta text on its own line (this also fixes shape C, where the formula currently renders empty), the body lines, the closer's content, and <code>$$</code> on its own line.</li>
  </ol>
  <p>I prototyped exactly this (<a href="1778/repro/prototype-fix.patch">prototype-fix.patch</a>: new <code>markdown-math-fences.ts</code> + a 3-line call in <code>MarkdownPreview</code>'s body memo). With it, the repro test and the existing <code>markdown-preview.test.tsx</code> suite pass (18/18, <a href="1778/repro/vitest-with-prototype-fix.log">log</a>) and <code>turbo typecheck --filter=@bb/app</code> is clean. Inline <code>$$x$$</code> is untouched because the opener pattern rejects a remainder containing <code>$</code>, and single-dollar handling is unaffected. Risks: (a) a legitimate <code>$$asciimath</code> meta line would now be treated as TeX — bb never used meta, and <code>mdast-util-math</code> drops it anyway, so nothing regresses; (b) math inside blockquotes / list items with a <code>&gt;</code> or <code>-</code> prefix is not normalised by the prototype (it only handles ≤3 spaces of indent) — extend the prefix handling or accept; (c) while streaming, a partially received block has no closer yet, so it stays unnormalised until the closer arrives and then flips to canonical form — the same transient as today's unclosed-fence behaviour, no worse.</p>
  <p>Alternative (more robust, more code): ship a custom micromark construct that replaces <code>mathFlow</code> and accepts a closing <code>$$</code> at the end of a content line. Either way, add the regression test above plus shapes B and C to <code>markdown-preview.test.tsx</code>, and apply the same normaliser in <code>apps/mobile/src/markdown/parse.ts</code>.</p>

  <h2>7. PR review</h2>
  <p>No open PRs are linked to this issue.</p>

  <h2>8. Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/issues/511">#511</a> / <a href="https://github.com/get-bb/bb/pull/512">PR #512</a> — disabled single-dollar math; the comment in <code>markdown-preview.tsx</code> documents why only <code>$$</code> is honoured.</li>
    <li><a href="https://github.com/get-bb/bb/issues/441">#441</a> / <a href="https://github.com/get-bb/bb/pull/442">PR #442</a> — original KaTeX support.</li>
    <li><a href="https://github.com/get-bb/bb/pull/1891">PR #1891</a> — lazy-loads KaTeX; unrelated to parsing but the last change to the math pipeline.</li>
    <li>Upstream: <code>micromark-extension-math</code> documents that display math works "like fenced code" (closing fence on its own line); this is a known design choice, not something bb can configure.</li>
  </ul>

  <h2>9. Appendix</h2>
  <h3>Assistant message event from the live thread (verbatim text)</h3>
  <pre>{esc('"text": "Before the formula.\\n\\n$$T_{\\\\text{appearance}\\\\rightarrow\\\\text{chunk}}\\n\\\\approx73\\\\text{--}146\\\\text{ ms}$$\\n\\n## Content after the formula\\n\\n- This should remain a list item.\\n- [This should remain a link](https://example.com)."')}</pre>
  <h3>Prototype fix patch</h3>
  <pre>{esc(patch)}</pre>
  <h3>Commands run</h3>
  <pre>{esc("""pnpm install --frozen-lockfile --prefer-offline
pnpm exec turbo run build --filter=@bb/app^...
cd apps/app && pnpm exec vitest run src/components/ui/markdown-preview.issue-1778.test.tsx   # fails at base -> vitest-base.log
cp mdast-dump.mjs apps/app/ && node apps/app/mdast-dump.mjs                                 # -> mdast-dump.out
cp mdast-variants.mjs apps/app/ && node apps/app/mdast-variants.mjs                         # -> mdast-variants.out
scripts/bb-dev-app current                                                                   # App :18548 Server :26548 Host daemon :34548
curl -s -X POST http://localhost:26548/api/v1/projects -H 'content-type: application/json' -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/bb-1778-scratch","hostId":"host_26tbywf36d"}}'
bash 1778/repro/spawn.sh           # codex thread thr_x9gvs6bkf5 echoing the issue body
doobie --headless < 1778/repro/shot1.js   # 1778-thread-overview.png
doobie --headless < 1778/repro/shot2.js   # 1778-assistant-message-zoom.png + assistant-message-dom.txt
bash 1778/repro/followup.sh        # canonical-form control message
doobie --headless < 1778/repro/shot3.js   # 1778-expected-canonical-form.png
# prototype fix applied, then:
cd apps/app && pnpm exec vitest run src/components/ui/markdown-preview.issue-1778.test.tsx src/components/ui/markdown-preview.test.tsx  # 18 passed
pnpm exec turbo run typecheck --filter=@bb/app   # clean
pnpm dev:stop; rm -rf ~/.bb-dev/projects-bb-.claude-worktrees-wf_926b3193-f6c-14-e735147cd39f /tmp/bb-1778-scratch""")}</pre>
</main></body></html>
'''
open('/tmp/bb-reports/issues/1778.html','w').write(body)
print(len(body))
