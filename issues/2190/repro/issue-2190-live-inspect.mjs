// Inspect a live (or stopped) bb data dir without touching SQLite's locks on
// the real files: copy bb.db ALONE to a temp file and query it, then parse the
// WAL with the forensic tool. Usage:
//   node issue-2190-live-inspect.mjs <data-dir>
import Database from "better-sqlite3";
import { copyFileSync, existsSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect } from "./issue-2190-wal-tool.mjs";

const dataDir = process.argv[2];
if (!dataDir) {
  console.error("usage: issue-2190-live-inspect.mjs <data-dir>");
  process.exit(2);
}
const dbPath = join(dataDir, "bb.db");
const files = Object.fromEntries(
  ["", "-wal", "-shm"].map((s) => [`bb.db${s}`, existsSync(dbPath + s) ? statSync(dbPath + s).size : null]),
);
const tmp = mkdtempSync(join(tmpdir(), "bb-2190-live-"));
const copyPath = join(tmp, "main-only.db");
copyFileSync(dbPath, copyPath);
const copy = new Database(copyPath, { readonly: true });
let mainFileOnly;
try {
  const tables = copy.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name);
  mainFileOnly = {
    tableCount: tables.length,
    projects: tables.includes("projects") ? copy.prepare("SELECT id, name FROM projects ORDER BY created_at").all() : "(no projects table)",
    threads: tables.includes("threads") ? copy.prepare("SELECT COUNT(*) n FROM threads").get().n : "(no threads table)",
  };
} finally {
  copy.close();
}
const wal = inspect(dbPath);
console.log(
  JSON.stringify(
    {
      dataDir,
      files,
      mainFileOnly,
      wal: wal.exists
        ? { fileBytes: wal.fileBytes, totalFrames: wal.totalFrames, liveFrameCount: wal.liveFrameCount, header: wal.header && { checkpointSeq: wal.header.checkpointSeq, salt1: wal.header.salt1, checksumValid: wal.header.checksumValid }, generations: wal.generations }
        : { exists: false },
    },
    null,
    2,
  ),
);
