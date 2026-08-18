import { describe, expect, it } from "vitest";
import { turnScope } from "@bb/domain";
import { createConnection, type DbConnection } from "../src/connection.js";
import { migrate } from "../src/migrate.js";
import { noopNotifier } from "../src/notifier.js";
import {
  insertEvents,
  listStoredEventRowsByParentToolCallIds,
  listTodoSnapshotEventRowsForThread,
} from "../src/data/events.js";
import { upsertHost } from "../src/data/hosts.js";
import { createProject } from "../src/data/projects.js";
import { createThread } from "../src/data/threads.js";

// Issue #1131 (timeline follow-up, 0.37.0 comment): the *latest page* of a
// large thread blocks the event loop for seconds on a cold cache. Two of the
// helpers the latest-page build always runs are not bounded by the page
// window at all: they walk every event (or every tool-call event) of the
// thread and evaluate json_extract() on the payload of each visited row, so
// their cost is proportional to the whole thread's stored bytes rather than to
// the page that is returned. This test pins the shape of the SQL plans and
// shows the row-visit scaling with an in-memory database.
//
// It PASSES on main: it documents the current plans. Once either helper is
// bounded (partial/expression index, or persisted state), the plan assertions
// here must be updated deliberately.

type SqliteParameter = string | number | bigint | Buffer | null;

interface QueryPlanRow {
  detail: string;
}

interface CapturedStatement {
  params: SqliteParameter[];
  sql: string;
}

function captureStatements(
  db: DbConnection,
  run: () => void,
): CapturedStatement[] {
  const captured: CapturedStatement[] = [];
  const raw = db.$client;
  const originalPrepare = raw.prepare.bind(raw);
  Object.defineProperty(raw, "prepare", {
    configurable: true,
    writable: true,
    value: (source: string) => {
      const statement = originalPrepare(source);
      const originalAll = statement.all.bind(statement);
      statement.all = (...params: unknown[]) => {
        captured.push({ params: params as SqliteParameter[], sql: source });
        return originalAll(...params);
      };
      return statement;
    },
  });
  try {
    run();
  } finally {
    Object.defineProperty(raw, "prepare", {
      configurable: true,
      writable: true,
      value: originalPrepare,
    });
  }
  return captured;
}

function queryPlan(db: DbConnection, statement: CapturedStatement): string {
  return db.$client
    .prepare<SqliteParameter[], QueryPlanRow>(
      `EXPLAIN QUERY PLAN ${statement.sql}`,
    )
    .all(...statement.params)
    .map((row) => row.detail)
    .join("\n");
}

function setup() {
  const db = createConnection(":memory:");
  migrate(db);
  const host = upsertHost(db, noopNotifier, {
    name: "issue-1131-host",
    type: "persistent",
  });
  const { project } = createProject(db, noopNotifier, {
    name: "issue-1131",
    source: { type: "local_path", hostId: host.id, path: "/tmp/issue-1131" },
  });
  const thread = createThread(db, noopNotifier, {
    projectId: project.id,
    providerId: "claude-code",
  });
  return { db, thread };
}

/**
 * A thread made of `toolCallPairs` Read tool calls (item/started +
 * item/completed with a `resultText` of `payloadChars`) followed by one
 * TodoWrite. This is the shape of a long claude-code session: thousands of
 * tool calls, each carrying a multi-KB result, and a handful of todo writes.
 */
function seedToolCallThread(
  db: DbConnection,
  threadId: string,
  toolCallPairs: number,
  payloadChars: number,
): number {
  const payload = "x".repeat(payloadChars);
  let sequence = 0;
  const batch: Parameters<typeof insertEvents>[2] = [];
  for (let index = 0; index < toolCallPairs; index += 1) {
    const itemId = `call_${index}`;
    batch.push({
      data: JSON.stringify({
        item: { id: itemId, type: "toolCall", tool: "Read", status: "inProgress" },
      }),
      itemId,
      itemKind: "toolCall",
      scope: turnScope("turn_1131"),
      sequence: ++sequence,
      threadId,
      type: "item/started",
    });
    batch.push({
      data: JSON.stringify({
        item: {
          id: itemId,
          type: "toolCall",
          tool: "Read",
          status: "completed",
          resultText: payload,
        },
      }),
      itemId,
      itemKind: "toolCall",
      scope: turnScope("turn_1131"),
      sequence: ++sequence,
      threadId,
      type: "item/completed",
    });
  }
  batch.push({
    data: JSON.stringify({
      item: {
        id: "call_todo",
        type: "toolCall",
        tool: "TodoWrite",
        status: "completed",
        args: { todos: [{ content: "ship", status: "pending" }] },
      },
    }),
    itemId: "call_todo",
    itemKind: "toolCall",
    scope: turnScope("turn_1131"),
    sequence: ++sequence,
    threadId,
    type: "item/completed",
  });
  db.transaction((tx) => {
    insertEvents(tx, noopNotifier, batch);
  });
  return sequence;
}

describe("issue #1131: latest-page timeline helpers scan the whole thread", () => {
  it("listTodoSnapshotEventRowsForThread visits every tool-call row (and its payload) of the thread", () => {
    const { db, thread } = setup();
    seedToolCallThread(db, thread.id, 200, 2_000);

    const captured = captureStatements(db, () => {
      const rows = listTodoSnapshotEventRowsForThread(db, {
        threadId: thread.id,
      });
      // Only the single TodoWrite row is wanted ...
      expect(rows).toHaveLength(1);
    });
    const statement = captured.find((entry) =>
      entry.sql.includes("'TodoWrite'"),
    );
    if (!statement) {
      throw new Error("expected the todo snapshot SQL");
    }
    // ... but the plan can only narrow to (thread_id, type, item_kind): the
    // json_extract($.item.tool) filter is applied per row after fetching the
    // event payload, so every tool-call row of the thread is read from disk.
    // On the reporter's 44k-event thread that is thousands of multi-KB rows
    // scattered across a 1.6 GiB file (73 MiB of reads on the seeded copy).
    const plan = queryPlan(db, statement);
    expect(plan).toMatch(
      /SEARCH events USING INDEX events_thread_type_item_kind_sequence_idx \(thread_id=\? AND type=\? AND item_kind=\?\)/u,
    );
    expect(plan).not.toContain("COVERING INDEX");
    db.$client.close();
  });

  it("listStoredEventRowsByParentToolCallIds without sequence bounds is a full-thread scan with json_extract per row", () => {
    const { db, thread } = setup();
    seedToolCallThread(db, thread.id, 200, 2_000);

    const captured = captureStatements(db, () => {
      // This is how ensureTimelineWindowParentedRows calls it for the latest
      // page (sequenceBounds === null): no sequenceStart / beforeSequence.
      const rows = listStoredEventRowsByParentToolCallIds(db, {
        excludedTypes: ["item/agentMessage/delta"],
        maxInlineOutputChars: 4_000,
        parentToolCallIds: ["call_7", "call_9"],
        threadId: thread.id,
      });
      expect(rows).toHaveLength(0);
    });
    const statement = captured.find((entry) =>
      entry.sql.includes("'$.parentToolCallId'"),
    );
    if (!statement) {
      throw new Error("expected the parent-tool-call SQL");
    }
    const plan = queryPlan(db, statement);
    // (thread_id=?) only: SQLite walks every event of the thread through the
    // thread/sequence index and evaluates json_extract on each payload.
    expect(plan).toMatch(
      /SEARCH events USING INDEX events_thread_sequence_idx \(thread_id=\?\)/u,
    );
    db.$client.close();
  });

  it("the unbounded parent-tool-call scan cost grows with thread size, not page size", () => {
    const { db, thread } = setup();
    const small = createThread(db, noopNotifier, {
      projectId: thread.projectId,
      providerId: "claude-code",
    });
    seedToolCallThread(db, small.id, 100, 4_000);
    seedToolCallThread(db, thread.id, 5_000, 4_000);

    const time = (threadId: string): number => {
      const start = performance.now();
      for (let index = 0; index < 5; index += 1) {
        listStoredEventRowsByParentToolCallIds(db, {
          excludedTypes: ["item/agentMessage/delta"],
          maxInlineOutputChars: 4_000,
          parentToolCallIds: ["call_1"],
          threadId,
        });
      }
      return (performance.now() - start) / 5;
    };
    const smallMs = time(small.id);
    const largeMs = time(thread.id);
    // Same page (zero matching rows either way), 50x the thread: the query
    // time follows the thread. Printed rather than asserted on an exact ratio
    // to keep the test stable on slow CI; the ratio is ~30-50x locally.
    console.log(
      `issue-1131 parent-tool-call scan: ${smallMs.toFixed(2)} ms (200 events) vs ${largeMs.toFixed(2)} ms (10k events), ratio ${(largeMs / smallMs).toFixed(1)}x`,
    );
    expect(largeMs).toBeGreaterThan(smallMs * 5);
    db.$client.close();
  });
});
