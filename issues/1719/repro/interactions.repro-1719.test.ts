import { describe, expect, it } from "vitest";
import { buildAcpPermissionInteractionPayload } from "./interactions.js";

// Repro for get-bb/bb#1719: an ACP `session/request_permission` for a file
// write must surface as a file-change approval subject, not as a command
// approval whose "command" is a bare path. Two shapes opencode actually sends
// (packages/opencode/src/acp/permission.ts + acp/tool.ts):
//   1. `write`/`edit` permission: kind "edit", title = file path,
//      locations = [{ path: file }], rawInput = tool input, NO `command`.
//   2. `external_directory` permission (write outside the project): kind
//      "other" (toToolKind has no case for it), title = parentDir (a bare
//      directory), locations = [{ path: file }, { path: parentDir }],
//      rawInput = { filepath, parentDir }, NO `command`.
const allowDenyOptions = [
  { kind: "allow_once" },
  { kind: "allow_always" },
  { kind: "reject_once" },
] as const;

describe("issue #1719: ACP write permission subject kind", () => {
  it("classifies an opencode-style write permission (kind edit) as a file_change subject", () => {
    const payload = buildAcpPermissionInteractionPayload({
      toolCall: {
        toolCallId: "write-tool-1",
        title: "/tmp/qa-1719/notes.md",
        kind: "edit",
        // no `command`: opencode only sets rawInput.command for bash/shell.
      },
      options: allowDenyOptions,
    });

    if (payload.kind !== "approval") {
      throw new Error("Expected an approval payload");
    }
    // FAILS on 16ceb3a54: subject is
    //   { kind: "command", command: "/tmp/qa-1719/notes.md", actions: [{type:"unknown", command:"/tmp/qa-1719/notes.md"}] }
    expect(payload.subject.kind).toBe("file_change");
    expect(payload.subject.itemId).toBe("write-tool-1");
  });

  it("classifies an opencode-style external_directory permission (kind other, bare directory title) as a file_change subject", () => {
    const payload = buildAcpPermissionInteractionPayload({
      toolCall: {
        toolCallId: "write-tool-1",
        title: "/tmp/qa-1719",
        kind: "other",
        // What the bridge forwards from `locations` once it stops dropping them.
        // On 16ceb3a54 the bridge does not forward locations at all, so this
        // field is simply ignored there.
        locations: ["/tmp/qa-1719/notes.md", "/tmp/qa-1719"],
      },
      options: allowDenyOptions,
    });

    if (payload.kind !== "approval") {
      throw new Error("Expected an approval payload");
    }
    // FAILS on 16ceb3a54: subject is
    //   { kind: "command", command: "/tmp/qa-1719", actions: [{type:"unknown", command:"/tmp/qa-1719"}] }
    // i.e. exactly the "command approval carrying a bare directory path" from the issue title.
    expect(payload.subject.kind).toBe("file_change");
    expect(payload.subject.itemId).toBe("write-tool-1");
  });
});
