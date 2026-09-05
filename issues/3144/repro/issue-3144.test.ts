import { turnScope } from "@bb/domain";
import { expect, it } from "vitest";
import { groupCompletedTurnMessages } from "../../src/completed-turn-grouping.js";
import type {
  EventProjectionAssistantTextMessage,
  EventProjectionCommandMessage,
  EventProjectionMessage,
  EventProjectionTurn,
} from "../../src/event-projection-types.js";

function base(id: string, seq: number) {
  return {
    id,
    threadId: "thread-1",
    sourceSeqStart: seq,
    sourceSeqEnd: seq,
    createdAt: seq,
    startedAt: seq,
    scope: turnScope("turn-1"),
  };
}

function assistant(
  id: string,
  seq: number,
): EventProjectionAssistantTextMessage {
  return {
    ...base(id, seq),
    kind: "assistant-text",
    text: id,
    status: "completed",
  };
}

function command(id: string, seq: number): EventProjectionCommandMessage {
  return {
    ...base(id, seq),
    kind: "command",
    callId: id,
    command: "read-file",
    cwd: "/repo",
    parsedIntents: [],
    source: null,
    output: "",
    exitCode: 0,
    completedAt: seq,
    approvalStatus: null,
    status: "completed",
  };
}

function completedTurn(
  messages: EventProjectionMessage[],
  terminalMessage: EventProjectionAssistantTextMessage,
): EventProjectionTurn {
  return {
    turnId: "turn-1",
    threadId: "thread-1",
    sourceSeqStart: 1,
    sourceSeqEnd: messages.length,
    startedAt: 1,
    createdAt: messages.length,
    completedAt: messages.length,
    status: "completed",
    summaryCount: messages.length,
    messages,
    terminalMessage,
  };
}

it("keeps assistant prose visible across completed-turn work", () => {
  const first = assistant("first-analysis", 1);
  const firstRead = command("first-read", 2);
  const second = assistant("second-analysis", 3);
  const secondRead = command("second-read", 4);
  const final = assistant("final-answer", 5);

  const groups = groupCompletedTurnMessages(
    completedTurn([first, firstRead, second, secondRead, final], final),
  );

  expect(
    groups.summaryItems.map((item) =>
      item.kind === "ungrouped-message"
        ? `visible:${item.message.id}`
        : `summary:${item.sourceMessages.map((message) => message.id).join(",")}`,
    ),
  ).toEqual([
    "visible:first-analysis",
    "summary:first-read",
    "visible:second-analysis",
    "summary:second-read",
  ]);
  expect(groups.terminalMessages.map((message) => message.id)).toEqual([
    "final-answer",
  ]);
});

