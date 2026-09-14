import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { PI_BRIDGE_ARGS_ENV, PI_BRIDGE_COMMAND_ENV } from "./rpc-child.js";
import { FULL_PERMISSION_OPTIONS, startFakePiBridge } from "./test-support.js";

it("resumes a saved session in the current directory after the original directory is removed", async () => {
  const harness = await startFakePiBridge({ prefix: "bb-3634-", initialize: true });
  try {
    const oldCwd = join(harness.workspaceDir, "old");
    const newCwd = join(harness.workspaceDir, "new");
    mkdirSync(oldCwd);
    mkdirSync(newCwd);
    mkdirSync(harness.sessionDir, { recursive: true });
    writeFileSync(join(harness.sessionDir, "thr-3634.jsonl"), JSON.stringify({
      type: "session", version: 3, id: "session-3634",
      timestamp: "2026-09-14T00:00:00.000Z", cwd: oldCwd,
    }) + "\n");
    rmSync(oldCwd, { recursive: true });
    const piEntry = fileURLToPath(new URL("../../node_modules/@earendil-works/pi-coding-agent/dist/cli.js", import.meta.url));
    vi.stubEnv("PI_CODING_AGENT_DIR", join(harness.workspaceDir, "agent"));
    vi.stubEnv(PI_BRIDGE_COMMAND_ENV, process.execPath);
    vi.stubEnv(PI_BRIDGE_ARGS_ENV, JSON.stringify([piEntry]));
    const response = await harness.request(3634, "thread/resume", {
      threadId: "thr-3634", providerThreadId: "thr-3634", cwd: newCwd,
      instructionMode: "append", options: FULL_PERMISSION_OPTIONS,
    });
    console.log(JSON.stringify(response).replaceAll(harness.workspaceDir, "<scratch>"));
    expect(response.error).toBeUndefined();
  } finally {
    await harness.teardown();
  }
}, 60_000);
