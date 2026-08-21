/**
 * Repro for get-bb/bb#2066: the timeline response cache keys on `maxSeq`, so
 * every appended event leaves the previous revision resident (and unreachable,
 * because a thread's maxSeq is monotonic) until global LRU eviction.
 *
 * Drives the REAL `GET /api/v1/threads/:id/timeline` route against an
 * in-memory SQLite database. The only instrumentation is wrapping the cache
 * factory so the test can read `.size` of the instance the route creates.
 */
import { describe, expect, it, vi } from "vitest";
import { threadScope, turnScope } from "@bb/domain";
import { threadTimelineResponseSchema } from "@bb/server-contract";
import { seedEvent, seedThreadFixture } from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";
import type { TestAppHarness } from "../helpers/test-app.js";
import type { createThreadTimelineCache as CreateCache } from "../../src/services/threads/timeline-cache.js";

const createdCaches: ReturnType<typeof CreateCache>[] = [];

vi.mock(
  "../../src/services/threads/timeline-cache.js",
  async (importOriginal) => {
    const mod =
      await importOriginal<
        typeof import("../../src/services/threads/timeline-cache.js")
      >();
    return {
      ...mod,
      createThreadTimelineCache: (
        ...args: Parameters<typeof mod.createThreadTimelineCache>
      ) => {
        const cache = mod.createThreadTimelineCache(...args);
        createdCaches.push(cache);
        return cache;
      },
    };
  },
);

async function fetchTimeline(harness: TestAppHarness, threadId: string) {
  const response = await harness.app.request(
    `/api/v1/threads/${threadId}/timeline`,
  );
  expect(response.status).toBe(200);
  const text = await response.text();
  return {
    bytes: Buffer.byteLength(text),
    body: threadTimelineResponseSchema.parse(JSON.parse(text)),
  };
}

describe("#2066 timeline cache retains superseded revisions", () => {
  it("keeps one resident response per appended event for the same request shape", async () => {
    await withTestHarness(async (harness) => {
      const cache = createdCaches.at(-1);
      if (!cache) {
        throw new Error("route did not create a timeline cache");
      }
      const { environment, thread } = seedThreadFixture(harness);
      const base = {
        threadId: thread.id,
        environmentId: environment.id,
        providerThreadId: "p1",
      } as const;

      // A completed turn with a sizeable assistant message so each cached
      // revision carries real payload weight.
      const bigText = "lorem ipsum ".repeat(2_000); // ~24 KB
      seedEvent(harness.deps, {
        ...base,
        scope: threadScope(),
        sequence: 1,
        type: "system/manager/user_message",
        data: { text: "hello" },
      });
      seedEvent(harness.deps, {
        ...base,
        scope: turnScope("turn-1"),
        sequence: 2,
        type: "turn/started",
        data: {},
      });
      seedEvent(harness.deps, {
        ...base,
        scope: turnScope("turn-1"),
        sequence: 3,
        type: "item/completed",
        data: { item: { type: "agentMessage", id: "a-1", text: bigText } },
      });
      seedEvent(harness.deps, {
        ...base,
        scope: turnScope("turn-1"),
        sequence: 4,
        type: "turn/completed",
        data: { status: "completed" },
      });

      const first = await fetchTimeline(harness, thread.id);
      expect(first.body.maxSeq).toBe(4);
      expect(cache.size).toBe(1);
      // Well under the 200-row cap, so every revision is cacheable.
      expect(first.body.rows.length).toBeLessThan(200);

      // A second, streaming turn: each appended event bumps maxSeq and the
      // client refetches the same window (same request shape).
      seedEvent(harness.deps, {
        ...base,
        scope: turnScope("turn-2"),
        sequence: 5,
        type: "turn/started",
        data: {},
      });
      const rounds = 150;
      let lastRows = 0;
      for (let i = 0; i < rounds; i++) {
        seedEvent(harness.deps, {
          ...base,
          scope: turnScope("turn-2"),
          sequence: 6 + i,
          type: "item/completed",
          data: {
            item: {
              type: "agentMessage",
              id: `a-2-${i}`,
              text: `chunk ${i}`,
            },
          },
        });
        const page = await fetchTimeline(harness, thread.id);
        expect(page.body.maxSeq).toBe(6 + i);
        lastRows = page.body.rows.length;
        // Still cacheable (row count grows slowly; stays <= 200 here).
        expect(lastRows).toBeLessThanOrEqual(200);
      }

      // A thread's maxSeq is monotonic (getLatestThreadSequence = MAX(sequence)),
      // so only the entry keyed by the newest maxSeq can ever be hit again.
      // Every other entry is dead weight. Expected: 1 live revision.
      // Actual on fcada5a3b: the global LRU bound (128) of dead revisions.
      // eslint-disable-next-line no-console
      console.log(
        `[2066] first-response bytes=${first.bytes} rows(last)=${lastRows} rounds=${rounds} cache.size=${cache.size}`,
      );
      expect(cache.size).toBe(1);
    });
  });
});
