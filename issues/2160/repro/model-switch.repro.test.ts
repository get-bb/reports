/**
 * Repro for get-bb/bb#2160: "Pi keeps using previous model after model
 * picker change until /compact".
 *
 * The canonical bridge protocol says execution options ride every command and
 * the bridge reconciles them ("apply live where it can, rebuild its provider
 * session where it must", `bridgeExecutionOptionsSchema` docs). The runtime's
 * generic adapter therefore classifies every option change as "live" and never
 * sends thread/resume for a model change.
 *
 * The pi bridge reads `options.model` only in `buildSessionOptions()` during
 * thread/start|resume|fork. `handleTurnStart` ignores `params.options`, so a
 * turn that arrives with a different model neither calls
 * `AgentSession.setModel` nor rebuilds the session. Pi keeps answering with
 * whatever model the session was constructed with.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent";

const GROK = { provider: "xai", id: "grok-4.6" };
const SOL = { provider: "openai-codex", id: "gpt-5.6-sol" };

const {
  mockCreateAgentSession,
  mockCreateAgentSessionServices,
  mockModelRuntime,
} = vi.hoisted(() => {
  const models = [
    { provider: "xai", id: "grok-4.6" },
    { provider: "openai-codex", id: "gpt-5.6-sol" },
  ];
  const mockModelRuntime = {
    getAvailable: vi.fn(async () => models),
    getModel: vi.fn((provider: string, id: string) =>
      models.find((m) => m.provider === provider && m.id === id),
    ),
    getModels: vi.fn(() => models),
    hasConfiguredAuth: vi.fn(() => true),
    checkAuth: vi.fn(async () => true),
    refresh: vi.fn(async () => ({ aborted: false, errors: new Map() })),
  };
  const mockSettingsManager = {
    getShellCommandPrefix: vi.fn(() => undefined),
    getShellPath: vi.fn(() => undefined),
  };
  const mockCreateAgentSessionServices = vi.fn(
    async (options: { agentDir: string; cwd: string }) => ({
      agentDir: options.agentDir,
      cwd: options.cwd,
      diagnostics: [],
      modelRuntime: mockModelRuntime,
      resourceLoader: { options },
      settingsManager: mockSettingsManager,
    }),
  );
  return {
    mockCreateAgentSession: vi.fn(),
    mockCreateAgentSessionServices,
    mockModelRuntime,
  };
});

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@earendil-works/pi-coding-agent")>();
  return {
    ...actual,
    createAgentSessionFromServices: mockCreateAgentSession,
    createAgentSessionServices: mockCreateAgentSessionServices,
    getAgentDir: vi.fn(() => "/tmp/pi-agent"),
    SessionManager: {
      forkFrom: actual.SessionManager.forkFrom.bind(actual.SessionManager),
      open: vi.fn((path: string, dir?: string, cwd?: string) =>
        actual.SessionManager.open(path, dir, cwd),
      ),
      inMemory: vi.fn((cwd?: string) => ({ kind: "in-memory", cwd })),
    },
  };
});

vi.mock("../configured-services.js", () => ({
  createConfiguredPiServices: mockCreateAgentSessionServices,
}));

vi.mock("../model-runtime.js", () => ({
  getPiModelRuntime: vi.fn(async () => mockModelRuntime),
}));

import { handleLine } from "../bridge.js";
import { PI_BRIDGE_SESSION_DIR_ENV } from "../session-paths.js";
import { createBridgeJsonRpcTestHarness } from "@bb/provider-bridge-protocol/testing";
import { createStandaloneBuiltinCompactCommandInput } from "@bb/domain";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CANONICAL_OPTIONS = {
  approvalReviewer: null,
  permissionEscalation: null,
  permissionMode: "full",
  permissionScope: "full",
} as const;

/**
 * A controllable stand-in for pi's AgentSession that tracks the model the
 * way the real one does: `model` is what the session was constructed with and
 * `setModel` swaps it. `prompt` records the model that each run would use.
 */
function createModelTrackingPiSession(constructedModel: {
  provider: string;
  id: string;
}) {
  const listeners: Array<(event: AgentSessionEvent) => void> = [];
  const session = {
    model: constructedModel,
    modelRuntime: mockModelRuntime,
    promptModels: [] as string[],
    compactModels: [] as string[],
    setModel: vi.fn(async (model: { provider: string; id: string }) => {
      session.model = model;
    }),
    setThinkingLevel: vi.fn(),
    thinkingLevel: "medium",
    abort: vi.fn(async () => undefined),
    bindExtensions: vi.fn(async () => undefined),
    compact: vi.fn(async () => {
      session.compactModels.push(`${session.model.provider}/${session.model.id}`);
      emit({ type: "compaction_start", reason: "manual" });
      emit({
        type: "compaction_end",
        reason: "manual",
        result: undefined,
        aborted: false,
        willRetry: false,
      } as AgentSessionEvent);
    }),
    dispose: vi.fn(),
    extensionRunner: { emit: vi.fn(async () => undefined) },
    getActiveToolNames: vi.fn(() => []),
    getContextUsage: vi.fn(() => undefined),
    hasExtensionHandlers: vi.fn(() => false),
    isStreaming: false,
    prompt: vi.fn(
      async (
        _text: string,
        options?: { preflightResult?: (accepted: boolean) => void },
      ) => {
        options?.preflightResult?.(true);
        session.promptModels.push(
          `${session.model.provider}/${session.model.id}`,
        );
        emit({ type: "agent_start" } as AgentSessionEvent);
        emit({
          type: "agent_end",
          messages: [],
          willRetry: false,
        } as AgentSessionEvent);
      },
    ),
    sessionManager: { getLeafId: vi.fn(() => "pi-entry-checkpoint") },
    setActiveToolsByName: vi.fn(),
    subscribe: vi.fn((listener: (event: AgentSessionEvent) => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index !== -1) listeners.splice(index, 1);
      };
    }),
  };
  function emit(event: AgentSessionEvent): void {
    for (const listener of [...listeners]) listener(event);
  }
  return session;
}

function turnStart(threadId: string, model: string, text: string) {
  return {
    clientRequestId: "creq_abcdefghjk",
    input: [{ type: "text", text }],
    options: { ...CANONICAL_OPTIONS, model },
    providerThreadId: threadId,
    threadId,
  };
}

describe("pi bridge model switch (#2160)", () => {
  const sessions: ReturnType<typeof createModelTrackingPiSession>[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    sessions.length = 0;
    process.env[PI_BRIDGE_SESSION_DIR_ENV] = mkdtempSync(
      join(tmpdir(), "bb-2160-pi-sessions-"),
    );
    // Construct a session with whatever model the bridge resolved, like the
    // real createAgentSessionFromServices does.
    mockCreateAgentSession.mockImplementation(
      async (options: { model?: { provider: string; id: string } }) => {
        const session = createModelTrackingPiSession(options.model ?? GROK);
        sessions.push(session);
        return { session };
      },
    );
  });

  it("applies a model that changed between turns before prompting pi", async () => {
    const bridge = createBridgeJsonRpcTestHarness(handleLine);
    const threadId = "thread-2160";
    try {
      // 1. Start the thread on Grok.
      bridge.sendRequest(1, "thread/start", {
        cwd: "/tmp/worktree",
        instructionMode: "append",
        options: { ...CANONICAL_OPTIONS, model: `${GROK.provider}/${GROK.id}` },
        threadId,
      });
      const started = await bridge.waitForResponse(1);
      expect(started.error).toBeUndefined();
      expect(mockCreateAgentSession).toHaveBeenCalledWith(
        expect.objectContaining({ model: GROK }),
      );

      // 2. First turn on Grok.
      bridge.sendRequest(
        2,
        "turn/start",
        turnStart(threadId, `${GROK.provider}/${GROK.id}`, "Reply only with ok."),
      );
      await bridge.waitForResponse(2);
      await bridge.flushWork();

      // 3. The user picks an OpenAI model in bb. The runtime classifies the
      //    change as "live" and sends it on the next turn/start.
      bridge.sendRequest(
        3,
        "turn/start",
        turnStart(threadId, `${SOL.provider}/${SOL.id}`, "Reply only with ok."),
      );
      const response = await bridge.waitForResponse(3);
      expect(response.error).toBeUndefined();
      await bridge.flushWork();

      // The bridge must have reconciled the model somehow: either by calling
      // setModel on the live session, or by rebuilding the session with the
      // new model (reported via session/replaced). On main it does neither.
      const live = sessions.at(-1);
      expect(live).toBeDefined();
      const setModelCalls = sessions.flatMap((s) => s.setModel.mock.calls);
      const rebuilt = mockCreateAgentSession.mock.calls.length > 1;
      expect({
        setModelCalls,
        rebuilt,
        promptModelsPerSession: sessions.map((s) => s.promptModels),
      }).toEqual({
        setModelCalls: rebuilt ? [] : [[SOL]],
        rebuilt,
        promptModelsPerSession: rebuilt
          ? [["xai/grok-4.6"], ["openai-codex/gpt-5.6-sol"]]
          : [["xai/grok-4.6", "openai-codex/gpt-5.6-sol"]],
      });
    } finally {
      bridge.restore();
    }
  });

  it("does not resynchronize the model on /compact either", async () => {
    const bridge = createBridgeJsonRpcTestHarness(handleLine);
    const threadId = "thread-2160-compact";
    try {
      bridge.sendRequest(1, "thread/start", {
        cwd: "/tmp/worktree",
        instructionMode: "append",
        options: { ...CANONICAL_OPTIONS, model: `${GROK.provider}/${GROK.id}` },
        threadId,
      });
      await bridge.waitForResponse(1);

      bridge.sendRequest(
        2,
        "turn/start",
        turnStart(threadId, `${SOL.provider}/${SOL.id}`, "Reply only with ok."),
      );
      await bridge.waitForResponse(2);
      await bridge.flushWork();

      // bb's manual compaction is a turn/start carrying the builtin /compact
      // mention, and it carries the selected model like every turn.
      bridge.sendRequest(3, "turn/start", {
        ...turnStart(threadId, `${SOL.provider}/${SOL.id}`, ""),
        input: JSON.parse(
          JSON.stringify(createStandaloneBuiltinCompactCommandInput()),
        ),
      });
      await bridge.waitForResponse(3);
      await bridge.flushWork();

      bridge.sendRequest(
        4,
        "turn/start",
        turnStart(threadId, `${SOL.provider}/${SOL.id}`, "Reply only with ok."),
      );
      await bridge.waitForResponse(4);
      await bridge.flushWork();

      const allPromptModels = sessions.flatMap((s) => s.promptModels);
      const allCompactModels = sessions.flatMap((s) => s.compactModels);
      // Expected: the compaction and every turn after the picker change run
      // on the selected model.
      expect({ allPromptModels, allCompactModels }).toEqual({
        allPromptModels: ["openai-codex/gpt-5.6-sol", "openai-codex/gpt-5.6-sol"],
        allCompactModels: ["openai-codex/gpt-5.6-sol"],
      });
    } finally {
      bridge.restore();
    }
  });
});
