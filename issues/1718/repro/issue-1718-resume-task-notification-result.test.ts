import { describe, expect, it } from "vitest";
import { turnScope } from "@bb/domain";
import { queueAcceptedUserMessage } from "@bb/provider-bridge-protocol/bridge-kit";
import { createClaudeEventTranslator } from "./event-translation.js";

/**
 * Issue #1718: message sent after stopping a claude-code thread that had a
 * backgrounded shell command is "dropped" (empty turn), and the answer arrives
 * as a later unsolicited turn.
 *
 * Captured from Claude Code 2.1.234 / Agent SDK 0.3.197 (see
 * 1718-sdk-resume-raw.out): when a session is resumed and its previous process
 * left a background shell task without a completion record, the CLI first
 * synthesises a `<task-notification status=stopped>` and settles it with a
 * `result` carrying `num_turns: 0`, zero usage and
 * `origin: { kind: "task-notification" }` BEFORE it processes the prompt that
 * bb pushed at resume time. The translator's terminal-turn resolution
 * (#1432) sees "result + pending accepted input" and opens-and-closes the
 * user's turn with no items; the real answer then opens an unsolicited turn.
 *
 * Copy to plugins/provider-claude-code/src/ and run:
 *   cd plugins/provider-claude-code && pnpm exec vitest run src/issue-1718-resume-task-notification-result.test.ts
 * On main (16ceb3a54) the first `it` FAILS: `events` contains
 * turn/started, turn/input/accepted, turn/completed for "turn-1".
 */
function createTranslator() {
  return createClaudeEventTranslator({
    providerId: "claude-code",
    turnIdPrefix: "turn-",
    itemIdPrefix: "claude-",
    synthesizeItemStarted: true,
  });
}

const SESSION = "e9136ce3-165c-4784-b75f-60397f1c5cca";

// Verbatim shape from the SDK (fields trimmed to what matters).
const RESUME_TASK_NOTIFICATION_RESULT = {
  type: "result",
  subtype: "success",
  is_error: false,
  duration_ms: 35,
  duration_api_ms: 0,
  num_turns: 0,
  result: "",
  stop_reason: null,
  session_id: SESSION,
  total_cost_usd: 0,
  usage: {
    input_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 0,
  },
  modelUsage: {},
  permission_denials: [],
  origin: { kind: "task-notification" },
  uuid: "f1d5e34c-3d97-4914-92d5-172da8e3a47f",
};

describe("issue #1718: resumed session settles an orphaned background task before the user's prompt", () => {
  it("does not open and close the user's pending turn on the task-notification result", () => {
    const { translateClaudeEvent, turnState } = createTranslator();
    // The bridge accepted turn/start for the prompt pushed at resume time.
    queueAcceptedUserMessage({
      clientRequestId: "creq_ke44su93nd",
      state: turnState.getOrCreate({ threadId: "bb-thread-1" }),
    });

    // CLI startup on resume: SessionStart hook, task_notification(stopped), init.
    translateClaudeEvent(
      {
        type: "system",
        subtype: "task_notification",
        task_id: "bahu2x1mc",
        tool_use_id: "toolu_017fZN7BHHxb6Aqepjgs3vxo",
        status: "stopped",
        output_file: "",
        summary: "No completion record was found for this background shell command from the previous session.",
        session_id: SESSION,
      },
      { threadId: "bb-thread-1" },
    );
    translateClaudeEvent(
      { type: "system", subtype: "init", session_id: SESSION },
      { threadId: "bb-thread-1" },
    );

    const events = translateClaudeEvent(RESUME_TASK_NOTIFICATION_RESULT, {
      threadId: "bb-thread-1",
    });

    // The user's prompt has not been processed yet: its accepted input must
    // stay pending and no turn may be settled on its behalf.
    expect(events.map((event) => event.type)).not.toContain("turn/completed");
    expect(events.map((event) => event.type)).not.toContain(
      "turn/input/accepted",
    );
    expect(
      turnState.getOrCreate({ threadId: "bb-thread-1" })
        .pendingAcceptedUserMessages,
    ).toHaveLength(1);
  });

  it("correlates the eventual answer with the user's accepted input", () => {
    const { translateClaudeEvent, turnState } = createTranslator();
    queueAcceptedUserMessage({
      clientRequestId: "creq_ke44su93nd",
      state: turnState.getOrCreate({ threadId: "bb-thread-1" }),
    });
    translateClaudeEvent(RESUME_TASK_NOTIFICATION_RESULT, {
      threadId: "bb-thread-1",
    });

    const answer = translateClaudeEvent(
      {
        type: "assistant",
        message: {
          id: "msg-1",
          role: "assistant",
          content: [{ type: "text", text: "second" }],
        },
        session_id: SESSION,
      },
      { threadId: "bb-thread-1" },
    );
    const done = translateClaudeEvent(
      {
        type: "result",
        subtype: "success",
        is_error: false,
        num_turns: 1,
        result: "second",
        session_id: SESSION,
        usage: { input_tokens: 10, output_tokens: 39 },
      },
      { threadId: "bb-thread-1" },
    );

    // One turn ("turn-1") owns the accepted input, the answer, and completion.
    expect(answer).toContainEqual(
      expect.objectContaining({
        type: "turn/input/accepted",
        scope: turnScope("turn-1"),
        clientRequestId: "creq_ke44su93nd",
      }),
    );
    expect(answer).toContainEqual(
      expect.objectContaining({
        type: "item/completed",
        scope: turnScope("turn-1"),
        item: expect.objectContaining({ type: "agentMessage", text: "second" }),
      }),
    );
    expect(done).toContainEqual(
      expect.objectContaining({
        type: "turn/completed",
        scope: turnScope("turn-1"),
        status: "completed",
      }),
    );
  });
});
