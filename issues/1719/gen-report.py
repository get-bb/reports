import html, json, re
R='/tmp/bb-reports/issues/1719/repro/'
def esc(p): return html.escape(open(p).read())
test=esc(R+'interactions.repro-1719.test.ts')
testout=html.escape(re.sub(r'\x1b\[[0-9;]*m','',open(R+'unit-test-output.txt').read()))
fix=esc(R+'proposed-fix.patch')
agentdiff=esc(R+'fake-agent.diff')
cfg=esc(R+'config.json')
pend=html.escape(json.dumps(json.load(open(R+'interactions-pending.json'))[0]['payload'],indent=1))
pendfix=html.escape(json.dumps(json.load(open(R+'interactions-pending-with-fix.json'))[0]['payload'],indent=1))
pend_ext=html.escape(json.dumps(json.load(open(R+'interactions-pending-external-directory.json'))[0]['payload'],indent=1))
pendfix_ext=html.escape(json.dumps(json.load(open(R+'interactions-pending-with-fix-external-directory.json'))[0]['payload'],indent=1))
pend_base=html.escape(json.dumps(json.load(open(R+'interactions-pending-baseline-claude-code.json'))[0]['payload'],indent=1))
testsfix=html.escape("\n".join(re.sub(r'\x1b\[[0-9;]*m','',open(R+'tests-with-fix.txt').read()).strip().splitlines()[-4:]))
clilist_bug=esc(R+'cli-interactions-list-bug.txt'); clilist_ext_bug=esc(R+'cli-interactions-list-external-directory-bug.txt'); clilist_fix_ext=esc(R+'cli-interactions-list-with-fix-external-directory.txt')
def items(p):
    d=json.load(open(p)); out=[]
    for e in d:
        t=e.get('type'); data=e.get('data',{}); item=data.get('item') if isinstance(data,dict) else None
        if t.startswith('item/') and item: out.append(f"{t}  {json.dumps(item)}")
    return html.escape("\n".join(out))
ev_before=items(R+'events-before-approval.json'); ev_after=items(R+'events-after-approval.json'); ev_fix=items(R+'events-with-fix-before-approval.json'); ev_ext_before=items(R+'events-external-directory-before-approval.json'); ev_fix_ext_after=items(R+'events-with-fix-external-directory-after-approval.json')
clilist_fix=esc(R+'cli-interactions-list-with-fix.txt')
opencode_perm=html.escape('''// packages/opencode/src/acp/permission.ts (anomalyco/opencode, main)
const result = await this.input.connection.requestPermission({
  sessionId: permission.sessionID,
  toolCall: await permissionToolCall({
    toolCallId: permission.tool?.callID ?? permission.id,
    toolName: permission.permission,      // "write" | "edit" | "external_directory" | ...
    input: permission.metadata,
  }),
  options: permissionOptions,
})
...
function permissionTitle(toolName, input) {
  switch (tool) {
    case "external_directory":
      return stringValue(input.description) ?? stringValue(input.command) ?? stringValue(input.parentDir)  // <- bare directory
    ...
    case "read": case "edit": case "write":
      return editTitle(input)             // <- relative/absolute file path
  }
}
// packages/opencode/src/acp/tool.ts
export function toToolKind(toolName) {
  switch (tool) {
    case "bash": case "shell": return "execute"
    case "edit": case "apply_patch": case "patch": case "write": return "edit"
    ...                                        // no case for "external_directory"
    default: return "other"                    // <- external_directory permission => kind "other"
  }
}
function rawInput(toolName, input, cwd) {
  if (!isShell(toolName)) return input   // <- only bash/shell rawInput has `.command`
  ...
}''')
base='16ceb3a540f81c1189efaffb27a39b1d9443abf5'
def perma(path,a,b): return f'https://github.com/get-bb/bb/blob/{base}/{path}#L{a}-L{b}'
src_interactions=html.escape('''function buildOpaqueAcpPermissionCommand(toolCall: {
  command?: string | undefined;
  title?: string | undefined;
  kind?: string | undefined;
}): string {
  return (
    toOptionalString(toolCall.command) ??
    toOptionalString(toolCall.title) ??      // <- for a write: the file/dir path
    toolCall.kind ??
    "ACP permission request"
  );
}

/** The canonical approval payload for an ACP `session/request_permission`. */
export function buildAcpPermissionInteractionPayload(args: {
  toolCall: AcpPermissionToolCall | undefined;
  options: readonly { kind: AcpPermissionOptionKind }[];
}): PendingInteractionPayload {
  const toolCall = args.toolCall;
  const command = toolCall
    ? buildOpaqueAcpPermissionCommand(toolCall)
    : "ACP permission request";
  return {
    kind: "approval",
    subject: {
      kind: "command",                        // <- always, regardless of toolCall.kind
      itemId: toolCall?.toolCallId ?? "acp-permission",
      command,
      cwd: null,
      actions: [{ type: "unknown", command }],
      sessionGrant: null,
    },
    reason: null,
    availableDecisions: buildAcpApprovalDecisions(args.options),
  };
}''')
src_bridge=html.escape('''  const toolCall = parsed.data.toolCall;
  const rawInputCommand = acpRawInputCommandSchema.safeParse(
    toolCall?.rawInput,
  );
  const normalizedToolCall = toolCall?.toolCallId
    ? {
        toolCallId: toolCall.toolCallId,
        ...(toolCall.title ? { title: toolCall.title } : {}),
        ...(toolCall.kind ? { kind: toolCall.kind } : {}),   // kind is forwarded but never used for classification
        ...(rawInputCommand.success
          ? { command: rawInputCommand.data.command }
          : {}),
        // toolCall.locations / content (diff) are dropped here
      }
    : undefined;''')
src_timeline=html.escape('''  switch (subject.kind) {
    case "command":
      appendApprovalItemEvent(deps, interaction, {
        type: "commandExecution",
        id: subject.itemId,        // == ACP toolCallId, same id the edit tool_call already used
        command: subject.command,  // == "/tmp/qa-1719/"
        cwd: subject.cwd ?? "",
        status,
        approvalStatus,
      });
      return;
    case "file_change":
      appendApprovalItemEvent(deps, interaction, {
        type: "fileChange",
        id: subject.itemId,
        changes: [],
        status,
        approvalStatus,
      });
      return;''')

doc=f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Report · #1719 ACP file-write approvals present as command approvals</title>
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
  .pill.low {{ background:#eef; }}
  .verdict {{ font-weight:600; }}
  .v-repro {{ color:var(--ok); }}
  .v-partial {{ color:var(--warn); }}
  table {{ border-collapse:collapse; width:100%; font-size:14px; }} td,th {{ text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
  code, pre {{ font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:13px; }} pre {{ background:#fff; border:1px solid var(--line); border-radius:6px; padding:12px; overflow:auto; }}
  a {{ color:var(--accent); }}
  .ok {{ color:var(--ok); font-weight:600; }} .no {{ color:var(--high); font-weight:600; }} .unv {{ color:var(--warn); font-weight:600; }}
  figure {{ margin:16px 0; }} figure img {{ max-width:100%; border:1px solid var(--line); border-radius:6px; }} figcaption {{ font-size:13px; color:var(--muted); margin-top:4px; }}
</style>
</head>
<body><main>
  <p class="meta"><a href="../">← reports</a></p>
  <h1>#1719 · ACP file-write approvals present as command approvals carrying a bare directory path</h1>
  <p class="meta">
    <span class="pill">Bug</span> <span class="pill low">Low</span> <span class="pill">Effort: Small</span>
    <span class="pill">providers</span> <span class="pill">provider-acp</span>
    <a href="https://github.com/get-bb/bb/issues/1719">open on GitHub</a>
    <span>2026-08-18</span>
    <span>base <code>{base}</code> (main)</span>
  </p>
  <p class="meta">
    <span class="verdict v-repro">Verdict: REPRODUCED</span>
    <span>· root-cause confidence: <b>high</b></span>
    <span>· linked open PRs: none</span>
  </p>

  <h2>TL;DR</h2>
  <p><b>Plain-language framing.</b> bb can drive third-party coding agents over ACP (Agent Client Protocol). When such an agent wants to do something that needs the user's OK, it sends bb a <code>session/request_permission</code> message that includes a description of the tool call: an id, a <code>title</code>, a <code>kind</code> (<code>execute</code>, <code>edit</code>, <code>read</code>, …), file <code>locations</code>, and the raw tool input. bb's ACP bridge (<code>plugins/provider-acp</code>) turns that into a canonical "pending interaction" that the app, the CLI and the SDK render. Pending interactions have a <em>subject kind</em>: <code>command</code> ("Do you want to run this command?"), <code>file_change</code> ("Do you want to make these changes?"), <code>permission_grant</code>, or <code>plan</code>.</p>
  <p>The bridge ignores the ACP tool call's <code>kind</code> and <code>locations</code> entirely and always builds a <code>command</code> subject whose <code>command</code> string is <code>rawInput.command ?? title ?? kind</code>. For a write, opencode (and any other agent) sends no <code>rawInput.command</code>, and its <code>title</code> is the file path (for a <code>write</code>/<code>edit</code> permission, ACP <code>kind: "edit"</code>) or the bare parent directory (for opencode's <code>external_directory</code> permission, which opencode tags ACP <code>kind: "other"</code>), so the user is asked "Do you want to run this command? <code>$ /tmp/qa-1719/notes.md</code>" or "<code>$ /tmp/qa-1719</code>". The server materialises a <code>command</code> subject as a <code>commandExecution</code> timeline item using the ACP tool-call id, so the row that the agent's own <code>tool_call</code> notification had just started as a <code>fileChange</code> ("Editing notes.md") flips to "Waiting for approval to run /tmp/qa-1719/notes.md" (or "… /tmp/qa-1719"), and flips back to a <code>fileChange</code> only when the agent's post-approval <code>tool_call_update</code> arrives with the diff. Approval/denial itself works; only the presentation is wrong.</p>
  <p>Reproduced end-to-end on the base commit for <em>both</em> opencode permission shapes with a fake ACP agent registered via <code>customAcpAgents</code> that emits exactly what opencode's ACP layer emits, and with a 2-case unit test against the mapping function that fails on main. A ~70-line mapping change in <code>plugins/provider-acp</code> (below) makes both requests render as a <code>file_change</code> approval, matching what Claude Code produces natively for a write; verified in the app and via <code>bb thread interactions list</code>.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>ACP file-write permission renders as a <em>command</em> interaction</td><td class="ok">Verified</td><td><code>GET /api/v1/threads/&lt;id&gt;/interactions</code> returns <code>subject.kind: "command"</code> for a <code>kind: "edit"</code> ACP permission (repro step 6). App shows "Do you want to run this command?" (<a href="assets/1719-pending-command-approval.png">screenshot</a>). Mapping at <a href="{perma('plugins/provider-acp/src/interactions.ts',69,90)}">interactions.ts:69-90</a> hard-codes <code>kind: "command"</code>.</td></tr>
    <tr><td>The "command" is a bare directory path</td><td class="ok">Verified</td><td>The command string is <code>rawInput.command ?? title ?? kind</code> (<a href="{perma('plugins/provider-acp/src/interactions.ts',55,66)}">interactions.ts:55-66</a>). opencode sets <code>rawInput.command</code> only for bash/shell. Its <code>write</code>/<code>edit</code> permission has title = file path (ACP kind <code>edit</code>) and yields <code>$ /tmp/qa-1719/notes.md</code>; its <code>external_directory</code> permission (a write outside the project) has title = <code>parentDir</code> and ACP kind <code>other</code> (opencode's <code>toToolKind</code> has no case for it, see <a href="1719/opencode-acp-tool.ts">opencode-acp-tool.ts</a>) and yields exactly the bare directory <code>$ /tmp/qa-1719</code> (repro step 6, second variant; <a href="assets/1719-pending-command-approval-external-directory.png">screenshot</a>). Both variants reproduced against the base commit with a fake agent that mirrors those two shapes; real opencode is not installed here.</td></tr>
    <tr><td>Timeline shows the item as <code>commandExecution</code> until approval upgrades it to <code>fileChange</code></td><td class="ok">Verified</td><td>Event dump before approval: <code>item/started fileChange write-tool-1</code> (from the ACP <code>tool_call</code>) followed by <code>item/started commandExecution write-tool-1 command="/tmp/qa-1719/notes.md" approvalStatus=waiting_for_approval</code>; after Allow once: <code>item/completed fileChange write-tool-1</code> with the diff. Same item id, so the UI row flips type twice. Server side: <a href="{perma('apps/server/src/services/interactions/pending-interaction-timeline.ts',220,249)}">pending-interaction-timeline.ts:220-249</a>.</td></tr>
    <tr><td>The approval itself works</td><td class="ok">Verified</td><td>Allow once in the app and <code>bb thread interactions approve</code> both settle the ACP request (agent echoed <code>permission:once</code>; fileChange completed with diff).</td></tr>
    <tr><td>Fix is a small mapping change in <code>plugins/provider-acp</code></td><td class="ok">Verified</td><td>Patch in <a href="1719/repro/proposed-fix.patch">1719/repro/proposed-fix.patch</a> (2 files, +72/−1: forward <code>locations</code> in the bridge, classify by kind/locations in the mapping); no server, protocol, or schema change: <code>file_change</code> is already a legal subject in the canonical payload and the wire shape is unchanged. Covers both the <code>edit</code>-kind and the <code>other</code>-kind-with-locations (external_directory) shapes.</td></tr>
    <tr><td>Observed with opencode; pre-existing</td><td class="unv">Unverified (opencode) / Verified (pre-existing)</td><td>opencode is not installed on this machine, so I reproduced with a fake ACP agent that mirrors opencode's ACP output. The identical mapping existed before #1640 in <code>packages/agent-runtime/src/acp/adapter.ts</code> (<code>git show c5b53caab^:packages/agent-runtime/src/acp/adapter.ts</code>, ~L1531-1550) and is unchanged on <code>origin/main</code> today.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18) in worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_570fde41-63f-5</code> (revision run; the first run used <code>wf_242c3e11-a10-34</code>). <code>origin/main</code> checked at <code>a108fa7ef</code>: <code>git log 16ceb3a54..origin/main -- plugins/provider-acp</code> shows only #1742 and <code>interactions.ts</code> is byte-identical, so not fixed.</li>
    <li>Linux 7.0.0-29-generic (Ubuntu), node v24.18.0. Providers on the machine: codex, claude-code, pi, acp-cursor, acp-grok; opencode is <b>not</b> installed, so the ACP agent is a fake (see below).</li>
    <li>Dev instance from this worktree: app <code>http://localhost:15048</code>, server <code>http://localhost:23048</code>, host daemon <code>:31048</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_570fde41-63f-5-ac966f501d5e</code> (deleted after the run). Host <code>host_7hwmtt9fc5</code>, project <code>proj_eyzm33avat</code> (local path <code>/tmp/qa-1719</code>). Bug threads: <code>thr_aqrjgmjtqa</code> (write permission), <code>thr_isrbv6ddiw</code> (external_directory permission); native baseline <code>thr_trenkdebtx</code> (Claude Code); with-fix threads <code>thr_eqxyczvh7j</code> / <code>thr_2wrth8z2e5</code>.</li>
    <li>Browser: <code>dev-browser --headless</code> (Playwright Chromium), viewport 1400×900 for every screenshot.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. Unit test at the exact mapping (fails on main)</h3>
  <p>File: <a href="1719/repro/interactions.repro-1719.test.ts">1719/repro/interactions.repro-1719.test.ts</a> (place at <code>plugins/provider-acp/src/interactions.repro-1719.test.ts</code>). It feeds <code>buildAcpPermissionInteractionPayload</code> the two shapes opencode sends: (1) the <code>write</code>/<code>edit</code> permission, <code>kind: "edit"</code>, file path as <code>title</code>, no <code>command</code>; (2) the <code>external_directory</code> permission, <code>kind: "other"</code>, bare directory as <code>title</code>, <code>locations</code>, no <code>command</code>. (On the base commit <code>AcpPermissionToolCall</code> has no <code>locations</code> field, so case 2 would be a TS excess-property error under <code>tsc</code>; vitest does not typecheck, and the mapping simply ignores the field, which is the point.)</p>
  <pre>{test}</pre>
  <pre>$ cd plugins/provider-acp &amp;&amp; pnpm exec vitest run src/interactions.repro-1719.test.ts

{testout}</pre>
  <p>Both assertions <code>expect(payload.subject.kind).toBe("file_change")</code> fail with <code>Received: "command"</code>; the subjects produced are <code>{{ kind: "command", itemId: "write-tool-1", command: "/tmp/qa-1719/notes.md", cwd: null, actions: [{{ type: "unknown", command: "/tmp/qa-1719/notes.md" }}], sessionGrant: null }}</code> and the same with <code>"/tmp/qa-1719"</code>.</p>

  <h3>B. End-to-end on a running bb (no real opencode required)</h3>
  <ol>
    <li>Build and start a dev instance from the base commit:
<pre>git checkout {base[:9]}
pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
scripts/bb-dev-app current          # prints App/Server/Host daemon URLs and the data dir
eval "$(scripts/bb-dev-app env)"</pre></li>
    <li>Take bb's own fake ACP agent (<code>plugins/provider-acp/src/bridge/fake-acp-agent.mjs</code>) and add a branch that answers the prompt <code>opencode-write</code> with what opencode's ACP layer emits for a <code>write</code> tool needing permission: a pending <code>tool_call</code> with <code>kind: "edit"</code>, then <code>session/request_permission</code> whose <code>toolCall</code> depends on <code>FAKE_ACP_PERMISSION</code>: <code>write</code> → <code>kind: "edit"</code>, <code>title</code> = file path, <code>locations</code> = <code>[{{path}}]</code>, <code>rawInput</code> = <code>{{filePath, content}}</code>; <code>external_directory</code> → <code>kind: "other"</code>, <code>title</code> = parent directory, <code>locations</code> = <code>[{{file}}, {{parentDir}}]</code>, <code>rawInput</code> = <code>{{filepath, parentDir}}</code>; never a <code>command</code>. On allow it sends a <code>tool_call_update</code> with the diff. Ready-made copy: <a href="1719/repro/fake-opencode-acp-agent.mjs">1719/repro/fake-opencode-acp-agent.mjs</a>; the delta vs the in-tree fake is <a href="1719/repro/fake-agent.diff">1719/repro/fake-agent.diff</a>:
<pre>{agentdiff}</pre></li>
    <li>Register it twice (one entry per permission shape) as custom ACP agents in the dev data dir's <code>config.json</code> (<a href="1719/repro/config.json">1719/repro/config.json</a>; adjust the node path) and reload:
<pre>{cfg}
$ curl -s -X POST $BB_SERVER_URL/api/v1/system/config/reload
{{"ok":true}}
$ node packages/scripts/dist/commands/run-cli.js provider list   # now lists acp-fakeopencode and acp-fakeopencodewrite</pre>
      Note: <code>pnpm bb:dev &lt;cmd&gt;</code> prints turbo's build banner on stdout before the command output, so it cannot be piped into <code>jq</code>/<code>python -m json</code>. Run <code>pnpm bb:dev --help</code> once so the CLI is built, then use <code>node packages/scripts/dist/commands/run-cli.js &lt;cmd&gt;</code> (shown below as <code>$BBCLI</code>) for anything with <code>--json</code>.</li>
    <li>Create a scratch repo and project:
<pre>mkdir -p /tmp/qa-1719 &amp;&amp; cd /tmp/qa-1719 &amp;&amp; git init -q &amp;&amp; echo hi &gt; README.md &amp;&amp; git add -A &amp;&amp; git -c user.email=qa@x -c user.name=qa commit -qm init
BBCLI="node packages/scripts/dist/commands/run-cli.js"
HOST=$($BBCLI machine list --json 2&gt;/dev/null | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')   # host_7hwmtt9fc5
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/qa-1719","hostId":"'$HOST'"}}}}'
# → {{"id":"proj_eyzm33avat", ...}}</pre></li>
    <li>Spawn one thread per fake agent in <code>accept-edits</code> mode with the trigger prompt (<code>--machine</code> is required when the CLI has no remembered host; without it <code>thread spawn</code> fails with <code>HTTP 404: Host not found</code>):
<pre>$BBCLI thread spawn --project proj_eyzm33avat --machine $HOST --provider acp-fakeopencodewrite \\
  --permission-mode accept-edits --title "1719 repro (write permission)" --prompt "opencode-write please" --json
# → "id": "thr_aqrjgmjtqa"
$BBCLI thread spawn --project proj_eyzm33avat --machine $HOST --provider acp-fakeopencode \\
  --permission-mode accept-edits --title "1719 repro (external_directory permission)" --prompt "opencode-write please" --json
# → "id": "thr_isrbv6ddiw"</pre></li>
    <li><b>Actual</b> — both pending interactions are <em>command</em> approvals whose "command" is a path. Write permission (file path):
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
      <figure><img src="assets/1719-baseline-claude-code-file-change-approval.png" alt="Claude Code file_change approval card"><figcaption><b>Expected rendering (baseline, unpatched base commit, Claude Code).</b> Timeline: "Waiting for approval <b>to edit</b> hello.txt". Card: "Path is outside allowed working directories · Item: … · Session grant: Write 1 path", i.e. a file-change approval, no "$" and no "run this command".</figcaption></figure></li>
    <li>Timeline events for the item (from <code>GET /threads/thr_aqrjgmjtqa/events</code>, <a href="1719/repro/events-before-approval.json">raw</a>): the agent's own <code>tool_call</code> creates a <code>fileChange</code>, then the approval overwrites the same id as a <code>commandExecution</code>:
<pre>{ev_before}</pre>
      Same for the external_directory thread (<a href="1719/repro/events-external-directory-before-approval.json">raw</a>):
<pre>{ev_ext_before}</pre></li>
    <li>Open <code>http://localhost:15048/projects/proj_eyzm33avat/threads/thr_aqrjgmjtqa</code> and <code>…/thr_isrbv6ddiw</code>:
      <figure><img src="assets/1719-pending-command-approval.png" alt="approval card asking to run a file path as a command"><figcaption><b>Bug, write permission.</b> Timeline: "Editing notes.md" (from the ACP tool_call) immediately followed by "Waiting for approval <b>to run</b> /tmp/qa-1719/notes.md". Approval card at the bottom: "Do you want to run this command? <code>$ /tmp/qa-1719/notes.md</code> · Action: /tmp/qa-1719/notes.md". The agent asked to write a file; nothing is being run.</figcaption></figure>
      <figure><img src="assets/1719-pending-command-approval-external-directory.png" alt="approval card asking to run a bare directory as a command"><figcaption><b>Bug, external_directory permission: the bare directory from the issue title.</b> "Waiting for approval to run /tmp/qa-1719" and "Do you want to run this command? <code>$ /tmp/qa-1719</code> · Action: /tmp/qa-1719".</figcaption></figure>
      <figure><img src="assets/1719-approval-card-crop.png" alt="crop of the approval card"><figcaption>Crop of the write-permission card just before I clicked <b>Allow once</b> (the trigger for step 9).</figcaption></figure></li>
    <li>Click <b>Allow once</b> on the write-permission thread. After approval the agent's <code>tool_call_update</code> arrives and the same item id becomes a completed <code>fileChange</code> with a diff (<a href="1719/repro/events-after-approval.json">raw</a>):
<pre>{ev_after}</pre>
      <figure><img src="assets/1719-after-allow-once.png" alt="thread after approval"><figcaption>After Allow once: the approval card is gone, the agent echoed <code>permission:once</code>, and the tool row (collapsed under "Worked for …") is now the file change. Approval works; only the pending presentation was wrong.</figcaption></figure></li>
  </ol>

  <h2>Root cause</h2>
  <p><b>Mechanism.</b> The bridge's <code>session/request_permission</code> handler forwards only <code>toolCallId</code>, <code>title</code>, <code>kind</code> and <code>rawInput.command</code> from the ACP tool call and drops <code>locations</code>/<code>content</code> (<a href="{perma('plugins/provider-acp/src/bridge/bridge.ts',1367,1389)}">bridge.ts:1367-1389</a>):</p>
  <pre>{src_bridge}</pre>
  <p>The mapping then unconditionally builds a <code>command</code> subject and picks the "command" text with a fallback chain that lands on the title (<a href="{perma('plugins/provider-acp/src/interactions.ts',55,90)}">interactions.ts:55-90</a>). The forwarded <code>kind</code> is only ever used as the last-resort <em>label</em>, never to classify the subject:</p>
  <pre>{src_interactions}</pre>
  <p>Why the visible symptom follows: (1) the app renders a <code>command</code> subject as "Do you want to run this command? <code>$ &lt;command&gt;</code>" (<code>apps/app/src/components/thread/pending-interactions/ThreadPendingInteractionBanner.tsx</code>, <code>buildApprovalSubject</code>), so the path shows up behind a <code>$</code>; (2) the server materialises the pending approval into the timeline by subject kind, and for <code>command</code> it emits a <code>commandExecution</code> item whose id is the subject's <code>itemId</code>, i.e. the ACP <code>toolCallId</code> (<a href="{perma('apps/server/src/services/interactions/pending-interaction-timeline.ts',220,249)}">pending-interaction-timeline.ts:220-249</a>):</p>
  <pre>{src_timeline}</pre>
  <p>Because the ACP <code>tool_call</code> notification for the same id was already translated to a <code>fileChange</code> item by <a href="{perma('plugins/provider-acp/src/event-translation.ts',179,257)}">event-translation.ts:179-257</a> (<code>kind === "edit"</code> + a location path → <code>fileChange</code>), and the post-approval <code>tool_call_update</code> is translated to a completed <code>fileChange</code> again, the timeline row goes fileChange → commandExecution → fileChange, exactly the "until approval upgrades it" the issue describes.</p>
  <p><b>Why the text is a path.</b> On the opencode side (fetched from <code>anomalyco/opencode</code> main, saved as <a href="1719/opencode-acp-permission.ts">1719/opencode-acp-permission.ts</a> and <a href="1719/opencode-acp-tool.ts">1719/opencode-acp-tool.ts</a>), <code>rawInput</code> only gains a <code>.command</code> for bash/shell; <code>write</code>/<code>edit</code> map to ACP <code>kind: "edit"</code> with the file path as title; and the <code>external_directory</code> permission that guards writes outside the project has title <code>parentDir</code> (a bare directory) and, because <code>toToolKind</code> has no case for <code>external_directory</code>, ACP <code>kind: "other"</code>. That last point matters for the fix: a kind-only classifier (<code>edit</code>/<code>delete</code>/<code>move</code>) would still show the bare-directory variant as a command approval; the <code>locations</code> array (<code>[file, parentDir]</code>) is the only signal that it is a file write.</p>
  <pre>{opencode_perm}</pre>
  <p><b>Deeper issue.</b> Event translation (<code>event-translation.ts</code>) already knows how to classify ACP tool calls by <code>kind</code>/<code>locations</code>/<code>content</code>, but the permission path was written independently and never consulted that knowledge. The two paths disagree about the same tool call, which is what makes the row flip. Any ACP agent (Cursor, Grok, Hermes, custom) that requests permission for an <code>edit</code>/<code>delete</code>/<code>move</code> tool without a shell command hits the same thing; it is not opencode-specific.</p>

  <h2>Proposed fix (first principles)</h2>
  <p>Classify write-ish ACP permission requests as <code>file_change</code> subjects at the mapping and forward the tool call's <code>locations</code> so the subject can carry a path and so unclassified (<code>other</code>/no-kind) permissions that name filesystem locations, opencode's <code>external_directory</code>, are covered too. Patch (applied and verified in this worktree; <a href="1719/repro/proposed-fix.patch">1719/repro/proposed-fix.patch</a>):</p>
  <pre>{fix}</pre>
  <pre>$ cd plugins/provider-acp &amp;&amp; pnpm exec vitest run src/interactions.repro-1719.test.ts src/interactions.test.ts src/bridge/bridge.test.ts
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
  <figure><img src="assets/1719-with-fix-file-change-approval-external-directory.png" alt="approval card with fix, external_directory permission"><figcaption>With the patch, external_directory permission: same card, "Write root: /tmp/qa-1719" (the containing location). Compare with the Claude Code baseline above.</figcaption></figure>
  <p>Notes and what could go wrong:</p>
  <ul>
    <li><b>Layer:</b> daemon-side provider translation (<code>plugins/provider-acp</code>), which is where ACP → canonical mapping belongs per AGENTS.md; the server needs no change. The canonical payload schema already allows <code>file_change</code>, and validation/timeline/CLI/app all handle it, so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump is needed (no field added or changed on the wire).</li>
    <li><b><code>writeScope</code> semantics:</b> Codex fills it with a <em>grant root</em> (a directory) and the UI labels it "Write root"; Claude Code passes <code>null</code> and carries the paths in <code>sessionGrant</code> (see baseline JSON above). The patch uses the location that contains all others (so <code>[file, parentDir]</code> → <code>parentDir</code>), else the first location, which is a file path for the write/edit shape and therefore slightly mislabelled; <code>dirname(location)</code> or <code>null</code> are the alternatives. Since the ACP <code>tool_call</code> already put the concrete path(s) into the timeline's <code>fileChange</code> item, <code>null</code> is defensible; I kept the path so the approval card is not empty. Reviewer's call.</li>
    <li><b>Classification:</b> <code>edit</code>/<code>delete</code>/<code>move</code> kinds are file changes; so is an <code>other</code>/no-kind permission that names <code>locations</code> and has no shell command (opencode's <code>external_directory</code>). <code>read</code>/<code>search</code>/<code>fetch</code>, and <code>other</code> without locations, keep the command fallback (still mislabelled "run this command" for e.g. a webfetch URL; a follow-up could add a <code>permission_grant</code> or a neutral subject, but that is outside this issue). Risk: an agent that tags a non-write tool <code>other</code> and attaches file locations (e.g. a custom "lint these files" tool) would be shown as a file change; that is still closer to the truth than "run this command".</li>
    <li><b>Timeline materialisation detail:</b> the server's <code>file_change</code> branch emits <code>fileChange {{changes: []}}</code> for the pending item (see events above); because it reuses the ACP tool-call id the row still shows "to edit notes.md" from the earlier <code>tool_call</code>, and the post-approval update fills the diff. Not a regression, but a reason to consider carrying <code>locations</code> into that item in a follow-up.</li>
    <li><b>Guard on <code>command === undefined</code>:</b> if an agent labels a shell tool <code>kind: "edit"</code> but supplies <code>rawInput.command</code>, it stays a command approval, which is the more informative rendering.</li>
    <li>Update <code>interactions.test.ts</code> (the historical-fix comment there says "must always end up with a grantable <em>command</em>-approval subject"; it should now say "grantable approval subject") and add the repro test as a regression test. <code>bridge.test.ts</code> (76 tests across the three files, including the 2 repro cases) passes with the patch; <code>turbo run typecheck --filter=bb-plugin-provider-acp --force</code> passes.</li>
  </ul>

  <h2>Related issues</h2>
  <ul>
    <li><a href="https://github.com/get-bb/bb/pull/1640">#1640</a> (merged) — provider bridge protocol; this bug was found during its default-on QA and is pre-existing (same mapping in the pre-#1640 <code>packages/agent-runtime/src/acp/adapter.ts</code>).</li>
    <li>Historical fix <code>79f591bea</code> (referenced in <code>interactions.test.ts</code>): made sparse ACP permission tool calls always yield a grantable command subject; that fallback chain is what now turns a path into a "command".</li>
    <li>Same-family, not the same bug: <a href="https://github.com/get-bb/bb/issues/1717">#1717</a> (permission-mode semantics for codex/claude).</li>
  </ul>

  <h2>Appendix</h2>
  <h3>Artifacts</h3>
  <ul>
    <li><a href="1719/repro/interactions.repro-1719.test.ts">interactions.repro-1719.test.ts</a>, <a href="1719/repro/unit-test-output.txt">unit-test-output.txt</a></li>
    <li><a href="1719/repro/fake-opencode-acp-agent.mjs">fake-opencode-acp-agent.mjs</a>, <a href="1719/repro/fake-agent.diff">fake-agent.diff</a>, <a href="1719/repro/patch-fake-agent.py">patch-fake-agent.py</a>, <a href="1719/repro/config.json">config.json</a></li>
    <li>Bug, write permission: <a href="1719/repro/project-create.json">project-create.json</a>, <a href="1719/repro/spawn.json">spawn.json</a>, <a href="1719/repro/interactions-pending.json">interactions-pending.json</a>, <a href="1719/repro/cli-interactions-list-bug.txt">cli-interactions-list-bug.txt</a>, <a href="1719/repro/events-before-approval.json">events-before-approval.json</a>, <a href="1719/repro/events-after-approval.json">events-after-approval.json</a></li>
    <li>Bug, external_directory permission: <a href="1719/repro/spawn-external-directory.json">spawn-external-directory.json</a>, <a href="1719/repro/interactions-pending-external-directory.json">interactions-pending-external-directory.json</a>, <a href="1719/repro/cli-interactions-list-external-directory-bug.txt">cli-interactions-list-external-directory-bug.txt</a>, <a href="1719/repro/events-external-directory-before-approval.json">events-external-directory-before-approval.json</a></li>
    <li>Native baseline (Claude Code): <a href="1719/repro/spawn-baseline-claude-code.json">spawn-baseline-claude-code.json</a>, <a href="1719/repro/interactions-pending-baseline-claude-code.json">interactions-pending-baseline-claude-code.json</a>, <a href="1719/repro/browser-baseline-claude-code.js">browser-baseline-claude-code.js</a></li>
    <li>With fix: <a href="1719/repro/proposed-fix.patch">proposed-fix.patch</a>, <a href="1719/repro/tests-with-fix.txt">tests-with-fix.txt</a>, <a href="1719/repro/typecheck-with-fix.txt">typecheck-with-fix.txt</a>, <a href="1719/repro/spawn-with-fix.json">spawn-with-fix.json</a>, <a href="1719/repro/spawn-with-fix-external-directory.json">spawn-with-fix-external-directory.json</a>, <a href="1719/repro/interactions-pending-with-fix.json">interactions-pending-with-fix.json</a>, <a href="1719/repro/interactions-pending-with-fix-external-directory.json">interactions-pending-with-fix-external-directory.json</a>, <a href="1719/repro/events-with-fix-before-approval.json">events-with-fix-before-approval.json</a>, <a href="1719/repro/events-with-fix-external-directory-before-approval.json">events-with-fix-external-directory-before-approval.json</a>, <a href="1719/repro/events-with-fix-external-directory-after-approval.json">events-with-fix-external-directory-after-approval.json</a>, <a href="1719/repro/cli-interactions-list-with-fix.txt">cli-interactions-list-with-fix.txt</a>, <a href="1719/repro/cli-interactions-list-with-fix-external-directory.txt">cli-interactions-list-with-fix-external-directory.txt</a></li>
    <li>Browser scripts: <a href="1719/repro/browser-approve.js">browser-approve.js</a>, <a href="1719/repro/browser-with-fix.js">browser-with-fix.js</a>; opencode sources consulted: <a href="1719/opencode-acp-permission.ts">opencode-acp-permission.ts</a>, <a href="1719/opencode-acp-tool.ts">opencode-acp-tool.ts</a>, <a href="1719/opencode-tool-external-directory.ts">opencode-tool-external-directory.ts</a></li>
  </ul>
  <h3>Commands run (chronological, abridged)</h3>
  <pre>gh issue view 1719 --repo get-bb/bb --json title,body,labels,state,comments
git checkout 16ceb3a54 &amp;&amp; pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
git fetch origin main; git log 16ceb3a54..origin/main --oneline -- plugins/provider-acp   # only #1742 (unrelated refactor); interactions.ts unchanged
git log -S'kind: "command"' -- plugins/provider-acp/src/interactions.ts; git show c5b53caab^:packages/agent-runtime/src/acp/adapter.ts
gh api repos/anomalyco/opencode/contents/packages/opencode/src/acp/{{permission,tool}}.ts -H "Accept: application/vnd.github.raw"
cd plugins/provider-acp &amp;&amp; pnpm exec vitest run src/interactions.repro-1719.test.ts        # 2 FAIL on base (expected)
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
  </ul>
</main></body></html>
'''
open('/tmp/bb-reports/issues/1719.html','w').write(doc)
print(len(doc))
