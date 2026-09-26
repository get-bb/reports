import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
import { readOpenCodeGoUsage } from "./opencode-usage.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      fs.rm(directory, { recursive: true, force: true }),
    ),
  );
});

it("collects Go usage from an active OpenCode v2 key credential", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "bb-opencode-v2-"));
  temporaryDirectories.push(directory);
  const opencodeDirectory = path.join(directory, "opencode");
  await fs.mkdir(opencodeDirectory);
  const database = new DatabaseSync(path.join(opencodeDirectory, "opencode.db"));
  database.exec(
    "CREATE TABLE credential (id TEXT PRIMARY KEY, integration_id TEXT, label TEXT NOT NULL, value TEXT NOT NULL, active INTEGER, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL)",
  );
  database
    .prepare(
      "INSERT INTO credential (id, integration_id, label, value, active, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      "cred-test",
      "opencode-go",
      "Test key",
      JSON.stringify({ type: "key", key: "synthetic-go-key" }),
      1,
      1,
      1,
    );
  database.close();

  const fetchUsage = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json({
      usage: {
        rolling: { status: "ok", percent: 12, resetsAt: "2026-10-01T00:00:00Z" },
        weekly: { status: "ok", percent: 24, resetsAt: "2026-10-07T00:00:00Z" },
        monthly: { status: "ok", percent: 36, resetsAt: "2026-11-01T00:00:00Z" },
      },
    }),
  );
  vi.stubGlobal("fetch", fetchUsage);

  const result = await readOpenCodeGoUsage({
    XDG_DATA_HOME: directory,
    HOME: directory,
  });

  expect(result.usage.status).toBe("ok");
  expect(fetchUsage).toHaveBeenCalledWith(
    "https://opencode.ai/zen/go/v1/usage",
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bearer synthetic-go-key",
      }),
    }),
  );
});
