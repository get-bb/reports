// Issue #1131 profiling harness: run one timeline "latest page" build for a
// thread against a real bb.db, exactly as the route does, and attribute the
// event-loop-blocking time and disk reads to individual SQL statements.
//
// Usage (from apps/server, with the dev server STOPPED or the DB copied):
//   node --conditions=source --import tsx issue-1131-profile.ts <bb.db> <thread id> [cold]
//
// "cold" evicts the OS page cache for the db files first (posix_fadvise via
// python3 is not needed: we use fs + a tiny fadvise shim through `dd`-free
// approach: node has no fadvise, so pass "cold" only after running the
// eviction yourself; the script prints /proc/self/io read_bytes deltas so
// you can see whether reads hit disk).
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { createConnection, getThread } from "@bb/db";
import { buildThreadTimelineWithProfile } from "./src/services/threads/timeline.js";
import { DEFAULT_MAX_INLINE_OUTPUT_CHARS } from "./src/services/threads/timeline-output-truncation.js";

const [dbPath, threadId] = process.argv.slice(2);
if (!dbPath || !threadId) {
  console.error("usage: issue-1131-profile.ts <bb.db> <thread id>");
  process.exit(2);
}

function readBytes(): number {
  const io = readFileSync("/proc/self/io", "utf8");
  const m = /^read_bytes: (\d+)/mu.exec(io);
  return m ? Number(m[1]) : 0;
}

/** Major page faults so far: with SQLite mmap each cold page is one fault. */
function majorFaults(): number {
  const stat = readFileSync("/proc/self/stat", "utf8");
  // field 12 (1-indexed) after the comm field; comm may contain spaces.
  const rest = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
  return Number(rest[9]);
}

interface StmtSample {
  sql: string;
  ms: number;
  bytes: number;
  op: string;
  args: number;
}
const samples: StmtSample[] = [];

const db = createConnection(dbPath, {
  slowQueryThresholdMs: 0,
  slowQueryLogger: {
    info() {
      /* replaced by the wrapper below */
    },
  },
});

// Wrap prepare again so each statement execution records read_bytes deltas.
const sqlite = db.$client;
const originalPrepare = sqlite.prepare.bind(sqlite);
Object.defineProperty(sqlite, "prepare", {
  configurable: true,
  writable: true,
  value: (source: string) => {
    const stmt = originalPrepare(source);
    for (const op of ["all", "get", "run"] as const) {
      const original = stmt[op].bind(stmt);
      (stmt as unknown as Record<string, unknown>)[op] = (
        ...params: unknown[]
      ) => {
        const b0 = readBytes();
        const t0 = performance.now();
        try {
          return original(...params);
        } finally {
          samples.push({
            sql: source.replace(/\s+/gu, " ").trim().slice(0, 1200),
            ms: performance.now() - t0,
            bytes: readBytes() - b0,
            op,
            args: params.length,
          });
        }
      };
    }
    return stmt;
  },
});

const thread = getThread(db, threadId);
if (!thread) {
  console.error(`thread ${threadId} not found`);
  process.exit(1);
}
const maxSeq = (
  db.$client
    .prepare("select max(sequence) as s from events where thread_id = ?")
    .get(threadId) as { s: number }
).s;
samples.length = 0;

const bytesBefore = readBytes();
const faultsBefore = majorFaults();
const t0 = performance.now();
const { profile } = buildThreadTimelineWithProfile(db, thread, {
  eventBudget: 1500,
  includeProviderUnhandledOperations: false,
  includeNestedRows: false,
  maxInlineOutputChars: DEFAULT_MAX_INLINE_OUTPUT_CHARS,
  maxSeq,
  page: { kind: "latest", segmentLimit: 20 },
  providerDisplayName: "Codex",
  planCommand: null,
  summaryOnly: false,
});
const totalMs = performance.now() - t0;
const bytesAfter = readBytes();
const faultsAfter = majorFaults();

console.log(
  JSON.stringify(
    {
      threadId,
      maxSeq,
      totalMs: Math.round(totalMs),
      diskReadBytes: bytesAfter - bytesBefore,
      majorPageFaults: faultsAfter - faultsBefore,
      profile: {
        ...profile,
        stageTimings: profile.stageTimings.map((s) => ({
          stage: s.stage,
          ms: Math.round(s.durationMs * 10) / 10,
        })),
      },
    },
    null,
    2,
  ),
);

// Aggregate by SQL text.
const agg = new Map<
  string,
  { n: number; ms: number; bytes: number; op: string }
>();
for (const s of samples) {
  const key = s.sql;
  const cur = agg.get(key) ?? { n: 0, ms: 0, bytes: 0, op: s.op };
  cur.n += 1;
  cur.ms += s.ms;
  cur.bytes += s.bytes;
  agg.set(key, cur);
}
const rows = [...agg.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
console.log(
  `\n${samples.length} statement executions, ${agg.size} distinct statements. Top by disk bytes:`,
);
for (const [sql, v] of rows.slice(0, 12)) {
  console.log(
    `  ${String(Math.round(v.bytes / 1024)).padStart(7)} KiB  ${String(Math.round(v.ms)).padStart(5)} ms  x${String(v.n).padStart(3)}  ${sql}`,
  );
}
const byMs = [...agg.entries()].sort((a, b) => b[1].ms - a[1].ms);
console.log(`\nTop by time:`);
for (const [sql, v] of byMs.slice(0, 8)) {
  console.log(
    `  ${String(Math.round(v.ms)).padStart(5)} ms  ${String(Math.round(v.bytes / 1024)).padStart(7)} KiB  x${String(v.n).padStart(3)}  ${sql}`,
  );
}
