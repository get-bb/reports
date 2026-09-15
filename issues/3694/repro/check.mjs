import assert from "node:assert/strict";
import { stripTypeScriptTypes } from "node:module";
import { readFile, writeFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.argv[2]);
const temporary = await mkdtemp(join(tmpdir(), "timeline-check-"));
try {
  for (const name of ["timeline-content-pagination", "timeline-pagination"]) {
    const source = await readFile(join(root, "apps/server/src/services/threads", name + ".ts"), "utf8");
    const stripped = stripTypeScriptTypes(source).replace(
      '"./timeline-content-pagination.js"',
      '"./timeline-content-pagination.mjs"',
    );
    await writeFile(join(temporary, name + ".mjs"), stripped);
  }
  const { paginateTimelineRows } = await import(pathToFileURL(join(temporary, "timeline-pagination.mjs")));
  const operation = (seq) => ({
    id: "operation-" + seq,
    kind: "system",
    threadId: "synthetic-thread",
    turnId: null,
    sourceSeqStart: seq,
    sourceSeqEnd: seq,
    startedAt: seq,
    createdAt: seq,
    systemKind: "operation",
    operationKind: "generic",
    title: "Synthetic operation",
    detail: null,
    status: "completed",
    completedAt: seq,
  });
  const rows = [operation(10), operation(30)];
  const args = {
    contextBoundarySeq: null,
    knownHasOlderSegments: true,
    maxLeaves: 1000,
    maxBytes: 1000000,
    ownedSequenceEnd: 40,
    page: { kind: "latest", segmentLimit: 8 },
    rows,
  };
  const control = paginateTimelineRows({ ...args, ownedSequenceStart: 10 });
  assert.equal(control.rows.length, 2);
  const actual = paginateTimelineRows({ ...args, ownedSequenceStart: 20 });
  console.log(JSON.stringify({ controlRows: control.rows.length, actual }, null, 2));
  assert.ok(
    !actual.hasOlderRows || actual.olderCursor !== null,
    "Older history must have a usable continuation cursor",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
