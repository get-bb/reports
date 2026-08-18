// Repro for get-bb/bb#1355: when one provider turn contains several
// assistant text blocks, only the LAST one is rendered as the visible
// assistant row; every earlier text block is folded into the collapsed
// "Worked for ..." summary. Both `it` blocks below FAIL on main (16ceb3a54)
// because the earlier prose is inside the summary row's children.
import type { TimelineRow } from "@bb/server-contract";
import { describe, expect, it } from "vitest";
import {
  createTimelineEventFactory,
  renderTimelineFixture,
} from "./timeline-test-harness.js";

type ConversationRow = Extract<TimelineRow, { kind: "conversation" }>;

function topLevelAssistantTexts(rows: readonly TimelineRow[]): string[] {
  return rows
    .filter(
      (row): row is ConversationRow =>
        row.kind === "conversation" && row.role === "assistant",
    )
    .map((row) => row.text);
}

function summaryChildAssistantTexts(rows: readonly TimelineRow[]): string[] {
  return rows
    .filter((row) => row.kind === "turn")
    .flatMap((row) => topLevelAssistantTexts(row.children ?? []));
}

const ANSWER =
  "- SQLite is a file, zero ops.\n- Postgres needs a server.\n**Question for you**: multi-user someday?";
const ACK =
  "The verify gate is open: no fresh fast-loop verdict for HEAD, nothing actionable this turn.";

describe("issue #1355: assistant prose hidden inside Worked for", () => {
  it("shows every assistant text block at rest when a Stop hook re-queries (text -> [hook feedback dropped] -> text)", () => {
    const event = createTimelineEventFactory({ threadId: "thread-1" });
    const request = event.clientTurnRequested({
      target: { kind: "new-turn" },
      text: "SQLite vs Postgres for a desktop app? End with a question.",
    });
    // This is exactly the event shape bb persisted for thread thr_g28r4itw8a
    // in the live repro: agentMessage, (hook feedback user message dropped by
    // provider-claude-code), agentMessage, turn/completed.
    const timeline = renderTimelineFixture({
      events: [
        request,
        event.turnStarted(),
        event.inputAccepted({ clientRequestId: request.data.requestId }),
        event.assistantCompleted({ itemId: "assistant-1", text: ANSWER }),
        event.assistantCompleted({ itemId: "assistant-2", text: ACK }),
        event.turnCompleted(),
      ],
      projectionOptions: { threadStatus: "idle", turnMessageDetail: "summary" },
    });

    // Diagnostic: what actually renders on main.
    // console.log(timeline.text);

    // The real answer must be visible without expanding anything.
    expect(topLevelAssistantTexts(timeline.rows)).toEqual([ANSWER, ACK]);
    // ...and it must not be buried under the collapsed summary row.
    expect(summaryChildAssistantTexts(timeline.rows)).not.toContain(ANSWER);
  });

  it("shows every assistant text block at rest for text -> tool_use -> text (no hooks involved)", () => {
    const event = createTimelineEventFactory({ threadId: "thread-1" });
    const request = event.clientTurnRequested({
      target: { kind: "new-turn" },
      text: "Name three planets, then stop.",
    });
    const timeline = renderTimelineFixture({
      events: [
        request,
        event.turnStarted(),
        event.inputAccepted({ clientRequestId: request.data.requestId }),
        event.assistantCompleted({
          itemId: "assistant-1",
          text: "1. Mercury\n2. Venus\n3. Mars",
        }),
        event.commandCompleted({ itemId: "tool-1", command: "ls" }),
        event.assistantCompleted({
          itemId: "assistant-2",
          text: "The hook is a no-op gate.",
        }),
        event.turnCompleted(),
      ],
      projectionOptions: { threadStatus: "idle", turnMessageDetail: "summary" },
    });

    expect(topLevelAssistantTexts(timeline.rows)).toEqual([
      "1. Mercury\n2. Venus\n3. Mars",
      "The hook is a no-op gate.",
    ]);
  });
});
