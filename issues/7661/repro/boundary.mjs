import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const checkout = resolve(process.argv[2]);
const requireDesktop = createRequire(join(checkout, "apps/desktop/package.json"));
const { build } = requireDesktop("esbuild");
const temporary = mkdtempSync(join(tmpdir(), "bb-7661-boundary-"));
const database = new DatabaseSync(":memory:");

try {
  const bundle = join(temporary, "production.cjs");
  await build({
    stdin: {
      contents: [
        `export { readChromiumCookieDatabase } from ${JSON.stringify(join(checkout, "apps/desktop/src/browser-import/chromium-cookies.ts"))};`,
        `export { writeCookies } from ${JSON.stringify(join(checkout, "apps/desktop/src/browser-import/browser-import.ts"))};`,
      ].join("\n"),
      resolveDir: checkout,
    },
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "cjs",
    conditions: ["source"],
    legalComments: "none",
  });
  const { readChromiumCookieDatabase, writeCookies } = requireDesktop(bundle);
  database.exec("CREATE TABLE meta (key TEXT, value TEXT); INSERT INTO meta VALUES ('version', '23'); CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB, path TEXT, expires_utc INTEGER, is_secure INTEGER, is_httponly INTEGER, samesite INTEGER, top_frame_site_key TEXT)");
  const insert = database.prepare("INSERT INTO cookies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const expiration = Math.floor(Date.now() / 1000) + 3600;
  insert.run("cookie-probe.invalid", "transient_control", "synthetic", Buffer.alloc(0), "/", 0, 1, 1, 1, "");
  insert.run("cookie-probe.invalid", "durable_control", "synthetic", Buffer.alloc(0), "/", (11644473600 + expiration) * 1000000, 1, 1, 1, "");
  const decoded = readChromiumCookieDatabase(database, {});
  assert.equal(decoded.cookies.length, 2);
  assert.equal(decoded.undecryptable, 0);
  const writes = [];
  let flushes = 0;
  const outcome = await writeCookies({ cookies: {
    set: async (details) => { writes.push(details); },
    flushStore: async () => { flushes += 1; },
  } }, decoded);
  assert.equal(outcome.imported, 2);
  assert.equal(outcome.skipped, 0);
  assert.equal(writes.length, 2);
  assert.equal(Object.hasOwn(writes.find((cookie) => cookie.name === "transient_control"), "expirationDate"), false);
  assert.equal(writes.find((cookie) => cookie.name === "durable_control").expirationDate, expiration);
  assert.equal(flushes, 1);
  console.log(JSON.stringify({ imported: outcome.imported, sessionExpirationOmitted: true, persistentExpirationPreserved: true, flushes }));
  console.log("BOUNDARY PASS: real Chromium reader and writer; recording sink only, no Electron persistence simulated");
} finally {
  database.close();
  rmSync(temporary, { recursive: true, force: true });
}
