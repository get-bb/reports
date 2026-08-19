// Repro for get-bb/bb#1860: the Cmd+Enter steer request drops the composer's
// selected model / reasoning level, while the normal follow-up send keeps it.
import type { PromptInput } from "@bb/domain";
import { describe, expect, it } from "vitest";
import {
  buildAutoFollowUpRequest,
  buildFollowUpShortcutRequest,
  type ThreadExecutionSelection,
} from "./threadDetailPromptSubmission";

const input: PromptInput[] = [
  { type: "text", text: "Steer: reply only with steered.", mentions: [] },
];

// The composer picker now shows "5.6-Luna · Low" while the turn started with
// "5.6-Terra · High".
const pickerSelection: ThreadExecutionSelection = {
  model: "gpt-5.6-luna",
  reasoningLevel: "low",
  permissionMode: "full",
  serviceTier: undefined,
  supportsServiceTier: false,
  executionInputSources: {
    model: "explicit",
    reasoningLevel: "explicit",
    permissionMode: "explicit",
    serviceTier: "explicit",
  },
};

describe("#1860 steer shortcut drops the selected execution tuple", () => {
  it("the regular follow-up send carries the picker selection", () => {
    expect(
      buildAutoFollowUpRequest({
        execution: pickerSelection,
        input,
        threadId: "thread-1",
      }),
    ).toMatchObject({ model: "gpt-5.6-luna", reasoningLevel: "low" });
  });

  it("the Cmd+Enter steer send carries the same picker selection (FAILS on main)", () => {
    const shortcut = buildFollowUpShortcutRequest({
      input,
      queuedMessages: [],
      threadId: "thread-1",
      // On main the builder does not even accept an execution selection.
      ...({ execution: pickerSelection } as object),
    });
    expect(shortcut?.kind).toBe("draft");
    // Expected: model/reasoningLevel present. Actual on d81fee6f: the request
    // is {id, input, mode:"steer-if-active"} and the server falls back to the
    // active turn's last execution tuple (gpt-5.6-terra / high).
    expect(shortcut?.request).toMatchObject({
      mode: "steer-if-active",
      model: "gpt-5.6-luna",
      reasoningLevel: "low",
    });
  });
});
