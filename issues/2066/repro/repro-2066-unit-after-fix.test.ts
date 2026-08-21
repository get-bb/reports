/**
 * The two #2066 unit scenarios (repro-2066-unit.test.ts) written against the
 * proposed fix's `getOrBuild({ paramsKey, maxSeq }, build)` signature
 * (proposed-fix-2066.diff). Run on fcada5a3b + proposed-fix-2066.diff.
 * Does not apply to fcada5a3b (string key) or PR #2067 (`revisionKey`).
 */
import { describe, expect, it } from "vitest";
import type { ThreadTimelineResponse } from "@bb/server-contract";
import {
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
  status: "active",
  environmentId: null,
  page: { kind: "latest", segmentLimit: 20 },
  includeNestedRows: false,
  summaryOnly: false,
  includeProviderUnhandledOperations: false,
};
const paramsKey = buildThreadTimelineParamsKey(shape);

describe("#2066 unit (proposed-fix signature)", () => {
  it("replaces the previous revision of the same request shape", () => {
    const cache = createThreadTimelineCache();
    cache.getOrBuild({ paramsKey, maxSeq: 10 }, () => makeResponse(3));
    cache.getOrBuild({ paramsKey, maxSeq: 11 }, () => makeResponse(3));
    expect(cache.size).toBe(1);
  });

  it("keeps one entry for a single streaming thread regardless of revision count", () => {
    const cache = createThreadTimelineCache();
    for (let maxSeq = 1; maxSeq <= 500; maxSeq++) {
      cache.getOrBuild({ paramsKey, maxSeq }, () => makeResponse(3));
    }
    expect(cache.size).toBe(1);
  });
});
