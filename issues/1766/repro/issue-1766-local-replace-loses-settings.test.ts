// Repro for get-bb/bb#1766: replacing a local (path:) plugin from a new
// checkout is only possible via `remove` + `install`, and `remove` deletes
// plugin_settings / schedules / secrets for the id.
import { mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createConnection,
  getPluginSettingsValues,
  migrate,
  type DbConnection,
} from "@bb/db";
import type { Logger } from "@bb/logger";
import {
  createPluginService,
  type PluginService,
} from "../../../src/services/plugins/plugin-service.js";
import { pluginSecretsDir } from "../../../src/services/plugins/plugin-settings.js";
import { testLogger } from "../../helpers/test-app.js";
import { createNoopTelemetryService } from "../../../src/services/system/telemetry.js";

const logger = testLogger as unknown as Logger;

const SERVER_SOURCE = `
  export default async function plugin(bb: any) {
    const settings = bb.settings.define({
      alertFloorMinutes: { type: "string", label: "Alert floor (min)", default: "60" },
      staleWindowMinutes: { type: "string", label: "Stale window (min)", default: "1440" },
      token: { type: "string", label: "Token", secret: true },
    });
    (globalThis as any).__watchdog = { settings };
  }
`;

// Same plugin id (package name -> "watchdog") written to two different
// directories, like two checkouts of the same repo.
async function writeCheckout(dir: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({
      name: "bb-plugin-watchdog",
      version: "0.1.0",
      bb: {
        name: "Watchdog fixture",
        description: "Issue 1766 fixture.",
        branding: { icon: "Zap" },
        server: "./server.ts",
      },
    }),
  );
  await writeFile(join(dir, "server.ts"), SERVER_SOURCE);
  return dir;
}

describe("issue #1766: local plugin replace destroys settings", () => {
  let db: DbConnection;
  let workDir: string;
  let dataDir: string;
  let service: PluginService;
  let checkoutA: string;
  let checkoutB: string;

  beforeEach(async () => {
    db = createConnection(":memory:");
    migrate(db);
    workDir = await mkdtemp(join(tmpdir(), "bb-issue-1766-"));
    dataDir = join(workDir, "data");
    checkoutA = await writeCheckout(join(workDir, "checkout-a"));
    checkoutB = await writeCheckout(join(workDir, "checkout-b"));
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

  async function installAndTune(): Promise<void> {
    const entry = await service.installPath(checkoutA);
    expect(entry.status).toBe("running");
    await service.updateSettings("watchdog", {
      alertFloorMinutes: "1",
      staleWindowMinutes: "3",
      token: "s3cret",
    });
    expect(getPluginSettingsValues(db, "watchdog")).toEqual({
      alertFloorMinutes: JSON.stringify("1"),
      staleWindowMinutes: JSON.stringify("3"),
    });
    await expect(
      stat(join(pluginSecretsDir(dataDir, "watchdog"), "token")),
    ).resolves.toBeDefined();
  }

  it("control: reload and same-path reinstall keep tuned settings", async () => {
    await installAndTune();
    await service.reload("watchdog");
    expect((await service.getSettings("watchdog"))?.values).toMatchObject({
      alertFloorMinutes: "1",
      staleWindowMinutes: "3",
      token: { set: true },
    });
    // Re-installing from the SAME path is allowed and preserves settings.
    await service.installPath(checkoutA);
    expect((await service.getSettings("watchdog"))?.values).toMatchObject({
      alertFloorMinutes: "1",
      staleWindowMinutes: "3",
      token: { set: true },
    });
  });

  it("installing the same plugin id from a NEW checkout is refused; there is no in-place replace", async () => {
    await installAndTune();
    await expect(service.installPath(checkoutB)).rejects.toThrow(
      /already installed from path:.*checkout-a; remove it first/,
    );
    // The refusal is harmless: settings survive.
    expect(getPluginSettingsValues(db, "watchdog")).toEqual({
      alertFloorMinutes: JSON.stringify("1"),
      staleWindowMinutes: JSON.stringify("3"),
    });
  });

  it("BUG: remove + install from the new checkout silently resets to defaults", async () => {
    await installAndTune();

    // The only supported route to move a path: plugin: remove, then install.
    expect(await service.remove("watchdog")).toBe(true);
    // Removal wiped plugin_settings rows and the secrets dir for the id.
    expect(getPluginSettingsValues(db, "watchdog")).toEqual({});
    await expect(
      stat(pluginSecretsDir(dataDir, "watchdog")),
    ).rejects.toMatchObject({ code: "ENOENT" });

    const entry = await service.installPath(checkoutB);
    expect(entry.status).toBe("running");
    const view = await service.getSettings("watchdog");
    // What the operator tuned. This assertion FAILS on main: the plugin is
    // back on defaults ("60" / "1440", token unset) with no warning.
    expect(view?.values).toMatchObject({
      alertFloorMinutes: "1",
      staleWindowMinutes: "3",
      token: { set: true },
    });
  });
});
