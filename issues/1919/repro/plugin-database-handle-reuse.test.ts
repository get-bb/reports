// Repro for get-bb/bb#1919: storage.database() opens a new better-sqlite3
// connection on every call instead of reusing one handle per plugin, so a
// chatty plugin leaks file descriptors until dispose/reload.
import {
  mkdtemp,
  mkdir,
  readdir,
  readlink,
  rm,
  writeFile,
} from "node:fs/promises";
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

/** Count open fds in this process that point at files under `dir`. */
async function openFdsUnder(dir: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const fd of await readdir("/proc/self/fd")) {
    let target: string;
    try {
      target = await readlink(join("/proc/self/fd", fd));
    } catch {
      continue;
    }
    if (target.startsWith(dir)) {
      const name = target.slice(dir.length + 1);
      counts[name] = (counts[name] ?? 0) + 1;
    }
  }
  return counts;
}

describe("storage.database() handle reuse (#1919)", () => {
  let db: DbConnection;
  let workDir: string;
  let dataDir: string;
  let service: PluginService;

  beforeEach(async () => {
    db = createConnection(":memory:");
    migrate(db);
    workDir = await mkdtemp(join(tmpdir(), "bb-plugin-db-reuse-"));
    dataDir = join(workDir, "data");
    service = createPluginService({
      telemetry: createNoopTelemetryService(),
      db,
      hub: {
        getDaemonSessionIdForHost: () => null,
        notifyPluginSignal: () => 0,
        notifySystem: () => {},
      },
      logger,
      dataDir,
      appVersion: "0.9.0",
      loadTimeoutMs: 2000,
    });
  });

  afterEach(async () => {
    await service.stop();
    await rm(workDir, { recursive: true, force: true });
  });

  it("returns one reused handle per plugin instead of opening a connection per call", async () => {
    const CALLS = 200;
    const rootDir = join(workDir, "bb-plugin-chatty");
    await mkdir(rootDir, { recursive: true });
    await writeFile(
      join(rootDir, "package.json"),
      JSON.stringify({
        name: "bb-plugin-chatty",
        version: "0.1.0",
        bb: {
          name: "Chatty",
          description: "Calls storage.database() on every service method.",
          branding: { icon: "Zap" },
          server: "./server.ts",
        },
      }),
    );
    await writeFile(
      join(rootDir, "server.ts"),
      `
      export default function plugin(bb: any) {
        const g = globalThis as any;
        g.__chatty = { bb, handles: [] as unknown[] };
        // Simulates a plugin whose every service method calls database().
        for (let i = 0; i < ${CALLS}; i++) {
          const db = bb.storage.database();
          db.prepare("SELECT 1").get();
          g.__chatty.handles.push(db);
        }
      }
      `,
    );
    const entry = await service.installPath(rootDir);
    expect(entry.status).toBe("running");

    const state = (globalThis as Record<string, unknown>).__chatty as {
      handles: unknown[];
    };
    const distinct = new Set(state.handles);
    const pluginDir = join(dataDir, "plugins", "chatty");
    const fds = await openFdsUnder(pluginDir);
    // eslint-disable-next-line no-console
    console.log(
      `[#1919] ${CALLS} database() calls -> ${distinct.size} distinct handles; open fds under ${pluginDir}:`,
      fds,
    );

    // Contract (backend-contract.ts / fake-plugin-host.ts): one reused handle.
    expect(distinct.size).toBe(1); // FAILS on d81fee6f: 200 distinct handles
    expect(fds["data.db"] ?? 0).toBeLessThanOrEqual(1); // FAILS: 200 fds on data.db
  });
});
