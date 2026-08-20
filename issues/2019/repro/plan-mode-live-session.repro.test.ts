/**
 * Repro for get-bb/bb#2019 (part 1): `/plan` sent to an already-loaded
 * claude-code session does not switch the session into plan mode.
 *
 * The runtime's bridge-protocol adapter classifies every execution-option
 * change as "live" (no thread/resume), so the only thing the bridge sees is a
 * `turn/start` whose providerOptions carry `claudeCodePermissionMode: "plan"`.
 * `runTurnStart` strips the `/plan` mention from the prompt but never calls
 * `session.setPermissionMode("plan")` nor updates `threadSession.permissionMode`,
 * so the turn runs under the session's original mode (acceptEdits here).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

const { forkSessionMock, queryMock } = vi.hoisted(() => ({
  forkSessionMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: queryMock,
  forkSession: forkSessionMock,
  createSdkMcpServer: vi.fn(() => ({})),
  tool: vi.fn((_name, _desc, _schema, handler) => handler),
}));

import { handleLine } from "../bridge.js";
import { createBridgeJsonRpcTestHarness } from "@bb/provider-bridge-protocol/testing";

interface ControlledQuery {
  applyFlagSettings: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  finish(): void;
  initializationResult: ReturnType<typeof vi.fn>;
  setModel: ReturnType<typeof vi.fn>;
  setPermissionMode: ReturnType<typeof vi.fn>;
  [Symbol.asyncIterator](): AsyncIterator<SDKMessage>;
}

function createControlledQuery(): ControlledQuery {
  let finishNext: ((r: IteratorResult<SDKMessage>) => void) | undefined;
  const iterator: AsyncIterator<SDKMessage> = {
    next: () =>
      new Promise<IteratorResult<SDKMessage>>((resolve) => {
        finishNext = resolve;
      }),
    return: async () => ({ value: undefined, done: true }),
  };
  return {
    applyFlagSettings: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(() => {
      finishNext?.({ value: undefined, done: true });
    }),
    finish() {
      finishNext?.({ value: undefined, done: true });
    },
    initializationResult: vi.fn().mockResolvedValue({ account: {}, models: [] }),
    setModel: vi.fn().mockResolvedValue(undefined),
    setPermissionMode: vi.fn().mockResolvedValue(undefined),
    [Symbol.asyncIterator]() {
      return iterator;
    },
  };
}

const acceptEditsOptions = {
  permissionMode: "accept-edits",
  permissionScope: "workspace",
  approvalReviewer: "user",
  permissionEscalation: "ask",
  instructions: "test",
} as const;

describe("#2019 repro: /plan on an already-loaded claude session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("switches the live session into plan mode when turn/start carries claudeCodePermissionMode=plan", async () => {
    const bridge = createBridgeJsonRpcTestHarness(handleLine);
    const queries: ControlledQuery[] = [];
    queryMock.mockImplementation(() => {
      const q = createControlledQuery();
      queries.push(q);
      return q;
    });
    const threadId = "thread-2019-plan-live";
    try {
      // 1. Session is loaded in accept-edits mode (what the issue calls
      //    "already-loaded claude-code session (acceptEdits mode)").
      bridge.sendRequest(1, "thread/start", {
        threadId,
        cwd: "/tmp/worktree",
        instructionMode: "append",
        options: {
          ...acceptEditsOptions,
          providerOptions: { workflowsEnabled: false },
        },
      });
      await bridge.waitForResponse(1);
      const query = queries[0];
      const call = queryMock.mock.calls.at(-1)?.[0] as {
        prompt: AsyncIterable<SDKUserMessage>;
        options: { permissionMode?: string };
      };
      expect(call.options.permissionMode).toBe("acceptEdits");

      // 2. User sends the structured `/plan` composer action. The server puts
      //    claudeCodePermissionMode: "plan" on the execution options; the
      //    runtime forwards it on turn/start (no thread/resume: the bridge
      //    adapter classifies every option change as "live").
      bridge.sendRequest(2, "turn/start", {
        threadId,
        providerThreadId: threadId,
        clientRequestId: "creq_abcdefghjk",
        input: [
          {
            type: "text",
            text: "/plan add a README",
            mentions: [
              {
                start: 0,
                end: 5,
                resource: {
                  kind: "command",
                  trigger: "/",
                  name: "plan",
                  source: "command",
                  origin: "builtin",
                  label: "plan",
                  argumentHint: null,
                },
              },
            ],
          },
        ],
        options: {
          ...acceptEditsOptions,
          providerOptions: {
            workflowsEnabled: false,
            claudeCodePermissionMode: "plan",
          },
        },
      });
      const prompt = await call.prompt[Symbol.asyncIterator]().next();
      await bridge.waitForResponse(2);

      // The `/plan` mention IS stripped from the prompt (plan mode is supposed
      // to be a session option) ...
      expect(prompt.done).toBe(false);
      if (prompt.done) throw new Error("unreachable");
      expect(prompt.value.message.content).toBe("add a README");

      // ... but the live session is never switched into plan mode: no
      // session rebuild happened and setPermissionMode("plan") was never sent.
      expect(queries).toHaveLength(1);
      expect(query?.setPermissionMode).toHaveBeenCalledWith("plan"); // <-- FAILS on c7c66423d
    } finally {
      bridge.sendRequest(3, "thread/stop", {
        threadId,
        providerThreadId: threadId,
        intent: "interrupt",
        activeTurnId: null,
      });
      await bridge.flushWork();
      queries[0]?.finish();
      await bridge.waitForResponse(3).catch(() => undefined);
      bridge.restore();
    }
  });
});
