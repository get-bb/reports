const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { app, session } = require("electron");
const { BB_BROWSER_PARTITION, readChromiumCookieDatabase, writeCookies } = require(process.argv[4]);

const phase = process.argv[2];
app.setPath("userData", process.argv[3]);
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const browserSession = session.fromPartition(BB_BROWSER_PARTITION);
  const filter = { url: "https://cookie-probe.invalid/" };
  if (phase === "seed") {
    const database = new DatabaseSync(":memory:");
    database.exec("CREATE TABLE meta (key TEXT, value TEXT); INSERT INTO meta VALUES ('version', '23'); CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB, path TEXT, expires_utc INTEGER, is_secure INTEGER, is_httponly INTEGER, samesite INTEGER, top_frame_site_key TEXT)");
    const insert = database.prepare("INSERT INTO cookies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const future = (11644473600 + Math.floor(Date.now() / 1000) + 3600) * 1000000;
    insert.run("cookie-probe.invalid", "transient_control", "synthetic", Buffer.alloc(0), "/", 0, 1, 1, 1, "");
    insert.run("cookie-probe.invalid", "durable_control", "synthetic", Buffer.alloc(0), "/", future, 1, 1, 1, "");
    const read = readChromiumCookieDatabase(database, {});
    database.close();
    assert.equal(read.cookies.length, 2);
    assert.equal(read.cookies.find((cookie) => cookie.name === "transient_control").expirationDate, undefined);
    const outcome = await writeCookies(browserSession, read);
    assert.equal(outcome.imported, 2);
    assert.equal(outcome.skipped, 0);
    const cookies = await browserSession.cookies.get(filter);
    assert.equal(cookies.length, 2);
    assert.equal(cookies.find((cookie) => cookie.name === "transient_control").session, true);
    assert.equal(cookies.find((cookie) => cookie.name === "durable_control").session, false);
    console.log(JSON.stringify({ phase, partition: BB_BROWSER_PARTITION, imported: outcome.imported, cookies: cookies.map(({ name, session }) => ({ name, session })) }));
  } else if (phase === "verify") {
    const cookies = await browserSession.cookies.get(filter);
    const persistentSurvived = cookies.some((cookie) => cookie.name === "durable_control");
    const sessionSurvived = cookies.some((cookie) => cookie.name === "transient_control");
    console.log(JSON.stringify({ phase, persistentSurvived, sessionSurvived }));
    assert.ok(persistentSurvived, "Persistent control did not survive; restart reproduction is invalid");
    assert.ok(sessionSurvived, "Imported session cookie disappeared after process restart");
  } else {
    throw new Error("Unexpected phase");
  }
  app.quit();
}).catch((error) => {
  console.error(error.message);
  app.exit(1);
});
