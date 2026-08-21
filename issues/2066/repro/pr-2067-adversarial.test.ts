/**
 * Adversarial checks for PR #2067 (one timeline revision per request shape).
 * Exercises paths the PR's own tests do not: an oversized replacement must
 * drop the previous cacheable revision, a replacement must become MRU, and a
 * hit on the newest revision must not be disturbed by a sibling shape.
 */
import { describe, expect, it, vi } from "vitest";
import type { ThreadTimelineResponse } from "@bb/server-contract";
import { createThreadTimelineCache } from "../../../src/services/threads/timeline-cache.js";

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

const k = (paramsKey: string, maxSeq: number) => ({
  paramsKey,
  revisionKey: `${maxSeq}|${paramsKey}`,
});

describe("PR #2067 adversarial", () => {
  it("an oversized newer revision evicts the previous cacheable revision (claimed in PR body, untested there)", () => {
    const cache = createThreadTimelineCache({ maxCacheableRows: 5 });
    cache.getOrBuild(k("shape", 1), () => makeResponse(3));
    expect(cache.size).toBe(1);
    cache.getOrBuild(k("shape", 2), () => makeResponse(50));
    expect(cache.size).toBe(0);
  });

  it("a replacement is most-recently-used for LRU purposes", () => {
    const cache = createThreadTimelineCache({ maxEntries: 2 });
    cache.getOrBuild(k("a", 1), () => makeResponse(1)); // [a]
    cache.getOrBuild(k("b", 1), () => makeResponse(1)); // [a,b]
    cache.getOrBuild(k("a", 2), () => makeResponse(1)); // replace a -> [b,a]
    cache.getOrBuild(k("c", 1), () => makeResponse(1)); // evict b -> [a,c]
    const rebuild = vi.fn(() => makeResponse(1));
    cache.getOrBuild(k("a", 2), rebuild);
    expect(rebuild).not.toHaveBeenCalled();
    cache.getOrBuild(k("b", 1), rebuild);
    expect(rebuild).toHaveBeenCalledTimes(1);
  });

  it("a stale revision request never returns the newer cached value", () => {
    const cache = createThreadTimelineCache();
    const v2 = makeResponse(2);
    cache.getOrBuild(k("shape", 2), () => v2);
    const v1 = makeResponse(1);
    const got = cache.getOrBuild(k("shape", 1), () => v1);
    expect(got).toBe(v1);
    // And the lower revision now owns the slot (caller-supplied truth wins).
    expect(cache.getOrBuild(k("shape", 1), () => makeResponse(9))).toBe(v1);
  });

  it("bounded: N revisions of one shape never exceed one entry", () => {
    const cache = createThreadTimelineCache();
    for (let seq = 1; seq <= 1000; seq++) {
      cache.getOrBuild(k("shape", seq), () => makeResponse(3));
    }
    expect(cache.size).toBe(1);
  });
});
