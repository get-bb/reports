// Repro for get-bb/bb#2166: `bb automation update --prompt <over-cap>` writes
// the row before the response serializer rejects it, leaving a row that every
// later read (list/show/update) rejects with the same `too_big` issue.
//
// Expected (desired) behaviour: the update is rejected before anything is
// persisted, and list/show/update keep working. Every assertion below that is
// marked BUG currently fails on main (fcada5a3b).
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import type { PluginCliRegistration } from "@get-bb/plugin-sdk";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getAutomation,
  listAutomationRuns,
  migrations,
  type Db,
} from "./data.js";
import { sweepDueAutomations } from "./sweep.js";
import { createAutomationService } from "./service.js";
import { registerAutomationCli } from "./cli.js";
import { AUTOMATION_PROMPT_MAX_LENGTH } from "./rpc-types.js";

function createTestDb(): Db {
  const db = new Database(":memory:");
  for (const migration of migrations) db.exec(migration);
  return db;
}

function fakeBb() {
  return {
    sdk: {
      projects: {
        get: async ({ projectId }: { projectId: string }) => ({
          id: projectId,
          kind: "standard" as const,
          name: "Test Project",
          gitRemoteUrl: null,
          createdAt: 1,
          updatedAt: 1,
          sources: [],
        }),
        list: async () => [],
      },
      providers: {
        list: async () =>
          [
            {
              id: "codex",
              capabilities: {
                permissionModes: ["accept-edits", "auto", "full"],
              },
            },
          ] as never,
      },
      hosts: { list: async () => [] },
      threads: {
        get: async () => {
          throw new Error("not expected");
        },
        send: async () => {
          throw new Error("not expected");
        },
        spawn: async () => {
          throw new Error("not expected");
        },
      },
    },
    realtime: { publish: () => undefined },
    log: {
      debug: () => undefined,
      error: () => undefined,
      info: () => undefined,
      warn: () => undefined,
    },
  };
}

describe("issue #2166: over-cap prompt update", () => {
  let db: Db;
  let pluginDataDir: string;
  let cli: PluginCliRegistration;
  const ctx = { cwd: "/", threadId: undefined } as never;
  // 8039 chars, the same length as in the report.
  const overCap = "x".repeat(AUTOMATION_PROMPT_MAX_LENGTH + 39);

  beforeEach(async () => {
    db = createTestDb();
    pluginDataDir = await mkdtemp(join(tmpdir(), "bb-2166-"));
    const bb = fakeBb();
    const service = createAutomationService({
      bb,
      db,
      pluginDataDir,
      serverUrl: "http://127.0.0.1:1",
    });
    let registered: PluginCliRegistration | undefined;
    registerAutomationCli({
      bb: {
        sdk: bb.sdk as never,
        cli: {
          register: (registration) => {
            registered = registration;
          },
        },
      },
      service,
    });
    if (!registered) throw new Error("automation CLI was not registered");
    cli = registered;
  });

  afterEach(async () => {
    await rm(pluginDataDir, { recursive: true, force: true });
  });

  async function createHealthy(): Promise<string> {
    const created = await cli.run(
      [
        "create",
        "--project",
        "proj_test",
        "--name",
        "issue-2166",
        "--cron",
        "*/5 * * * *",
        "--timezone",
        "UTC",
        "--prompt",
        "Reply only with ok.",
        "--provider",
        "codex",
        "--model",
        "gpt-5",
      ],
      ctx,
    );
    expect(created.exitCode, created.stderr).toBe(0);
    const id = /Automation created: (\S+)/.exec(created.stdout ?? "")?.[1];
    if (!id) throw new Error(`no id in: ${created.stdout}`);
    return id;
  }

  function storedPromptLength(id: string): number {
    const row = db
      .prepare("SELECT execution FROM automations WHERE id = ?")
      .get(id) as { execution: string };
    return (JSON.parse(row.execution) as { prompt: string }).prompt.length;
  }

  it("rejects the update without persisting it (BUG: row is written)", async () => {
    const id = await createHealthy();
    expect(storedPromptLength(id)).toBe("Reply only with ok.".length);

    const update = await cli.run(
      ["update", id, "--project", "proj_test", "--prompt", overCap],
      ctx,
    );
    // The CLI does report a rejection ...
    expect(update.exitCode).toBe(1);
    expect(update.stderr).toContain("too_big");

    // ... but the row was written anyway. BUG: this assertion fails on main
    // (stored length is 8039, not 19).
    expect(storedPromptLength(id)).toBe("Reply only with ok.".length);
  });

  it("keeps list/show/update working for the project after a rejected update (BUG: all fail)", async () => {
    const healthyId = await createHealthy();
    const brokenId = await createHealthy();
    await cli.run(
      ["update", brokenId, "--project", "proj_test", "--prompt", overCap],
      ctx,
    );

    // `bb automation list --project proj_test` takes the healthy row down too.
    const list = await cli.run(["list", "--project", "proj_test"], ctx);
    expect(list.exitCode, list.stderr).toBe(0); // BUG: exit 1, too_big
    expect(list.stdout).toContain(healthyId);

    // `bb automation show <brokenId>` sends no prompt, still too_big.
    const show = await cli.run(
      ["show", brokenId, "--project", "proj_test"],
      ctx,
    );
    expect(show.exitCode, show.stderr).toBe(0); // BUG: exit 1, too_big

    // Recovery with a valid, short prompt is locked out: update reads
    // (and validates) the stored row before it writes.
    const repair = await cli.run(
      [
        "update",
        brokenId,
        "--project",
        "proj_test",
        "--prompt",
        "short again",
      ],
      ctx,
    );
    expect(repair.exitCode, repair.stderr).toBe(0); // BUG: exit 1, too_big
    expect(storedPromptLength(brokenId)).toBe("short again".length);
  });

  it("documents the current (buggy) behaviour precisely", async () => {
    const healthyId = await createHealthy();
    const brokenId = await createHealthy();
    const update = await cli.run(
      ["update", brokenId, "--project", "proj_test", "--prompt", overCap],
      ctx,
    );
    expect(update.exitCode).toBe(1);
    expect(storedPromptLength(brokenId)).toBe(overCap.length); // written anyway

    const list = await cli.run(["list", "--project", "proj_test"], ctx);
    expect(list.exitCode).toBe(1);
    expect(list.stderr).toContain("too_big");
    expect(list.stdout ?? "").not.toContain(healthyId); // healthy row hidden

    const showHealthy = await cli.run(
      ["show", healthyId, "--project", "proj_test"],
      ctx,
    );
    expect(showHealthy.exitCode).toBe(0); // per-row: other ids still work

    const repair = await cli.run(
      [
        "update",
        brokenId,
        "--project",
        "proj_test",
        "--prompt",
        "short again",
      ],
      ctx,
    );
    expect(repair.exitCode).toBe(1);
    expect(repair.stderr).toContain("too_big");
    expect(storedPromptLength(brokenId)).toBe(overCap.length); // unchanged: locked out
  });

  it("claim check: the scheduler SKIPS (not runs) the corrupted automation", async () => {
    // The issue says "the automation keeps running on schedule throughout".
    // The sweep parses the stored execution with the same schema and bails.
    const brokenId = await createHealthy();
    await cli.run(
      ["update", brokenId, "--project", "proj_test", "--prompt", overCap],
      ctx,
    );
    const errors: string[] = [];
    const bb = {
      sdk: {
        hosts: {
          list: async () => [
            {
              id: "host_test",
              name: "host",
              type: "persistent",
              status: "connected",
              lastSeenAt: null,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
        threads: {
          get: async () => {
            throw new Error("not expected");
          },
          send: async () => {
            throw new Error("not expected");
          },
          spawn: async () => {
            throw new Error("sweep tried to spawn a thread");
          },
        },
      },
      realtime: { publish: () => undefined },
      log: {
        debug: () => undefined,
        error: (message: string) => {
          errors.push(message);
        },
        info: () => undefined,
        warn: () => undefined,
      },
    };
    const before = getAutomation(db, brokenId);
    if (!before || before.nextRunAt === null) throw new Error("no nextRunAt");
    await sweepDueAutomations(bb, db, {
      pluginDataDir,
      serverUrl: "http://127.0.0.1:1",
      now: before.nextRunAt + 1,
    });
    const after = getAutomation(db, brokenId);
    expect(after?.runCount).toBe(0);
    expect(after?.nextRunAt).toBe(before.nextRunAt); // never advances
    expect(
      listAutomationRuns(db, { automationId: brokenId, limit: 10 }),
    ).toHaveLength(0);
    expect(errors.join("\n")).toContain(
      `Skipping due automation ${brokenId} with invalid stored configuration`,
    );
  });

  it("recovers an already-corrupted row (the reporter's situation) via list/show/update", async () => {
    // Seed the corrupt row directly, as a user who already hit the bug has it.
    const healthyId = await createHealthy();
    const brokenId = await createHealthy();
    db.prepare(
      "UPDATE automations SET execution = json_set(execution, '$.prompt', ?) WHERE id = ?",
    ).run(overCap, brokenId);
    expect(storedPromptLength(brokenId)).toBe(overCap.length);

    const list = await cli.run(["list", "--project", "proj_test"], ctx);
    expect(list.exitCode, list.stderr).toBe(0); // BUG on main
    expect(list.stdout).toContain(healthyId);
    expect(list.stdout).toContain(brokenId);

    const show = await cli.run(
      ["show", brokenId, "--project", "proj_test"],
      ctx,
    );
    expect(show.exitCode, show.stderr).toBe(0); // BUG on main

    const repair = await cli.run(
      ["update", brokenId, "--project", "proj_test", "--prompt", "short again"],
      ctx,
    );
    expect(repair.exitCode, repair.stderr).toBe(0); // BUG on main
    expect(storedPromptLength(brokenId)).toBe("short again".length);
  });
});
