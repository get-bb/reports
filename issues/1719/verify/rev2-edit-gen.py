p='/tmp/bb-reports/issues/1719/gen-report.py'; s=open(p).read()
def rep(a,b,count=1):
    global s
    assert a in s, a[:80]
    s=s.replace(a,b,count)

# ---- TL;DR
rep('''For a write, opencode (and any other agent) sends no <code>rawInput.command</code>, and its <code>title</code> is the file path (for a <code>write</code>/<code>edit</code> permission) or the parent directory (for opencode's <code>external_directory</code> permission), so the user is asked "Do you want to run this command? <code>$ /tmp/qa-1719/</code>".''',
'''For a write, opencode (and any other agent) sends no <code>rawInput.command</code>, and its <code>title</code> is the file path (for a <code>write</code>/<code>edit</code> permission, ACP <code>kind: "edit"</code>) or the bare parent directory (for opencode's <code>external_directory</code> permission, which opencode tags ACP <code>kind: "other"</code>), so the user is asked "Do you want to run this command? <code>$ /tmp/qa-1719/notes.md</code>" or "<code>$ /tmp/qa-1719</code>".''')
rep('''Reproduced end-to-end on the base commit with a fake ACP agent registered via <code>customAcpAgents</code> that emits exactly what opencode's ACP layer emits for a write, and with a 1-assertion unit test against the mapping function that fails on main. A ~30-line mapping change (below) makes the same request render as a <code>file_change</code> approval; verified in the app and via <code>bb thread interactions list</code>.</p>''',
'''Reproduced end-to-end on the base commit for <em>both</em> opencode permission shapes with a fake ACP agent registered via <code>customAcpAgents</code> that emits exactly what opencode's ACP layer emits, and with a 2-case unit test against the mapping function that fails on main. A ~70-line mapping change in <code>plugins/provider-acp</code> (below) makes both requests render as a <code>file_change</code> approval, matching what Claude Code produces natively for a write; verified in the app and via <code>bb thread interactions list</code>.</p>''')

# ---- Claims table
rep('''<tr><td>The "command" is a bare directory path</td><td class="ok">Verified (mechanism); exact string is agent-dependent</td><td>The command string is <code>rawInput.command ?? title ?? kind</code> (<a href="{perma('plugins/provider-acp/src/interactions.ts',55,66)}">interactions.ts:55-66</a>). opencode sets <code>rawInput.command</code> only for bash/shell; for <code>write</code>/<code>edit</code> the title is the file path and for <code>external_directory</code> it is <code>parentDir</code>, a bare directory (opencode <code>acp/permission.ts</code>, <code>acp/tool.ts</code>, quoted in Root cause). My repro used title <code>/tmp/qa-1719/</code> and got <code>$ /tmp/qa-1719/</code>. I could not run real opencode (not installed here), so which of the two opencode permissions the reporter hit is unverified; both take the same code path.</td></tr>''',
'''<tr><td>The "command" is a bare directory path</td><td class="ok">Verified</td><td>The command string is <code>rawInput.command ?? title ?? kind</code> (<a href="{perma('plugins/provider-acp/src/interactions.ts',55,66)}">interactions.ts:55-66</a>). opencode sets <code>rawInput.command</code> only for bash/shell. Its <code>write</code>/<code>edit</code> permission has title = file path (ACP kind <code>edit</code>) and yields <code>$ /tmp/qa-1719/notes.md</code>; its <code>external_directory</code> permission (a write outside the project) has title = <code>parentDir</code> and ACP kind <code>other</code> (opencode's <code>toToolKind</code> has no case for it, see <a href="1719/opencode-acp-tool.ts">opencode-acp-tool.ts</a>) and yields exactly the bare directory <code>$ /tmp/qa-1719</code> (repro step 6, second variant; <a href="assets/1719-pending-command-approval-external-directory.png">screenshot</a>). Both variants reproduced against the base commit with a fake agent that mirrors those two shapes; real opencode is not installed here.</td></tr>''')
rep('''<tr><td>Fix is a small mapping change in <code>plugins/provider-acp</code></td><td class="ok">Verified</td><td>Patch in <a href="1719/repro/proposed-fix.patch">1719/repro/proposed-fix.patch</a> (2 files, +33/−1); no server, protocol, or schema change: <code>file_change</code> is already a legal subject in the canonical payload and the wire shape is unchanged.</td></tr>''',
'''<tr><td>Fix is a small mapping change in <code>plugins/provider-acp</code></td><td class="ok">Verified</td><td>Patch in <a href="1719/repro/proposed-fix.patch">1719/repro/proposed-fix.patch</a> (2 files, +72/−1: forward <code>locations</code> in the bridge, classify by kind/locations in the mapping); no server, protocol, or schema change: <code>file_change</code> is already a legal subject in the canonical payload and the wire shape is unchanged. Covers both the <code>edit</code>-kind and the <code>other</code>-kind-with-locations (external_directory) shapes.</td></tr>''')

# ---- Environment
rep('''<li>bb <code>16ceb3a54</code> (main, 2026-08-18) in worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-34</code>. <code>origin/main</code> checked at <code>a108fa7ef</code>: <code>plugins/provider-acp/src/interactions.ts</code> still hard-codes <code>kind: "command"</code>; not fixed.</li>''',
'''<li>bb <code>16ceb3a54</code> (main, 2026-08-18) in worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-5</code> (revision run; the first run used <code>wf_242c3e11-a10-34</code>). <code>origin/main</code> checked at <code>a108fa7ef</code>: <code>git log 16ceb3a54..origin/main -- plugins/provider-acp</code> shows only #1742 and <code>interactions.ts</code> is byte-identical, so not fixed.</li>''')
rep('''<li>Dev instance from this worktree: app <code>http://localhost:16802</code>, server <code>http://localhost:24802</code>, host daemon <code>:32802</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-34-ec42636a32f0</code>. Host <code>host_xbta2sfdkc</code>, project <code>proj_vp9rypyfbf</code> (local path <code>/tmp/qa-1719</code>), bug thread <code>thr_g6thsjvka4</code>, with-fix thread <code>thr_gvgz7qwcd9</code>.</li>''',
'''<li>Dev instance from this worktree: app <code>http://localhost:15048</code>, server <code>http://localhost:23048</code>, host daemon <code>:31048</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_570fde41-63f-5-ac966f501d5e</code> (deleted after the run). Host <code>host_7hwmtt9fc5</code>, project <code>proj_eyzm33avat</code> (local path <code>/tmp/qa-1719</code>). Bug threads: <code>thr_aqrjgmjtqa</code> (write permission), <code>thr_isrbv6ddiw</code> (external_directory permission); native baseline <code>thr_trenkdebtx</code> (Claude Code); with-fix threads <code>thr_eqxyczvh7j</code> / <code>thr_2wrth8z2e5</code>.</li>''')
rep('''<li>Browser: <code>dev-browser --headless</code> (Playwright Chromium), viewport 1400×900.</li>''',
'''<li>Browser: <code>dev-browser --headless</code> (Playwright Chromium), viewport 1400×900 for every screenshot.</li>''')

# ---- Repro A
rep('''It feeds <code>buildAcpPermissionInteractionPayload</code> exactly the tool-call fields the bridge forwards for an opencode write permission: <code>kind: "edit"</code>, a path as <code>title</code>, no <code>command</code>.</p>''',
'''It feeds <code>buildAcpPermissionInteractionPayload</code> the two shapes opencode sends: (1) the <code>write</code>/<code>edit</code> permission, <code>kind: "edit"</code>, file path as <code>title</code>, no <code>command</code>; (2) the <code>external_directory</code> permission, <code>kind: "other"</code>, bare directory as <code>title</code>, <code>locations</code>, no <code>command</code>. (On the base commit <code>AcpPermissionToolCall</code> has no <code>locations</code> field, so case 2 would be a TS excess-property error under <code>tsc</code>; vitest does not typecheck, and the mapping simply ignores the field, which is the point.)</p>''')
rep('''<p>The assertion <code>expect(payload.subject.kind).toBe("file_change")</code> fails with <code>Received: "command"</code>; the full subject produced is <code>{{ kind: "command", itemId: "write-tool-1", command: "/tmp/qa-1719/", cwd: null, actions: [{{ type: "unknown", command: "/tmp/qa-1719/" }}], sessionGrant: null }}</code>.</p>''',
'''<p>Both assertions <code>expect(payload.subject.kind).toBe("file_change")</code> fail with <code>Received: "command"</code>; the subjects produced are <code>{{ kind: "command", itemId: "write-tool-1", command: "/tmp/qa-1719/notes.md", cwd: null, actions: [{{ type: "unknown", command: "/tmp/qa-1719/notes.md" }}], sessionGrant: null }}</code> and the same with <code>"/tmp/qa-1719"</code>.</p>''')

# ---- Repro B step 2
rep('''<li>Take bb's own fake ACP agent (<code>plugins/provider-acp/src/bridge/fake-acp-agent.mjs</code>) and add a branch that answers the prompt <code>opencode-write</code> with what opencode's ACP layer emits for a <code>write</code> tool needing permission (a pending <code>tool_call</code> with <code>kind: "edit"</code>, then <code>session/request_permission</code> with the same tool call: <code>title</code> = path, <code>locations</code> = <code>[{{path}}]</code>, <code>rawInput</code> = <code>{{filePath, content}}</code>, no <code>command</code>; then a <code>tool_call_update</code> with the diff on allow).''',
'''<li>Take bb's own fake ACP agent (<code>plugins/provider-acp/src/bridge/fake-acp-agent.mjs</code>) and add a branch that answers the prompt <code>opencode-write</code> with what opencode's ACP layer emits for a <code>write</code> tool needing permission: a pending <code>tool_call</code> with <code>kind: "edit"</code>, then <code>session/request_permission</code> whose <code>toolCall</code> depends on <code>FAKE_ACP_PERMISSION</code>: <code>write</code> → <code>kind: "edit"</code>, <code>title</code> = file path, <code>locations</code> = <code>[{{path}}]</code>, <code>rawInput</code> = <code>{{filePath, content}}</code>; <code>external_directory</code> → <code>kind: "other"</code>, <code>title</code> = parent directory, <code>locations</code> = <code>[{{file}}, {{parentDir}}]</code>, <code>rawInput</code> = <code>{{filepath, parentDir}}</code>; never a <code>command</code>. On allow it sends a <code>tool_call_update</code> with the diff.''')
rep('''<li>Register it as a custom ACP agent in the dev data dir's <code>config.json</code> (<a href="1719/repro/config.json">1719/repro/config.json</a>; adjust the node path) and reload:
<pre>{cfg}
$ curl -s -X POST $BB_SERVER_URL/api/v1/system/config/reload
{{"ok":true}}
$ pnpm bb:dev provider list        # now lists acp-fakeopencode "Fake opencode (ACP)"</pre></li>''',
'''<li>Register it twice (one entry per permission shape) as custom ACP agents in the dev data dir's <code>config.json</code> (<a href="1719/repro/config.json">1719/repro/config.json</a>; adjust the node path) and reload:
<pre>{cfg}
$ curl -s -X POST $BB_SERVER_URL/api/v1/system/config/reload
{{"ok":true}}
$ node packages/scripts/dist/commands/run-cli.js provider list   # now lists acp-fakeopencode and acp-fakeopencodewrite</pre>
      Note: <code>pnpm bb:dev &lt;cmd&gt;</code> prints turbo's build banner on stdout before the command output, so it cannot be piped into <code>jq</code>/<code>python -m json</code>. Run <code>pnpm bb:dev --help</code> once so the CLI is built, then use <code>node packages/scripts/dist/commands/run-cli.js &lt;cmd&gt;</code> (shown below as <code>$BBCLI</code>) for anything with <code>--json</code>.</li>''')
rep('''HOST=$(pnpm bb:dev machine list --json | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\\\
  -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/qa-1719","hostId":"'$HOST'"}}}}'
# → {{"id":"proj_vp9rypyfbf", ...}}</pre></li>''',
'''BBCLI="node packages/scripts/dist/commands/run-cli.js"
HOST=$($BBCLI machine list --json 2&gt;/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')   # host_7hwmtt9fc5
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\\\
  -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/qa-1719","hostId":"'$HOST'"}}}}'
# → {{"id":"proj_eyzm33avat", ...}}</pre></li>''')
rep('''<li>Spawn a thread on the fake agent in <code>accept-edits</code> (ask) mode with the trigger prompt:
<pre>pnpm bb:dev thread spawn --project proj_vp9rypyfbf --provider acp-fakeopencode \\\\
  --permission-mode accept-edits --title "1719 repro" --prompt "opencode-write please" --json
# → "id": "thr_g6thsjvka4"</pre></li>''',
'''<li>Spawn one thread per fake agent in <code>accept-edits</code> mode with the trigger prompt (<code>--machine</code> is required when the CLI has no remembered host; without it <code>thread spawn</code> fails with <code>HTTP 404: Host not found</code>):
<pre>$BBCLI thread spawn --project proj_eyzm33avat --machine $HOST --provider acp-fakeopencodewrite \\\\
  --permission-mode accept-edits --title "1719 repro (write permission)" --prompt "opencode-write please" --json
# → "id": "thr_aqrjgmjtqa"
$BBCLI thread spawn --project proj_eyzm33avat --machine $HOST --provider acp-fakeopencode \\\\
  --permission-mode accept-edits --title "1719 repro (external_directory permission)" --prompt "opencode-write please" --json
# → "id": "thr_isrbv6ddiw"</pre></li>''')
rep('''    <li><b>Actual</b> — the pending interaction is a <em>command</em> approval whose command is the directory path:
<pre>$ curl -s $BB_SERVER_URL/api/v1/threads/thr_g6thsjvka4/interactions | jq '.[0].payload'
{pend}</pre>
      <b>Expected</b>: <code>subject.kind: "file_change"</code> (as Claude Code and Codex produce for edits), so the app asks "Do you want to make these changes?" and the timeline keeps the row as a file change.</li>''',
'''    <li><b>Actual</b> — both pending interactions are <em>command</em> approvals whose "command" is a path. Write permission (file path):
<pre>$ curl -s $BB_SERVER_URL/api/v1/threads/thr_aqrjgmjtqa/interactions | jq '.[0].payload'
{pend}
$ $BBCLI thread interactions list thr_aqrjgmjtqa
{clilist_bug}</pre>
      external_directory permission (the bare directory from the issue title):
<pre>$ curl -s $BB_SERVER_URL/api/v1/threads/thr_isrbv6ddiw/interactions | jq '.[0].payload'
{pend_ext}
$ $BBCLI thread interactions list thr_isrbv6ddiw
{clilist_ext_bug}</pre>
      <b>Expected</b>: <code>subject.kind: "file_change"</code>, so the app asks "Do you want to make these changes?" and the timeline keeps the row as a file change. For comparison, this is what a native provider produces on the same base commit for the same situation (Claude Code, <code>accept-edits</code>, asked to write <code>/tmp/qa-1719-outside/hello.txt</code>, i.e. outside the workspace; thread <code>thr_trenkdebtx</code>, <a href="1719/repro/interactions-pending-baseline-claude-code.json">raw</a>):
<pre>$ curl -s $BB_SERVER_URL/api/v1/threads/thr_trenkdebtx/interactions | jq '.[0].payload'
{pend_base}</pre>
      <figure><img src="assets/1719-baseline-claude-code-file-change-approval.png" alt="Claude Code file_change approval card"><figcaption><b>Expected rendering (baseline, unpatched base commit, Claude Code).</b> Timeline: "Waiting for approval <b>to edit</b> hello.txt". Card: "Path is outside allowed working directories · Item: … · Session grant: Write 1 path", i.e. a file-change approval, no "$" and no "run this command".</figcaption></figure></li>''')
rep('''    <li>Timeline events for the item (from <code>GET /threads/thr_g6thsjvka4/events</code>, <a href="1719/repro/events-before-approval.json">raw</a>): the agent's own <code>tool_call</code> creates a <code>fileChange</code>, then the approval overwrites the same id as a <code>commandExecution</code>:
<pre>{ev_before}</pre></li>''',
'''    <li>Timeline events for the item (from <code>GET /threads/thr_aqrjgmjtqa/events</code>, <a href="1719/repro/events-before-approval.json">raw</a>): the agent's own <code>tool_call</code> creates a <code>fileChange</code>, then the approval overwrites the same id as a <code>commandExecution</code>:
<pre>{ev_before}</pre>
      Same for the external_directory thread (<a href="1719/repro/events-external-directory-before-approval.json">raw</a>):
<pre>{ev_ext_before}</pre></li>''')
rep('''    <li>Open <code>http://localhost:16802/projects/proj_vp9rypyfbf/threads/thr_g6thsjvka4</code>:
      <figure><img src="assets/1719-pending-command-approval.png" alt="approval card asking to run a directory as a command"><figcaption><b>Bug, the moment it shows.</b> Timeline: "Editing notes.md" (from the ACP tool_call) immediately followed by "Waiting for approval <b>to run</b> /tmp/qa-1719/". Approval card at the bottom: "Do you want to run this command? <code>$ /tmp/qa-1719/</code> · Action: /tmp/qa-1719/". The agent asked to write a file; nothing is being run.</figcaption></figure>
      <figure><img src="assets/1719-approval-card-crop.png" alt="crop of the approval card"><figcaption>Crop of the same card just before I clicked <b>Allow once</b> (the trigger for step 9).</figcaption></figure></li>''',
'''    <li>Open <code>http://localhost:15048/projects/proj_eyzm33avat/threads/thr_aqrjgmjtqa</code> and <code>…/thr_isrbv6ddiw</code>:
      <figure><img src="assets/1719-pending-command-approval.png" alt="approval card asking to run a file path as a command"><figcaption><b>Bug, write permission.</b> Timeline: "Editing notes.md" (from the ACP tool_call) immediately followed by "Waiting for approval <b>to run</b> /tmp/qa-1719/notes.md". Approval card at the bottom: "Do you want to run this command? <code>$ /tmp/qa-1719/notes.md</code> · Action: /tmp/qa-1719/notes.md". The agent asked to write a file; nothing is being run.</figcaption></figure>
      <figure><img src="assets/1719-pending-command-approval-external-directory.png" alt="approval card asking to run a bare directory as a command"><figcaption><b>Bug, external_directory permission: the bare directory from the issue title.</b> "Waiting for approval to run /tmp/qa-1719" and "Do you want to run this command? <code>$ /tmp/qa-1719</code> · Action: /tmp/qa-1719".</figcaption></figure>
      <figure><img src="assets/1719-approval-card-crop.png" alt="crop of the approval card"><figcaption>Crop of the write-permission card just before I clicked <b>Allow once</b> (the trigger for step 9).</figcaption></figure></li>''')
rep('''<li>Click <b>Allow once</b>. After approval the agent's <code>tool_call_update</code> arrives''','''<li>Click <b>Allow once</b> on the write-permission thread. After approval the agent's <code>tool_call_update</code> arrives''')

# ---- Root cause
rep('''<p><b>Why the text is a path.</b> On the opencode side (fetched from <code>anomalyco/opencode</code> main, saved as <a href="1719/opencode-acp-permission.ts">1719/opencode-acp-permission.ts</a> and <a href="1719/opencode-acp-tool.ts">1719/opencode-acp-tool.ts</a>), <code>rawInput</code> only gains a <code>.command</code> for bash/shell, <code>write</code>/<code>edit</code> map to ACP <code>kind: "edit"</code>, and the title is the file path, or, for the <code>external_directory</code> permission that guards writes outside the project, <code>parentDir</code>, a bare directory:</p>''',
'''<p><b>Why the text is a path.</b> On the opencode side (fetched from <code>anomalyco/opencode</code> main, saved as <a href="1719/opencode-acp-permission.ts">1719/opencode-acp-permission.ts</a> and <a href="1719/opencode-acp-tool.ts">1719/opencode-acp-tool.ts</a>), <code>rawInput</code> only gains a <code>.command</code> for bash/shell; <code>write</code>/<code>edit</code> map to ACP <code>kind: "edit"</code> with the file path as title; and the <code>external_directory</code> permission that guards writes outside the project has title <code>parentDir</code> (a bare directory) and, because <code>toToolKind</code> has no case for <code>external_directory</code>, ACP <code>kind: "other"</code>. That last point matters for the fix: a kind-only classifier (<code>edit</code>/<code>delete</code>/<code>move</code>) would still show the bare-directory variant as a command approval; the <code>locations</code> array (<code>[file, parentDir]</code>) is the only signal that it is a file write.</p>''')
rep('''    case "edit": case "apply_patch": case "patch": case "write": return "edit"
    ...
  }
}''','''    case "edit": case "apply_patch": case "patch": case "write": return "edit"
    ...                                        // no case for "external_directory"
    default: return "other"                    // <- external_directory permission => kind "other"
  }
}''')

# ---- Proposed fix
rep('''<p>Classify write-ish ACP permission requests as <code>file_change</code> subjects at the mapping and forward the tool call's <code>locations</code> so the subject can carry a path. Patch (applied and verified in this worktree; <a href="1719/repro/proposed-fix.patch">1719/repro/proposed-fix.patch</a>):</p>''',
'''<p>Classify write-ish ACP permission requests as <code>file_change</code> subjects at the mapping and forward the tool call's <code>locations</code> so the subject can carry a path and so unclassified (<code>other</code>/no-kind) permissions that name filesystem locations, opencode's <code>external_directory</code>, are covered too. Patch (applied and verified in this worktree; <a href="1719/repro/proposed-fix.patch">1719/repro/proposed-fix.patch</a>):</p>''')
rep('''  <p>Result with the patch (same fake agent, thread <code>thr_gvgz7qwcd9</code>):</p>
  <pre>$ curl -s $BB_SERVER_URL/api/v1/threads/thr_gvgz7qwcd9/interactions | jq '.[0].payload'
{pendfix}
$ pnpm bb:dev thread interactions list thr_gvgz7qwcd9
{clilist_fix}
# timeline items before approval: both rows are fileChange now
{ev_fix}</pre>
  <figure><img src="assets/1719-with-fix-file-change-approval.png" alt="approval card with fix"><figcaption>With the patch: "Waiting for approval <b>to edit</b> notes.md" and the card reads "Do you want to make these changes? Item: write-tool-1 · Write root: /tmp/qa-1719/notes.md".</figcaption></figure>''',
'''  <pre>$ cd plugins/provider-acp &amp;&amp; pnpm exec vitest run src/interactions.repro-1719.test.ts src/interactions.test.ts src/bridge/bridge.test.ts
{testsfix}
$ pnpm exec turbo run typecheck --filter=bb-plugin-provider-acp --force   # 1 successful</pre>
  <p>Result with the patch (dev instance restarted so the host daemon reloads the plugin; same fake agents). Write permission, thread <code>thr_eqxyczvh7j</code>:</p>
  <pre>$ curl -s $BB_SERVER_URL/api/v1/threads/thr_eqxyczvh7j/interactions | jq '.[0].payload'
{pendfix}
$ $BBCLI thread interactions list thr_eqxyczvh7j
{clilist_fix}
# timeline items before approval: both rows are fileChange now
{ev_fix}</pre>
  <p>external_directory permission, thread <code>thr_2wrth8z2e5</code> (the bare-directory variant):</p>
  <pre>$ curl -s $BB_SERVER_URL/api/v1/threads/thr_2wrth8z2e5/interactions | jq '.[0].payload'
{pendfix_ext}
$ $BBCLI thread interactions list thr_2wrth8z2e5
{clilist_fix_ext}
$ $BBCLI thread interactions approve pint_q9jyg7t6ui thr_2wrth8z2e5
# timeline items after approval (raw: 1719/repro/events-with-fix-external-directory-after-approval.json)
{ev_fix_ext_after}</pre>
  <figure><img src="assets/1719-with-fix-file-change-approval.png" alt="approval card with fix, write permission"><figcaption>With the patch, write permission: "Waiting for approval <b>to edit</b> notes.md" and the card reads "Do you want to make these changes? Item: write-tool-1 · Write root: /tmp/qa-1719/notes.md".</figcaption></figure>
  <figure><img src="assets/1719-with-fix-file-change-approval-external-directory.png" alt="approval card with fix, external_directory permission"><figcaption>With the patch, external_directory permission: same card, "Write root: /tmp/qa-1719" (the containing location). Compare with the Claude Code baseline above.</figcaption></figure>''')
rep('''    <li><b><code>writeScope</code> semantics:</b> Codex fills it with a <em>grant root</em> (a directory) and the UI labels it "Write root". Using the first location (a file path) is informative but slightly mislabelled; passing <code>dirname(location)</code> or <code>null</code> are the alternatives. Since the ACP <code>tool_call</code> already put the concrete path(s) into the timeline's <code>fileChange</code> item, <code>null</code> is defensible; I kept the path so the approval card is not empty. Reviewer's call.</li>
    <li><b>Kinds:</b> I classify <code>edit</code>, <code>delete</code>, <code>move</code>. <code>read</code>/<code>search</code>/<code>fetch</code>/<code>other</code> keep the command fallback (still mislabelled "run this command" for e.g. a webfetch URL; a follow-up could add a <code>permission_grant</code> or a neutral subject, but that is outside this issue).</li>''',
'''    <li><b><code>writeScope</code> semantics:</b> Codex fills it with a <em>grant root</em> (a directory) and the UI labels it "Write root"; Claude Code passes <code>null</code> and carries the paths in <code>sessionGrant</code> (see baseline JSON above). The patch uses the location that contains all others (so <code>[file, parentDir]</code> → <code>parentDir</code>), else the first location, which is a file path for the write/edit shape and therefore slightly mislabelled; <code>dirname(location)</code> or <code>null</code> are the alternatives. Since the ACP <code>tool_call</code> already put the concrete path(s) into the timeline's <code>fileChange</code> item, <code>null</code> is defensible; I kept the path so the approval card is not empty. Reviewer's call.</li>
    <li><b>Classification:</b> <code>edit</code>/<code>delete</code>/<code>move</code> kinds are file changes; so is an <code>other</code>/no-kind permission that names <code>locations</code> and has no shell command (opencode's <code>external_directory</code>). <code>read</code>/<code>search</code>/<code>fetch</code>, and <code>other</code> without locations, keep the command fallback (still mislabelled "run this command" for e.g. a webfetch URL; a follow-up could add a <code>permission_grant</code> or a neutral subject, but that is outside this issue). Risk: an agent that tags a non-write tool <code>other</code> and attaches file locations (e.g. a custom "lint these files" tool) would be shown as a file change; that is still closer to the truth than "run this command".</li>
    <li><b>Timeline materialisation detail:</b> the server's <code>file_change</code> branch emits <code>fileChange {{changes: []}}</code> for the pending item (see events above); because it reuses the ACP tool-call id the row still shows "to edit notes.md" from the earlier <code>tool_call</code>, and the post-approval update fills the diff. Not a regression, but a reason to consider carrying <code>locations</code> into that item in a follow-up.</li>''')
rep('''<code>bridge.test.ts</code> (75 tests across the three files) still passes with the patch; <code>turbo run typecheck --filter=bb-plugin-provider-acp</code> passes.</li>''',
'''<code>bridge.test.ts</code> (76 tests across the three files, including the 2 repro cases) passes with the patch; <code>turbo run typecheck --filter=bb-plugin-provider-acp --force</code> passes.</li>''')

# ---- Appendix
rep('''    <li><a href="1719/repro/project-create.json">project-create.json</a>, <a href="1719/repro/spawn.json">spawn.json</a>, <a href="1719/repro/interactions-pending.json">interactions-pending.json</a>, <a href="1719/repro/events-before-approval.json">events-before-approval.json</a>, <a href="1719/repro/events-after-approval.json">events-after-approval.json</a></li>
    <li>With fix: <a href="1719/repro/proposed-fix.patch">proposed-fix.patch</a>, <a href="1719/repro/interactions-pending-with-fix.json">interactions-pending-with-fix.json</a>, <a href="1719/repro/events-with-fix-before-approval.json">events-with-fix-before-approval.json</a>, <a href="1719/repro/cli-interactions-list-with-fix.txt">cli-interactions-list-with-fix.txt</a></li>
    <li>Browser scripts: <a href="1719/repro/browser-approve.js">browser-approve.js</a>, <a href="1719/repro/browser-with-fix.js">browser-with-fix.js</a>; opencode sources consulted: <a href="1719/opencode-acp-permission.ts">opencode-acp-permission.ts</a>, <a href="1719/opencode-acp-tool.ts">opencode-acp-tool.ts</a></li>''',
'''    <li>Bug, write permission: <a href="1719/repro/project-create.json">project-create.json</a>, <a href="1719/repro/spawn.json">spawn.json</a>, <a href="1719/repro/interactions-pending.json">interactions-pending.json</a>, <a href="1719/repro/cli-interactions-list-bug.txt">cli-interactions-list-bug.txt</a>, <a href="1719/repro/events-before-approval.json">events-before-approval.json</a>, <a href="1719/repro/events-after-approval.json">events-after-approval.json</a></li>
    <li>Bug, external_directory permission: <a href="1719/repro/spawn-external-directory.json">spawn-external-directory.json</a>, <a href="1719/repro/interactions-pending-external-directory.json">interactions-pending-external-directory.json</a>, <a href="1719/repro/cli-interactions-list-external-directory-bug.txt">cli-interactions-list-external-directory-bug.txt</a>, <a href="1719/repro/events-external-directory-before-approval.json">events-external-directory-before-approval.json</a></li>
    <li>Native baseline (Claude Code): <a href="1719/repro/spawn-baseline-claude-code.json">spawn-baseline-claude-code.json</a>, <a href="1719/repro/interactions-pending-baseline-claude-code.json">interactions-pending-baseline-claude-code.json</a>, <a href="1719/repro/browser-baseline-claude-code.js">browser-baseline-claude-code.js</a></li>
    <li>With fix: <a href="1719/repro/proposed-fix.patch">proposed-fix.patch</a>, <a href="1719/repro/tests-with-fix.txt">tests-with-fix.txt</a>, <a href="1719/repro/typecheck-with-fix.txt">typecheck-with-fix.txt</a>, <a href="1719/repro/spawn-with-fix.json">spawn-with-fix.json</a>, <a href="1719/repro/spawn-with-fix-external-directory.json">spawn-with-fix-external-directory.json</a>, <a href="1719/repro/interactions-pending-with-fix.json">interactions-pending-with-fix.json</a>, <a href="1719/repro/interactions-pending-with-fix-external-directory.json">interactions-pending-with-fix-external-directory.json</a>, <a href="1719/repro/events-with-fix-before-approval.json">events-with-fix-before-approval.json</a>, <a href="1719/repro/events-with-fix-external-directory-before-approval.json">events-with-fix-external-directory-before-approval.json</a>, <a href="1719/repro/events-with-fix-external-directory-after-approval.json">events-with-fix-external-directory-after-approval.json</a>, <a href="1719/repro/cli-interactions-list-with-fix.txt">cli-interactions-list-with-fix.txt</a>, <a href="1719/repro/cli-interactions-list-with-fix-external-directory.txt">cli-interactions-list-with-fix-external-directory.txt</a></li>
    <li>Browser scripts: <a href="1719/repro/browser-approve.js">browser-approve.js</a>, <a href="1719/repro/browser-with-fix.js">browser-with-fix.js</a>; opencode sources consulted: <a href="1719/opencode-acp-permission.ts">opencode-acp-permission.ts</a>, <a href="1719/opencode-acp-tool.ts">opencode-acp-tool.ts</a>, <a href="1719/opencode-tool-external-directory.ts">opencode-tool-external-directory.ts</a></li>''')
rep('''cd plugins/provider-acp &amp;&amp; pnpm exec vitest run src/interactions.repro-1719.test.ts        # FAILS on base (expected)
scripts/bb-dev-app current; scripts/bb-dev-app env
# write config.json (customAcpAgents) into the dev data dir; curl -X POST $BB_SERVER_URL/api/v1/system/config/reload
pnpm bb:dev provider list; pnpm bb:dev machine list --json
curl -X POST $BB_SERVER_URL/api/v1/projects ... /tmp/qa-1719
pnpm bb:dev thread spawn --project proj_vp9rypyfbf --provider acp-fakeopencode --permission-mode accept-edits --prompt "opencode-write please" --json
curl $BB_SERVER_URL/api/v1/threads/thr_g6thsjvka4/interactions ; curl .../events
dev-browser --browser bb1719 --headless  (goto thread, screenshot, click "Allow once", screenshot)
# apply proposed-fix.patch; pnpm exec vitest run src/interactions.repro-1719.test.ts src/interactions.test.ts src/bridge/bridge.test.ts  → 75 passed
pnpm exec turbo run typecheck --filter=bb-plugin-provider-acp; scripts/bb-dev-app current  (restart)
pnpm bb:dev thread spawn ... --title "1719 with fix" ...; curl .../thr_gvgz7qwcd9/interactions
pnpm bb:dev thread interactions list thr_gvgz7qwcd9; pnpm bb:dev thread interactions approve pint_tcfypn8emz thr_gvgz7qwcd9
pnpm dev:stop</pre>''',
'''cd plugins/provider-acp &amp;&amp; pnpm exec vitest run src/interactions.repro-1719.test.ts        # 2 FAIL on base (expected)
scripts/bb-dev-app current; scripts/bb-dev-app env      # app :15048, server :23048, host :31048
cp 1719/repro/config.json $DATA_DIR/config.json; curl -X POST $BB_SERVER_URL/api/v1/system/config/reload
BBCLI="node packages/scripts/dist/commands/run-cli.js"; $BBCLI provider list; $BBCLI machine list --json
curl -X POST $BB_SERVER_URL/api/v1/projects ... /tmp/qa-1719                            # proj_eyzm33avat
$BBCLI thread spawn --project proj_eyzm33avat --machine host_7hwmtt9fc5 --provider acp-fakeopencodewrite --permission-mode accept-edits --prompt "opencode-write please" --json   # thr_aqrjgmjtqa
$BBCLI thread spawn ... --provider acp-fakeopencode ...                                                                                                             # thr_isrbv6ddiw
curl $BB_SERVER_URL/api/v1/threads/{{thr_aqrjgmjtqa,thr_isrbv6ddiw}}/interactions ; curl .../events ; $BBCLI thread interactions list ...
dev-browser --browser bb1719r2 --headless  (goto both threads, screenshot 1400x900, click "Allow once" on the write thread, screenshot)
$BBCLI thread spawn ... --provider claude-code --permission-mode accept-edits --prompt "Use the Write tool to create the file /tmp/qa-1719-outside/hello.txt ..." --json   # thr_trenkdebtx (native baseline)
curl .../thr_trenkdebtx/interactions ; dev-browser screenshot ; $BBCLI thread interactions deny pint_jtbseqas22 thr_trenkdebtx
git apply 1719/repro/proposed-fix.patch; pnpm exec vitest run src/interactions.repro-1719.test.ts src/interactions.test.ts src/bridge/bridge.test.ts  → 76 passed
pnpm exec turbo run typecheck --filter=bb-plugin-provider-acp --force; scripts/bb-dev-app current  (restart)
$BBCLI thread spawn ... acp-fakeopencodewrite ...   # thr_eqxyczvh7j ;  $BBCLI thread spawn ... acp-fakeopencode ...   # thr_2wrth8z2e5
curl .../interactions ; $BBCLI thread interactions list ... ; $BBCLI thread interactions approve pint_9bcixqii5u thr_eqxyczvh7j ; approve pint_q9jyg7t6ui thr_2wrth8z2e5
git fetch origin main; git log 16ceb3a54..origin/main -- plugins/provider-acp   # only #1742; interactions.ts unchanged
pnpm dev:stop; rm -rf $DATA_DIR /tmp/qa-1719 /tmp/qa-1719-outside; ss -ltn | grep -E '15048|23048|31048'  # nothing</pre>
  <h3>Verification</h3>
  <p>An independent verifier followed both repro paths in a fresh worktree at <code>16ceb3a54</code> (own dev instance, app :18882) and confirmed: the unit test fails on base exactly as shown; the fake-agent E2E yields <code>subject.kind "command"</code> with a path as command, the fileChange → commandExecution flip in the events, and the "Do you want to run this command? $ /tmp/qa-1719/" card; the patch passes the ACP tests and typecheck; the code excerpts match the base commit; and the fix is not on <code>origin/main</code>. Findings and what changed in this revision:</p>
  <ul>
    <li><b>Major:</b> the first revision's patch classified only ACP kinds <code>edit</code>/<code>delete</code>/<code>move</code>, but opencode's <code>external_directory</code> permission, the one that produces a <em>bare directory</em> title, arrives with kind <code>other</code>, so the variant matching the issue title would still have rendered as a command approval; and the first fake agent emitted a hybrid (kind <code>edit</code> + directory title) that opencode never sends. Fixed: the fake agent now emits the two real opencode shapes (<code>FAKE_ACP_PERMISSION=write|external_directory</code>), both were reproduced separately on base (threads <code>thr_aqrjgmjtqa</code>, <code>thr_isrbv6ddiw</code>; new artifacts and screenshot), the unit test has a case per shape, and the patch also classifies <code>other</code>/no-kind permissions with <code>locations</code> and no command as <code>file_change</code>, choosing the containing location as <code>writeScope</code>. Both variants verified with the patch in the app, API and CLI. Root cause and Claims now say explicitly that <code>external_directory</code> is kind <code>other</code>.</li>
    <li><b>Minor:</b> <code>HOST=$(pnpm bb:dev machine list --json | python3 …)</code> did not work as written (turbo banner on stdout). Fixed: the repro uses <code>node packages/scripts/dist/commands/run-cli.js</code> and says why; also documented that <code>thread spawn</code> needs <code>--machine</code> when no host is remembered.</li>
    <li><b>Minor:</b> no baseline of a native file-change approval and the with-fix shot was 1280×720. Fixed: added a real Claude Code <code>file_change</code> approval on the unpatched base commit (JSON + screenshot) as the expected rendering, and re-captured every screenshot at 1400×900.</li>
  </ul>''')
open(p,'w').write(s)
print("ok")
