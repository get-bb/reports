/**
 * The two #2066 unit scenarios (repro-2066-unit.test.ts) rewritten against
 * PR #2067's `getOrBuild({ paramsKey, revisionKey }, build)` signature, so the
 * "pass after" half of the claim can be shown on the PR branch. The base-tree
 * version cannot run against the PR: it passes a string key and throws
 * `TypeError: Cannot read properties of undefined (reading 'value')`.
 *
 * Note: this file also fails on fcada5a3b (2 and 128 instead of 1) because the
 * base cache accepts the object as an opaque Map key, but that is a type error
 * at compile time, not evidence; use repro-2066-unit.test.ts for "fails before".
 */
import { describe, expect, it } from "vitest";
import type { ThreadTimelineResponse } from "@bb/server-contract";
import {
  buildThreadTimelineCacheKey,
  buildThreadTimelineParamsKey,
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

// Exactly what routes/threads/data.ts does on the PR branch.
const keysFor = (args: ThreadTimelineCacheKeyArgs) => ({
  paramsKey: buildThreadTimelineParamsKey(args),
  revisionKey: buildThreadTimelineCacheKey(args),
});

describe("#2066 unit (PR #2067 signature)", () => {
  it("replaces the previous revision of the same request shape", () => {
    const cache = createThreadTimelineCache();
    cache.getOrBuild(keysFor(shape), () => makeResponse(3));
    cache.getOrBuild(keysFor({ ...shape, maxSeq: 11 }), () => makeResponse(3));
    expect(cache.size).toBe(1);
  });

  it("keeps one entry for a single streaming thread regardless of revision count", () => {
    const cache = createThreadTimelineCache();
    for (let maxSeq = 1; maxSeq <= 500; maxSeq++) {
      cache.getOrBuild(keysFor({ ...shape, maxSeq }), () => makeResponse(3));
    }
    expect(cache.size).toBe(1);
  });
});
