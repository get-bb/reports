import { describe, expect, it } from "vitest";
import {
  encodeClientTurnRequestIdNumber,
  threadScope,
  type PromptInput,
} from "@bb/domain";
import { createConnection } from "../../src/connection.js";
import { migrate } from "../../src/migrate.js";
import { noopNotifier } from "../../src/notifier.js";
import { appendStoredThreadEvent } from "../../src/data/events.js";
import { upsertHost } from "../../src/data/hosts.js";
import { createProject } from "../../src/data/projects.js";
import {
  createThread,
  searchThreadsWithPendingInteractionState,
} from "../../src/data/threads.js";

// Issue #1768: "[bb system] Child thread updates" notifications are stored as
// system-initiated client/turn/requested events on the parent thread. Verify
// whether thread search indexes/finds them.
describe("issue 1768: child-thread notification searchability", () => {
  it("finds a system-initiated child-thread outcome batch message via search", () => {
    const db = createConnection(":memory:");
    migrate(db);
    const host = upsertHost(db, noopNotifier, { name: "h", type: "persistent" });
    const { project } = createProject(db, noopNotifier, {
      name: "p",
      source: { type: "local_path", hostId: host.id, path: "/tmp/p" },
    });
    const parent = createThread(db, noopNotifier, {
      projectId: project.id,
      providerId: "codex",
      title: "orchestrator",
    });
    const input: PromptInput[] = [
      {
        type: "text",
        text: "[bb system]\n\nChild thread updates:\n\n- @thread:thr_a failed.\n- @thread:thr_b completed.",
        mentions: [],
      },
    ];
    appendStoredThreadEvent(db, noopNotifier, {
      threadId: parent.id,
      environmentId: null,
      type: "client/turn/requested",
      scope: threadScope(),
      data: {
        direction: "outbound",
        requestId: encodeClientTurnRequestIdNumber({ value: 1 }),
        source: "tell",
        initiator: "system",
        senderThreadId: null,
        systemMessageKind: "child-outcome-batch",
        systemMessageSubject: { kind: "thread-batch", count: 2 },
        input,
        target: { kind: "new-turn" },
        request: { method: "turn/start", params: {} },
        execution: {
          model: "gpt-5",
          serviceTier: "default",
          reasoningLevel: "medium",
          permissionMode: "full",
          source: "client/turn/requested",
        },
      },
    });

    const segments = db.$client
      .prepare(
        "SELECT source_kind, text FROM thread_search_segments WHERE thread_id = ?",
      )
      .all(parent.id);
    console.log("indexed segments:", JSON.stringify(segments, null, 2));

    const result = searchThreadsWithPendingInteractionState(db, {
      query: "Child thread updates",
      limitPerGroup: 10,
    });
    console.log("search result:", JSON.stringify(result.active, null, 2));
    expect(result.active.total).toBe(1);
    expect(result.active.results[0]?.matches[0]?.text).toContain(
      "Child thread updates",
    );
    db.$client.close();
  });

  it("does NOT find the same message when the parent thread is hidden (visibility filter)", () => {
    const db = createConnection(":memory:");
    migrate(db);
    const host = upsertHost(db, noopNotifier, { name: "h", type: "persistent" });
    const { project } = createProject(db, noopNotifier, {
      name: "p",
      source: { type: "local_path", hostId: host.id, path: "/tmp/p" },
    });
    const parent = createThread(db, noopNotifier, {
      projectId: project.id,
      providerId: "codex",
      title: "hidden orchestrator",
      visibility: "hidden",
    });
    appendStoredThreadEvent(db, noopNotifier, {
      threadId: parent.id,
      environmentId: null,
      type: "client/turn/requested",
      scope: threadScope(),
      data: {
        direction: "outbound",
        requestId: encodeClientTurnRequestIdNumber({ value: 1 }),
        source: "tell",
        initiator: "system",
        senderThreadId: null,
        systemMessageKind: "child-outcome-batch",
        systemMessageSubject: { kind: "thread-batch", count: 2 },
        input: [
          {
            type: "text",
            text: "[bb system]\n\nChild thread updates:\n\n- @thread:thr_a failed.",
            mentions: [],
          },
        ],
        target: { kind: "new-turn" },
        request: { method: "turn/start", params: {} },
        execution: {
          model: "gpt-5",
          serviceTier: "default",
          reasoningLevel: "medium",
          permissionMode: "full",
          source: "client/turn/requested",
        },
      },
    });
    const indexed = db.$client
      .prepare("SELECT count(*) AS n FROM thread_search_segments WHERE thread_id = ? AND source_kind = 'user_message'")
      .get(parent.id) as { n: number };
    expect(indexed.n).toBe(1); // it IS indexed...
    const result = searchThreadsWithPendingInteractionState(db, {
      query: "Child thread updates",
      limitPerGroup: 10,
    });
    expect(result.active.total).toBe(0); // ...but hidden threads are filtered out of results
    db.$client.close();
  });
});
