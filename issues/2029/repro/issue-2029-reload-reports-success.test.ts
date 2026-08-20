// Repro for get-bb/bb#2029 (defect 2): `pluginService.reload(id)` resolves
// normally when the plugin's previous service did not stop, even though the
// outcome is "plugin unloaded, degraded, CLI command gone". The HTTP route
// (POST /plugins/reload) and `bb plugin reload` therefore report ok:true /
// exit 0. The last assertion FAILS on main (c7c66423d) because reload resolves.
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConnection, migrate, type DbConnection } from "@bb/db";
import type { Logger } from "@bb/logger";
import {
  createPluginService,
  type PluginService,
} from "../../../src/services/plugins/plugin-service.js";
import { testLogger } from "../../helpers/test-app.js";
import { createNoopTelemetryService } from "../../../src/services/system/telemetry.js";

const logger = testLogger as unknown as Logger;

describe("issue 2029: reload of a plugin whose service ignores abort", () => {
  let db: DbConnection;
  let workDir: string;
  let service: PluginService;

  beforeEach(async () => {
    db = createConnection(":memory:");
    migrate(db);
    workDir = await mkdtemp(join(tmpdir(), "bb-2029-"));
    service = createPluginService({
      telemetry: createNoopTelemetryService(),
      db,
      hub: {
        getDaemonSessionIdForHost: () => null,
        notifyPluginSignal: () => 0,
        notifySystem: () => {},
      },
      logger,
      dataDir: join(workDir, "data"),
      appVersion: "0.9.0",
      loadTimeoutMs: 2000,
      serviceStopTimeoutMs: 100,
      serviceRestartBaseMs: 5,
    });
  });

  afterEach(async () => {
    await service.stop();
    await rm(workDir, { recursive: true, force: true });
  });

  it("leaves the plugin unloaded with its CLI gone, yet reload() resolves (reports success)", async () => {
    const rootDir = join(workDir, "bb-plugin-collab");
    await mkdir(rootDir, { recursive: true });
    await writeFile(
      join(rootDir, "package.json"),
      JSON.stringify({
        name: "bb-plugin-collab",
        version: "0.1.0",
        bb: {
          name: "collab",
          description: "fixture",
          branding: { icon: "Zap" },
          server: "./server.ts",
        },
      }),
    );
    await writeFile(
      join(rootDir, "server.ts"),
      `
      export default function plugin(bb: any) {
        const db = bb.storage.database();
        db.exec("CREATE TABLE IF NOT EXISTS ticks (at INTEGER)");
        bb.cli.register({ name: "collab", summary: "collab", run() { return { exitCode: 0, stdout: "ok" }; } });
        bb.background.service("lane-watcher", {
          start() {
            const g = globalThis as any;
            g.__2029ticks = 0; g.__2029closedErrors = 0;
            const timer = setInterval(() => {
              try { db.prepare("INSERT INTO ticks (at) VALUES (?)").run(Date.now()); g.__2029ticks += 1; }
              catch (e) { g.__2029closedErrors += 1; }
            }, 20);
            (timer as any).unref?.();
            return new Promise<void>(() => {}); // ignores abort forever
          },
        });
      }
      `,
    );
    const installed = await service.installPath(rootDir);
    expect(installed.status).toBe("running");
    expect(service.getApi("collab")).toBeDefined();

    // What `bb plugin reload collab` does. It resolves; the route then answers
    // { ok: true } and the CLI exits 0.
    let reloadError: unknown = null;
    try {
      await service.reload("collab");
    } catch (error) {
      reloadError = error;
    }

    const entry = service.list().find((p) => p.id === "collab");
    expect(entry?.status).toBe("degraded");
    expect(entry?.statusDetail).toContain("service lane-watcher did not stop");
    // The plugin is unloaded: no API handle -> `bb collab` is "unknown command".
    expect(service.getApi("collab")).toBeUndefined();
    // The orphaned service keeps ticking on the closed database handle.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const g = globalThis as Record<string, unknown>;
    expect(g.__2029closedErrors as number).toBeGreaterThan(0);

    // Expected by the reporter (and by any automated deploy): a reload that
    // leaves the plugin unusable must not report success.
    expect(reloadError, "reload() resolved although the plugin is degraded and unloaded").not.toBeNull();
  });
});
