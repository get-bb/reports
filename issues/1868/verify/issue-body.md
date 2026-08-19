### Summary

Open a thread whose finished turn started a long-running `Workflow` (a `local_workflow` background task) while the workflow is still running. The timeline pages in oddly: it shows "Loading older messages…" and then stacks the same finished-turn summary — `Worked for 7m 19s` — six or seven times above "Working…". Expected: the finished turn's summary appears once, and the thread loads in one page.

Two things go wrong together:

1. **Superseded workflow progress snapshots spend the timeline byte budget.** Every `item/backgroundTask/progress` event carries the full workflow snapshot (~250 KB with 206 agents). Only the latest snapshot per task is load-bearing (`pruneBackgroundTaskProgressEvents` deletes the rest, but only every 250 sequences / 30 s on an active thread). Between prunes, 100+ snapshots (25 MB+) sit above the 4 MiB `THREAD_TIMELINE_EVENT_DATA_BYTE_LIMIT`, so the latest page is cut into many byte-window pages that contain nothing but superseded snapshots.
2. **Each byte-window page emits a phantom summary row for the spawning turn.** The progress rows carry `parentToolCallId` = the `Workflow` tool call in finished turn 1. Parent closure pulls that tool call's rows in, turn lifecycle closure adds turn 1's `turn/started`/`turn/completed`, and byte-window mode clears `contextOnlyToolCallIds`, so the projection builds a completed turn 1 with one message and renders `Worked for <full turn 1 duration>`. `buildSequencePageTimelineRows` clamps a turn row to the byte window only when the ranges overlap; turn 1 (seq 17–232) lies entirely below the window (seq 3269+), so the row is returned verbatim with a page-unique id (`…:turn:sequence-page:<anchor>`). The client keeps one row per id, so every page adds another `Worked for 7m 19s`.

### Versions and environment

- bb 0.39.0 (main at `b33abbff0`), from source dev server (`scripts/bb-dev-app current`) and the packaged app; Linux 7.0, Node 24.18
- claude-code provider; the turn ran a `Workflow` tool call with 206 agents (`mobile-perf-sweep`)
- Observed remotely through bb Connect (bee.getbb.app) and reproduced locally on `localhost`
- Thread `thr_7wvd28jzpj`, project `proj_atixi2qwed`, environment `env_kgkbk6tjv6`, host `host_j8fm4di6ds` (worktree environment)

### Steps to reproduce

Unit repro at the exact code path (server only, in-memory SQLite). Drop this file at `apps/server/test/services/threads/timeline-workflow-progress-window.test.ts` and run `cd apps/server && pnpm exec vitest run test/services/threads/timeline-workflow-progress-window.test.ts`. Both tests fail today.

<details>
<summary>timeline-workflow-progress-window.test.ts</summary>

```ts
import { describe, expect, it } from "vitest";
import {
  encodeClientTurnRequestIdNumber,
  LOCAL_WORKFLOW_TASK_TYPE,
  threadScope,
  turnScope,
} from "@bb/domain";
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
import type {
  TimelinePaginationCursor,
  TimelineRow,
} from "@bb/server-contract";
import {
  buildThreadTimelineWithProfile,
  THREAD_TIMELINE_EVENT_DATA_BYTE_LIMIT,
} from "../../../src/services/threads/timeline.js";

/** Larger than any thread these tests build, so the event budget never binds. */
const LARGE_BUDGET = 1_000_000;
const providerThreadId = "provider-root";
const WORKFLOW_CALL_ID = "call-workflow";
const WORKFLOW_TASK_ID = "task:wf-1";
/**
 * A workflow snapshot with a couple hundred agents is ~250 KB. Enough of them
 * to span several 4 MiB byte windows.
 */
const SNAPSHOT_BYTES = 300_000;
const SNAPSHOT_COUNT = 45;

const execution = {
  model: "gpt-5",
  serviceTier: "default",
  reasoningLevel: "medium",
  permissionMode: "full",
  source: "client/turn/requested",
} as const;

type EventInput = Parameters<typeof insertEvents>[2][number];

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

function workflowTaskData(args: {
  status: "pending" | "completed";
  padding: number;
}): string {
  return JSON.stringify({
    providerThreadId,
    item: {
      type: "backgroundTask",
      id: WORKFLOW_TASK_ID,
      taskType: LOCAL_WORKFLOW_TASK_TYPE,
      description: "sweep the codebase",
      status: args.status,
      taskStatus: args.status === "pending" ? "running" : "completed",
      skipTranscript: false,
      workflowName: "sweep",
      parentToolCallId: WORKFLOW_CALL_ID,
      workflow: {
        phases: [{ index: 1, title: "Find" }],
        agents: [
          {
            index: 1,
            label: "find:boot",
            state: "running",
            model: "gpt-5",
            attempt: 1,
            cached: false,
            lastProgressAt: 1,
            promptPreview: "x".repeat(args.padding),
          },
        ],
      },
    },
  });
}

/**
 * Turn 1: user asks, agent starts a Workflow tool call (a local_workflow
 * background task), reports back, and the turn completes. The workflow keeps
 * running and streams thread-scoped progress snapshots long after turn 1
 * completed. Turn 2 is a provider-opened turn that is still pending.
 */
function seedWorkflowThread(
  db: DbConnection,
  thread: Thread,
  options: { snapshotCount: number },
): void {
  const events: EventInput[] = [];
  let sequence = 0;
  const push = (event: Omit<EventInput, "sequence" | "threadId">): void => {
    sequence += 1;
    events.push({ ...event, sequence, threadId: thread.id });
  };
  const clientRequestId = encodeClientTurnRequestIdNumber({ value: 1 });
  push({
    type: "client/turn/requested",
    scope: threadScope(),
    itemId: null,
    itemKind: null,
    data: JSON.stringify({
      direction: "outbound",
      source: "tell",
      initiator: "user",
      request: { method: "turn/start", params: {} },
      requestId: clientRequestId,
      senderThreadId: null,
      input: [{ type: "text", text: "Sweep the codebase", mentions: [] }],
      target: { kind: "thread-start" },
      execution,
    }),
  });
  push({
    type: "turn/started",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: null,
    itemKind: null,
    data: JSON.stringify({}),
  });
  push({
    type: "turn/input/accepted",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: null,
    itemKind: null,
    data: JSON.stringify({ clientRequestId }),
  });
  push({
    type: "item/started",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: WORKFLOW_CALL_ID,
    itemKind: "toolCall",
    data: JSON.stringify({
      providerThreadId,
      item: {
        type: "toolCall",
        id: WORKFLOW_CALL_ID,
        tool: "Workflow",
        arguments: { script: "export const meta = {}" },
        status: "pending",
      },
    }),
  });
  push({
    type: "item/started",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: WORKFLOW_TASK_ID,
    itemKind: "backgroundTask",
    data: workflowTaskData({ status: "pending", padding: 0 }),
  });
  push({
    type: "item/completed",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: WORKFLOW_CALL_ID,
    itemKind: "toolCall",
    data: JSON.stringify({
      providerThreadId,
      item: {
        type: "toolCall",
        id: WORKFLOW_CALL_ID,
        tool: "Workflow",
        arguments: { script: "export const meta = {}" },
        result: "started",
        status: "completed",
      },
    }),
  });
  push({
    type: "item/completed",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: "assistant-1",
    itemKind: "agentMessage",
    data: JSON.stringify({
      providerThreadId,
      item: {
        type: "agentMessage",
        id: "assistant-1",
        text: "The workflow will notify me when it completes.",
        status: "completed",
      },
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
  push({
    type: "turn/started",
    scope: turnScope("turn-2"),
    providerThreadId,
    itemId: null,
    itemKind: null,
    data: JSON.stringify({}),
  });
  for (let index = 0; index < options.snapshotCount; index += 1) {
    push({
      type: "item/backgroundTask/progress",
      scope: threadScope(),
      providerThreadId,
      itemId: WORKFLOW_TASK_ID,
      itemKind: "backgroundTask",
      data: workflowTaskData({ status: "pending", padding: SNAPSHOT_BYTES }),
    });
  }
  insertEvents(db, noopNotifier, events);
}

function buildPage(
  db: DbConnection,
  thread: Thread,
  cursor: TimelinePaginationCursor | null,
) {
  return buildThreadTimelineWithProfile(db, thread, {
    eventBudget: LARGE_BUDGET,
    includeProviderUnhandledOperations: false,
    includeNestedRows: false,
    maxInlineOutputChars: 32_000,
    maxSeq: 0,
    page: cursor
      ? { kind: "older", beforeCursor: cursor, segmentLimit: 20 }
      : { kind: "latest", segmentLimit: 20 },
  });
}

interface WalkResult {
  maxEventDataBytes: number;
  pages: number;
  rows: TimelineRow[];
}

function walkAllPages(db: DbConnection, thread: Thread): WalkResult {
  const rowsByPage: TimelineRow[][] = [];
  let cursor: TimelinePaginationCursor | null = null;
  let maxEventDataBytes = 0;
  let pages = 0;
  for (;;) {
    const { profile, response } = buildPage(db, thread, cursor);
    pages += 1;
    maxEventDataBytes = Math.max(maxEventDataBytes, profile.eventDataBytes);
    rowsByPage.push(response.rows);
    if (!response.timelinePage.hasOlderRows) {
      break;
    }
    cursor = response.timelinePage.olderCursor;
    expect(cursor).not.toBeNull();
    expect(pages).toBeLessThan(50);
  }
  return { maxEventDataBytes, pages, rows: rowsByPage.reverse().flat() };
}

describe("workflow progress snapshots across timeline pages", () => {
  it("renders the spawning turn's summary once, not once per byte page", () => {
    const { db, thread } = setup();
    seedWorkflowThread(db, thread, { snapshotCount: SNAPSHOT_COUNT });
    expect(SNAPSHOT_BYTES * SNAPSHOT_COUNT).toBeGreaterThan(
      THREAD_TIMELINE_EVENT_DATA_BYTE_LIMIT * 2,
    );

    const walk = walkAllPages(db, thread);
    const turnRows = walk.rows.filter(
      (row): row is Extract<TimelineRow, { kind: "turn" }> =>
        row.kind === "turn",
    );
    const turnOneRows = turnRows.filter((row) => row.turnId === "turn-1");

    // One finished turn, one "Worked for" row — whatever the paging did.
    expect(turnOneRows.map((row) => row.id)).toHaveLength(1);
    // And no page ever emits a finished-turn row that lies entirely outside
    // the events that page actually covers.
    expect(new Set(turnRows.map((row) => row.id)).size).toBe(turnRows.length);
  });

  it("does not spend the byte budget on superseded progress snapshots", () => {
    const { db, thread } = setup();
    seedWorkflowThread(db, thread, { snapshotCount: SNAPSHOT_COUNT });

    const latest = buildPage(db, thread, null);
    // Only the latest snapshot per task is load-bearing (see
    // pruneBackgroundTaskProgressEvents), so the whole thread fits one page.
    expect(latest.response.timelinePage.hasOlderRows).toBe(false);
    expect(latest.profile.eventDataBytes).toBeLessThan(SNAPSHOT_BYTES * 3);
    expect(latest.response.activeWorkflows).toHaveLength(1);
    expect(
      latest.response.rows.filter((row) => row.kind === "turn"),
    ).toHaveLength(1);
  });
});
```

</details>

Live repro (dev server, real thread data):

1. Import the thread's rows into a fresh dev data dir: `hosts`, `projects`, `environments`, `threads`, and `events` for `thr_7wvd28jzpj` from `~/.bb/bb.db`; repoint the environment's `host_id` to the dev host.
2. Rewind so turn 2 is still pending (delete events with `sequence >= 3357`, set `threads.status = 'active'`).
3. The prod pruner had already removed most snapshots, so restore the shape at recording time: insert ~125 `item/backgroundTask/progress` rows for `task:wo2ev7ffn` (copy the `item/backgroundTask/completed` payload with `status: "pending"`, ~262 KB each) at free sequences 3160–3283 and 3287.
4. Open `/projects/proj_atixi2qwed/threads/thr_7wvd28jzpj` in the dev app.

Did **not** reproduce with the pruned event set (only 6 small progress rows left): the full timeline fits in one page and the turn row appears once. Did **not** reproduce once turn 2 completed and the workflow finished (the completed row prunes every snapshot).

### Expected vs actual

```text
# GET /api/v1/threads/thr_7wvd28jzpj/timeline  (latest page)
maxSeq 3287 rows 1 {'kind': 'latest', 'segmentLimit': 20, 'returnedSegmentCount': 1, 'hasOlderRows': True, 'olderCursor': {'anchorSeq': 3269, 'anchorId': 'thr_7wvd28jzpj:byte-window:3269'}}
turn thr_7wvd28jzpj:bt1ffa4a59-1-1:turn 17 232 1787096656563 1787097095120 completed

# following olderCursor, one page per 4 MiB of superseded snapshots:
--- page 2: rows=1 olderCursor byte-window:3253
    turn thr_7wvd28jzpj:bt1ffa4a59-1-1:turn:sequence-page:3253 17 232 1787096656563 1787097095120
--- page 3: rows=1 olderCursor byte-window:3237
    turn thr_7wvd28jzpj:bt1ffa4a59-1-1:turn:sequence-page:3237 17 232 1787096656563 1787097095120
--- page 4 … page 7: same row, ids …:sequence-page:3221 / 3205 / 3189 / 3173
--- page 8: rows=7 hasOlderRows=False
    conversation …:user-seed:1:sequence-page:1 …
    turn thr_7wvd28jzpj:bt1ffa4a59-1-1:turn:0:sequence-page:1 28 52 …
    conversation …:user-seed:53:sequence-page:1 …
    turn thr_7wvd28jzpj:bt1ffa4a59-1-1:turn:1:sequence-page:1 60 182 …
    conversation …:assistant-4:sequence-page:1 …
total rows 14 turn rows 9

# unit repro
× renders the spawning turn's summary once, not once per byte page
  AssertionError: expected [ …(4) ] to have a length of 1 but got 4
× does not spend the byte budget on superseded progress snapshots
  AssertionError: expected true to be false   (timelinePage.hasOlderRows)
```

In the app: after "Loading older messages…" finishes, seven `Worked for 7m 19s` rows are stacked between the turn-1 final message and "Working…" (the recording shows six; the count is the number of byte pages). Turn 1 really did take 7m 19s (`turn/started` 1787096656563 → `turn/completed` 1787097095120).

Expected: one `Worked for 7m 19s` row (from the page that holds turn 1's events), `hasOlderRows: false` on the latest page because only the newest snapshot per task needs to be read.

### Evidence

- Turn 1 is seq 17–232 (`bt1ffa4a59-1-1`); the workflow task `task:wo2ev7ffn` starts at seq 145 with `parentToolCallId: toolu_011jUEdpMS2naA1U8QPUaFMe` (seq 143/146, in turn 1). Turn 2 (`bt1ffa4a59-1-2`, seq 270, provider-opened, no input) is pending and holds only `local_bash` background tasks. Progress rows are thread-scoped and 250–263 KB each (`length(data)` on the `item/backgroundTask/completed` row for the same task is 253,331 bytes).
- Byte floor is computed over every non-excluded row: https://github.com/get-bb/bb/blob/b33abbff098ac4c857578e7350d492dcaa65d489/packages/db/src/data/events.ts#L2828-L2839 and https://github.com/get-bb/bb/blob/b33abbff098ac4c857578e7350d492dcaa65d489/packages/db/src/data/events.ts#L2877-L2946
- Only the latest snapshot per task is load-bearing: https://github.com/get-bb/bb/blob/b33abbff098ac4c857578e7350d492dcaa65d489/packages/db/src/data/events.ts#L3660-L3704 ; prune cadence: https://github.com/get-bb/bb/blob/b33abbff098ac4c857578e7350d492dcaa65d489/apps/server/src/services/system/event-pruning.ts#L62-L63
- Parent closure pulls the `Workflow` tool call from turn 1: https://github.com/get-bb/bb/blob/b33abbff098ac4c857578e7350d492dcaa65d489/apps/server/src/services/threads/timeline.ts#L463-L545 ; turn lifecycle closure: https://github.com/get-bb/bb/blob/b33abbff098ac4c857578e7350d492dcaa65d489/apps/server/src/services/threads/timeline.ts#L731-L782 ; byte-window mode clears `contextOnlyToolCallIds`: https://github.com/get-bb/bb/blob/b33abbff098ac4c857578e7350d492dcaa65d489/apps/server/src/services/threads/timeline.ts#L1479-L1482
- Non-overlapping turn rows are emitted verbatim with a page suffix: https://github.com/get-bb/bb/blob/b33abbff098ac4c857578e7350d492dcaa65d489/apps/server/src/services/threads/timeline.ts#L1524-L1566
- Investigation thread: `thr_dimqh92e2n` (bb project `proj_atixi2qwed`).

### What you ruled out

- Not #1714 (cross-turn item lifecycle in turn-summary details) or #1201: those are about item state, not extra turn rows.
- Not #1129 / PR #1199 regressing on its own tests: those cover byte pages of one large finished turn where each page really holds a slice of that turn. Here the turn is entirely below every byte page.
- Not the client merge: each page's turn row has a distinct id, so the client is right to keep them all.
- Still happens on `main` at `b33abbff0` (dev server built from this commit).

### Suggested priority and effort (optional)

Medium — hits every thread that runs a large Workflow while the turn is finished; no data loss; goes away after the next prune. Effort Low–Medium (server-side).

> AGENT GENERATED: by Claude Opus 5

