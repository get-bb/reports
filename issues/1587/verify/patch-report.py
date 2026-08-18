p="/tmp/bb-reports/issues/1587.html"
s=open(p).read()
def rep(old,new,count=1):
    global s
    assert old in s, old[:80]
    s=s.replace(old,new,count)

# TL;DR minors: WAF expansion, inference marking
rep("and it sits behind Cloudflare bot management (\"managed challenge\").",
    "and it sits behind Cloudflare bot management (a web application firewall, WAF, rule that issues a \"managed challenge\").")
rep("The reporters (\"usually fails on my machine\", \"same here\") are on networks where the same daemon request is scored badly. I therefore",
    "The reporters (\"usually fails on my machine\", \"same here\") are presumably on networks where the same daemon request is scored badly (inferred, not observed: Cloudflare's per-IP/fingerprint scoring is opaque and the issue does not say). I therefore")
rep("which is not behind that WAF rule.</p>", "which is not behind that WAF rule. Note that the issue body does not quote an error string (it only says \"fails with HTTP 403 due to cloudflare\"); the exact wording shown below is what the code produces on a challenged network, reproduced here by simulation.</p>")

# Environment: dev instance line
rep("<li>Dev instance: app <code>:16862</code>, server <code>:24862</code>, host daemon <code>:32862</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-20-905936e6568b</code>. Started with",
    "<li>Dev instance (original run): app <code>:16862</code>, server <code>:24862</code>, host daemon <code>:32862</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-20-905936e6568b</code>. Revision re-run (step D output below): worktree <code>wf_6b6686dc-4c2-26</code> (same HEAD <code>a108fa7ef</code>), server <code>:25796</code>, host daemon <code>:33796</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_6b6686dc-4c2-26-1b40c9cc9b2f</code>. Both started with")

# Repro intro
rep("to \"the exact CLI error the reporter sees\".", "to \"the CLI error the code produces on a challenged network\" (the issue itself does not quote the error text).")
rep("A request that passes the WAF reaches the app", "A request that passes the WAF (Cloudflare's web application firewall) reaches the app")

# Step D
rep("It logs each intercepted call, which lets us count the daemon's attempts.</p>",
    "It logs each intercepted call, which lets us count the daemon's attempts. Both scripts are configured through the environment: the preload reads <code>CF_PRELOAD_DIR</code> (flag file + log location, default <code>/tmp/bb-1587-preload</code>) and finds <code>cf-challenge-body.html</code> next to itself; the wrapper <a href=\"1587/repro/run-cli-transcribe.sh\">run-cli-transcribe.sh</a> reads <code>WORKTREE</code> (default <code>$PWD</code>), <code>BB_SERVER_URL</code> (required) and the same <code>CF_PRELOAD_DIR</code>. Nothing needs editing.</p>")
rep("<li>Build, then start your dev instance with the preload: <code>export NODE_OPTIONS=\"--import /tmp/bb-reports/issues/1587/repro/cf-challenge-preload.mjs\" &amp;&amp; scripts/bb-dev-app current</code> (the launcher passes the environment to the server and daemon). Confirm <code>curl -s $BB_SERVER_URL/api/v1/system/config</code> shows <code>\"voiceTranscriptionEnabled\":true</code>.</li>",
    "<li>In your built bb worktree, start your dev instance with the preload: <code>export NODE_OPTIONS=\"--import /tmp/bb-reports/issues/1587/repro/cf-challenge-preload.mjs\" &amp;&amp; scripts/bb-dev-app current</code> (the launcher passes the environment to the server and daemon). Then <code>unset NODE_OPTIONS; eval \"$(scripts/bb-dev-app env)\"; export WORKTREE=$PWD</code> and confirm <code>curl -s $BB_SERVER_URL/api/v1/system/config</code> shows <code>\"voiceTranscriptionEnabled\":true</code> (give it ~30 s to boot).</li>")
rep("<li>Baseline (real network): <code>bash /tmp/bb-reports/issues/1587/repro/run-cli-transcribe.sh baseline</code> (the wrapper sets <code>BB_SERVER_URL=http://localhost:24862</code>; edit it for your ports). Expected and actual: <code>{\"text\":\"...\"}</code>.</li>",
    "<li>Baseline (real network): <code>bash /tmp/bb-reports/issues/1587/repro/run-cli-transcribe.sh baseline</code>. Expected and actual: the CLI prints <code>...</code> (the transcript of the 1 s tone, printed as plain text because the wrapper does not pass <code>--json</code>) and <code>exit=0</code>:</li>")
rep("""  <pre>$ bash /tmp/bb-reports/issues/1587/repro/run-cli-transcribe.sh challenge
$ bb voice transcribe tone.mp3 --type audio/mpeg   # mode=challenge
""", """  <pre>$ bash /tmp/bb-reports/issues/1587/repro/run-cli-transcribe.sh baseline
$ bb voice transcribe tone.mp3 --type audio/mpeg   # mode=baseline server=http://localhost:25796
...
exit=0

$ bash /tmp/bb-reports/issues/1587/repro/run-cli-transcribe.sh challenge
$ bb voice transcribe tone.mp3 --type audio/mpeg   # mode=challenge server=http://localhost:25796
""")
rep("""--- daemon fetch calls intercepted by the preload:
2026-08-18T07:39:56.211Z pid=2454664 intercepted POST https://chatgpt.com/backend-api/transcribe cookie="__cf_bm=Fbe73…; __cflb=04dT…; _cfuvid=qwWC…" ua=bb-host-daemon
2026-08-18T07:39:56.211Z pid=2454664 intercepted POST https://chatgpt.com/backend-api/transcribe cookie="__cf_bm=SIMULATED.CHALLENGE.COOKIE-1787038601; __cflb=04dT…; _cfuvid=qwWC…" ua=bb-host-daemon</pre>""",
"""--- daemon fetch calls intercepted by the preload during this run (/tmp/bb-1587-preload/cf-challenge-preload.log):
2026-08-18T14:27:13.470Z pid=3478951 intercepted POST https://chatgpt.com/backend-api/transcribe cookie="__cf_bm=6DH8…; __cflb=04dT…; _cfuvid=zv0y…" ua=bb-host-daemon
2026-08-18T14:27:13.471Z pid=3478951 intercepted POST https://chatgpt.com/backend-api/transcribe cookie="__cf_bm=SIMULATED.CHALLENGE.COOKIE-1787038601; __cflb=04dT…; _cfuvid=zv0y…" ua=bb-host-daemon</pre>""")
rep("<b>Actual:</b> exit 1 with the reporter's error (HTTP 502 wrapping", "<b>Actual:</b> exit 1 with the error the code produces for a challenged request (HTTP 502 wrapping")
rep("""  <pre>@bb/host-daemon:dev: [07:39:56] DEBUG: [host-daemon] Online host RPC {"commandType":"codex.voice.transcribe","errorCode":"codex_request_failed","handlerMs":2.2,"ok":false}
@bb/server:dev:      [07:39:56] WARN: [server] Voice transcription failed {"attempts":1,"durationMs":8,"maxAttempts":2,"model":"codex/gpt-transcribe","reason":"failed"}</pre>""",
"""  <pre>@bb/host-daemon:dev: [14:27:13] DEBUG: [host-daemon] Online host RPC {"serverUrl":"http://127.0.0.1:25796","commandType":"codex.voice.transcribe","errorCode":"codex_request_failed","handlerMs":1.9,"ok":false}
@bb/server:dev:      [14:27:13] WARN: [server] Voice transcription failed {"attempts":1,"durationMs":7,"maxAttempts":2,"model":"codex/gpt-transcribe","reason":"failed"}</pre>""")
rep("Remove the flag file (<code>rm /tmp/bb-reports/issues/1587/repro/FORCE_CF_CHALLENGE</code>) and the same instance transcribes again.</p>",
    "Running <code>run-cli-transcribe.sh baseline</code> again (which removes the flag file <code>/tmp/bb-1587-preload/FORCE_CF_CHALLENGE</code>) makes the same instance transcribe again (<code>...</code>, <code>exit=0</code>). Preload log of the run: <a href=\"1587/repro/cf-challenge-preload.log\">cf-challenge-preload.log</a>.</p>")

# Appendix commands
rep("""export NODE_OPTIONS="--import /tmp/bb-reports/issues/1587/repro/cf-challenge-preload.mjs" &amp;&amp; scripts/bb-dev-app current
curl -s http://localhost:24862/api/v1/system/config   # voiceTranscriptionEnabled: true
pnpm bb:dev voice transcribe /tmp/bb-reports/issues/1587/repro/tone.mp3 --type audio/mpeg --json   # baseline {"text":"..."}
bash repro/run-cli-transcribe.sh challenge
grep -a "Voice transcription failed\\|codex.voice.transcribe" ~/.bb-dev/launchers/projects-bb-.claude-worktrees-wf_242c3e11-a10-20/dev.log""",
"""export NODE_OPTIONS="--import /tmp/bb-reports/issues/1587/repro/cf-challenge-preload.mjs" &amp;&amp; scripts/bb-dev-app current
unset NODE_OPTIONS; eval "$(scripts/bb-dev-app env)"; export WORKTREE=$PWD
curl -s $BB_SERVER_URL/api/v1/system/config   # voiceTranscriptionEnabled: true
bash /tmp/bb-reports/issues/1587/repro/run-cli-transcribe.sh baseline    # "..." exit=0
bash /tmp/bb-reports/issues/1587/repro/run-cli-transcribe.sh challenge   # HTTP 502 ... HTTP 403 ... exit=1
bash /tmp/bb-reports/issues/1587/repro/run-cli-transcribe.sh baseline    # "..." exit=0 again
grep -a "Voice transcription failed\\|codex.voice.transcribe" ~/.bb-dev/launchers/projects-bb-.claude-worktrees-wf_6b6686dc-4c2-26/dev.log""")

# Verification subsection before </main>
verification = """  <h2>Verification</h2>
  <p>An independent verifier followed all five layers (A–E) in a separate worktree at the same HEAD and confirmed every result: waf-probe.sh gave the identical 403/<code>cf-mitigated: challenge</code> vs 401 table; waf-probe-headers.py gave the identical header-combination table and waf-sample.py tallied full-daemon-headers 10/10 200 vs authorization-only 9/10 challenged (7/10 in the original run: the "coin flip"); live-probe-1587.ts 8/8 OK; the dev-instance run reproduced the exact <code>HTTP 502: Codex transcription request failed with HTTP 403: &lt;html&gt;…</code> output with two intercepted daemon fetches, <code>codex_request_failed</code> in the daemon log and <code>attempts:1,maxAttempts:2</code> in the server log; vitest 1 passed / 1 failed at the <code>codex_service_unavailable</code> assertion. All root-cause code excerpts were confirmed at <code>16ceb3a54</code>, and <code>git log 16ceb3a54..origin/main</code> touches none of the files.</p>
  <p><b>Changed in this revision.</b> (1) The verifier's one major finding: <code>run-cli-transcribe.sh</code> and <code>cf-challenge-preload.mjs</code> were hardcoded to the original worktree path, ports and flag/log paths (and the wrapper deleted the preload-log artifact on every run). Both were rewritten to take <code>WORKTREE</code>, <code>BB_SERVER_URL</code> and <code>CF_PRELOAD_DIR</code> from the environment (defaults: <code>$PWD</code>, required, <code>/tmp/bb-1587-preload</code>), the preload locates <code>cf-challenge-body.html</code> relative to itself, and the wrapper only prints the log lines appended during its own run. Step D was then re-run from scratch in a third worktree (<code>wf_6b6686dc-4c2-26</code>, ports 25796/33796) with the new scripts and no manual edits; the baseline / challenge / baseline outputs and log lines shown in step D and <a href="1587/cli-challenge-run.log">cli-challenge-run.log</a> are from that re-run. (2) Minor: step D's baseline expectation now says the CLI prints <code>...</code> (no <code>--json</code>). (3) Minor: "the reporter's error" is now phrased as the error the code produces on a challenged network, with a note that the issue does not quote an error string. (4) Minor: WAF is expanded once, and the per-network bot-score explanation is marked as inferred in the TL;DR.</p>
</main></body>"""
rep("</main></body>", verification)
open(p,"w").write(s)
print("ok")
