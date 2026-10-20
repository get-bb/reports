import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readOpenCodeGoUsage } from "./opencode-usage.js";

let directory: string;
const fetchUsage = vi.fn<typeof fetch>();
const databaseKey = "fixture-database-only";
const obsoleteKey = "fixture-obsolete-file";

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), "bb-5852-"));
  await fs.mkdir(path.join(directory, "opencode"));
  fetchUsage.mockReset();
  fetchUsage.mockImplementation(
    async () => new Response("{}", { status: 500 }),
  );
  vi.stubGlobal("fetch", fetchUsage);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await fs.rm(directory, { recursive: true, force: true });
});

async function seedCredential(active: number | null, legacyFile: boolean) {
  const database = new DatabaseSync(
    path.join(directory, "opencode", "opencode.db"),
  );
  try {
    database.exec(
      "CREATE TABLE credential (id TEXT PRIMARY KEY, integration_id TEXT, label TEXT NOT NULL, value TEXT NOT NULL, connector_id TEXT, method_id TEXT, active INTEGER, time_created INTEGER NOT NULL, time_updated INTEGER NOT NULL)",
    );
    database
      .prepare(
        "INSERT INTO credential (id, integration_id, label, value, active, time_created, time_updated) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        "fixture-row",
        "opencode",
        "fixture",
        JSON.stringify({ type: "key", key: databaseKey }),
        active,
        10,
        10,
      );
  } finally {
    database.close();
  }
  if (legacyFile) {
    await fs.writeFile(
      path.join(directory, "opencode", "auth.json"),
      JSON.stringify({ "opencode-go": { type: "api", key: obsoleteKey } }),
    );
  }
}

it("control: an explicitly active database credential overrides the legacy file", async () => {
  await seedCredential(1, true);
  const result = await readOpenCodeGoUsage({
    HOME: directory,
    XDG_DATA_HOME: directory,
  });
  const headers = new Headers(fetchUsage.mock.calls[0]?.[1]?.headers);
  expect(headers.get("authorization") === "Bearer " + databaseKey).toBe(true);
  expect(result.usage.status).toBe("error");
});

it.each([true, false])(
  "regression: a selectable unflagged database credential remains usable (legacy file: %s)",
  async (legacyFile) => {
    await seedCredential(null, legacyFile);
    const result = await readOpenCodeGoUsage({
      HOME: directory,
      XDG_DATA_HOME: directory,
    });
    const headers = new Headers(fetchUsage.mock.calls[0]?.[1]?.headers);
    const selectedDatabase =
      headers.get("authorization") === "Bearer " + databaseKey;
    const selectedLegacy =
      headers.get("authorization") === "Bearer " + obsoleteKey;
    console.log(
      JSON.stringify({
        legacyFile,
        selectedDatabase,
        selectedLegacy,
        requests: fetchUsage.mock.calls.length,
        status: result.usage.status,
      }),
    );
    expect(selectedDatabase).toBe(true);
  },
);
