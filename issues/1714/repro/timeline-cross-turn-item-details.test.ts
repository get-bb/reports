/**
 * Repro: a cross-turn item lifecycle renders `completed` in a turn row's
 * inline children but `pending` in the same row's turn-summary details.
 *
 * The item's `item/started` is scoped to turn-1; its `item/completed` arrives
 * scoped to turn-2 — the persisted shape #447 made the projection support
 * (keep first scope, stretch end). The control scopes the same completion row
 * to turn-1 and both surfaces agree.
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
  const host = upsertHost(db, noopNotifier, {
    name: "test-host",
    type: "persistent",
  });
  const { project } = createProject(db, noopNotifier, {
    name: "test-project",
    source: { type: "local_path", hostId: host.id, path: "/tmp/test" },
  });
  const thread = createThread(db, noopNotifier, {
    projectId: project.id,
    providerId: "claude-code",
  });
  return { db, thread };
}

type EventInput = Parameters<typeof insertEvents>[2][number];

function seed(db: DbConnection, thread: Thread, lateCompletionTurnId: string) {
  const events: EventInput[] = [];
  let sequence = 0;
  const push = (event: Omit<EventInput, "sequence" | "threadId">): void => {
    sequence += 1;
    events.push({ ...event, sequence, threadId: thread.id });
  };

  // turn 1: a command starts, the turn answers and completes
  push({
    type: "turn/started",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: null,
    itemKind: null,
    data: JSON.stringify({}),
  });
  push({
    type: "item/started",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: "call-1",
    itemKind: "commandExecution",
    data: JSON.stringify({
      item: {
        type: "commandExecution",
        id: "call-1",
        command: "npm run dev",
        cwd: "/tmp/test",
        status: "pending",
        approvalStatus: null,
      },
    }),
  });
  push({
    type: "item/completed",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: "msg-1",
    itemKind: "agentMessage",
    data: JSON.stringify({
      item: { type: "agentMessage", id: "msg-1", text: "Dev server is starting." },
    }),
  });
  push({
    type: "turn/completed",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: null,
    itemKind: null,
    data: JSON.stringify({ status: "completed", providerThreadId }),
  });

  // turn 2: the same call settles late. In the defect case its completion row
  // is scoped to turn-2 (the adapter's degraded late-result shape); in the
  // control it stays scoped to turn-1.
  push({
    type: "turn/started",
    scope: turnScope("turn-2"),
    providerThreadId,
    itemId: null,
    itemKind: null,
    data: JSON.stringify({}),
  });
  push({
    type: "item/completed",
    scope: turnScope(lateCompletionTurnId),
    providerThreadId,
    itemId: "call-1",
    itemKind: "toolCall",
    data: JSON.stringify({
      item: {
        type: "toolCall",
        id: "call-1",
        tool: "unknown",
        status: "completed",
        result: "dev server exited with code 0",
      },
    }),
  });
  push({
    type: "turn/completed",
    scope: turnScope("turn-2"),
    providerThreadId,
    itemId: null,
    itemKind: null,
    data: JSON.stringify({ status: "completed", providerThreadId }),
  });

  insertEvents(db, noopNotifier, events);
}

function run(lateCompletionTurnId: string) {
  const { db, thread } = setup();
  seed(db, thread, lateCompletionTurnId);

  const build = (includeNestedRows: boolean): TimelineRow[] =>
    buildThreadTimelineWithProfile(db, thread, {
      eventBudget: 1_000_000,
      includeProviderUnhandledOperations: false,
      includeNestedRows,
      maxInlineOutputChars: 32_000,
      maxSeq: 0,
      page: { kind: "latest", segmentLimit: 20 },
    }).response.rows;

  const turnRow = build(false).find(
    (row): row is Extract<TimelineRow, { kind: "turn" }> =>
      row.kind === "turn" && row.turnId === "turn-1",
  );
  expect(turnRow).toBeDefined();

  const inlineTurnRow = build(true).find(
    (row): row is Extract<TimelineRow, { kind: "turn" }> =>
      row.kind === "turn" && row.turnId === "turn-1",
  );
  // Exactly what LazyTurnRowBody sends on expansion: the row's own identity.
  const details = buildTimelineTurnSummaryDetails(db, thread, {
    includeProviderUnhandledOperations: false,
    turnId: turnRow!.turnId,
    sourceSeqStart: turnRow!.sourceSeqStart,
    sourceSeqEnd: turnRow!.sourceSeqEnd,
  });

  const workOf = (rows: readonly TimelineRow[]) =>
    rows.find((row) => row.kind === "work") as
      | (Extract<TimelineRow, { kind: "work" }> & { output?: string })
      | undefined;
  return {
    detailsCommand: workOf(details.rows),
    detailsRows: details.rows,
    inlineChildren: inlineTurnRow?.children ?? [],
    inlineCommand: workOf(inlineTurnRow?.children ?? []),
    turnRow: turnRow!,
  };
}

it("details disagree with inline children when the completion is scoped to the next turn", () => {
  const result = run("turn-2");

  // The turn row's range covers the late completion (seq 6).
  expect(result.turnRow.sourceSeqStart).toBe(1);
  expect(result.turnRow.sourceSeqEnd).toBe(6);

  // Same row id on both surfaces — the same rendered item.
  expect(result.detailsCommand?.id).toBe(result.inlineCommand?.id);

  // Inline: the truth. Details: permanently pending, no output.
  expect(result.inlineCommand?.status).toBe("completed");
  expect(result.inlineCommand?.output).toBe("dev server exited with code 0");
  expect(result.detailsCommand?.status).toBe("pending");
  expect(result.detailsCommand?.output).toBe("");
});

it("control: the same completion row scoped to turn-1 keeps both surfaces identical", () => {
  const result = run("turn-1");
  expect(result.inlineCommand?.status).toBe("completed");
  expect(result.detailsCommand?.status).toBe("completed");
  expect(JSON.stringify(result.detailsRows)).toBe(
    JSON.stringify(result.inlineChildren),
  );
});
