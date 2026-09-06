import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { handleLine } from "./bridge.js";
import {
  FULL_PERMISSION_OPTIONS,
  type FakePiBridgeHarness,
  startFakePiBridge,
} from "./test-support.js";

let harness: FakePiBridgeHarness;

beforeEach(async () => {
  harness = await startFakePiBridge({
    prefix: "bb-pi-environment-switch-",
    initialize: true,
    processLog: true,
  });
}, 90_000);

afterEach(async () => {
  await harness.teardown();
}, 90_000);

it("uses the requested environment cwd after resuming a persisted session", async () => {
  const originalDirectory = mkdtempSync(join(tmpdir(), "bb-pi-old-cwd-"));
  try {
    const threadId = "thr-environment-switch";
    mkdirSync(harness.sessionDir, { recursive: true });
    writeFileSync(
      join(harness.sessionDir, `${threadId}.jsonl`),
      `${JSON.stringify({ type: "session", version: 3, id: "sess-1", timestamp: "2026-01-01T00:00:00.000Z", cwd: originalDirectory })}\n`,
    );
    const resumed = await harness.request(1, "thread/resume", {
      threadId,
      providerThreadId: threadId,
      cwd: harness.workspaceDir,
      instructionMode: "append",
      options: FULL_PERMISSION_OPTIONS,
    });
    expect(resumed.result).toMatchObject({ providerThreadId: threadId });
    handleLine(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "turn/start",
        params: {
          threadId,
          providerThreadId: threadId,
          clientRequestId: "creq_rsm2345678",
          input: [
            {
              type: "text",
              text: '/tool bash {"command":"pwd"}',
              mentions: [],
            },
          ],
          options: FULL_PERMISSION_OPTIONS,
        },
      }),
    );
    await harness.waitForDelta(threadId, (delta) => delta.kind === "item.close");
    const command = harness
      .deltasOf(threadId)
      .find((delta) => delta.kind === "item.open");
    expect(command?.item).toMatchObject({
      type: "command",
      command: "pwd",
      cwd: harness.workspaceDir,
    });
  } finally {
    rmSync(originalDirectory, { recursive: true, force: true });
  }
}, 90_000);
