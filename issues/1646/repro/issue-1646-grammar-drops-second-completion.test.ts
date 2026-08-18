/**
 * get-bb/bb#1646 / PR #1697 follow-up: since c5b53caab (#1640) the host daemon
 * runs every provider event through ThreadEventGrammar at intake and DROPS
 * violations. A second `turn/completed` for a turn that already completed is
 * a `turn/settles-once` violation, so the "second completion" that PR #1697
 * relies on to settle a reactivated thread back to idle never reaches the
 * server on main. This test documents that intake behaviour.
 */
import { turnScope, type ThreadEvent } from "@bb/domain";
import { describe, expect, it } from "vitest";
import { ThreadEventGrammar } from "./thread-event-grammar.js";

const base = { threadId: "t1", providerThreadId: "codex-1" } as const;

function turnStarted(turnId: string): ThreadEvent {
  return { type: "turn/started", ...base, scope: turnScope(turnId) };
}
function turnCompleted(turnId: string): ThreadEvent {
  return {
    type: "turn/completed",
    ...base,
    scope: turnScope(turnId),
    status: "completed",
  };
}
function commandStarted(turnId: string): ThreadEvent {
  return {
    type: "item/started",
    ...base,
    scope: turnScope(turnId),
    item: {
      type: "commandExecution",
      id: "cmd-1",
      command: "npm test",
      cwd: "/repo",
      status: "pending",
      approvalStatus: null,
    },
  };
}

describe("issue #1646: daemon intake grammar vs. work-after-completion", () => {
  it("passes root work on a completed turn through, but drops the turn's second turn/completed", () => {
    const grammar = new ThreadEventGrammar();
    expect(grammar.observe(turnStarted("turn-X"))).toEqual({ kind: "ok" });
    expect(grammar.observe(turnCompleted("turn-X"))).toEqual({ kind: "ok" });
    // The late work is accepted (this is what lets the bug reach the server).
    expect(grammar.observe(commandStarted("turn-X"))).toEqual({ kind: "ok" });
    // The second completion is dropped, so nothing can settle a thread that
    // PR #1697 reactivated from that late work.
    expect(grammar.observe(turnCompleted("turn-X"))).toEqual({
      kind: "violation",
      rule: "turn/settles-once",
      reason: 'turn/completed for turn "turn-X", which already completed',
    });
  });
});
