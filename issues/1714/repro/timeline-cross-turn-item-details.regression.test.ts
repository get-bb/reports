/**
 * Regression test for get-bb/bb#1714: the invariant that a turn summary
 * row's details (buildTimelineTurnSummaryDetails over the row's own
 * turnId/sourceSeqStart/sourceSeqEnd) equal that row's inline `children`.
 *
 * FAILS on 16ceb3a54 (bug present): details work row is `pending` with
 * empty output while the inline child is `completed` with output.
 */
import { expect, it } from "vitest";
import { turnScope } from "@bb/domain";
import type { Thread } from "@bb/domain";
import {
  createConnection,
  createProject,
  createThread,
  insertEvents,
  migrate,
  noopNotifier,
  upsertHost,
} from "@bb/db";
import type { DbConnection } from "@bb/db";
import type { TimelineRow } from "@bb/server-contract";
import {
  buildThreadTimelineWithProfile,
  buildTimelineTurnSummaryDetails,
} from "../../../src/services/threads/timeline.js";

const providerThreadId = "provider-root";

function setup(): { db: DbConnection; thread: Thread } {
  const db = createConnection(":memory:");
  migrate(db);
  const host = upsertHost(db, noopNotifier, { name: "test-host", type: "persistent" });
  const { project } = createProject(db, noopNotifier, {
    name: "test-project",
    source: { type: "local_path", hostId: host.id, path: "/tmp/test" },
  });
  const thread = createThread(db, noopNotifier, { projectId: project.id, providerId: "claude-code" });
  return { db, thread };
}

type EventInput = Parameters<typeof insertEvents>[2][number];

function seed(db: DbConnection, thread: Thread) {
  const events: EventInput[] = [];
  let sequence = 0;
  const push = (event: Omit<EventInput, "sequence" | "threadId">): void => {
    sequence += 1;
    events.push({ ...event, sequence, threadId: thread.id });
  };
  push({ type: "turn/started", scope: turnScope("turn-1"), providerThreadId, itemId: null, itemKind: null, data: JSON.stringify({}) });
  push({ type: "item/started", scope: turnScope("turn-1"), providerThreadId, itemId: "call-1", itemKind: "commandExecution",
    data: JSON.stringify({ item: { type: "commandExecution", id: "call-1", command: "npm run dev", cwd: "/tmp/test", status: "pending", approvalStatus: null } }) });
  push({ type: "item/completed", scope: turnScope("turn-1"), providerThreadId, itemId: "msg-1", itemKind: "agentMessage",
    data: JSON.stringify({ item: { type: "agentMessage", id: "msg-1", text: "Dev server is starting." } }) });
  push({ type: "turn/completed", scope: turnScope("turn-1"), providerThreadId, itemId: null, itemKind: null, data: JSON.stringify({ status: "completed", providerThreadId }) });
  push({ type: "turn/started", scope: turnScope("turn-2"), providerThreadId, itemId: null, itemKind: null, data: JSON.stringify({}) });
  // Late completion for call-1, scoped to turn-2 (the shape #447 made the projection support).
  push({ type: "item/completed", scope: turnScope("turn-2"), providerThreadId, itemId: "call-1", itemKind: "toolCall",
    data: JSON.stringify({ item: { type: "toolCall", id: "call-1", tool: "unknown", status: "completed", result: "dev server exited with code 0" } }) });
  push({ type: "turn/completed", scope: turnScope("turn-2"), providerThreadId, itemId: null, itemKind: null, data: JSON.stringify({ status: "completed", providerThreadId }) });
  insertEvents(db, noopNotifier, events);
}

it("turn-1 details rows equal turn-1 inline children when call-1 completes in turn-2 (#1714)", () => {
  const { db, thread } = setup();
  seed(db, thread);
  const build = (includeNestedRows: boolean): TimelineRow[] =>
    buildThreadTimelineWithProfile(db, thread, {
      eventBudget: 1_000_000,
      includeProviderUnhandledOperations: false,
      includeNestedRows,
      maxInlineOutputChars: 32_000,
      maxSeq: 0,
      page: { kind: "latest", segmentLimit: 20 },
    }).response.rows;
  const isTurn1 = (row: TimelineRow): row is Extract<TimelineRow, { kind: "turn" }> =>
    row.kind === "turn" && row.turnId === "turn-1";
  const turnRow = build(false).find(isTurn1)!;
  const inlineChildren = build(true).find(isTurn1)!.children ?? [];
  const details = buildTimelineTurnSummaryDetails(db, thread, {
    includeProviderUnhandledOperations: false,
    turnId: turnRow.turnId,
    sourceSeqStart: turnRow.sourceSeqStart,
    sourceSeqEnd: turnRow.sourceSeqEnd,
  });
  console.log("TURN ROW", JSON.stringify({ turnId: turnRow.turnId, sourceSeqStart: turnRow.sourceSeqStart, sourceSeqEnd: turnRow.sourceSeqEnd }));
  console.log("INLINE CHILDREN", JSON.stringify(inlineChildren, null, 2));
  console.log("DETAILS ROWS", JSON.stringify(details.rows, null, 2));
  expect(details.rows).toEqual(inlineChildren);
});
