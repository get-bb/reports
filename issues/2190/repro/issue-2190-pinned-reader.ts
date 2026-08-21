/**
 * A second process holding an open read transaction on bb.db (a DB GUI, a
 * stuck sqlite3 shell, any tool that opened the file) pins every checkpoint at
 * its snapshot: bb keeps committing into the WAL, auto-checkpoints run, and the
 * main file never moves past the reader's snapshot.
 *   pnpm exec tsx test/issue-2190-pinned-reader.ts
 */
import { spawn } from "node:child_process";
import { copyFileSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { createConnection } from "../src/connection.js";
import { ensurePersonalProject } from "../src/data/projects.js";
import { migrate } from "../src/migrate.js";
import { projects } from "../src/schema.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore plain ESM helper
import { inspect } from "./issue-2190-wal-tool.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "bb-2190-pin-"));
const dbPath = join(dir, "bb.db");

function mainFileOnlyProjects(): string {
  const copy = join(dir, `main-only-${Date.now()}.db`);
  copyFileSync(dbPath, copy);
  const c = new Database(copy, { readonly: true });
  try {
    const has = c.prepare<[], { n: number }>("SELECT COUNT(*) n FROM sqlite_master WHERE name='projects'").get()?.n === 1;
    return has ? JSON.stringify(c.prepare<[], { name: string }>("SELECT name FROM projects ORDER BY name").all().map((r) => r.name)) : "(no projects table)";
  } finally {
    c.close();
  }
}
function files(): string {
  return `bb.db=${statSync(dbPath).size} bb.db-wal=${statSync(`${dbPath}-wal`).size}`;
}
function shmState(): string {
  const s = inspect(dbPath).shm;
  return `mxFrame=${s.copy1.mxFrame} nBackfill=${s.ckpt.nBackfill} aReadMark=${JSON.stringify(s.ckpt.aReadMark)}`;
}
function insertProject(name: string): void {
  const now = Date.now();
  db.insert(projects).values({ id: `proj_${name}`, name, createdAt: now, updatedAt: now }).run();
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const db = createConnection(dbPath);
migrate(db);
ensurePersonalProject(db);
insertProject("aug-9");
db.$client.pragma("wal_checkpoint(TRUNCATE)");
console.log("== 'Aug 9' state checkpointed:", files(), "main file sees", mainFileOnlyProjects());

// Another process opens bb.db and leaves a read transaction open.
const reader = spawn(process.execPath, ["-e", `
  const Database = require(${JSON.stringify(join(here, "..", "node_modules", "better-sqlite3"))});
  const db = new Database(${JSON.stringify(dbPath)});
  db.prepare("BEGIN").run();
  db.prepare("SELECT COUNT(*) FROM projects").get();
  process.stdout.write("reader holding snapshot\\n");
  setInterval(() => {}, 1000);
`], { stdio: ["ignore", "pipe", "inherit"] });
await new Promise<void>((resolve) => reader.stdout.once("data", () => resolve()));
console.log("== second process opened bb.db with an open read transaction (pid", reader.pid, ")");

// bb keeps working for "12 days": many commits, well past the 1000-page auto-checkpoint.
db.run(sql`CREATE TABLE IF NOT EXISTS padding (id INTEGER PRIMARY KEY, blob BLOB)`);
const pad = db.$client.prepare("INSERT INTO padding (blob) VALUES (?)");
for (let i = 0; i < 40; i += 1) {
  insertProject(`new-${String(i).padStart(2, "0")}`);
  for (let j = 0; j < 50; j += 1) pad.run(Buffer.alloc(3500, 1));
}
db.delete(projects).where(sql`${projects.id} = 'proj_aug-9'`).run();
console.log("== after 40 projects + ~2000 padding pages + deleting 'aug-9':", files());
console.log("   open bb handle sees", db.select({ name: projects.name }).from(projects).all().length, "projects");
console.log("   main file alone sees", mainFileOnlyProjects());
console.log("   wal-index:", shmState());

// What the proposed periodic PASSIVE checkpoint would see while the reader is
// alive: it copies nothing (checkpointed=0 < log), but its result is the
// signal a warning can be raised from.
console.log("   explicit PRAGMA wal_checkpoint(PASSIVE) while the reader is alive:", JSON.stringify(db.$client.pragma("wal_checkpoint(PASSIVE)")));
console.log("   main file alone still sees", mainFileOnlyProjects(), "|", files());

reader.kill("SIGKILL");
await sleep(300);
insertProject("after-reader-gone");
console.log("== reader killed, one more commit:", files());
console.log("   main file alone sees", mainFileOnlyProjects().slice(0, 80), "...");
console.log("   wal-index:", shmState());
console.log("   explicit PRAGMA wal_checkpoint(PASSIVE) now:", JSON.stringify(db.$client.pragma("wal_checkpoint(PASSIVE)")));
db.$client.close();
console.log(`scratch: ${dir}`);
