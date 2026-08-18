import re, sys
p = "/tmp/bb-reports/issues/1603.html"
s = open(p, encoding="utf-8").read()
orig = s

def rep(old, new, count=1):
    global s
    assert s.count(old) >= 1, "missing: " + old[:80]
    s = s.replace(old, new, count)

# --- Environment: browsers row -> add harness setup
rep('Old builds run on this Ubuntu via <a href="1603/repro/setup-old-webkit.sh">setup-old-webkit.sh</a> + <a href="1603/repro/run-old-webkit160.sh">run-old-webkit160.sh</a> / <a href="1603/repro/run-webkit164.sh">run-webkit164.sh</a>.</td></tr>',
    'Old builds run on this Ubuntu 26.04 host via the harness built by <a href="1603/repro/setup-harness.sh">setup-harness.sh</a> (see "Harness setup" below) and driven by <a href="1603/repro/run-old-webkit160.sh">run-old-webkit160.sh</a> / <a href="1603/repro/run-webkit164.sh">run-webkit164.sh</a>.</td></tr>')

# --- Minimal reproduction intro + harness setup subsection
rep('''  <h2>Minimal reproduction</h2>
  <p>Everything below is against the pristine build at the base commit. Scripts live in <a href="1603/repro/">1603/repro/</a>.</p>
''', '''  <h2>Minimal reproduction</h2>
  <p>Everything below is against the pristine build at the base commit. Scripts live in <a href="1603/repro/">1603/repro/</a>; <code>R=/tmp/bb-reports/issues/1603/repro</code> in the commands. Every script is invoked by absolute path from any cwd.</p>

  <h3>0. Harness setup (old WebKit engines on a modern Linux, no root)</h3>
  <p>Cause 1 needs a Safari-16.0-era JavaScriptCore; Playwright still hosts <code>webkit-1724</code> (Playwright 1.27.1) and <code>webkit-1837</code> (Playwright 1.33.0, Safari 16.4-era). Those builds were compiled for Ubuntu 22.04, so on a newer distro their shared libraries have to be supplied by hand. <a href="1603/repro/setup-harness.sh">setup-harness.sh</a> does all of it: <code>npm i playwright@1.27.1 acorn acorn-walk</code> into <code>$HARNESS</code>, <code>npm i playwright@1.33.0</code> into <code>$HARNESS/pw132</code>, <code>npx playwright install webkit</code> for both, <code>apt-get download</code> of 27 host-distro packages (newer sonames) + 6 jammy-only packages from archive.ubuntu.com (<code>libicu70 libpcre3 libsoup2.4-1 libvpx7 libwoff1 libxml2</code>; the exact list is in the script), <code>dpkg-deb -x</code> into <code>$HARNESS/root</code>/<code>oldroot</code>, copy the <code>.so</code> files into each build's <code>minibrowser-wpe/sys/lib</code>, move the bundled glib 2.70 aside, then smoke-launch both engines.</p>
<pre># default target: /tmp/bb-1603-wk + ~/.cache/ms-playwright. Override with BB1603_HARNESS / PLAYWRIGHT_BROWSERS_PATH.
bash /tmp/bb-reports/issues/1603/repro/setup-harness.sh          # ~4 min, ~2 GB
# proof it works from nothing (separate dir + separate browser cache, logged):
bash /tmp/bb-reports/issues/1603/repro/setup-harness-fresh-test.sh   # → 1603/setup-harness-fresh.log</pre>
  <p>Actual, from-scratch run into <code>/tmp/bb-1603-wk-fresh</code> (<a href="1603/setup-harness-fresh.log">full log</a>, 3 min 40 s):</p>
<pre>playwright@1.27.1 webkit rev 1724
playwright@1.33.0 webkit rev 1837
== 2. download the two WebKit builds
/tmp/bb-1603-wk-fresh/browsers/webkit-1724
/tmp/bb-1603-wk-fresh/browsers/webkit-1837
== 3b. jammy-only packages …
ok libicu70 -> pool/main/i/icu/libicu70_70.1-2_amd64.deb
ok libpcre3 -> pool/main/p/pcre3/libpcre3_8.39-13build5_amd64.deb
ok libsoup2.4-1 -> pool/main/libs/libsoup2.4/libsoup2.4-1_2.74.2-3_amd64.deb
ok libvpx7 -> pool/main/libv/libvpx/libvpx7_1.11.0-2ubuntu2_amd64.deb
ok libwoff1 -> pool/main/w/woff2/libwoff1_1.0.2-1build4_amd64.deb
ok libxml2 -> pool/main/libx/libxml2/libxml2_2.9.13+dfsg-1build1_amd64.deb
== 4. … prepared /tmp/bb-1603-wk-fresh/browsers/webkit-1724/minibrowser-wpe (332 files in sys/lib)
== 5. smoke test both engines
Mozilla/5.0 (Macintosh; …) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15 | lookbehind: no  | v flag: no
Mozilla/5.0 (Macintosh; …) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15 | lookbehind: yes | v flag: yes
exit=0</pre>
  <p>The two runners <a href="1603/repro/run-old-webkit160.sh">run-old-webkit160.sh</a> (webkit-1724) and <a href="1603/repro/run-webkit164.sh">run-webkit164.sh</a> (webkit-1837) take the script as an absolute path (they copy it next to the right <code>node_modules</code> so <code>import "playwright"</code> resolves to the right version) and set the env the old builds need (<code>PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS</code>, <code>__EGL_VENDOR_LIBRARY_DIRS</code>, <code>LIBGL_ALWAYS_SOFTWARE</code>). Cause 2 alone (step 5) needs no old engine at all: any Playwright WebKit plus the RegExp-wrapping init script in <a href="1603/repro/wk-load-no-vflag.mjs">wk-load-no-vflag.mjs</a> reproduces it.</p>
''')

# --- step 1
rep('''bash /tmp/bb-reports/issues/1603/repro/start-prod-app.sh "$PWD"      # → up: http://localhost:45031</pre>''',
    '''bash /tmp/bb-reports/issues/1603/repro/start-prod-app.sh "$PWD"      # → up: http://localhost:45031 (ports 45031/45032, data dir /tmp/bb-1603-proddata)</pre>''')

# --- step 2
rep('''<pre>node wk-feature-probe.mjs        # under run-old-webkit160.sh (webkit-1724, Safari 16.0-era)</pre>''',
    '''<pre>bash $R/run-old-webkit160.sh $R/wk-feature-probe.mjs        # webkit-1724, Safari 16.0-era
bash $R/run-webkit164.sh    $R/wk-feature-probe.mjs        # webkit-1837, Safari 16.4-era (control)</pre>''')

# --- step 3
rep('''<pre>node wk-load-and-wait.mjs http://localhost:45031 /tmp/bb-reports/issues/assets/1603-wk160-prod 20000   # under run-old-webkit160.sh</pre>''',
    '''<pre>bash $R/run-old-webkit160.sh $R/wk-load-and-wait.mjs http://localhost:45031 /tmp/bb-reports/issues/assets/1603-wk160-prod 20000</pre>''')

# --- step 4
rep('''<pre>node webkit-find-bad-regex.mjs http://localhost:45031 dist/assets/workspace-checkout-display-*.js dist/assets/worker-portable-*.js   # parses each chunk with acorn, compiles every literal in the old engine</pre>''',
    '''<pre>A=$PWD/packages/bb-app/app/dist/assets
bash $R/run-old-webkit160.sh $R/webkit-find-bad-regex.mjs http://localhost:45031 $A/workspace-checkout-display-*.js $A/worker-portable-*.js   # parses each chunk with acorn, compiles every literal in the old engine</pre>''')

# --- step 5
rep('''<pre>node wk-load-no-vflag.mjs http://localhost:45031/ /tmp/bb-reports/issues/assets/1603-wk164-novflag 12000   # under run-webkit164.sh</pre>''',
    '''<pre>bash $R/run-webkit164.sh $R/wk-load-no-vflag.mjs  http://localhost:45031/ /tmp/bb-reports/issues/assets/1603-wk164-novflag 12000
bash $R/run-webkit164.sh $R/wk-load-and-wait.mjs  http://localhost:45031/ /tmp/bb-reports/issues/assets/1603-wk164-prod    12000   # control, native v flag</pre>''')

# caption fix
rep('''<figcaption>Safari-16.4-like engine (no <code>v</code> flag), pristine bundle: same blank page + error card, now "Invalid flags supplied to RegExp constructor.".</figcaption>''',
    '''<figcaption>Safari-16.4-like engine (no <code>v</code> flag), pristine bundle: same blank page + error card. The "Error details" box shows the stack (<code>RegExp@web-inspector://bootstrap.js:6:28</code> / <code>module code@…/workspace-checkout-display-2ZaYoVXJ.js:60:4148</code>, i.e. a RegExp constructor call at module top level); the message itself, "Invalid flags supplied to RegExp constructor.", is in the console log (<a href="1603/webkit164-no-vflag.log">log</a>).</figcaption>''')

# --- step 7
rep('''<pre># bb-app serves packages/bb-app/app/dist and prefers the .br/.gz siblings, so move those aside for the two chunks first
node patch-lookbehind-experiment.mjs packages/bb-app/app/dist/assets --unfold   # 3 lookbehind literals → non-lookbehind; folded envFlags → real try/catch
# restart bb-app, then:
node wk-load-and-wait.mjs http://localhost:45031/ /tmp/bb-reports/issues/assets/1603-wk160-prod-patched 15000   # under run-old-webkit160.sh</pre>''',
    '''<pre># all-in-one (moves the .br/.gz siblings aside, patches, restarts bb-app, loads on webkit-1724, restores, restarts):
bash $R/step7-counter-experiment.sh "$PWD"
# which is:
#   node $R/patch-lookbehind-experiment.mjs packages/bb-app/app/dist/assets --unfold   # 3 lookbehind literals → non-lookbehind; folded envFlags → real try/catch
#   (restart bb-app; it serves packages/bb-app/app/dist and prefers the .br/.gz siblings, so those are moved aside first)
#   bash $R/run-old-webkit160.sh $R/wk-load-and-wait.mjs http://localhost:45031/ …/1603-wk160-prod-patched 15000
#   node $R/patch-lookbehind-experiment.mjs packages/bb-app/app/dist/assets restore</pre>''')

# --- Verification subsection before Related issues (after Proposed fix section) -> put at end before Appendix? Instruction: "at the end". Put before </main> after Appendix.
rep('''</main></body>''', '''  <h2>Verification</h2>
  <p>An independent verifier followed steps 1–7 in a separate worktree at <code>16ceb3a54</code> (fresh <code>pnpm install</code> + <code>turbo build</code>; identical chunk hashes <code>workspace-checkout-display-2ZaYoVXJ.js</code> / <code>worker-portable-DaFcwpf8.js</code>) and reproduced every step: feature probe (lookbehind and static blocks rejected on webkit-1724), the iPhone 8 Plus crash after ~1.4 s with "Invalid regular expression: invalid group specifier name", the acorn scan finding exactly the three regexes at the same byte offsets, the "Invalid flags supplied to RegExp constructor." crash at <code>…:60:4148</code> with the <code>v</code>-flag-rejecting init script (control on the same engine renders 20 buttons), rolldown 1.0.0 folding the try/catch to <code>unicodeSets: true</code> with minify on and off, and the patched bundle booting on the Safari-16.0-era engine. All code claims (App.tsx L78/L325, diff-worker-pool.ts L20, git-diff-parsing.ts L1, markdown-preview.tsx L39, @pierre/diffs 1.2.9 constants.js:15, mdast-util-gfm-autolink-literal 2.0.1 lib/index.js:135, oniguruma-to-es 4.3.4 / regex 6.1.0 probes, Vite 8.0.12 default target, folded <code>Hd={flagGroups:!0,unicodeSets:!0}</code> in both chunks) checked out, and nothing on <code>origin/main</code> through <code>71f52fe0a</code> touches the relevant files. Verifier artifacts: <a href="1603/verify/">1603/verify/</a>.</p>
  <p><b>Findings and what changed in this revision:</b></p>
  <ul>
    <li><b>Major — harness not reproducible from the report.</b> The old-WebKit harness lived only in <code>/tmp/bb-1603-wk</code>: the runner scripts <code>cd</code>'d there, only worked with scripts named relatively (an absolute path failed with <code>ERR_MODULE_NOT_FOUND: Cannot find package 'playwright'</code>), and the npm/Playwright/apt package lists were never recorded. Fixed by re-doing it, not by rewording: new <a href="1603/repro/setup-harness.sh">setup-harness.sh</a> builds the whole harness from nothing (exact npm versions, <code>npx playwright install webkit</code>, the 27 + 6 package names, lib layout, glib workaround, smoke test); <a href="1603/repro/setup-harness-fresh-test.sh">setup-harness-fresh-test.sh</a> ran it into a brand-new dir with a brand-new browser cache (<a href="1603/setup-harness-fresh.log">log</a>, exit 0, 3 min 40 s); <a href="1603/repro/run-old-webkit160.sh">run-old-webkit160.sh</a> / <a href="1603/repro/run-webkit164.sh">run-webkit164.sh</a> now accept absolute script paths and honour <code>BB1603_HARNESS</code> / <code>PLAYWRIGHT_BROWSERS_PATH</code>; <a href="1603/repro/fetch-jammy.sh">fetch-jammy.sh</a> is now in <code>repro/</code>. Then steps 2–5 and 7 were re-run <em>through that fresh harness</em> with every script called by absolute path from <code>/</code> (<a href="1603/repro/rerun-fresh-harness.sh">rerun-fresh-harness.sh</a>, <a href="1603/repro/step7-counter-experiment.sh">step7-counter-experiment.sh</a>; output <a href="1603/fresh-harness-rerun.log">fresh-harness-rerun.log</a>, <a href="1603/fresh-harness/">fresh-harness/</a> logs + screenshots): identical results — probe rejects lookbehind/static blocks, iPhone 8 Plus crash after ~1416 ms with the same message, same three regexes at @12092/@1638057/@795245, "Invalid flags supplied to RegExp constructor." at <code>:60:4148</code>, control renders 20 buttons, patched bundle boots (20 buttons, no errors). The section "0. Harness setup" above was added; the step commands were rewritten in absolute-path form.</li>
    <li><b>Minor — step 5 caption</b> claimed the error card shows "Invalid flags supplied to RegExp constructor."; the card's details box actually shows only the stack, the message is in the console log. Caption corrected.</li>
    <li><b>Minor — Playwright version</b> in the <code>run-webkit164.sh</code> header said 1.32.3; it is 1.33.0 (<code>pw132/node_modules/playwright/package.json</code>, browsers.json revision 1837). Comment corrected.</li>
  </ul>
  <p>Fresh-harness rerun excerpt (<a href="1603/fresh-harness-rerun.log">full</a>):</p>
<pre>harness=/tmp/bb-1603-wk-fresh browsers=/tmp/bb-1603-wk-fresh/browsers
== step 2: feature probe, webkit-1724
      "regex lookbehind /(?&lt;=\\\\n)/ (from @pierre/diffs)",  "SyntaxError: Invalid regular expression: invalid group specifier name"
      "class static block",  "SyntaxError: Unexpected token '{'"
== step 3: iPhone 8 Plus on webkit-1724 (crash expected)
after load: {…"text":"New thread Extensions Settings Report a bug Toggle Sidebar","errorBoundary":false,"buttons":8}
error boundary visible after ~1416 ms: {…"text":"bb hit an error and stopped …","errorBoundary":true,"buttons":1}
[console.error] [bb] the app crashed SyntaxError: Invalid regular expression: invalid group specifier name
== step 4: pin the regexes
== workspace-checkout-display-2ZaYoVXJ.js: 505 regexes, 2 rejected   @12092 /(?&lt;=\\n)/   @1638057 /(?&lt;=^|\\s|\\p{P}|\\p{S})([-.\\w+]+)@…/gu
== worker-portable-DaFcwpf8.js: 111 regexes, 1 rejected              @795245 /(?&lt;=\\n)/
== step 5: webkit-1837 with RegExp v flag rejected (crash expected)
module code@http://localhost:45031/assets/workspace-checkout-display-2ZaYoVXJ.js:60:4148
[console.error] [bb] the app crashed SyntaxError: Invalid flags supplied to RegExp constructor.
== step 5 control: webkit-1837 native (home screen expected)
final: {…"text":"New thread Extensions Automations Threads No threads Settings Remote access … New project Create one from a local folder ","errorBoundary":false,"buttons":20}
== step 7 (step7.log): worker-portable: real lookbehind literals 1 -> 0; workspace-checkout-display: 2 -> 0
final: {…"errorBoundary":false,"buttons":20}   [console.error] Viewport argument key "interactive-widget" not recognized and ignored.   (only)
restored worker-portable-DaFcwpf8.js / workspace-checkout-display-2ZaYoVXJ.js</pre>
  <p>Cleanup after the revision: packaged app killed, <code>/tmp/bb-1603-proddata</code> removed, ports 45031/45032 free, patched chunks restored (<code>.br/.gz</code> back in place), the fresh harness <code>/tmp/bb-1603-wk-fresh</code> deleted (its logs are kept under <code>1603/</code>); <code>/tmp/bb-1603-wk</code> is left in place for convenience but is no longer required — <code>setup-harness.sh</code> recreates it.</p>
</main></body>''')

# artifacts list
rep('''<li>Runners: <a href="1603/repro/setup-old-webkit.sh">setup-old-webkit.sh</a>, <a href="1603/repro/run-old-webkit160.sh">run-old-webkit160.sh</a>, <a href="1603/repro/run-webkit164.sh">run-webkit164.sh</a>, <a href="1603/repro/start-prod-app.sh">start-prod-app.sh</a>, <a href="1603/repro/stop-prod-app.sh">stop-prod-app.sh</a></li>''',
    '''<li>Harness: <a href="1603/repro/setup-harness.sh">setup-harness.sh</a> (from scratch), <a href="1603/repro/setup-harness-fresh-test.sh">setup-harness-fresh-test.sh</a> → <a href="1603/setup-harness-fresh.log">setup-harness-fresh.log</a>, <a href="1603/repro/fetch-jammy.sh">fetch-jammy.sh</a>, <a href="1603/repro/setup-old-webkit.sh">setup-old-webkit.sh</a> (older per-build variant)</li>
    <li>Runners: <a href="1603/repro/run-old-webkit160.sh">run-old-webkit160.sh</a>, <a href="1603/repro/run-webkit164.sh">run-webkit164.sh</a>, <a href="1603/repro/start-prod-app.sh">start-prod-app.sh</a>, <a href="1603/repro/stop-prod-app.sh">stop-prod-app.sh</a>, <a href="1603/repro/rerun-fresh-harness.sh">rerun-fresh-harness.sh</a> (steps 2–5 in one go), <a href="1603/repro/step7-counter-experiment.sh">step7-counter-experiment.sh</a></li>''')

rep('''bash repro/start-prod-app.sh "$PWD" ; … (steps 2–7) … ; kill &lt;pid&gt;; rm -rf /tmp/bb-1603-proddata</pre>''',
    '''bash repro/start-prod-app.sh "$PWD" ; … (steps 2–7) … ; kill &lt;pid&gt;; rm -rf /tmp/bb-1603-proddata
# revision:
bash repro/setup-harness-fresh-test.sh                                   # from-scratch harness into /tmp/bb-1603-wk-fresh
BB1603_HARNESS=/tmp/bb-1603-wk-fresh PLAYWRIGHT_BROWSERS_PATH=/tmp/bb-1603-wk-fresh/browsers bash repro/rerun-fresh-harness.sh "$PWD"
BB1603_HARNESS=/tmp/bb-1603-wk-fresh PLAYWRIGHT_BROWSERS_PATH=/tmp/bb-1603-wk-fresh/browsers bash repro/step7-counter-experiment.sh "$PWD"
bash repro/stop-prod-app.sh ; rm -rf /tmp/bb-1603-wk-fresh</pre>''')

assert s != orig
open(p, "w", encoding="utf-8").write(s)
print("ok", len(s))
