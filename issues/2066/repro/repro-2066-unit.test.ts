/**
 * Unit-level repro for get-bb/bb#2066 against the cache in isolation, using the
 * exact key builder the route uses. Two revisions (maxSeq 10 then 11) of one
 * request shape leave two resident entries although only the newest can ever
 * be looked up again (a thread's maxSeq never decreases).
 */
import { describe, expect, it } from "vitest";
import type { ThreadTimelineResponse } from "@bb/server-contract";
import {
  buildThreadTimelineCacheKey,
  createThreadTimelineCache,
  type ThreadTimelineCacheKeyArgs,
} from "../../../src/services/threads/timeline-cache.js";

function makeResponse(rowCount: number): ThreadTimelineResponse {
  return {
    rows: Array.from({ length: rowCount }, (_, index) => ({
      id: `row-${index}`,
      kind: "system",
      threadId: "thr_x",
      turnId: null,
      sourceSeqStart: index,
      sourceSeqEnd: index,
      startedAt: 0,
      createdAt: 0,
      systemKind: "debug",
      title: "t",
      detail: null,
      status: null,
    })),
    activePromptMode: null,
    activeThinking: null,
    activeWorkflows: [],
    activeBackgroundCommands: [],
    pendingTodos: null,
    goal: null,
    modelFallback: null,
    maxSeq: 0,
    timelinePage: {
      kind: "latest",
      segmentLimit: 20,
      returnedSegmentCount: 0,
      hasOlderRows: false,
      olderCursor: null,
    },
  };
}

const shape: ThreadTimelineCacheKeyArgs = {
  threadId: "thr_x",
  maxSeq: 10,
  status: "active",
  environmentId: null,
  page: { kind: "latest", segmentLimit: 20 },
  includeNestedRows: false,
  summaryOnly: false,
  includeProviderUnhandledOperations: false,
};

describe("#2066 unit", () => {
  it("replaces the previous revision of the same request shape", () => {
    const cache = createThreadTimelineCache();
    cache.getOrBuild(buildThreadTimelineCacheKey(shape), () => makeResponse(3));
    cache.getOrBuild(buildThreadTimelineCacheKey({ ...shape, maxSeq: 11 }), () =>
      makeResponse(3),
    );
    // Expected 1 (only maxSeq 11 is reachable). Actual on fcada5a3b: 2.
    expect(cache.size).toBe(1);
  });

  it("is bounded only by the global LRU for a single streaming thread", () => {
    const cache = createThreadTimelineCache();
    for (let maxSeq = 1; maxSeq <= 500; maxSeq++) {
      cache.getOrBuild(buildThreadTimelineCacheKey({ ...shape, maxSeq }), () =>
        makeResponse(3),
      );
    }
    // Expected 1. Actual on fcada5a3b: 128 (DEFAULT_MAX_ENTRIES).
    expect(cache.size).toBe(1);
  });
});
