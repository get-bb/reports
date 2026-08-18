// Repro for get-bb/bb#1649: `--script-file` is copied at registration; edits to
// the source path afterwards do not reach the automation.
//
// The CLI (cli.ts buildExecution) reads the file into `script` and forwards the
// path as `scriptFile`; the service (service.ts resolveStoredExecution ->
// script-files.ts writeInlineAutomationScript) writes the content under
// <pluginDataDir>/scripts/<automationId>/<basename> and persists ONLY that
// basename. The absolute source path is never stored, and runs execute the copy.
//
// The last `expect` in each test is the one that documents the reported
// behaviour: it PASSES on main (the behaviour is deliberate), so this file is a
// characterisation test, not a red test.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { getAutomation, migrations, type Db } from "./data.js";
import { createAutomationService } from "./service.js";
import { automationScriptDir } from "./script-files.js";
import { executeStoredScript } from "./script-runner.js";

function createTestDb(): Db {
  const db = new Database(":memory:");
  for (const migration of migrations) db.exec(migration);
  return db;
}

function bb() {
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
      providers: { list: async () => [] as never },
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

describe("issue #1649: --script-file copy semantics", () => {
  it("stores a copy keyed by basename, forgets the source path, and runs the copy after the source changes", async () => {
    const db = createTestDb();
    const pluginDataDir = await mkdtemp(join(tmpdir(), "bb-1649-data-"));
    const srcDir = await mkdtemp(join(tmpdir(), "bb-1649-src-"));
    const sourcePath = join(srcDir, "hello.sh");
    await writeFile(sourcePath, '#!/bin/sh\necho "VERSION 1"\n');
    const service = createAutomationService({
      bb: bb(),
      db,
      pluginDataDir,
      serverUrl: "http://127.0.0.1:1",
    });
    try {
      // Exactly what `bb automation create --script-file <sourcePath>` sends
      // (cli.ts buildExecution): the file CONTENT plus the path.
      const created = await service.create({
        projectId: "proj_test",
        name: "issue-1649",
        enabled: true,
        trigger: { triggerType: "once", runAt: Date.now() + 60_000 },
        execution: {
          mode: "script",
          script: await readFile(sourcePath, "utf8"),
          scriptFile: sourcePath,
          timeoutMs: 120_000,
        },
        origin: "human",
      });

      // 1. Persisted execution keeps only the basename; the source path is gone.
      const row = getAutomation(db, created.id);
      expect(JSON.parse(String(row?.execution))).toEqual({
        mode: "script",
        scriptFile: "hello.sh",
        timeoutMs: 120_000,
      });
      const copyPath = join(
        automationScriptDir(pluginDataDir, created.id),
        "hello.sh",
      );
      await expect(readFile(copyPath, "utf8")).resolves.toContain("VERSION 1");

      // 2. Reporter's step: edit the source file, then run.
      await writeFile(sourcePath, '#!/bin/sh\necho "VERSION 2"\n');
      const result = await executeStoredScript({
        pluginDataDir,
        automationId: created.id,
        runId: "arun_test",
        projectId: "proj_test",
        scriptFile: "hello.sh",
        timeoutMs: 30_000,
        serverUrl: "http://127.0.0.1:1",
      });

      // Expected by the reporter: VERSION 2. Actual on main: VERSION 1, because
      // the run executes <pluginDataDir>/scripts/<id>/hello.sh, never sourcePath.
      expect(result.output).toContain("VERSION 1");
      expect(result.output).not.toContain("VERSION 2");

      // 3. `show` returns the copy's content, without either path.
      const shown = await service.get({
        projectId: "proj_test",
        automationId: created.id,
      });
      expect(shown.execution).toEqual({
        mode: "script",
        script: '#!/bin/sh\necho "VERSION 1"\n',
        timeoutMs: 120_000,
      });
    } finally {
      await rm(pluginDataDir, { recursive: true, force: true });
      await rm(srcDir, { recursive: true, force: true });
    }
  });
});
