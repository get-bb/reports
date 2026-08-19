// Seeds a thread that mirrors issue #1868 into a dev bb.db: finished turn 1
// started a Workflow background task; turn 2 is pending; 45 superseded
// ~300 KB workflow progress snapshots are stacked above the 4 MiB byte budget.
// usage: pnpm exec tsx seed-1868.ts <path/to/bb.db> <projectId>
import {
  encodeClientTurnRequestIdNumber,
  LOCAL_WORKFLOW_TASK_TYPE,
  threadScope,
  turnScope,
} from "@bb/domain";
import {
  createConnection,
  createThread,
  insertEvents,
  noopNotifier,
} from "@bb/db";

const [dbPath, projectId] = process.argv.slice(2);
if (!dbPath || !projectId) {
  throw new Error("usage: tsx seed-1868.ts <bb.db> <projectId>");
}
const db = createConnection(dbPath);
const thread = createThread(db, noopNotifier, {
  projectId,
  providerId: "claude-code",
  title: "issue 1868 repro",
  status: "active",
});

const providerThreadId = "provider-root";
const WORKFLOW_CALL_ID = "call-workflow";
const WORKFLOW_TASK_ID = "task:wf-1";
const SNAPSHOT_BYTES = 300_000;
const SNAPSHOT_COUNT = 45;
const execution = {
  model: "claude-opus-4",
  serviceTier: "default",
  reasoningLevel: "medium",
  permissionMode: "full",
  source: "client/turn/requested",
} as const;

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

type EventInput = Parameters<typeof insertEvents>[2][number];
const events: EventInput[] = [];
let sequence = 0;
const base = Date.now() - 20 * 60_000;
const push = (
  event: Omit<EventInput, "sequence" | "threadId">,
  at: number,
): void => {
  sequence += 1;
  events.push({ ...event, sequence, threadId: thread.id, createdAt: at });
};
const clientRequestId = encodeClientTurnRequestIdNumber({ value: 1 });
push(
  {
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
  },
  base,
);
push(
  {
    type: "turn/started",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: null,
    itemKind: null,
    data: "{}",
  },
  base + 1000,
);
push(
  {
    type: "turn/input/accepted",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: null,
    itemKind: null,
    data: JSON.stringify({ clientRequestId }),
  },
  base + 1100,
);
push(
  {
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
  },
  base + 2000,
);
push(
  {
    type: "item/started",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: WORKFLOW_TASK_ID,
    itemKind: "backgroundTask",
    data: workflowTaskData({ status: "pending", padding: 0 }),
  },
  base + 2500,
);
push(
  {
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
  },
  base + 3000,
);
push(
  {
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
  },
  base + 4000,
);
// Turn 1 took 7m 19s, like the real thread in the issue.
push(
  {
    type: "turn/completed",
    scope: turnScope("turn-1"),
    providerThreadId,
    itemId: null,
    itemKind: null,
    data: JSON.stringify({ status: "completed", providerThreadId }),
  },
  base + 1000 + 439_000,
);
push(
  {
    type: "turn/started",
    scope: turnScope("turn-2"),
    providerThreadId,
    itemId: null,
    itemKind: null,
    data: "{}",
  },
  base + 445_000,
);
for (let index = 0; index < SNAPSHOT_COUNT; index += 1) {
  push(
    {
      type: "item/backgroundTask/progress",
      scope: threadScope(),
      providerThreadId,
      itemId: WORKFLOW_TASK_ID,
      itemKind: "backgroundTask",
      data: workflowTaskData({ status: "pending", padding: SNAPSHOT_BYTES }),
    },
    base + 446_000 + index * 4000,
  );
}
insertEvents(db, noopNotifier, events);
console.log(JSON.stringify({ threadId: thread.id, events: events.length }));
