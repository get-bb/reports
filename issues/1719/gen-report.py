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
def items(p):
    d=json.load(open(p)); out=[]
    for e in d:
        t=e.get('type'); data=e.get('data',{}); item=data.get('item') if isinstance(data,dict) else None
        if t.startswith('item/') and item: out.append(f"{t}  {json.dumps(item)}")
    return html.escape("\n".join(out))
ev_before=items(R+'events-before-approval.json'); ev_after=items(R+'events-after-approval.json'); ev_fix=items(R+'events-with-fix-before-approval.json')
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
    ...
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
  <p>The bridge ignores the ACP tool call's <code>kind</code> and <code>locations</code> entirely and always builds a <code>command</code> subject whose <code>command</code> string is <code>rawInput.command ?? title ?? kind</code>. For a write, opencode (and any other agent) sends no <code>rawInput.command</code>, and its <code>title</code> is the file path (for a <code>write</code>/<code>edit</code> permission) or the parent directory (for opencode's <code>external_directory</code> permission), so the user is asked "Do you want to run this command? <code>$ /tmp/qa-1719/</code>". The server materialises a <code>command</code> subject as a <code>commandExecution</code> timeline item using the ACP tool-call id, so the row that the agent's own <code>tool_call</code> notification had just started as a <code>fileChange</code> ("Editing notes.md") flips to "Waiting for approval to run /tmp/qa-1719/", and flips back to a <code>fileChange</code> only when the agent's post-approval <code>tool_call_update</code> arrives with the diff. Approval/denial itself works; only the presentation is wrong.</p>
  <p>Reproduced end-to-end on the base commit with a fake ACP agent registered via <code>customAcpAgents</code> that emits exactly what opencode's ACP layer emits for a write, and with a 1-assertion unit test against the mapping function that fails on main. A ~30-line mapping change (below) makes the same request render as a <code>file_change</code> approval; verified in the app and via <code>bb thread interactions list</code>.</p>

  <h2>Claims vs findings</h2>
  <table>
    <tr><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    <tr><td>ACP file-write permission renders as a <em>command</em> interaction</td><td class="ok">Verified</td><td><code>GET /api/v1/threads/&lt;id&gt;/interactions</code> returns <code>subject.kind: "command"</code> for a <code>kind: "edit"</code> ACP permission (repro step 6). App shows "Do you want to run this command?" (<a href="assets/1719-pending-command-approval.png">screenshot</a>). Mapping at <a href="{perma('plugins/provider-acp/src/interactions.ts',69,90)}">interactions.ts:69-90</a> hard-codes <code>kind: "command"</code>.</td></tr>
    <tr><td>The "command" is a bare directory path</td><td class="ok">Verified (mechanism); exact string is agent-dependent</td><td>The command string is <code>rawInput.command ?? title ?? kind</code> (<a href="{perma('plugins/provider-acp/src/interactions.ts',55,66)}">interactions.ts:55-66</a>). opencode sets <code>rawInput.command</code> only for bash/shell; for <code>write</code>/<code>edit</code> the title is the file path and for <code>external_directory</code> it is <code>parentDir</code>, a bare directory (opencode <code>acp/permission.ts</code>, <code>acp/tool.ts</code>, quoted in Root cause). My repro used title <code>/tmp/qa-1719/</code> and got <code>$ /tmp/qa-1719/</code>. I could not run real opencode (not installed here), so which of the two opencode permissions the reporter hit is unverified; both take the same code path.</td></tr>
    <tr><td>Timeline shows the item as <code>commandExecution</code> until approval upgrades it to <code>fileChange</code></td><td class="ok">Verified</td><td>Event dump before approval: <code>item/started fileChange write-tool-1</code> (from the ACP <code>tool_call</code>) followed by <code>item/started commandExecution write-tool-1 command="/tmp/qa-1719/" approvalStatus=waiting_for_approval</code>; after Allow once: <code>item/completed fileChange write-tool-1</code> with the diff. Same item id, so the UI row flips type twice. Server side: <a href="{perma('apps/server/src/services/interactions/pending-interaction-timeline.ts',220,249)}">pending-interaction-timeline.ts:220-249</a>.</td></tr>
    <tr><td>The approval itself works</td><td class="ok">Verified</td><td>Allow once in the app and <code>bb thread interactions approve</code> both settle the ACP request (agent echoed <code>permission:once</code>; fileChange completed with diff).</td></tr>
    <tr><td>Fix is a small mapping change in <code>plugins/provider-acp</code></td><td class="ok">Verified</td><td>Patch in <a href="1719/repro/proposed-fix.patch">1719/repro/proposed-fix.patch</a> (2 files, +33/−1); no server, protocol, or schema change: <code>file_change</code> is already a legal subject in the canonical payload and the wire shape is unchanged.</td></tr>
    <tr><td>Observed with opencode; pre-existing</td><td class="unv">Unverified (opencode) / Verified (pre-existing)</td><td>opencode is not installed on this machine, so I reproduced with a fake ACP agent that mirrors opencode's ACP output. The identical mapping existed before #1640 in <code>packages/agent-runtime/src/acp/adapter.ts</code> (<code>git show c5b53caab^:packages/agent-runtime/src/acp/adapter.ts</code>, ~L1531-1550) and is unchanged on <code>origin/main</code> today.</td></tr>
  </table>

  <h2>Environment</h2>
  <ul>
    <li>bb <code>16ceb3a54</code> (main, 2026-08-18) in worktree <code>/home/sawyer/projects/bb/.claude/worktrees/wf_242c3e11-a10-34</code>. <code>origin/main</code> checked at <code>a108fa7ef</code>: <code>plugins/provider-acp/src/interactions.ts</code> still hard-codes <code>kind: "command"</code>; not fixed.</li>
    <li>Linux 7.0.0-29-generic (Ubuntu), node v24.18.0. Providers on the machine: codex, claude-code, pi, acp-cursor, acp-grok; opencode is <b>not</b> installed, so the ACP agent is a fake (see below).</li>
    <li>Dev instance from this worktree: app <code>http://localhost:16802</code>, server <code>http://localhost:24802</code>, host daemon <code>:32802</code>, data dir <code>/home/sawyer/.bb-dev/projects-bb-.claude-worktrees-wf_242c3e11-a10-34-ec42636a32f0</code>. Host <code>host_xbta2sfdkc</code>, project <code>proj_vp9rypyfbf</code> (local path <code>/tmp/qa-1719</code>), bug thread <code>thr_g6thsjvka4</code>, with-fix thread <code>thr_gvgz7qwcd9</code>.</li>
    <li>Browser: <code>dev-browser --headless</code> (Playwright Chromium), viewport 1400×900.</li>
  </ul>

  <h2>Minimal reproduction</h2>
  <h3>A. Unit test at the exact mapping (fails on main)</h3>
  <p>File: <a href="1719/repro/interactions.repro-1719.test.ts">1719/repro/interactions.repro-1719.test.ts</a> (place at <code>plugins/provider-acp/src/interactions.repro-1719.test.ts</code>). It feeds <code>buildAcpPermissionInteractionPayload</code> exactly the tool-call fields the bridge forwards for an opencode write permission: <code>kind: "edit"</code>, a path as <code>title</code>, no <code>command</code>.</p>
  <pre>{test}</pre>
  <pre>$ cd plugins/provider-acp &amp;&amp; pnpm exec vitest run src/interactions.repro-1719.test.ts

{testout}</pre>
  <p>The assertion <code>expect(payload.subject.kind).toBe("file_change")</code> fails with <code>Received: "command"</code>; the full subject produced is <code>{{ kind: "command", itemId: "write-tool-1", command: "/tmp/qa-1719/", cwd: null, actions: [{{ type: "unknown", command: "/tmp/qa-1719/" }}], sessionGrant: null }}</code>.</p>

  <h3>B. End-to-end on a running bb (no real opencode required)</h3>
  <ol>
    <li>Build and start a dev instance from the base commit:
<pre>git checkout {base[:9]}
pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
scripts/bb-dev-app current          # prints App/Server/Host daemon URLs and the data dir
eval "$(scripts/bb-dev-app env)"</pre></li>
    <li>Take bb's own fake ACP agent (<code>plugins/provider-acp/src/bridge/fake-acp-agent.mjs</code>) and add a branch that answers the prompt <code>opencode-write</code> with what opencode's ACP layer emits for a <code>write</code> tool needing permission (a pending <code>tool_call</code> with <code>kind: "edit"</code>, then <code>session/request_permission</code> with the same tool call: <code>title</code> = path, <code>locations</code> = <code>[{{path}}]</code>, <code>rawInput</code> = <code>{{filePath, content}}</code>, no <code>command</code>; then a <code>tool_call_update</code> with the diff on allow). Ready-made copy: <a href="1719/repro/fake-opencode-acp-agent.mjs">1719/repro/fake-opencode-acp-agent.mjs</a>; the delta vs the in-tree fake is <a href="1719/repro/fake-agent.diff">1719/repro/fake-agent.diff</a>:
<pre>{agentdiff}</pre></li>
    <li>Register it as a custom ACP agent in the dev data dir's <code>config.json</code> (<a href="1719/repro/config.json">1719/repro/config.json</a>; adjust the node path) and reload:
<pre>{cfg}
$ curl -s -X POST $BB_SERVER_URL/api/v1/system/config/reload
{{"ok":true}}
$ pnpm bb:dev provider list        # now lists acp-fakeopencode "Fake opencode (ACP)"</pre></li>
    <li>Create a scratch repo and project:
<pre>mkdir -p /tmp/qa-1719 &amp;&amp; cd /tmp/qa-1719 &amp;&amp; git init -q &amp;&amp; echo hi &gt; README.md &amp;&amp; git add -A &amp;&amp; git -c user.email=qa@x -c user.name=qa commit -qm init
HOST=$(pnpm bb:dev machine list --json | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
curl -s -X POST $BB_SERVER_URL/api/v1/projects -H 'content-type: application/json' \\
  -d '{{"name":"qa","source":{{"type":"local_path","path":"/tmp/qa-1719","hostId":"'$HOST'"}}}}'
# → {{"id":"proj_vp9rypyfbf", ...}}</pre></li>
    <li>Spawn a thread on the fake agent in <code>accept-edits</code> (ask) mode with the trigger prompt:
<pre>pnpm bb:dev thread spawn --project proj_vp9rypyfbf --provider acp-fakeopencode \\
  --permission-mode accept-edits --title "1719 repro" --prompt "opencode-write please" --json
# → "id": "thr_g6thsjvka4"</pre></li>
    <li><b>Actual</b> — the pending interaction is a <em>command</em> approval whose command is the directory path:
<pre>$ curl -s $BB_SERVER_URL/api/v1/threads/thr_g6thsjvka4/interactions | jq '.[0].payload'
{pend}</pre>
      <b>Expected</b>: <code>subject.kind: "file_change"</code> (as Claude Code and Codex produce for edits), so the app asks "Do you want to make these changes?" and the timeline keeps the row as a file change.</li>
    <li>Timeline events for the item (from <code>GET /threads/thr_g6thsjvka4/events</code>, <a href="1719/repro/events-before-approval.json">raw</a>): the agent's own <code>tool_call</code> creates a <code>fileChange</code>, then the approval overwrites the same id as a <code>commandExecution</code>:
<pre>{ev_before}</pre></li>
    <li>Open <code>http://localhost:16802/projects/proj_vp9rypyfbf/threads/thr_g6thsjvka4</code>:
      <figure><img src="assets/1719-pending-command-approval.png" alt="approval card asking to run a directory as a command"><figcaption><b>Bug, the moment it shows.</b> Timeline: "Editing notes.md" (from the ACP tool_call) immediately followed by "Waiting for approval <b>to run</b> /tmp/qa-1719/". Approval card at the bottom: "Do you want to run this command? <code>$ /tmp/qa-1719/</code> · Action: /tmp/qa-1719/". The agent asked to write a file; nothing is being run.</figcaption></figure>
      <figure><img src="assets/1719-approval-card-crop.png" alt="crop of the approval card"><figcaption>Crop of the same card just before I clicked <b>Allow once</b> (the trigger for step 9).</figcaption></figure></li>
    <li>Click <b>Allow once</b>. After approval the agent's <code>tool_call_update</code> arrives and the same item id becomes a completed <code>fileChange</code> with a diff (<a href="1719/repro/events-after-approval.json">raw</a>):
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
  <p><b>Why the text is a path.</b> On the opencode side (fetched from <code>anomalyco/opencode</code> main, saved as <a href="1719/opencode-acp-permission.ts">1719/opencode-acp-permission.ts</a> and <a href="1719/opencode-acp-tool.ts">1719/opencode-acp-tool.ts</a>), <code>rawInput</code> only gains a <code>.command</code> for bash/shell, <code>write</code>/<code>edit</code> map to ACP <code>kind: "edit"</code>, and the title is the file path, or, for the <code>external_directory</code> permission that guards writes outside the project, <code>parentDir</code>, a bare directory:</p>
  <pre>{opencode_perm}</pre>
  <p><b>Deeper issue.</b> Event translation (<code>event-translation.ts</code>) already knows how to classify ACP tool calls by <code>kind</code>/<code>locations</code>/<code>content</code>, but the permission path was written independently and never consulted that knowledge. The two paths disagree about the same tool call, which is what makes the row flip. Any ACP agent (Cursor, Grok, Hermes, custom) that requests permission for an <code>edit</code>/<code>delete</code>/<code>move</code> tool without a shell command hits the same thing; it is not opencode-specific.</p>

  <h2>Proposed fix (first principles)</h2>
  <p>Classify write-ish ACP permission requests as <code>file_change</code> subjects at the mapping and forward the tool call's <code>locations</code> so the subject can carry a path. Patch (applied and verified in this worktree; <a href="1719/repro/proposed-fix.patch">1719/repro/proposed-fix.patch</a>):</p>
  <pre>{fix}</pre>
  <p>Result with the patch (same fake agent, thread <code>thr_gvgz7qwcd9</code>):</p>
  <pre>$ curl -s $BB_SERVER_URL/api/v1/threads/thr_gvgz7qwcd9/interactions | jq '.[0].payload'
{pendfix}
$ pnpm bb:dev thread interactions list thr_gvgz7qwcd9
{clilist_fix}
# timeline items before approval: both rows are fileChange now
{ev_fix}</pre>
  <figure><img src="assets/1719-with-fix-file-change-approval.png" alt="approval card with fix"><figcaption>With the patch: "Waiting for approval <b>to edit</b> notes.md" and the card reads "Do you want to make these changes? Item: write-tool-1 · Write root: /tmp/qa-1719/notes.md".</figcaption></figure>
  <p>Notes and what could go wrong:</p>
  <ul>
    <li><b>Layer:</b> daemon-side provider translation (<code>plugins/provider-acp</code>), which is where ACP → canonical mapping belongs per AGENTS.md; the server needs no change. The canonical payload schema already allows <code>file_change</code>, and validation/timeline/CLI/app all handle it, so no <code>HOST_DAEMON_PROTOCOL_VERSION</code> bump is needed (no field added or changed on the wire).</li>
    <li><b><code>writeScope</code> semantics:</b> Codex fills it with a <em>grant root</em> (a directory) and the UI labels it "Write root". Using the first location (a file path) is informative but slightly mislabelled; passing <code>dirname(location)</code> or <code>null</code> are the alternatives. Since the ACP <code>tool_call</code> already put the concrete path(s) into the timeline's <code>fileChange</code> item, <code>null</code> is defensible; I kept the path so the approval card is not empty. Reviewer's call.</li>
    <li><b>Kinds:</b> I classify <code>edit</code>, <code>delete</code>, <code>move</code>. <code>read</code>/<code>search</code>/<code>fetch</code>/<code>other</code> keep the command fallback (still mislabelled "run this command" for e.g. a webfetch URL; a follow-up could add a <code>permission_grant</code> or a neutral subject, but that is outside this issue).</li>
    <li><b>Guard on <code>command === undefined</code>:</b> if an agent labels a shell tool <code>kind: "edit"</code> but supplies <code>rawInput.command</code>, it stays a command approval, which is the more informative rendering.</li>
    <li>Update <code>interactions.test.ts</code> (the historical-fix comment there says "must always end up with a grantable <em>command</em>-approval subject"; it should now say "grantable approval subject") and add the repro test as a regression test. <code>bridge.test.ts</code> (75 tests across the three files) still passes with the patch; <code>turbo run typecheck --filter=bb-plugin-provider-acp</code> passes.</li>
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
    <li><a href="1719/repro/project-create.json">project-create.json</a>, <a href="1719/repro/spawn.json">spawn.json</a>, <a href="1719/repro/interactions-pending.json">interactions-pending.json</a>, <a href="1719/repro/events-before-approval.json">events-before-approval.json</a>, <a href="1719/repro/events-after-approval.json">events-after-approval.json</a></li>
    <li>With fix: <a href="1719/repro/proposed-fix.patch">proposed-fix.patch</a>, <a href="1719/repro/interactions-pending-with-fix.json">interactions-pending-with-fix.json</a>, <a href="1719/repro/events-with-fix-before-approval.json">events-with-fix-before-approval.json</a>, <a href="1719/repro/cli-interactions-list-with-fix.txt">cli-interactions-list-with-fix.txt</a></li>
    <li>Browser scripts: <a href="1719/repro/browser-approve.js">browser-approve.js</a>, <a href="1719/repro/browser-with-fix.js">browser-with-fix.js</a>; opencode sources consulted: <a href="1719/opencode-acp-permission.ts">opencode-acp-permission.ts</a>, <a href="1719/opencode-acp-tool.ts">opencode-acp-tool.ts</a></li>
  </ul>
  <h3>Commands run (chronological, abridged)</h3>
  <pre>gh issue view 1719 --repo get-bb/bb --json title,body,labels,state,comments
git checkout 16ceb3a54 &amp;&amp; pnpm install --frozen-lockfile --prefer-offline &amp;&amp; pnpm exec turbo run build
git fetch origin main; git log 16ceb3a54..origin/main --oneline -- plugins/provider-acp   # only #1742 (unrelated refactor); interactions.ts unchanged
git log -S'kind: "command"' -- plugins/provider-acp/src/interactions.ts; git show c5b53caab^:packages/agent-runtime/src/acp/adapter.ts
gh api repos/anomalyco/opencode/contents/packages/opencode/src/acp/{{permission,tool}}.ts -H "Accept: application/vnd.github.raw"
cd plugins/provider-acp &amp;&amp; pnpm exec vitest run src/interactions.repro-1719.test.ts        # FAILS on base (expected)
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
pnpm dev:stop</pre>
</main></body></html>
'''
open('/tmp/bb-reports/issues/1719.html','w').write(doc)
print(len(doc))
