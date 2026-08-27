import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import path from "node:path";

test("bb status fails when the server port is closed", () => {
  const repoRoot = process.env.BB_REPRO_REPO;
  assert.ok(repoRoot, "Set BB_REPRO_REPO to the bb checkout path.");
  const reproPort = process.env.BB_REPRO_PORT;
  assert.match(reproPort ?? "", /^\d+$/, "Set BB_REPRO_PORT to a free port.");
  const commandEnv = { ...process.env };
  delete commandEnv.BB_CLI;
  delete commandEnv.BB_ENVIRONMENT_ID;
  delete commandEnv.BB_THREAD_ID;

  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "apps/cli/dist/index.js"), "status"],
    {
      encoding: "utf8",
      env: {
        ...commandEnv,
        BB_PROJECT_ID: "proj_xxxxxxxxxx",
        BB_SERVER_URL: `http://127.0.0.1:${reproPort}`,
      },
      timeout: 2_000,
    },
  );

  assert.notStrictEqual(
    result.status,
    0,
    `The command reported success. Output:\n${result.stdout}${result.stderr}`,
  );
});
