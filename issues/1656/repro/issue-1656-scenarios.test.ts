import type { ThreadEventRow } from "@bb/domain";
import { turnScope } from "@bb/domain";
import { describe, it } from "vitest";
import {
  createTimelineEventFactory,
  renderTimelineFixture,
} from "./timeline-test-harness.js";

// Exploratory scenarios for #1656 / PR #1657. Prints top-level rows only.

function topLevel(rows: ReturnType<typeof renderTimelineFixture>["rows"]) {
  return rows.map((row) => {
    if (row.kind === "conversation") return `${row.role}: ${row.text}`;
    if (row.kind === "turn") return `turn-summary(count=${row.summaryCount})`;
    if (row.kind === "work") return `work(${row.workKind})`;
    return row.kind;
  });
}

function render(events: ThreadEventRow[], completed: boolean) {
  return topLevel(
    renderTimelineFixture({
      events,
      projectionOptions: {
        threadStatus: completed ? "idle" : "active",
        turnMessageDetail: "summary",
      },
    }).rows,
  );
}

function answeredQuestion(seq: number): ThreadEventRow {
  return {
    id: `evt-user-question-${seq}`,
    threadId: "thread-1",
    seq,
    createdAt: seq,
    scope: turnScope("turn-1"),
    type: "system/userQuestion/lifecycle",
    data: {
      interactionId: "pint_question_1",
      providerId: "claude-code",
      providerRequestId: "request-question-1",
      status: "resolved",
      resolution: { kind: "user_answer", answers: { q1: { selected: ["all"] } } },
      statusReason: null,
      payload: {
        kind: "user_question",
        questions: [
          {
            id: "q1",
            prompt: "Which changes should I include?",
            shortLabel: "Scope",
            multiSelect: false,
            options: [
              { value: "all", label: "All of them" },
              { value: "none", label: "None" },
            ],
            allowFreeText: false,
          },
        ],
      },
    },
  } as ThreadEventRow;
}

describe("#1656 scenarios", () => {
  it("A: unsteered turn with several assistant messages", () => {
    const event = createTimelineEventFactory({ threadId: "thread-1" });
    const request = event.clientTurnRequested({
      target: { kind: "new-turn" },
      text: "Check my router setup",
    });
    const events: ThreadEventRow[] = [
      request,
      event.turnStarted(),
      event.inputAccepted({ clientRequestId: request.data.requestId }),
      event.assistantCompleted({ itemId: "a1", text: "Starting the audit." }),
      event.commandCompleted({ itemId: "tool-1", command: "ssh router" }),
      event.assistantCompleted({ itemId: "a3", text: "Login works." }),
      event.assistantCompleted({ itemId: "a4", text: "Audit complete." }),
      event.assistantCompleted({ itemId: "a5", text: "Final runbook." }),
      event.turnCompleted(),
    ];
    console.log("A COMPLETED (unsteered):\n  " + render(events, true).join("\n  "));
  });

  it("B: answered AskUserQuestion mid-turn", () => {
    const event = createTimelineEventFactory({ threadId: "thread-1" });
    const request = event.clientTurnRequested({
      target: { kind: "new-turn" },
      text: "Audit the router",
    });
    const events: ThreadEventRow[] = [
      request,
      event.turnStarted(),
      event.inputAccepted({ clientRequestId: request.data.requestId }),
      event.assistantCompleted({ itemId: "a0", text: "Let me look." }),
      event.commandCompleted({ itemId: "tool-1", command: "ssh router" }),
      event.assistantCompleted({
        itemId: "a1",
        text: "Audit complete. Which changes should I include?",
      }),
      answeredQuestion(7),
      event.commandCompleted({ itemId: "tool-2", command: "apply" }),
      event.assistantCompleted({ itemId: "a2", text: "Applied all." }),
      event.assistantCompleted({ itemId: "a3", text: "Final runbook." }),
    ];
    console.log("B RUNNING:\n  " + render(events, false).join("\n  "));
    events.push(event.turnCompleted());
    console.log("B COMPLETED:\n  " + render(events, true).join("\n  "));
  });

  it("C: steer answered by a single assistant message after tools", () => {
    const event = createTimelineEventFactory({ threadId: "thread-1" });
    const request = event.clientTurnRequested({
      target: { kind: "new-turn" },
      text: "Check my router setup",
    });
    const steer = event.clientTurnRequested({
      target: { kind: "steer", expectedTurnId: "turn-1" },
      source: "tell",
      text: "explore but do not apply changes",
      requestId: "creq_steersteer" as never,
    });
    const events: ThreadEventRow[] = [
      request,
      event.turnStarted(),
      event.inputAccepted({ clientRequestId: request.data.requestId }),
      event.commandCompleted({ itemId: "tool-0", command: "ip route" }),
      steer,
      event.inputAccepted({ clientRequestId: steer.data.requestId }),
      event.commandCompleted({ itemId: "tool-1", command: "ssh router" }),
      event.assistantCompleted({ itemId: "a3", text: "Only reply." }),
      event.commandCompleted({ itemId: "tool-2", command: "cat config" }),
      event.turnCompleted(),
    ];
    console.log("C COMPLETED:\n  " + render(events, true).join("\n  "));
  });

  it("D: is the initial user message inside the turn's messages?", () => {
    const event = createTimelineEventFactory({ threadId: "thread-1" });
    const request = event.clientTurnRequested({
      target: { kind: "new-turn" },
      text: "Check my router setup",
    });
    const fixture = renderTimelineFixture({
      events: [
        request,
        event.turnStarted(),
        event.inputAccepted({ clientRequestId: request.data.requestId }),
        event.assistantCompleted({ itemId: "a1", text: "Starting the audit." }),
        event.commandCompleted({ itemId: "tool-1", command: "ssh router" }),
        event.assistantCompleted({ itemId: "a5", text: "Final runbook." }),
        event.turnCompleted(),
      ],
      projectionOptions: { threadStatus: "idle", turnMessageDetail: "summary" },
    });
    for (const entry of fixture.projection.entries) {
      if (entry.kind === "turn") {
        console.log(
          "D turn messages: " +
            (entry.turn.messages ?? [])
              .map(
                (m) =>
                  `${m.kind}${m.kind === "user" ? `(initiator=${m.initiator})` : ""}`,
              )
              .join(", "),
        );
      } else {
        console.log("D projected-message: " + entry.message.kind);
      }
    }
  });
});
