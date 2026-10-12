import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { z } from "zod";
import { createBridgeJsonRpcTestHarness } from "@bb/provider-bridge-protocol/testing";
import { handleLine } from "./bridge.js";

it.each([
  {
    phase: "stop",
    permissionMode: "full",
    expected: { outcome: "cancelled" },
  },
  {
    phase: "cancel",
    permissionMode: "full",
    expected: { outcome: "cancelled" },
  },
  {
    phase: "load",
    permissionMode: "full",
    expected: { outcome: "selected", optionId: "yes" },
  },
  {
    phase: "turn",
    permissionMode: "full",
    expected: { outcome: "selected", optionId: "yes" },
  },
  {
    phase: "load",
    permissionMode: "accept-edits",
    expected: { outcome: "cancelled" },
  },
] as const)(
  "permission at $phase with $permissionMode",
  async ({ phase, permissionMode, expected }) => {
    const workspace = mkdtempSync(join(tmpdir(), "issue-5401-"));
    const outcomeLog = join(workspace, "outcome.jsonl");
    const readyFile = join(workspace, "ready");
    const harness = createBridgeJsonRpcTestHarness(handleLine);
    const options = {
      permissionMode,
      permissionScope: permissionMode === "full" ? "full" : "workspace",
      approvalReviewer: permissionMode === "full" ? null : "user",
      permissionEscalation: permissionMode === "full" ? null : "ask",
      providerOptions: {
        acpLaunchSpec: {
          displayName: "Restore fixture",
          command: process.execPath,
          args: [
            fileURLToPath(new URL("./issue-5401-agent.mjs", import.meta.url)),
          ],
          env: {
            OUTCOME_LOG: outcomeLog,
            READY_FILE: readyFile,
            CASE_PHASE: phase,
          },
        },
      },
    };
    try {
      harness.sendRequest(
        540101,
        phase === "load" ? "thread/resume" : "thread/start",
        {
          threadId: "thread-5401",
          cwd: workspace,
          instructionMode: "append",
          options,
          ...(phase === "load" ? { providerThreadId: "restored-session" } : {}),
        },
      );
      const construction = await harness.waitForResponse(540101);
      expect(construction.error).toBeUndefined();
      expect(construction.result).toEqual({
        providerThreadId: "restored-session",
        sessionRestorable: true,
      });
      if (phase !== "load") {
        harness.sendRequest(540102, "turn/start", {
          threadId: "thread-5401",
          providerThreadId: "restored-session",
          clientRequestId: "creq_abcdefghjk",
          options,
          input: [{ type: "text", text: "Status", mentions: [] }],
        });
        const turn = await harness.waitForResponse(540102);
        expect(turn.error).toBeUndefined();
      }
      if (phase === "stop" || phase === "cancel") {
        await expect.poll(() => existsSync(readyFile)).toBe(true);
        harness.sendRequest(
          540104,
          phase === "stop" ? "thread/stop" : "turn/steer",
          {
            threadId: "thread-5401",
            providerThreadId: "restored-session",
            ...(phase === "stop"
              ? { intent: "interrupt", activeTurnId: null }
              : {
                  clientRequestId: "creq_bcdefghjkm",
                  expectedTurnId: "turn-1",
                  options,
                  input: [{ type: "text", text: "Continue", mentions: [] }],
                }),
          },
        );
        expect((await harness.waitForResponse(540104)).error).toBeUndefined();
      }
      await expect.poll(() => existsSync(outcomeLog)).toBe(true);
      const receipt = z
        .object({
          phase: z.string(),
          response: z.object({
            outcome: z.union([
              z.object({
                outcome: z.literal("selected"),
                optionId: z.string(),
              }),
              z.object({ outcome: z.literal("cancelled") }),
            ]),
          }),
        })
        .parse(JSON.parse(readFileSync(outcomeLog, "utf8").trim()));
      expect(receipt.phase).toBe(phase);
      expect(
        harness.messages.filter(
          (message) => message.method === "interaction/request",
        ),
      ).toHaveLength(0);
      expect(receipt.response.outcome).toEqual(expected);
    } finally {
      try {
        harness.sendRequest(540103, "thread/stop", {
          threadId: "thread-5401",
          providerThreadId: "restored-session",
          intent: "interrupt",
          activeTurnId: null,
        });
        await harness.waitForResponse(540103);
      } finally {
        harness.restore();
        rmSync(workspace, { recursive: true, force: true });
      }
    }
  },
);
