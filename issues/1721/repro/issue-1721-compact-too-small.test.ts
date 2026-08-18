import { describe, expect, it } from "vitest";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { createPiEventTranslator } from "./event-translation.js";

/**
 * Repro for get-bb/bb#1721.
 *
 * Pi's `AgentSession.compact()` refuses a session below `keepRecentTokens`
 * (20k by default) by emitting `compaction_end` with
 * `errorMessage: "Compaction failed: Nothing to compact (session too small)"`
 * and then rejecting. That is a benign no-op, not a failure of the turn.
 *
 * bb's translator maps every manual `compaction_end` with an `errorMessage`
 * to `turn/completed status=failed`, which the server turns into
 * `run.failed` -> thread status `error`. This test encodes the desired
 * behaviour and therefore FAILS on 16ceb3a54.
 */
describe("issue #1721: pi manual /compact on a too-small session", () => {
  it("does not fail the turn when pi has nothing to compact", () => {
    const translator = createPiEventTranslator({ providerId: "pi" });
    const context = { threadId: "bb-thread-1" };

    translator.translatePiEvent(
      { type: "compaction_start", reason: "manual" } satisfies AgentSessionEvent,
      context,
    );
    const completed = translator.translatePiEvent(
      {
        type: "compaction_end",
        reason: "manual",
        result: undefined,
        willRetry: false,
        aborted: false,
        errorMessage: "Compaction failed: Nothing to compact (session too small)",
      } satisfies AgentSessionEvent,
      context,
    );

    const turnCompleted = completed.find(
      (event) => event.type === "turn/completed",
    );
    expect(turnCompleted).toBeDefined();
    // Actual on 16ceb3a54: status === "failed" with the pi error message,
    // which the server maps to run.failed -> thread status "error".
    expect(turnCompleted).toMatchObject({ status: "completed" });
  });
});
