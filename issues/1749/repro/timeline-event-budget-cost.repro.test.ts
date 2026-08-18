/**
 * Repro / measurement for get-bb/bb#1749.
 *
 * `defaultFeatureFlags.timelineWindowEventBudget` (1500) is justified by a
 * "~0.06ms/event" figure and a "cold build near 100ms" target. This test seeds
 * a realistic long-tail fixture (the same generator `pnpm seed:perf` uses),
 * builds the latest page for every thread the way the route does, and prints
 * the measured cost per event so the reader can compare with that figure.
 *
 * The one assertion encodes the *documented* budget: a full 1500-event window
 * must build in <= 100ms at p50 on the machine running the test. It passes on
 * fast hardware and fails on slow hardware, which is precisely the issue.
 */
import { appendFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import {
  createConnection,
  createProject,
  createThread,
  getThread,
  insertEvents,
  migrate,
  noopNotifier,
  upsertHost,
} from "@bb/db";
import type { DbConnection } from "@bb/db";
import {
  defaultFeatureFlags,
  encodeClientTurnRequestIdNumber,
  threadScope,
  turnScope,
} from "@bb/domain";
import type { Thread } from "@bb/domain";
import { seedPerfFixture } from "../../../../../packages/scripts/src/lib/seed-perf-fixture.js";
import { buildThreadTimelineWithProfile } from "../../../src/services/threads/timeline.js";
import { DEFAULT_MAX_INLINE_OUTPUT_CHARS } from "../../../src/services/threads/timeline-output-truncation.js";

const EVENT_BUDGET = defaultFeatureFlags.timelineWindowEventBudget;

/** vitest silences passing-test stdout here, so also append to a file when asked. */
function report(text: string): void {
  // eslint-disable-next-line no-console
  console.log(text);
  const out = process.env["REPRO_1749_OUT"];
  if (out) appendFileSync(out, `${text}\n\n`);
}
const DOCUMENTED_MS_PER_EVENT = 0.06;
const DOCUMENTED_COLD_BUILD_TARGET_MS = 100;

interface Sample {
  threadId: string;
  totalEvents: number;
  eventRowCount: number;
  eventDataBytes: number;
  strategy: string;
  responseRows: number;
  ms: number;
  stages: Record<string, number>;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[idx] ?? 0;
}

function build(db: DbConnection, threadId: string, budget: number) {
  const thread = getThread(db, threadId);
  if (!thread) throw new Error("missing thread");
  return buildThreadTimelineWithProfile(db, thread, {
    eventBudget: budget,
    includeProviderUnhandledOperations: false,
    includeNestedRows: false,
    maxInlineOutputChars: DEFAULT_MAX_INLINE_OUTPUT_CHARS,
    maxSeq: 0,
    page: { kind: "latest", segmentLimit: 20 },
    planCommand: null,
    summaryOnly: false,
  });
}

describe("#1749 timelineWindowEventBudget calibration", () => {
  it("per-event build cost across the perf fixture (informational; segment limit binds before the event budget)", () => {
    const db = createConnection(":memory:");
    migrate(db);
    const seeded = seedPerfFixture(db, {
      hostId: "host_repro_1749",
      workspacesRootPath: "/tmp/repro-1749",
      projectCount: 2,
      threadCount: 60,
      eventCount: 60_000,
      randomSeed: 1749,
    });
    const totalEventsByThread = new Map<string, number>();
    for (const row of db.all<{ threadId: string; n: number }>(
      sql`select thread_id as threadId, count(*) as n from events group by thread_id`,
    )) {
      totalEventsByThread.set(row.threadId, row.n);
    }

    // Warm SQLite page cache + JIT once, then take the measured pass.
    for (const id of seeded.threadIds) build(db, id, EVENT_BUDGET);

    const samples: Sample[] = [];
    for (const id of seeded.threadIds) {
      const runs: number[] = [];
      let last: ReturnType<typeof build> | null = null;
      for (let i = 0; i < 5; i += 1) {
        last = build(db, id, EVENT_BUDGET);
        runs.push(last.profile.totalDurationMs);
      }
      if (!last) continue;
      const p = last.profile;
      const stages: Record<string, number> = {};
      for (const s of p.stageTimings) stages[s.stage] = s.durationMs;
      samples.push({
        threadId: id,
        totalEvents: totalEventsByThread.get(id) ?? 0,
        eventRowCount: p.eventRowCount,
        eventDataBytes: p.eventDataBytes,
        strategy: p.selectionStrategy,
        responseRows: p.responseRowCount,
        ms: percentile(runs, 50),
        stages,
      });
    }

    samples.sort((a, b) => b.eventRowCount - a.eventRowCount);
    const measured = samples.filter((s) => s.eventRowCount >= 200);
    const perEvent = measured.map((s) => s.ms / s.eventRowCount);
    const perKB = measured.map((s) => s.ms / (s.eventDataBytes / 1024));
    const bound = samples.filter((s) => s.totalEvents > EVENT_BUDGET).length;

    const lines: string[] = [];
    lines.push(`host: ${process.arch} node ${process.version}`);
    lines.push(
      `threads=${samples.length} budget=${EVENT_BUDGET} threadsWhereBudgetBinds=${bound}`,
    );
    lines.push(
      `ms/event (threads>=200 events, n=${perEvent.length}): p50=${percentile(perEvent, 50).toFixed(3)} p90=${percentile(perEvent, 90).toFixed(3)} max=${Math.max(...perEvent).toFixed(3)}  (documented: ${DOCUMENTED_MS_PER_EVENT})`,
    );
    lines.push(
      `ms/KiB  (same threads): p50=${percentile(perKB, 50).toFixed(3)} p90=${percentile(perKB, 90).toFixed(3)}`,
    );
    lines.push("");
    lines.push(
      "threadEvents  windowEvents  windowKiB  bytes/evt  strategy  respRows  buildMs  ms/evt   query  decode  project",
    );
    for (const s of samples.slice(0, 25)) {
      lines.push(
        `${String(s.totalEvents).padStart(12)}  ${String(s.eventRowCount).padStart(12)}  ${(s.eventDataBytes / 1024).toFixed(0).padStart(9)}  ${(s.eventDataBytes / Math.max(1, s.eventRowCount)).toFixed(0).padStart(9)}  ${s.strategy.padEnd(8)}  ${String(s.responseRows).padStart(8)}  ${s.ms.toFixed(1).padStart(7)}  ${(s.ms / Math.max(1, s.eventRowCount)).toFixed(3).padStart(6)}  ${(s.stages["event-query"] ?? 0).toFixed(1).padStart(6)}  ${(s.stages["event-json-decode"] ?? 0).toFixed(1).padStart(6)}  ${(s.stages["thread-view-projection"] ?? 0).toFixed(1).padStart(7)}`,
      );
    }
    const fullWindows = samples.filter(
      (s) => s.eventRowCount >= EVENT_BUDGET * 0.9,
    );
    const fullWindowP50 = percentile(
      fullWindows.map((s) => s.ms),
      50,
    );
    lines.push("");
    lines.push(
      `full-window builds (>= ${EVENT_BUDGET * 0.9} events, n=${fullWindows.length}): p50=${fullWindowP50.toFixed(1)}ms  target=${DOCUMENTED_COLD_BUILD_TARGET_MS}ms`,
    );
    // eslint-disable-next-line no-console
    report(lines.join("\n"));

    // The seed fixture's turns are short (8-60 items), so segmentLimit=20
    // binds before the event budget does; this scenario is informational.
    expect(samples.length).toBeGreaterThan(0);
    void fullWindows;
    void fullWindowP50;
  }, 600_000);

  it("long agentic turns: a full 1500-event window at ~1.2KB/event vs the 100ms target", () => {
    // Shape from the issue's representative logged build: eventRowCount 1257,
    // eventDataBytes 1481754 (~1179 bytes/event), 96 response rows from
    // segmentLimit 20 — i.e. very few user messages, very many events.
    const db = createConnection(":memory:");
    migrate(db);
    const host = upsertHost(db, noopNotifier, {
      name: "h",
      type: "persistent",
    });
    const { project } = createProject(db, noopNotifier, {
      name: "p",
      source: { type: "local_path", hostId: host.id, path: "/tmp/p" },
    });
    const thread = createThread(db, noopNotifier, {
      projectId: project.id,
      providerId: "codex",
    });
    insertLongAgenticTurns(db, thread, { turnCount: 6, eventsPerTurn: 500 });

    const rows: string[] = [];
    let defaultBudgetP50 = Number.NaN;
    let defaultBudgetWindowEvents = 0;
    for (const budget of [EVENT_BUDGET, 400]) {
      for (let i = 0; i < 3; i += 1) build(db, thread.id, budget);
      const runs: number[] = [];
      let last = build(db, thread.id, budget);
      for (let i = 0; i < 9; i += 1) {
        last = build(db, thread.id, budget);
        runs.push(last.profile.totalDurationMs);
      }
      const p = last.profile;
      const stages = Object.fromEntries(
        p.stageTimings.map((s) => [s.stage, s.durationMs]),
      );
      const p50 = percentile(runs, 50);
      rows.push(
        `budget=${budget}: strategy=${p.selectionStrategy} windowEvents=${p.eventRowCount} windowKiB=${(p.eventDataBytes / 1024).toFixed(0)} bytes/evt=${(p.eventDataBytes / Math.max(1, p.eventRowCount)).toFixed(0)} respRows=${p.responseRowCount} segments=${p.returnedSegmentCount} build p50=${p50.toFixed(1)}ms max=${Math.max(...runs).toFixed(1)}ms ms/evt=${(p50 / p.eventRowCount).toFixed(3)} [query=${stages["event-query"]?.toFixed(1)} decode=${stages["event-json-decode"]?.toFixed(1)} project=${stages["thread-view-projection"]?.toFixed(1)}]`,
      );
      if (budget === EVENT_BUDGET) {
        defaultBudgetP50 = p50;
        defaultBudgetWindowEvents = p.eventRowCount;
      }
    }
    // eslint-disable-next-line no-console
    report(rows.join("\n"));

    // The one assertion: the documented "cold build near 100ms" target, for a
    // window that actually fills the default budget. Passes on fast hardware,
    // fails on slow hardware — which is the issue.
    expect(defaultBudgetWindowEvents).toBeGreaterThanOrEqual(1_000);
    expect(defaultBudgetP50).toBeLessThanOrEqual(
      DOCUMENTED_COLD_BUILD_TARGET_MS,
    );
  }, 600_000);
});

/**
 * `turnCount` turns of `eventsPerTurn` events each, mixing small deltas with
 * completed command executions carrying multi-KB output, so the average stored
 * payload lands near the ~1.2KB/event the issue reports.
 */
function insertLongAgenticTurns(
  db: DbConnection,
  thread: Thread,
  shape: { turnCount: number; eventsPerTurn: number },
): void {
  const events: Parameters<typeof insertEvents>[2] = [];
  const providerThreadId = "provider-root";
  let sequence = 0;
  const push = (
    event: Omit<Parameters<typeof insertEvents>[2][number], "sequence">,
  ): void => {
    sequence += 1;
    events.push({ ...event, sequence });
  };
  const outputLine =
    "src/services/threads/timeline.ts:1234:5 - warning TS6133: 'x' is declared but its value is never read.\n";
  const output = (lines: number): string => outputLine.repeat(lines);
  const sentence =
    "I will now look at the timeline projection and the budget floor query to see why the window is not binding. ";
  const execution = {
    model: "gpt-5",
    serviceTier: "default",
    reasoningLevel: "medium",
    permissionMode: "full",
    source: "client/turn/requested",
  } as const;
  for (let turn = 1; turn <= shape.turnCount; turn += 1) {
    const turnId = `turn-${turn}`;
    const clientRequestId = encodeClientTurnRequestIdNumber({ value: turn });
    push({
      threadId: thread.id,
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
        input: [
          {
            type: "text",
            text: `Please fix the failing tests in turn ${turn}`,
            mentions: [],
          },
        ],
        target: turn === 1 ? { kind: "thread-start" } : { kind: "new-turn" },
        execution,
      }),
    });
    push({
      threadId: thread.id,
      type: "turn/started",
      scope: turnScope(turnId),
      providerThreadId,
      itemId: null,
      itemKind: null,
      data: JSON.stringify({ providerThreadId }),
    });
    push({
      threadId: thread.id,
      type: "turn/input/accepted",
      scope: turnScope(turnId),
      providerThreadId,
      itemId: null,
      itemKind: null,
      data: JSON.stringify({ clientRequestId }),
    });
    let emitted = 3;
    let item = 0;
    while (emitted < shape.eventsPerTurn - 1) {
      item += 1;
      const itemId = `${turnId}-item-${item}`;
      if (item % 3 === 0) {
        for (let d = 0; d < 3; d += 1) {
          push({
            threadId: thread.id,
            type: "item/agentMessage/delta",
            scope: turnScope(turnId),
            providerThreadId,
            itemId,
            itemKind: null,
            data: JSON.stringify({ providerThreadId, itemId, delta: sentence }),
          });
        }
        push({
          threadId: thread.id,
          type: "item/completed",
          scope: turnScope(turnId),
          providerThreadId,
          itemId,
          itemKind: "agentMessage",
          data: JSON.stringify({
            providerThreadId,
            item: { type: "agentMessage", id: itemId, text: sentence.repeat(5) },
          }),
        });
        emitted += 4;
      } else {
        const command = "pnpm exec turbo run typecheck --filter=@bb/server";
        push({
          threadId: thread.id,
          type: "item/started",
          scope: turnScope(turnId),
          providerThreadId,
          itemId,
          itemKind: "commandExecution",
          data: JSON.stringify({
            providerThreadId,
            item: {
              type: "commandExecution",
              id: itemId,
              command,
              cwd: "",
              status: "pending",
              approvalStatus: null,
              aggregatedOutput: "",
            },
          }),
        });
        for (let d = 0; d < 2; d += 1) {
          push({
            threadId: thread.id,
            type: "item/commandExecution/outputDelta",
            scope: turnScope(turnId),
            providerThreadId,
            itemId,
            itemKind: null,
            data: JSON.stringify({ providerThreadId, itemId, delta: output(8) }),
          });
        }
        push({
          threadId: thread.id,
          type: "item/completed",
          scope: turnScope(turnId),
          providerThreadId,
          itemId,
          itemKind: "commandExecution",
          data: JSON.stringify({
            providerThreadId,
            item: {
              type: "commandExecution",
              id: itemId,
              command,
              cwd: "",
              status: "completed",
              approvalStatus: null,
              aggregatedOutput: output(24),
            },
          }),
        });
        emitted += 4;
      }
    }
    push({
      threadId: thread.id,
      type: "turn/completed",
      scope: turnScope(turnId),
      providerThreadId,
      itemId: null,
      itemKind: null,
      data: JSON.stringify({ status: "completed", providerThreadId }),
    });
  }
  insertEvents(db, noopNotifier, events);
}
