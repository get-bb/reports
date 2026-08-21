/**
 * Does a bb connection lose committed rows when the process exits without
 * close() (bb's shutdown path) and a new process reopens the file?
 *   pnpm exec tsx test/issue-2190-exit-durability.ts
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "../src/connection.js";
import { ensurePersonalProject } from "../src/data/projects.js";
import { migrate } from "../src/migrate.js";
import { projects } from "../src/schema.js";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore plain ESM helper
import { inspect } from "./issue-2190-wal-tool.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const mode = process.argv[2];
const dbPath = process.argv[3];

if (mode === "writer") {
  const db = createConnection(dbPath);
  migrate(db);
  ensurePersonalProject(db);
  for (let i = 0; i < Number(process.argv[4]); i += 1) {
    const now = Date.now();
    db.insert(projects).values({ id: `proj_${i}`, name: `p${i}`, createdAt: now, updatedAt: now }).run();
  }
  const count = db.select({ name: projects.name }).from(projects).all().length;
  process.stdout.write(JSON.stringify({ committed: count, walFrames: inspect(dbPath).liveFrameCount }));
  process.exit(0); // bb's runShutdown never closes the handle
} else if (mode === "reader") {
  const db = createConnection(dbPath);
  const count = db.select({ name: projects.name }).from(projects).all().length;
  process.stdout.write(JSON.stringify({ visible: count, shm: inspect(dbPath).shm?.ckpt }));
  db.$client.close();
} else {
  const dir = mkdtempSync(join(tmpdir(), "bb-2190-exit-"));
  for (const rows of [10, 50, 200]) {
    const path = join(dir, `bb-${rows}.db`);
    const w = execFileSync(process.execPath, ["--import", "tsx", join(here, "issue-2190-exit-durability.ts"), "writer", path, String(rows)], { encoding: "utf8" });
    const walBytes = statSync(`${path}-wal`).size;
    const r = execFileSync(process.execPath, ["--import", "tsx", join(here, "issue-2190-exit-durability.ts"), "reader", path], { encoding: "utf8" });
    console.log(`rows=${rows}: writer ${w} walBytes=${walBytes} -> reader ${r}`);
  }
  console.log(`scratch: ${dir}`);
}
