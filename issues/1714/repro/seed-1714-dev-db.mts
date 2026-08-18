/**
 * Seeds the #1714 event shape into a running dev instance's bb.db so the bug
 * can be observed through the real API/UI. Usage:
 *   BB_DB=/path/to/bb.db BB_PROJECT_ID=proj_xxx pnpm exec tsx test/services/threads/seed-1714-dev-db.mts
 * Prints the created thread id.
 */
import { turnScope } from "@bb/domain";
import {
  createConnection,
  createThread,
  insertEvents,
  noopNotifier,
} from "@bb/db";

const dbPath = process.env.BB_DB;
const projectId = process.env.BB_PROJECT_ID;
if (!dbPath || !projectId) {
  throw new Error("BB_DB and BB_PROJECT_ID are required");
}
const db = createConnection(dbPath);
const thread = createThread(db, noopNotifier, {
  projectId,
  providerId: "claude-code",
  title: "issue-1714 repro (seeded)",
});
const providerThreadId = "provider-root";
type EventInput = Parameters<typeof insertEvents>[2][number];
const events: EventInput[] = [];
let sequence = 0;
const push = (event: Omit<EventInput, "sequence" | "threadId">): void => {
  sequence += 1;
  events.push({ ...event, sequence, threadId: thread.id });
};
push({ type: "turn/started", scope: turnScope("turn-1"), providerThreadId, itemId: null, itemKind: null, data: JSON.stringify({}) });
push({ type: "item/started", scope: turnScope("turn-1"), providerThreadId, itemId: "call-1", itemKind: "commandExecution",
  data: JSON.stringify({ item: { type: "commandExecution", id: "call-1", command: "npm run dev", cwd: "/tmp/bb-1714-qa", status: "pending", approvalStatus: null } }) });
push({ type: "item/completed", scope: turnScope("turn-1"), providerThreadId, itemId: "msg-1", itemKind: "agentMessage",
  data: JSON.stringify({ item: { type: "agentMessage", id: "msg-1", text: "Dev server is starting." } }) });
push({ type: "turn/completed", scope: turnScope("turn-1"), providerThreadId, itemId: null, itemKind: null, data: JSON.stringify({ status: "completed", providerThreadId }) });
push({ type: "turn/started", scope: turnScope("turn-2"), providerThreadId, itemId: null, itemKind: null, data: JSON.stringify({}) });
push({ type: "item/completed", scope: turnScope("turn-2"), providerThreadId, itemId: "call-1", itemKind: "toolCall",
  data: JSON.stringify({ item: { type: "toolCall", id: "call-1", tool: "unknown", status: "completed", result: "dev server exited with code 0" } }) });
push({ type: "item/completed", scope: turnScope("turn-2"), providerThreadId, itemId: "msg-2", itemKind: "agentMessage",
  data: JSON.stringify({ item: { type: "agentMessage", id: "msg-2", text: "Second turn done." } }) });
push({ type: "turn/completed", scope: turnScope("turn-2"), providerThreadId, itemId: null, itemKind: null, data: JSON.stringify({ status: "completed", providerThreadId }) });
insertEvents(db, noopNotifier, events);
console.log(thread.id);
