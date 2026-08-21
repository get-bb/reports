/**
 * Hostile probes for PR #2123 (vouched agent-initiated ACP turns).
 *
 * 1. The agent process exits while a vouched turn is open: the turn must
 *    still reach a terminal state (otherwise the thread hangs "working").
 * 2. The agent asks for permission during a vouched turn: the bridge must
 *    not auto-cancel it (the turn is real work, not an idle session).
 */
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  experimental_assembleCapturedThreadEvents as assembleCapturedThreadEvents,
  experimental_captureBridgeJsonRpcOutput as captureBridgeJsonRpcOutput,
} from "@get-bb/plugin-sdk/provider-bridge/testing";
import type { CapturedBridgeJsonRpcOutput } from "@get-bb/plugin-sdk/provider-bridge/testing";

import { handleLine } from "./bridge.js";

const AGENT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "issue-2122-unprompted-agent.mjs",
);

let output: CapturedBridgeJsonRpcOutput;
let workspaceDir: string;
let nextRequestId = 500;

function sendRequest(method: string, params: object): number {
  nextRequestId += 1;
  handleLine(
    JSON.stringify({ jsonrpc: "2.0", id: nextRequestId, method, params }),
  );
  return nextRequestId;
}

async function waitFor<T>(
  resolveValue: () => T | undefined,
  description: string,
  timeoutMs = 10_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = resolveValue();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`Timed out: ${description}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

function events(): Record<string, unknown>[] {
  return assembleCapturedThreadEvents(
    output.messages,
    "acp",
  ) as unknown as Record<string, unknown>[];
}

function agentText(): string {
  let text = "";
  for (const event of events()) {
    if (event.type === "item/agentMessage/delta") {
      text += String(event.delta ?? "");
    }
  }
  return text;
}

function optionsWith(envVars: Record<string, string>, mode: "full" | "accept-edits") {
  return {
    ...(mode === "full"
      ? {
          permissionMode: "full",
          permissionScope: "full",
          approvalReviewer: null,
          permissionEscalation: null,
        }
      : {
          permissionMode: "accept-edits",
          permissionScope: "workspace",
          approvalReviewer: "user",
          permissionEscalation: "ask",
        }),
    envVars,
    providerOptions: {
      acpLaunchSpec: {
        displayName: "Unprompted ACP",
        command: process.execPath,
        args: [AGENT_PATH],
        env: {},
      },
    },
  };
}

async function startAndPrompt(
  threadId: string,
  envVars: Record<string, string>,
  mode: "full" | "accept-edits",
): Promise<string> {
  const options = optionsWith(envVars, mode);
  const startId = sendRequest("thread/start", {
    threadId,
    cwd: workspaceDir,
    instructionMode: "append",
    options,
  });
  const start = await waitFor(
    () => output.messages.find((m) => m.id === startId),
    "thread/start response",
  );
  const providerThreadId = (start.result as { providerThreadId: string })
    .providerThreadId;
  sendRequest("turn/start", {
    threadId,
    providerThreadId,
    clientRequestId: "creq_abcdefghjk",
    options,
    input: [{ type: "text", text: "start job", mentions: [] }],
  });
  await waitFor(
    () => events().find((e) => e.type === "turn/completed"),
    "first turn/completed",
  );
  return providerThreadId;
}

beforeEach(() => {
  workspaceDir = mkdtempSync(join(tmpdir(), "bb-2122-edges-"));
  output = captureBridgeJsonRpcOutput();
});

afterEach(() => {
  output.restore();
  rmSync(workspaceDir, { recursive: true, force: true });
});

describe("PR #2123 edge cases", () => {
  it("settles a vouched turn when the agent process exits mid-turn", async () => {
    const doneFile = join(workspaceDir, "done");
    await startAndPrompt(
      "thread-2122-exit",
      { UNPROMPTED_DONE_FILE: doneFile, UNPROMPTED_EXIT_AFTER: "1" },
      "full",
    );
    await waitFor(() => (existsSync(doneFile) ? true : undefined), "agent done");
    // Agent exits ~100ms after its last chunk; wait for the bridge's exit
    // handling (error notification) to land.
    await waitFor(
      () => output.messages.find((m) => m.method === "error"),
      "bridge error notification after agent exit",
    );
    await new Promise((r) => setTimeout(r, 300));

    const all = events();
    const started = all.filter((e) => e.type === "turn/started");
    const completed = all.filter((e) => e.type === "turn/completed");
    // eslint-disable-next-line no-console
    console.log(
      "after agent exit:",
      all.map((e) => String(e.type)).join(" "),
    );
    expect(started).toHaveLength(2);
    // The vouched turn must reach a terminal state when its agent dies.
    expect(completed).toHaveLength(2);
  }, 30_000);

  it("does not auto-cancel a permission request raised during a vouched turn (full mode)", async () => {
    const doneFile = join(workspaceDir, "done");
    await startAndPrompt(
      "thread-2122-perm",
      { UNPROMPTED_DONE_FILE: doneFile, UNPROMPTED_ASK_PERMISSION: "1" },
      "full",
    );
    await waitFor(
      () => (existsSync(doneFile + ".perm") ? true : undefined),
      "permission answered",
    );
    await new Promise((r) => setTimeout(r, 300));
    const text = agentText();
    // eslint-disable-next-line no-console
    console.log("agent text:", text);
    // In full mode the bridge auto-allows; a vouched turn must get the same.
    expect(text).toContain('"optionId":"yes"');
    expect(text).not.toContain('"outcome":"cancelled"');
  }, 30_000);
});
