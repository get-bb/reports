import html
p='/tmp/bb-reports/issues/1182.html'
s=open(p).read()

# 1. Unit test section: replace inline test source with new file
test_src=open('/tmp/bb-reports/issues/1182/repro/markdown-local-file-link.issue-1182.test.ts').read()
start=s.index('<pre>import { describe, expect, it } from "vitest";')
end=s.index('</pre>',start)+len('</pre>')
s=s[:start]+'<pre>'+html.escape(test_src.rstrip('\n'),quote=False)+'</pre>'+s[end:]

old_exp='<p><b>Expected:</b> all 5 pass (tilde hrefs resolve to <code>null</code>, i.e. left as ordinary links). <b>Actual on 16ceb3a54:</b></p>'
new_exp='<p><b>Expected:</b> all 11 pass (tilde hrefs resolve to <code>null</code>, i.e. left as ordinary links; names that merely start with <code>~</code> still resolve). <b>Actual on 16ceb3a54:</b> 7 fail / 4 pass — the four "still resolves" guards pass on base (they exist to keep the fix from over-rejecting), every home-path case fails:</p>'
assert old_exp in s; s=s.replace(old_exp,new_exp)

old_out_start=s.index('<pre> × leaves ~/.config/example.md as plain text (not a workspace file)')
old_out_end=s.index('</pre>',old_out_start)+len('</pre>')
new_out='''<pre> ❯ src/components/ui/markdown-local-file-link.issue-1182.test.ts (11 tests | 7 failed)
     × leaves ~ as plain text (not a workspace file)
       → expected '/Users/me/bb/~' to be null
     × leaves ~/.config/example.md as plain text (not a workspace file)
       → expected '/Users/me/bb/~/.config/example.md' to be null
     × leaves %7E/.config/example.md as plain text (not a workspace file)
       → expected '/Users/me/bb/~/.config/example.md' to be null
     × leaves ~/.config/example.md:12 as plain text (not a workspace file)
       → expected '/Users/me/bb/~/.config/example.md:12' to be null
     × leaves ~/notes.md#L3-L5 as plain text (not a workspace file)
       → expected '/Users/me/bb/~/notes.md#L3-L5' to be null
     × leaves ~alice/notes.md as plain text (not a workspace file)
       → expected '/Users/me/bb/~alice/notes.md' to be null
     ✓ still resolves ~notes.md as a workspace file
     ✓ still resolves ~$report.docx as a workspace file
     ✓ still resolves ~notes.md:3 as a workspace file
     ✓ still resolves docs/~draft.md as a workspace file
     × documents the actual (buggy) behaviour on 16ceb3a54
       → expected '/Users/me/bb/~/.config/example.md' not to be '/Users/me/bb/~/.config/example.md'
stdout | documents the actual (buggy) behaviour on 16ceb3a54
resolved href: /Users/me/bb/~/.config/example.md -&gt; workspace link: { lineRange: null, path: '/Users/me/bb/~/.config/example.md' }

 Test Files  1 failed (1)
      Tests  7 failed | 4 passed (11)</pre>'''
s=s[:old_out_start]+new_out+s[old_out_end:]

# 2. Repro B step 1 command block
old_b1='''<pre>scripts/bb-dev-app current            # prints App/Server URLs
export BB_SERVER_URL=http://localhost:25374 BB_HOST_DAEMON_PORT=33374
mkdir -p /tmp/bb-1182-scratch &amp;&amp; cd /tmp/bb-1182-scratch &amp;&amp; git init -q &amp;&amp; echo "# scratch" &gt; README.md &amp;&amp; git add . &amp;&amp; git -c user.email=a@b -c user.name=qa commit -qm init
pnpm bb:dev machine list              # -&gt; host_7jfebaa4wr
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/bb-1182-scratch","hostId":"host_7jfebaa4wr"}}'
# -&gt; {"id":"proj_xfhduummc3", ...}</pre></li>'''
new_b1='''<pre># run everything from the bb repo root of your worktree
scripts/bb-dev-app current            # prints App/Server/Host daemon URLs for YOUR worktree (ports differ per worktree)
eval "$(scripts/bb-dev-app env)"      # sets BB_SERVER_URL etc. to those values
( mkdir -p /tmp/bb-1182-scratch &amp;&amp; cd /tmp/bb-1182-scratch &amp;&amp; git init -q &amp;&amp; echo "# scratch" &gt; README.md &amp;&amp; git add . &amp;&amp; git -c user.email=a@b -c user.name=qa commit -qm init )
pnpm bb:dev machine list              # note the host id (mine: host_7jfebaa4wr; the verifier's: host_ai8j9cyts3)
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{"name":"qa","source":{"type":"local_path","path":"/tmp/bb-1182-scratch","hostId":"&lt;host id from machine list&gt;"}}'
# -&gt; {"id":"proj_…", ...}   (substitute this project id, and the thread id spawned below, in the following commands;
#    the ids/ports shown further down — proj_xfhduummc3, thr_em7hmw2zzh, :17374/:25374 — are from the author's instance)</pre></li>'''
assert old_b1 in s; s=s.replace(old_b1,new_b1)

# 3. with-fix screenshot caption
old_cap='<figcaption>Same thread after applying the proposed one-function fix (vite HMR): inline code is plain code again, and the explicit markdown link stays an ordinary anchor without the local-file icon (href stays <code>~/.config/example.md</code>).</figcaption>'
new_cap='<figcaption>Same thread after applying the proposed one-function fix (vite HMR): inline code is plain code again, and the explicit markdown link stays an ordinary anchor without the local-file icon (href stays <code>~/.config/example.md</code>). <b>Note:</b> the <code>example.md</code> / <code>notes.md</code> tabs still open in the right-hand panel are stale from steps 4–5 (they were opened before the fix and were not closed before capturing); with the fix applied nothing in the message is clickable as a workspace file, so no new tab can be opened.</figcaption>'
assert old_cap in s; s=s.replace(old_cap,new_cap)

anchor='<figure><img src="assets/1182-with-fix.png"'
extra='''<figure><img src="assets/1182-hover-open-in-editor.png" alt="hover on Open in editor button"><figcaption>Between steps 4 and 5: hovering the external-link button in the file tab header shows the "Open in editor" tooltip; this is the button that produces the toast in the next screenshot.</figcaption></figure>
  <figure><img src="assets/1182-inline-code-links.png" alt="inline code links before click"><figcaption>Inline-code variant before clicking: both <code>`~/.config/example.md`</code> and <code>`~/notes.md`</code> in the assistant reply are rendered as underlined links with the local-file icon.</figcaption></figure>
  '''
assert anchor in s; s=s.replace(anchor,extra+anchor,1)

# 4. Proposed fix section
old_pf='''<p>Reject shell-style home paths in <code>resolveRelativeLocalFileHref</code> after decoding, in the same guard clause as absolute paths. One helper + one condition; verified in this worktree (unit test goes 5/5 green, existing <code>markdown-local-file-link.test.ts</code> and <code>markdown-preview.test.tsx</code> still pass, <code>turbo typecheck --filter=@bb/app</code> clean, and the live app shows plain code / plain anchor — see last screenshot). Diff: <a href="1182/repro/proposed-fix.diff">1182/repro/proposed-fix.diff</a>.</p>'''
new_pf='''<p>Reject shell-style home paths in <code>resolveRelativeLocalFileHref</code> after decoding, in the same guard clause as absolute paths. One helper + one condition; verified in this worktree (repro test goes 11/11 green, existing <code>markdown-local-file-link.test.ts</code> and <code>markdown-preview.test.tsx</code> still pass — 37 tests across the three files, <code>turbo typecheck --filter=@bb/app</code> clean, and the live app shows plain code / plain anchor — see last screenshot). Diff: <a href="1182/repro/proposed-fix.diff">1182/repro/proposed-fix.diff</a> (applies cleanly to 16ceb3a54 with <code>git apply</code>).</p>
  <p><b>Correction (after verification):</b> the first version of this report used <code>/^~[^/]*(?:\\/|$)/</code> and claimed it kept <code>~notes.md</code>-style names linkified. That was wrong — <code>[^/]*</code> swallows the whole first segment and <code>$</code> then always matches, so it was equivalent to <code>/^~/</code>. The regex below is the corrected one: it matches a bare <code>~</code>, or a first segment starting with <code>~</code> <em>that is followed by a slash</em> (<code>~/…</code>, <code>~user/…</code>), and nothing else. Table from <code>node</code> (<a href="1182/verify/revise-regex.txt">verify/revise-regex.txt</a>):</p>
<pre>"~"              true    (rejected: home path)
"~/x"            true
"~user/x.md"     true
"~foo/bar.md"    true
"~notes.md"      false   (kept: relative file name)
"~$report.docx"  false
"~notes.md:3"    false   (line suffix is parsed off before the check anyway)
"docs/~draft.md" false</pre>'''
assert old_pf in s; s=s.replace(old_pf,new_pf)

old_diffpre='''<pre>+// Shell-style home paths (`~`, `~/x`, `~user/x`) are not workspace-relative.
+// The renderer has no home directory to expand them against, so leave them as
+// plain links instead of joining the literal `~` onto the workspace root.
+// This runs on the *decoded* href, so `%7E/x` is covered too.
+function isHomeRelativePath(path: string): boolean {
+  return /^~[^/]*(?:\\/|$)/u.test(path);
+}'''
new_diffpre='''<pre>+// Shell-style home paths (`~`, `~/x`, `~user/x`) are not workspace-relative.
+// The renderer has no home directory to expand them against, so leave them as
+// plain links instead of joining the literal `~` onto the workspace root.
+// Only a bare `~` or a first segment that starts with `~` and is followed by a
+// `/` counts; a plain file name that happens to start with `~` (for example
+// `~notes.md` or a `~$report.docx` lock file) is still a relative file. This
+// runs on the *decoded* href, so `%7E/x` is covered too.
+function isHomeRelativePath(path: string): boolean {
+  return /^~(?:[^/]*\\/|$)/u.test(path);
+}'''
assert old_diffpre in s; s=s.replace(old_diffpre,new_diffpre)

old_note='<li>Match <code>~</code>, <code>~/…</code>, and <code>~user/…</code> (what a shell would expand). Do <em>not</em> reject every path that merely starts with <code>~</code>: <code>~$report.docx</code>-style lock files or a file literally named <code>~notes.md</code> are legitimate relative names, and the regex above keeps them.</li>'
new_note='<li>Match <code>~</code>, <code>~/…</code>, and <code>~user/…</code> (what a shell would expand). Do <em>not</em> reject every path that merely starts with <code>~</code>: <code>~$report.docx</code>-style lock files or a file literally named <code>~notes.md</code> are legitimate relative names. The corrected regex keeps them, and this is now <em>tested</em>: the repro file has four "still resolves … as a workspace file" cases (<code>~notes.md</code>, <code>~$report.docx</code>, <code>~notes.md:3</code>, <code>docs/~draft.md</code>) that pass both on base and with the fix. Trade-off: <code>~foo/bar.md</code> (a directory literally named <code>~foo</code>) is also rejected, because it is indistinguishable from a <code>~user/</code> path; that seems acceptable and is documented in the code comment. If maintainers prefer the blunter rule "anything starting with <code>~</code>", use <code>/^~/</code> and drop the four positive cases — either is fine, but the report should not claim one while shipping the other.</li>'
assert old_note in s; s=s.replace(old_note,new_note)

old_add='<li>Add the four <code>it.each</code> cases (plus <code>~</code> alone and <code>~user/x.md</code>) to <code>apps/app/src/components/ui/markdown-local-file-link.test.ts</code> under <code>describe("resolveRelativeLocalFileHref")</code>.</li>'
new_add='<li>Add the six negative <code>it.each</code> cases and the four positive ones from the repro file to <code>apps/app/src/components/ui/markdown-local-file-link.test.ts</code> under <code>describe("resolveRelativeLocalFileHref")</code>.</li>'
assert old_add in s; s=s.replace(old_add,new_add)

# 5. Appendix commands
s=s.replace('markdown-preview.test.tsx   # 31 passed','markdown-preview.test.tsx   # 31 passed (first version of the repro test)')
old_cmds_end='pnpm dev:stop</pre>'
new_cmds_end='''pnpm dev:stop
# revision pass (after verifier findings), in worktree wf_6b6686dc-4c2-27 pinned to 16ceb3a54:
node -e '…regex table…' &gt; /tmp/bb-reports/issues/1182/verify/revise-regex.txt
cd apps/app &amp;&amp; pnpm exec vitest run src/components/ui/markdown-local-file-link.issue-1182.test.ts   # base: 7 failed | 4 passed
git apply /tmp/bb-reports/issues/1182/repro/proposed-fix.diff
cd apps/app &amp;&amp; pnpm exec vitest run …issue-1182.test.ts …markdown-local-file-link.test.ts …markdown-preview.test.tsx   # 37 passed (verify/revise-vitest-fix.txt)
pnpm exec turbo run typecheck --filter=@bb/app   # ok (verify/revise-typecheck.txt)</pre>'''
assert old_cmds_end in s; s=s.replace(old_cmds_end,new_cmds_end,1)

# 6. Verification subsection
ver='''  <h2>Verification</h2>
  <p>An independent verifier followed this report in a fresh worktree at 16ceb3a54: (A) the unit test reproduced with the same assertions, and the fix diff applied cleanly and turned the suite green; (B) a live dev instance (App :14920 / Server :22920, project <code>/tmp/bb-1182-verify-scratch</code>, a real claude-code turn) showed the <code>file:///tmp/bb-1182-verify-scratch/~/.config/example.md</code> anchor, the "Failed to load file" tab, and the "Open target path does not exist" toast; all permalinked code excerpts matched the base commit and <code>origin/main</code> still lacks a fix. Verifier logs and screenshots: <a href="1182/verify/vitest-base.txt">verify/vitest-base.txt</a>, <a href="1182/verify/vitest-fix.txt">verify/vitest-fix.txt</a>, <a href="1182/verify/1182-verify-thread.png">verify/1182-verify-thread.png</a>, <a href="1182/verify/1182-verify-after-click.png">verify/1182-verify-after-click.png</a>, <a href="1182/verify/1182-verify-open-in-editor.png">verify/1182-verify-open-in-editor.png</a>.</p>
  <p>Findings and what changed in this revision:</p>
  <ul>
    <li><b>Major — regex claim was false.</b> <code>/^~[^/]*(?:\\/|$)/</code> rejected <em>every</em> href starting with <code>~</code>, contradicting the report's statement that <code>~notes.md</code> / <code>~$report.docx</code> stayed linkified. Fixed: the regex is now <code>/^~(?:[^/]*\\/|$)/</code> (bare <code>~</code>, or <code>~…/</code>), <code>repro/proposed-fix.diff</code> was regenerated, the repro test gained four positive "still resolves" cases plus <code>~</code> and <code>~alice/notes.md</code> negatives (11 tests: 7 fail on base, 11 pass with fix; 37 pass together with the two existing suites), typecheck re-run clean, and the Proposed-fix section documents the trade-off explicitly.</li>
    <li><b>Minor — repro B step 1 not literally followable.</b> Ports/host id/project id were the author's instance values and the <code>cd</code> into the scratch repo broke the following <code>pnpm bb:dev</code> call. Fixed: the block now uses <code>eval "$(scripts/bb-dev-app env)"</code>, runs the scratch <code>git init</code> in a subshell, and says to substitute your own host/project/thread ids.</li>
    <li><b>Minor — screenshots.</b> Added a caption note that the tabs visible in <code>1182-with-fix.png</code> are stale from the pre-fix steps; embedded the two previously unreferenced screenshots (<code>1182-hover-open-in-editor.png</code>, <code>1182-inline-code-links.png</code>).</li>
  </ul>
  <p>The live-app screenshots were not re-taken for the corrected regex: the only behavioural difference between the two regexes is for names like <code>~notes.md</code> (kept as workspace files, unchanged from base), and every <code>~/…</code> case exercised in the browser is rejected identically by both, as the unit test shows.</p>
</main></body>'''
assert '</main></body>' in s; s=s.replace('</main></body>',ver)
open(p,'w').write(s)
print("ok")
