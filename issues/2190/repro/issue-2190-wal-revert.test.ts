/**
 * Reproduction harness for get-bb/bb#2190 ("SQLite db silently reverted to a
 * 2-week-old state while the server was running").
 *
 * bb opens bb.db exactly once (apps/server/src/start-server.ts -> initDb ->
 * createConnection) in WAL mode and never closes the handle (runShutdown only
 * closes HTTP/WS and then process.exit()s). The main bb.db file therefore only
 * advances when SQLite's 1000-page auto-checkpoint fires; everything since the
 * last checkpoint lives only in bb.db-wal + the wal-index (bb.db-shm).
 *
 * These tests show, with bb's real connection settings:
 *  1. the main file lags the WAL (a copy of bb.db without -wal is a snapshot at
 *     the last checkpoint),
 *  2. if the WAL header / wal-index becomes unreadable while the connection is
 *     OPEN, SQLite runs recovery, finds zero valid frames and silently serves
 *     the last-checkpoint snapshot from the same open handle (no error, no
 *     log line, no restart) - the next write restarts the WAL at frame 1 with the
 *     SAME salt (recovery copies the salt before the checksum check), so
 *     "replaying the WAL on a copy" cannot surface the lost rows,
 *  3. the lost pages are physically still in the WAL file as stale-salt frames
 *     and can be recovered with the forensic tool next to this test.
 *
 * All three tests PASS on main (fcada5a3b): they document the current
 * behaviour. Test 1 only checks createConnection()'s defaults and that a leaked
 * handle leaves the main file empty; it does not exercise apps/server's
 * runShutdown() or the periodic sweep, so a fix in apps/server needs its own
 * server-level test (see the report's "Proposed fix").
 */
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createConnection, type DbConnection } from "../src/connection.js";
import { ensurePersonalProject } from "../src/data/projects.js";
import { migrate } from "../src/migrate.js";
import { projects } from "../src/schema.js";
// Plain ESM helper (no types): it is the same file a user would run by hand.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { inspect, recoverGeneration } from "./issue-2190-wal-tool.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const WAL_TOOL = join(here, "issue-2190-wal-tool.mjs");

interface WalInspection {
  exists: boolean;
  fileBytes: number;
  header: {
    salt1: number;
    salt2: number;
    checkpointSeq: number;
    checksumValid: boolean;
    pageSize: number;
  } | null;
  totalFrames: number;
  liveFrameCount: number;
  generations: Array<{
    salt1: number;
    salt2: number;
    frameCount: number;
    firstIndex: number;
    lastIndex: number;
    commitFrames: number;
    isLive: boolean;
  }>;
}

interface RecoverResult {
  outDb: string;
  appliedFrames: number;
  overwrittenPrefixFrames: number;
}

const inspectWal = inspect as (dbPath: string) => WalInspection;
const recoverWal = recoverGeneration as (
  dbPath: string,
  outDir: string,
) => RecoverResult;

const tempDirs: string[] = [];
const openDbs: DbConnection[] = [];

function makeDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "bb-2190-"));
  tempDirs.push(dir);
  return dir;
}

function openBbDb(dbPath: string): DbConnection {
  const db = createConnection(dbPath);
  openDbs.push(db);
  return db;
}

function projectNames(db: DbConnection): string[] {
  return db
    .select({ name: projects.name })
    .from(projects)
    .orderBy(projects.name)
    .all()
    .map((row) => row.name);
}

/** Names visible in the main file alone (what a reader gets if the WAL is gone). */
function mainFileOnlyProjectNames(dbPath: string): string[] {
  const dir = makeDir();
  const copyPath = join(dir, "main-only.db");
  copyFileSync(dbPath, copyPath);
  const copy = new Database(copyPath, { readonly: true });
  try {
    const hasProjectsTable =
      copy
        .prepare<[], { n: number }>(
          "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'projects'",
        )
        .get()?.n === 1;
    if (!hasProjectsTable) {
      // Not even the schema has reached the main file yet.
      return ["<main file has no projects table>"];
    }
    return copy
      .prepare<[], { name: string }>("SELECT name FROM projects ORDER BY name")
      .all()
      .map((row) => row.name);
  } finally {
    copy.close();
  }
}

function insertProject(db: DbConnection, name: string): void {
  const now = Date.now();
  db.insert(projects)
    .values({ id: `proj_${name}`, name, createdAt: now, updatedAt: now })
    .run();
}

/** Runs file surgery from ANOTHER process, like any external actor would. */
function runInChildProcess(script: string): void {
  execFileSync(process.execPath, ["-e", script], { stdio: "pipe" });
}

afterEach(() => {
  for (const db of openDbs.splice(0)) {
    try {
      db.$client.close();
    } catch {
      // already closed
    }
  }
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("issue #2190: WAL-only durability of bb.db", () => {
  it("uses WAL with a 1000-page auto-checkpoint and no checkpoint on shutdown", () => {
    const dir = makeDir();
    const dbPath = join(dir, "bb.db");
    const db = openBbDb(dbPath);
    migrate(db);
    ensurePersonalProject(db);

    const pragma = (name: string): unknown => db.$client.pragma(name, { simple: true });
    expect(pragma("journal_mode")).toBe("wal");
    expect(pragma("wal_autocheckpoint")).toBe(1000);
    expect(pragma("synchronous")).toBe(1); // NORMAL
    expect(pragma("journal_size_limit")).toBe(-1);

    insertProject(db, "after-checkpoint-a");
    insertProject(db, "after-checkpoint-b");

    // The rows are committed and visible through the open handle ...
    expect(projectNames(db)).toEqual(["Personal", "after-checkpoint-a", "after-checkpoint-b"]);
    // ... but the main file does not contain them - on a fresh install it does
    // not even contain the schema: migrations, the Personal project and every
    // later row exist only in -wal until 1000 pages accumulate.
    expect(mainFileOnlyProjectNames(dbPath)).toEqual(["<main file has no projects table>"]);
    const wal = inspectWal(dbPath);
    expect(wal.exists).toBe(true);
    expect(wal.liveFrameCount).toBeGreaterThan(0);

    // bb's server shutdown path never calls close(); this test mirrors that by
    // letting the handle leak (afterEach closes it later). The main file stays
    // empty. NOTE: this is a packages/db-level statement about connection
    // defaults; it cannot observe a fix made in apps/server/src/start-server.ts.
    expect(mainFileOnlyProjectNames(dbPath)).toEqual(["<main file has no projects table>"]);
  });

  it("auto-checkpoints only once the WAL passes 1000 pages", () => {
    const dir = makeDir();
    const dbPath = join(dir, "bb.db");
    const db = openBbDb(dbPath);
    migrate(db);
    ensurePersonalProject(db);
    insertProject(db, "needle");
    expect(mainFileOnlyProjectNames(dbPath)).toEqual(["<main file has no projects table>"]);

    // Write >1000 pages of unrelated data; the commit that crosses the
    // threshold triggers a PASSIVE checkpoint that carries "needle" along.
    db.run(sql`CREATE TABLE IF NOT EXISTS padding (id INTEGER PRIMARY KEY, blob BLOB)`);
    const insertPadding = db.$client.prepare("INSERT INTO padding (blob) VALUES (?)");
    const payload = Buffer.alloc(3_500, 1);
    for (let index = 0; index < 1_200; index += 1) {
      insertPadding.run(payload);
    }
    expect(mainFileOnlyProjectNames(dbPath)).toEqual(["Personal", "needle"]);
  });

  it("silently serves the last checkpoint from an OPEN handle once the WAL header is unreadable", () => {
    const dir = makeDir();
    const dbPath = join(dir, "bb.db");
    const db = openBbDb(dbPath);
    migrate(db);
    ensurePersonalProject(db);

    // "Aug 9": force a full checkpoint so the main file holds this state.
    insertProject(db, "old-project-from-aug-9");
    db.$client.pragma("wal_checkpoint(TRUNCATE)");
    expect(mainFileOnlyProjectNames(dbPath)).toEqual(["Personal", "old-project-from-aug-9"]);

    // "Aug 9 -> Aug 21": the user deletes the old project and creates new ones.
    // Each statement is its own transaction, so each becomes WAL frames.
    db.delete(projects).where(sql`${projects.id} = 'proj_old-project-from-aug-9'`).run();
    const lostNames = Array.from({ length: 40 }, (_, index) => `lost-${String(index).padStart(2, "0")}`);
    for (const name of lostNames) insertProject(db, name);
    expect(projectNames(db)).toEqual(["Personal", ...lostNames]);
    expect(mainFileOnlyProjectNames(dbPath)).toEqual(["Personal", "old-project-from-aug-9"]);

    const before = inspectWal(dbPath);
    expect(before.header?.checksumValid).toBe(true);
    expect(before.liveFrameCount).toBe(before.totalFrames);
    const walBytesBefore = statSync(`${dbPath}-wal`).size;

    // The event: some other actor makes the wal-index + WAL header unreadable.
    // (Zero the -shm in place and flip one bit of the WAL header checksum.)
    // Done from a separate process so this test's own fds never touch
    // SQLite's POSIX locks.
    runInChildProcess(`
      const fs = require("node:fs");
      const shm = ${JSON.stringify(`${dbPath}-shm`)};
      const wal = ${JSON.stringify(`${dbPath}-wal`)};
      const shmFd = fs.openSync(shm, "r+");
      fs.writeSync(shmFd, Buffer.alloc(fs.fstatSync(shmFd).size, 0), 0);
      fs.closeSync(shmFd);
      const walFd = fs.openSync(wal, "r+");
      const header = Buffer.alloc(32);
      fs.readSync(walFd, header, 0, 32, 0);
      header[24] ^= 0x01;
      fs.writeSync(walFd, header, 0, 32, 0);
      fs.closeSync(walFd);
    `);

    // Same process, same open handle, no restart, no exception: the next read
    // runs WAL recovery, finds no valid frames and returns the "Aug 9" world.
    const afterRevert = projectNames(db);
    expect(afterRevert).toEqual(["Personal", "old-project-from-aug-9"]);

    // The server keeps working and writing: the next commit restarts the WAL
    // at frame 1 with the same salt. bb.db itself is NOT written by this
    // commit (no checkpoint runs); see the walkthrough, steps 6 and 9-10.
    const mainMtimeBefore = statSync(dbPath).mtimeMs;
    insertProject(db, "created-after-revert");
    expect(statSync(dbPath).mtimeMs).toBe(mainMtimeBefore);
    expect(projectNames(db)).toEqual(["Personal", "created-after-revert", "old-project-from-aug-9"]);

    const after = inspectWal(dbPath);
    expect(after.header?.checksumValid).toBe(true);
    // WAL file keeps its old size ("the WAL was ~7 MB") ...
    expect(statSync(`${dbPath}-wal`).size).toBeGreaterThanOrEqual(walBytesBefore);
    // ... but only the new, tiny generation is live; the rest is stale-salt.
    expect(after.liveFrameCount).toBeLessThan(after.totalFrames);
    const stale = after.generations.filter((generation) => !generation.isLive);
    expect(stale.length).toBeGreaterThanOrEqual(1);
    expect(stale[0]?.frameCount).toBeGreaterThan(after.liveFrameCount);

    // "Replaying the WAL on a copy does not surface the lost rows either":
    // copying bb.db + -wal (+ -shm) elsewhere and opening only replays the
    // live generation.
    const replayDir = makeDir();
    for (const suffix of ["", "-wal", "-shm"]) {
      if (existsSync(`${dbPath}${suffix}`)) copyFileSync(`${dbPath}${suffix}`, join(replayDir, `bb.db${suffix}`));
    }
    const replay = new Database(join(replayDir, "bb.db"));
    try {
      expect(
        replay.prepare<[], { name: string }>("SELECT name FROM projects ORDER BY name").all().map((row) => row.name),
      ).toEqual(["Personal", "created-after-revert", "old-project-from-aug-9"]);
    } finally {
      replay.close();
    }

    // Forensics: the lost pages are still in the file as stale frames. Rebuild
    // the stale generation onto a copy of the main file.
    const recovered = recoverWal(dbPath, join(dir, "recovered"));
    expect(recovered.appliedFrames).toBeGreaterThan(0);
    const recoveredDb = new Database(recovered.outDb, { readonly: true });
    try {
      const integrity = recoveredDb.pragma("integrity_check", { simple: true });
      const names = recoveredDb
        .prepare<[], { name: string }>("SELECT name FROM projects ORDER BY name")
        .all()
        .map((row) => row.name);
      // Frames 1..k of the stale generation were overwritten by the new
      // generation, so recovery is best-effort; here the hot pages were
      // rewritten by later transactions and everything comes back.
      expect(integrity).toBe("ok");
      expect(names).toEqual(["Personal", ...lostNames]);
      expect(names).not.toContain("created-after-revert");
    } finally {
      recoveredDb.close();
    }

    // The CLI form of the tool prints the same inspection.
    const cliOutput = execFileSync(process.execPath, [WAL_TOOL, "inspect", dbPath], { encoding: "utf8" });
    expect(JSON.parse(cliOutput).generations.length).toBe(after.generations.length);
    expect(readFileSync(WAL_TOOL, "utf8")).toContain("recoverGeneration");
  });
});
