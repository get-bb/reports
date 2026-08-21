/**
 * Narrated walkthrough for get-bb/bb#2190. Run from packages/db:
 *   pnpm exec tsx test/issue-2190-walkthrough.ts
 *
 * Uses bb's real createConnection()/migrate() and prints what a reader of
 * bb.db (main file only), the open server handle, and the WAL forensic tool
 * see at each step.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { createConnection, type DbConnection } from "../src/connection.js";
import { ensurePersonalProject } from "../src/data/projects.js";
import { migrate } from "../src/migrate.js";
import { projects } from "../src/schema.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore plain ESM helper
import { inspect, recoverGeneration } from "./issue-2190-wal-tool.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "bb-2190-walkthrough-"));
const dbPath = join(dir, "bb.db");

function names(db: DbConnection): string[] {
  return db.select({ name: projects.name }).from(projects).orderBy(projects.name).all().map((r) => r.name);
}
function mainFileOnly(): string {
  const copy = join(dir, `main-only-${Date.now()}.db`);
  copyFileSync(dbPath, copy);
  const c = new Database(copy, { readonly: true });
  try {
    const has = c.prepare<[], { n: number }>("SELECT COUNT(*) n FROM sqlite_master WHERE name='projects'").get()?.n === 1;
    if (!has) return "(no projects table in main file)";
    return JSON.stringify(c.prepare<[], { name: string }>("SELECT name FROM projects ORDER BY name").all().map((r) => r.name));
  } finally {
    c.close();
  }
}
function sizes(): string {
  return ["", "-wal", "-shm"].map((s) => `${"bb.db" + s}=${existsSync(dbPath + s) ? statSync(dbPath + s).size : "absent"}`).join(" ");
}
function insert(db: DbConnection, name: string): void {
  const now = Date.now();
  db.insert(projects).values({ id: `proj_${name}`, name, createdAt: now, updatedAt: now }).run();
}
function step(title: string): void {
  console.log(`\n== ${title}`);
}

step("1. open bb.db with bb's createConnection() + migrate() (what apps/server does at start)");
const db = createConnection(dbPath);
migrate(db);
ensurePersonalProject(db);
console.log("pragmas:", ["journal_mode", "wal_autocheckpoint", "synchronous", "mmap_size"].map((p) => `${p}=${String(db.$client.pragma(p, { simple: true }))}`).join(" "));
console.log("files:", sizes());
console.log("open handle sees projects:", JSON.stringify(names(db)));
console.log("main file alone sees:", mainFileOnly());

step("2. simulate the last checkpoint ('Aug 9'): a project exists, then PRAGMA wal_checkpoint(TRUNCATE)");
insert(db, "old-project-from-aug-9");
db.$client.pragma("wal_checkpoint(TRUNCATE)");
console.log("files:", sizes());
console.log("main file alone sees:", mainFileOnly());

step("3. 'Aug 9 -> Aug 21': delete the old project, create 40 new ones (each its own transaction)");
db.delete(projects).where(sql`${projects.id} = 'proj_old-project-from-aug-9'`).run();
for (let i = 0; i < 40; i += 1) insert(db, `lost-${String(i).padStart(2, "0")}`);
console.log("open handle sees", names(db).length, "projects:", JSON.stringify(names(db).slice(0, 4)), "...");
console.log("main file alone sees:", mainFileOnly());
console.log("files:", sizes());
const before = inspect(dbPath);
console.log("WAL before:", JSON.stringify({ header: { salt1: before.header.salt1, salt2: before.header.salt2, checkpointSeq: before.header.checkpointSeq, checksumValid: before.header.checksumValid }, totalFrames: before.totalFrames, liveFrameCount: before.liveFrameCount }));

step("4. THE EVENT (from another process): wal-index (-shm) zeroed in place + 1 bit flipped in the WAL header checksum");
execFileSync(process.execPath, ["-e", `
  const fs = require("node:fs");
  const shmFd = fs.openSync(${JSON.stringify(dbPath + "-shm")}, "r+");
  fs.writeSync(shmFd, Buffer.alloc(fs.fstatSync(shmFd).size, 0), 0);
  fs.closeSync(shmFd);
  const walFd = fs.openSync(${JSON.stringify(dbPath + "-wal")}, "r+");
  const header = Buffer.alloc(32); fs.readSync(walFd, header, 0, 32, 0); header[24] ^= 1; fs.writeSync(walFd, header, 0, 32, 0); fs.closeSync(walFd);
`]);
console.log("done; the server handle was never closed or reopened");

step("5. next read on the SAME open handle (no restart, no exception thrown)");
console.log("open handle sees projects:", JSON.stringify(names(db)));
console.log("  -> the 40 projects are gone and the deleted 'Aug 9' project is back");

step("6. server keeps running; one more write ('created-after-revert'). NOTE: bb issues no checkpoint here, so bb.db is NOT written");
const mtimeBefore = statSync(dbPath).mtimeMs;
insert(db, "created-after-revert");
console.log("open handle sees projects:", JSON.stringify(names(db)));
console.log("bb.db mtime changed:", statSync(dbPath).mtimeMs !== mtimeBefore, "(expected false: the commit only restarts the WAL at frame 1)");
console.log("files:", sizes(), "(WAL keeps its old size)");
const after = inspect(dbPath);
console.log("WAL after:", JSON.stringify({ header: { salt1: after.header.salt1, salt2: after.header.salt2, checkpointSeq: after.header.checkpointSeq, checksumValid: after.header.checksumValid }, totalFrames: after.totalFrames, liveFrameCount: after.liveFrameCount, generations: after.generations }, null, 1));

step("7. 'replaying the WAL on a copy' (copy bb.db + -wal + -shm elsewhere and open)");
const replayDir = join(dir, "replay");
execFileSync("mkdir", ["-p", replayDir]);
for (const s of ["", "-wal", "-shm"]) if (existsSync(dbPath + s)) copyFileSync(dbPath + s, join(replayDir, "bb.db" + s));
const replay = new Database(join(replayDir, "bb.db"));
console.log("replay copy sees:", JSON.stringify(replay.prepare<[], { name: string }>("SELECT name FROM projects ORDER BY name").all().map((r) => r.name)));
replay.close();

step("8. forensic recovery: apply the stale frames onto a copy of the main file");
const recovered = recoverGeneration(dbPath, join(dir, "recovered"));
console.log("recover result:", JSON.stringify(recovered));
const rdb = new Database(recovered.outDb, { readonly: true });
console.log("integrity_check:", rdb.pragma("integrity_check", { simple: true }));
const recoveredNames = rdb.prepare<[], { name: string }>("SELECT name FROM projects ORDER BY name").all().map((r) => r.name);
console.log("recovered projects:", recoveredNames.length, JSON.stringify(recoveredNames.slice(0, 4)), "...", JSON.stringify(recoveredNames.slice(-2)));
rdb.close();

step("9. what bb does on its own after the revert: keep committing; bb.db is written only by SQLite's 1000-page auto-checkpoint");
let commitsUntilMainFileWritten = 0;
const mtimeBeforeLoop = statSync(dbPath).mtimeMs;
while (statSync(dbPath).mtimeMs === mtimeBeforeLoop && commitsUntilMainFileWritten < 2000) {
  insert(db, `post-incident-${String(commitsUntilMainFileWritten).padStart(4, "0")}`);
  commitsUntilMainFileWritten += 1;
}
const afterLoop = inspect(dbPath);
console.log("commits (one row each) before bb.db was written by the auto-checkpoint:", commitsUntilMainFileWritten);
console.log("WAL at that point:", JSON.stringify({ totalFrames: afterLoop.totalFrames, liveFrameCount: afterLoop.liveFrameCount, nBackfill: afterLoop.shm.ckpt.nBackfill, staleGenerations: afterLoop.generations.filter((g: { isLive: boolean }) => !g.isLive).length }));
console.log("  -> a single commit right after the revert does not touch bb.db; ~1000 WAL pages of later writes are needed, and by then the stale frames holding the lost data have been overwritten");
let lateRecovery: unknown;
try {
  const r = recoverGeneration(dbPath, join(dir, "recovered-late"));
  const ldb = new Database(r.outDb, { readonly: true });
  lateRecovery = { appliedFrames: r.appliedFrames, integrity: ldb.pragma("integrity_check", { simple: true }), projects: ldb.prepare<[], { n: number }>("SELECT COUNT(*) n FROM projects").get()?.n };
  ldb.close();
} catch (error) {
  lateRecovery = `recovery no longer possible: ${error instanceof Error ? error.message : String(error)}`;
}
console.log("recovery attempted now:", JSON.stringify(lateRecovery));

step("10. INDUCED (bb never does this): an explicit PRAGMA wal_checkpoint(PASSIVE) on the server handle");
const mtimeBeforeInduced = statSync(dbPath).mtimeMs;
insert(db, "one-more-row");
console.log("checkpoint result:", JSON.stringify(db.$client.pragma("wal_checkpoint(PASSIVE)")));
console.log("bb.db mtime changed:", statSync(dbPath).mtimeMs !== mtimeBeforeInduced, "(only a checkpoint writes bb.db; bb runs one only via the 1000-page auto-checkpoint or the hourly sweep when the freelist >= 1024 pages)");

console.log(`\nscratch dir: ${dir} (tool: ${join(here, "issue-2190-wal-tool.mjs")})`);
db.$client.close();
