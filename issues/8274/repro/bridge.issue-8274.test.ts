import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  experimental_assembleCapturedThreadEvents as assembleCapturedThreadEvents,
  experimental_createBridgeJsonRpcTestHarness as createBridgeJsonRpcTestHarness,
} from "@get-bb/plugin-sdk/provider-bridge/testing";
import type { BridgeJsonRpcTestHarness } from "@get-bb/plugin-sdk/provider-bridge/testing";
import { handleLine } from "./bridge.js";
import {
  FULL_ACCESS_SESSION_OPTIONS,
  stubFakeCodexAppServer,
} from "./fake-codex-app-server-harness.js";

const THREAD_ID = "thr_repro_8274";
let harness: BridgeJsonRpcTestHarness;
let workspaceDir: string;

beforeEach(() => {
  workspaceDir = mkdtempSync(join(tmpdir(), "bb-repro-8274-"));
  harness = createBridgeJsonRpcTestHarness(handleLine);
});

afterEach(async () => {
  vi.useRealTimers();
  harness.sendRequest(99, "thread/stop", {
    threadId: THREAD_ID,
    providerThreadId: "repro-cleanup",
    intent: "release",
    activeTurnId: null,
  });
  await harness.waitForResponse(99);
  harness.restore();
  vi.unstubAllEnvs();
  rmSync(workspaceDir, { recursive: true, force: true });
});

it.each(["silent", "completed"] as const)(
  "settles a retried turn when the child becomes %s",
  async (outcome) => {
    const scriptPath = join(workspaceDir, "notifications.json");
    const turnId = "repro-turn";
    writeFileSync(
      scriptPath,
      JSON.stringify({
        turns: [
          [
            {
              method: "turn/started",
              params: {
                threadId: "script-thread",
                turn: { id: turnId, status: "inProgress" },
              },
            },
            ...[1, 2, 3].map((attempt) => ({
              method: "error",
              params: {
                threadId: "script-thread",
                turnId,
                error: {
                  message: `Synthetic transport retry ${attempt}`,
                  codexErrorInfo: "internalServerError",
                  additionalDetails: null,
                },
                willRetry: true,
              },
            })),
            ...(outcome === "completed"
              ? [
                  {
                    method: "turn/completed",
                    params: {
                      threadId: "script-thread",
                      turn: { id: turnId, status: "completed" },
                    },
                  },
                ]
              : []),
          ],
        ],
      }),
    );
    stubFakeCodexAppServer(scriptPath);
    harness.sendRequest(1, "thread/start", {
      threadId: THREAD_ID,
      cwd: workspaceDir,
      instructionMode: "append",
      options: FULL_ACCESS_SESSION_OPTIONS,
    });
    const response = await harness.waitForResponse(1);
    const { providerThreadId } = z
      .object({ providerThreadId: z.string() })
      .parse(response.result);
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout"],
      shouldAdvanceTime: true,
    });
    harness.sendRequest(2, "turn/start", {
      threadId: THREAD_ID,
      providerThreadId,
      input: [{ type: "text", text: "Exercise lifecycle" }],
      clientRequestId: "creq_abcdefghjk",
      options: FULL_ACCESS_SESSION_OPTIONS,
    });
    expect(await harness.waitForResponse(2)).not.toHaveProperty("error");
    const events = () =>
      assembleCapturedThreadEvents(harness.messages, "codex");
    await vi.waitFor(() => {
      expect(
        events().filter((event) => event.type === "provider/error"),
      ).toHaveLength(3);
      if (outcome === "completed") {
        expect(events().some((event) => event.type === "turn/completed")).toBe(
          true,
        );
      }
    });
    await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000);
    const captured = events();
    const boundaries = captured.filter(
      (event) => event.type === "turn/completed",
    );
    console.log(
      JSON.stringify({
        outcome,
        observedRetryErrors: captured.filter(
          (event) => event.type === "provider/error",
        ).length,
        observedStarts: captured.filter(
          (event) => event.type === "turn/started",
        ).length,
        observedBoundaries: boundaries.length,
        advancedSilenceMs: 3 * 60 * 60 * 1000,
      }),
    );
    expect(boundaries).toHaveLength(1);
    expect(boundaries[0]).toMatchObject({
      status: outcome === "silent" ? "failed" : "completed",
    });
  },
);
