import { describe, expect, it } from "vitest";
import type { PromptInput } from "@bb/domain";
import { createConnection } from "../../src/connection.js";
import { migrate } from "../../src/migrate.js";
import { noopNotifier } from "../../src/notifier.js";
import {
  claimNextQueuedThreadMessageGroup,
  createQueuedThreadMessage,
  hasQueuedThreadMessages,
  listQueuedThreadMessages,
  releaseStaleQueuedMessageClaims,
} from "../../src/data/queued-thread-messages.js";
import { createProject } from "../../src/data/projects.js";
import { createThread } from "../../src/data/threads.js";
import { upsertHost } from "../../src/data/hosts.js";

// Issue #1706: a queued message that is *claimed* by the drain worker (or
// orphaned by a server restart mid-drain) is still stored, but the public
// queue listing (`GET /threads/:id/queued-messages`, `bb thread queue list`)
// hides it. To an observer the message is "accepted, not delivered, not
// queued" until the claim is consumed or released (stale after 5 minutes).

function textInput(text: string): PromptInput[] {
  return [{ type: "text", text, mentions: [] }];
}

function setup() {
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
    providerId: "codex",
  });
  return { db, thread };
}

describe("issue #1706: claimed queued messages disappear from the queue listing", () => {
  it("hides a claimed (in-flight or orphaned) message from listQueuedThreadMessages", () => {
    const { db, thread } = setup();
    createQueuedThreadMessage(db, noopNotifier, {
      threadId: thread.id,
      content: textInput("MARKER queued while target was active"),
      model: "gpt-5",
      reasoningLevel: "medium",
      permissionMode: "accept-edits",
      serviceTier: "default",
      senderThreadId: null,
    });
    expect(listQueuedThreadMessages(db, thread.id)).toHaveLength(1);

    // The auto-send worker claims the message before dispatching it.
    const claimed = claimNextQueuedThreadMessageGroup(
      db,
      noopNotifier,
      thread.id,
    );
    expect(claimed).not.toBeNull();

    // The row is still durably stored ...
    expect(hasQueuedThreadMessages(db, thread.id)).toBe(true);
    // ... but the public listing (what `bb thread queue list` shows) is empty.
    // This is the "not queued" observation from the issue.
    expect(listQueuedThreadMessages(db, thread.id)).toEqual([]);

    // A stale-claim release younger than the 5 minute threshold does not
    // bring it back either (claimedBefore = now - 5min in the sweep).
    releaseStaleQueuedMessageClaims(db, noopNotifier, {
      claimedBefore: Date.now() - 5 * 60 * 1000,
      protectedClaimTokens: [],
    });
    expect(listQueuedThreadMessages(db, thread.id)).toEqual([]);

    // Only once the claim is considered stale does the message reappear.
    releaseStaleQueuedMessageClaims(db, noopNotifier, {
      claimedBefore: Date.now() + 1,
      protectedClaimTokens: [],
    });
    expect(listQueuedThreadMessages(db, thread.id)).toHaveLength(1);
  });
});
