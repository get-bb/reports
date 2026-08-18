import type { ThreadEventRow } from "@bb/domain";
import { describe, expect, it } from "vitest";
import {
  createTimelineEventFactory,
  renderTimelineFixture,
} from "./timeline-test-harness.js";

// Repro for get-bb/bb#1656: after `turn/completed`, the direct reply to a
// mid-turn steer ("Understood - read-only only.") is collapsed into the
// "Worked for …" summary even though it was rendered as its own row while the
// turn was running.

function topLevel(rows: ReturnType<typeof renderTimelineFixture>["rows"]) {
  return rows.map((row) => {
    if (row.kind === "conversation") return `${row.role}: ${row.text}`;
    if (row.kind === "turn") return `turn-summary(count=${row.summaryCount})`;
    return row.kind;
  });
}

function build(completed: boolean) {
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
    event.assistantCompleted({ itemId: "a1", text: "Starting the audit." }),
    event.commandCompleted({ itemId: "tool-0", command: "ip route" }),
    steer,
    event.inputAccepted({ clientRequestId: steer.data.requestId }),
    event.assistantCompleted({
      itemId: "a2",
      text: "Understood - read-only only.",
    }),
    event.commandCompleted({ itemId: "tool-1", command: "ssh router" }),
    event.assistantCompleted({ itemId: "a3", text: "Login works." }),
    event.assistantCompleted({
      itemId: "a4",
      text: "Audit complete. Nothing was changed.",
    }),
    event.assistantCompleted({ itemId: "a5", text: "Final runbook." }),
  ];
  if (completed) events.push(event.turnCompleted());
  return renderTimelineFixture({
    events,
    projectionOptions: {
      threadStatus: completed ? "idle" : "active",
      turnMessageDetail: "summary",
    },
  });
}

describe("issue #1656", () => {
  it("shows the same assistant rows before and after turn/completed", () => {
    const running = topLevel(build(false).rows);
    const done = topLevel(build(true).rows);
    console.log("RUNNING:\n  " + running.join("\n  "));
    console.log("COMPLETED:\n  " + done.join("\n  "));
    // The direct reply to the steer was on screen while running…
    expect(running).toContain("assistant: Understood - read-only only.");
    // …and is expected to survive turn completion. On main it does not.
    expect(done).toContain("assistant: Understood - read-only only.");
  });
});
