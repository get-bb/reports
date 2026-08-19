/**
 * Repro for get-bb/bb#1915: a plugin whose `engines.bb` range stops matching
 * after a host upgrade is marked `incompatible` on startup, but the server
 * writes no log line for it (unlike a successful load, which logs
 * `plugin <id>@<v> loaded`, or a factory failure, which logs
 * `plugin <id> failed to load: ...`).
 */
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConnection, migrate, type DbConnection } from "@bb/db";
import type { Logger } from "@bb/logger";
import { createPluginService } from "../../../src/services/plugins/plugin-service.js";
import { createNoopTelemetryService } from "../../../src/services/system/telemetry.js";

function capturingLogger(): { logger: Logger; lines: string[] } {
  const lines: string[] = [];
  const push = (level: string) => (msg: unknown) => {
    lines.push(`${level} ${String(msg)}`);
  };
  const logger = {
    debug: push("debug"),
    info: push("info"),
    warn: push("warn"),
    error: push("error"),
  } as unknown as Logger;
  return { logger, lines };
}

async function writeNotifyPlugin(dir: string): Promise<string> {
  const rootDir = join(dir, "bb-plugin-notify");
  await mkdir(rootDir, { recursive: true });
  await writeFile(
    join(rootDir, "package.json"),
    JSON.stringify({
      name: "bb-plugin-notify",
      version: "0.2.1",
      engines: { bb: ">=0.38.0 <0.39.0" },
      bb: {
        name: "Notify",
        description: "Issue 1915 fixture.",
        branding: { icon: "Zap" },
        server: "./server.ts",
      },
    }),
  );
  await writeFile(
    join(rootDir, "server.ts"),
    `export default function plugin() {}`,
  );
  return rootDir;
}

function makeService(db: DbConnection, dataDir: string, appVersion: string) {
  const { logger, lines } = capturingLogger();
  const service = createPluginService({
    telemetry: createNoopTelemetryService(),
    db,
    hub: {
      getDaemonSessionIdForHost: () => null,
      notifyPluginSignal: () => 0,
      notifySystem: () => {},
    },
    logger,
    dataDir,
    appVersion,
    loadTimeoutMs: 2000,
  });
  return { service, lines };
}

describe("#1915 incompatible plugin after host upgrade", () => {
  let db: DbConnection;
  let workDir: string;

  beforeEach(async () => {
    db = createConnection(":memory:");
    migrate(db);
    workDir = await mkdtemp(join(tmpdir(), "bb-1915-"));
  });
  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("logs the load on 0.38.x but nothing at all when 0.39.0 marks it incompatible", async () => {
    const rootDir = await writeNotifyPlugin(workDir);

    // bb 0.38.5: the plugin installs and loads; the server logs it.
    const before = makeService(db, join(workDir, "data"), "0.38.5");
    const installed = await before.service.installPath(rootDir);
    expect(installed.status).toBe("running");
    expect(before.lines).toContainEqual("info plugin notify@0.2.1 loaded");
    await before.service.stop();

    // bb 0.39.0 starts against the same database (= user upgraded bb).
    const after = makeService(db, join(workDir, "data"), "0.39.0");
    await after.service.start();
    const entry = after.service.list().find((p) => p.id === "notify");
    expect(entry?.status).toBe("incompatible");
    expect(entry?.statusDetail).toBe(
      "requires bb >=0.38.0 <0.39.0, this is 0.39.0",
    );

    // BUG: no log line mentions the plugin at all. The only place the
    // verdict exists is the in-memory status returned by plugins.list().
    const mentions = after.lines.filter((l) => /notify/i.test(l));
    expect(mentions).not.toEqual([]); // <-- fails on d81fee6f
    await after.service.stop();
  });
});
