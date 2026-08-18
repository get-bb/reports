# Produces fake-opencode-acp-agent.mjs from bb's in-tree fake ACP agent.
# usage: python3 patch-fake-agent.py <bb-repo>/plugins/provider-acp/src/bridge/fake-acp-agent.mjs <out.mjs>
import sys

src, out = sys.argv[1], sys.argv[2]
s = open(src).read()
anchor = '''  } else if (text.includes("write-file")) {'''
branch = '''  } else if (text.includes("opencode-write")) {
    // Mirrors what opencode's ACP layer sends when its `write` tool needs
    // permission (anomalyco/opencode packages/opencode/src/acp/permission.ts
    // + acp/tool.ts). The tool_call itself is always kind "edit"; the
    // permission request's toolCall depends on which permission fires:
    //   FAKE_ACP_PERMISSION=write (default): the write/edit permission ->
    //     kind "edit", title = file path, locations = [{ path: file }],
    //     rawInput = { filePath, content }, NO command.
    //   FAKE_ACP_PERMISSION=external_directory: the external_directory
    //     permission (write outside the project) -> toToolKind has no case
    //     for it so kind "other", title = parentDir (a bare directory),
    //     locations = [{ path: file }, { path: parentDir }],
    //     rawInput = { filepath, parentDir }, NO command.
    const filePath = process.env.FAKE_ACP_WRITE_PATH ?? "/tmp/qa-1719/notes.md";
    const parentDir = filePath.slice(0, filePath.lastIndexOf("/")) || "/";
    const external = process.env.FAKE_ACP_PERMISSION === "external_directory";
    const permissionToolCall = external
      ? {
          toolCallId: "write-tool-1",
          title: parentDir,
          kind: "other",
          status: "pending",
          locations: [{ path: filePath }, { path: parentDir }],
          rawInput: { filepath: filePath, parentDir },
        }
      : {
          toolCallId: "write-tool-1",
          title: filePath,
          kind: "edit",
          status: "pending",
          locations: [{ path: filePath }],
          rawInput: { filePath, content: "hello from agent\\n" },
        };
    notifyUpdate({
      sessionUpdate: "tool_call",
      toolCallId: "write-tool-1",
      title: filePath,
      kind: "edit",
      status: "pending",
      locations: [{ path: filePath }],
      rawInput: { filePath, content: "hello from agent\\n" },
    });
    let outcome = "cancelled";
    try {
      const result = await requestClient("session/request_permission", {
        sessionId: activeSessionId,
        toolCall: permissionToolCall,
        options: [
          { optionId: "once", name: "Allow once", kind: "allow_once" },
          { optionId: "always", name: "Always allow", kind: "allow_always" },
          { optionId: "reject", name: "Reject", kind: "reject_once" },
        ],
      });
      outcome =
        result?.outcome?.outcome === "selected"
          ? result.outcome.optionId
          : "cancelled";
    } catch {
      outcome = "error";
    }
    if (outcome === "once" || outcome === "always") {
      notifyUpdate({
        sessionUpdate: "tool_call_update",
        toolCallId: "write-tool-1",
        title: filePath,
        kind: "edit",
        status: "completed",
        locations: [{ path: filePath }],
        content: [
          { type: "diff", path: filePath, oldText: null, newText: "hello from agent\\n" },
        ],
        rawInput: { filePath, content: "hello from agent\\n" },
      });
    } else {
      notifyUpdate({
        sessionUpdate: "tool_call_update",
        toolCallId: "write-tool-1",
        title: filePath,
        kind: "edit",
        status: "failed",
      });
    }
    notifyUpdate(messageChunk(`permission:${outcome}`));
'''
assert anchor in s
open(out, "w").write(s.replace(anchor, branch + anchor, 1))
print("wrote", out)
