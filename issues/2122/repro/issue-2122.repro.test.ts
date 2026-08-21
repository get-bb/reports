/**
 * Repro for get-bb/bb#2122: provider-acp drops agent-initiated turns.
 *
 * Drives the real bridge (`handleLine`) with a fake ACP agent that, after a
 * normal prompt completes, emits unsolicited session/update notifications
 * (user_message_chunk + agent_message_chunks + tool_call/update) with no
 * prompt in flight. The bridge output is run through the real runtime delta
 * assembler, exactly as the bridge-protocol adapter does.
 *
 * On main (fcada5a3b) the "agent-initiated" assertions FAIL: the unprompted
 * text never becomes an agentMessage item and no second turn is opened.
 * Instead each chunk surfaces as a thread-scoped `provider/unhandled` row.
 */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { THREAD_DELTA_NOTIFICATION_METHOD } from "@bb/provider-bridge-protocol";
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
let nextRequestId = 100;

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
    if (Date.now() > deadline) {
      // eslint-disable-next-line no-console
      console.log("bridge output so far:", JSON.stringify(output.messages, null, 1));
      throw new Error(`Timed out: ${description}`);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}

function events(): Record<string, unknown>[] {
  return assembleCapturedThreadEvents(
    output.messages,
    "acp",
  ) as unknown as Record<string, unknown>[];
}

function agentMessageTexts(): string[] {
  const texts = new Map<string, string>();
  for (const event of events()) {
    if (event.type === "item/agentMessage/delta") {
      const id = String(event.itemId);
      texts.set(id, (texts.get(id) ?? "") + String(event.delta ?? ""));
    } else if (event.type === "item/completed") {
      const item = event.item as { id: string; type: string; text?: string };
      if (item.type === "agentMessage") texts.set(item.id, item.text ?? "");
    }
  }
  return [...texts.values()];
}

const fullOptions = {
  permissionMode: "full",
  permissionScope: "full",
  approvalReviewer: null,
  permissionEscalation: null,
  providerOptions: {
    acpLaunchSpec: {
      displayName: "Unprompted ACP",
      command: process.execPath,
      args: [AGENT_PATH],
      env: {},
    },
  },
};

beforeEach(() => {
  workspaceDir = mkdtempSync(join(tmpdir(), "bb-2122-"));
  output = captureBridgeJsonRpcOutput();
});

afterEach(() => {
  output.restore();
  rmSync(workspaceDir, { recursive: true, force: true });
});

describe("issue #2122: agent-initiated ACP turns", () => {
  it("renders unprompted agent output as a turn with agent messages", async () => {
    const doneFile = join(workspaceDir, "unprompted.done");
    const startId = sendRequest("thread/start", {
      threadId: "thread-2122",
      cwd: workspaceDir,
      instructionMode: "append",
      options: {
        ...fullOptions,
        envVars: { UNPROMPTED_DONE_FILE: doneFile },
      },
    });
    const start = await waitFor(
      () => output.messages.find((m) => m.id === startId),
      "thread/start response",
    );
    const providerThreadId = (start.result as { providerThreadId: string })
      .providerThreadId;

    sendRequest("turn/start", {
      threadId: "thread-2122",
      providerThreadId,
      clientRequestId: "creq_abcdefghjk",
      options: fullOptions,
      input: [{ type: "text", text: "start job", mentions: [] }],
    });
    await waitFor(
      () => events().find((e) => e.type === "turn/completed"),
      "first turn/completed",
    );
    // Let the agent finish its unprompted follow-up, then give the bridge a
    // moment to forward everything.
    await waitFor(
      () => (existsSync(doneFile) ? true : undefined),
      "agent done",
    );
    await new Promise((r) => setTimeout(r, 300));

    const all = events();
    const kinds = output.messages
      .filter((m) => m.method === THREAD_DELTA_NOTIFICATION_METHOD)
      .flatMap((m) =>
        ((m.params as { deltas: { kind: string }[] }).deltas ?? []).map(
          (d) => d.kind,
        ),
      );
    const dump = process.env.ISSUE_2122_DUMP;
    if (dump) {
      writeFileSync(
        dump,
        JSON.stringify(
          { deltaKinds: kinds, events: all, bridgeOutput: output.messages },
          null,
          2,
        ),
      );
    }
    // eslint-disable-next-line no-console
    console.log("delta kinds on the wire:", kinds.join(" "));
    // eslint-disable-next-line no-console
    console.log(
      "assembled event types:",
      all
        .map(
          (e) =>
            `${String(e.type)}${
              e.type === "provider/unhandled"
                ? `(${String(e.rawType)}, ${JSON.stringify(e.scope)})`
                : ""
            }`,
        )
        .join(" "),
    );
    // eslint-disable-next-line no-console
    console.log("agent message texts:", JSON.stringify(agentMessageTexts()));

    // The prompted turn works.
    expect(agentMessageTexts()).toContain("PROMPTED: started bg_4");

    // --- Agent-initiated turn (the bug) ---
    // A second turn should have been opened for the unprompted work.
    expect(all.filter((e) => e.type === "turn/started")).toHaveLength(2);
    // The unprompted text must reach the thread as an agent message.
    expect(agentMessageTexts().join("")).toContain(
      "UNPROMPTED: job bg_4 finished, the answer is 42.",
    );
    // No chunk may fall through to the thread-scoped raw-event bin.
    expect(all.filter((e) => e.type === "provider/unhandled")).toHaveLength(0);

    sendRequest("thread/stop", {
      threadId: "thread-2122",
      providerThreadId,
      intent: "interrupt",
      activeTurnId: null,
    });
  }, 30_000);
});
