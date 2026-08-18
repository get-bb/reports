import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { threadEventNotificationSchema } from "@bb/provider-bridge-protocol";
import { createBridgeJsonRpcTestHarness } from "@bb/provider-bridge-protocol/testing";
import { handleLine } from "./bridge.js";

/**
 * Repro for get-bb/bb#1727.
 *
 * `codex app-server` replays the rollout's last-turn token usage on
 * `thread/resume`, scoped to that previous turn's Codex turn id (observed live
 * with codex-cli 0.147.0). The bridge stamps every turn scope with a
 * per-session id prefix (`bt<entropy>-<serial>-`), so the SAME Codex turn is
 * emitted under a different bb turn id in the resumed session than the one
 * its `turn/started` was stored under. The server therefore sees a
 * thread/tokenUsage/updated for a turn with "no stored turn/started" and drops
 * it with a warn log ("Dropped orphan thread-state snapshot ...").
 *
 * This test drives the bridge through two sessions against the fake
 * app-server and shows the id mismatch directly.
 */

const THREAD_ID = "thr_1727_resume_usage";
// The fake app-server replays usage on resume for `usage-replay-*` ids.
const PROVIDER_THREAD_ID = "usage-replay-1727";
const BRIDGE_MINTED_ID_PATTERN = /^bt[0-9a-f]{8}-\d+-/;

const fakeAppServerPath = fileURLToPath(
  new URL("./fake-codex-app-server.mjs", import.meta.url),
);

const sessionOptions = {
  permissionMode: "full",
  permissionScope: "full",
  approvalReviewer: null,
  permissionEscalation: null,
} as const;

let harness: ReturnType<typeof createBridgeJsonRpcTestHarness>;
let workspaceDir: string;

beforeEach(() => {
  workspaceDir = mkdtempSync(join(tmpdir(), "bb-codex-1727-ws-"));
  vi.stubEnv("BB_CODEX_BRIDGE_APP_SERVER_COMMAND", process.execPath);
  vi.stubEnv(
    "BB_CODEX_BRIDGE_APP_SERVER_ARGS",
    JSON.stringify([fakeAppServerPath]),
  );
  harness = createBridgeJsonRpcTestHarness(handleLine);
});

afterEach(async () => {
  const cleanupId = 993_001;
  harness.sendRequest(cleanupId, "thread/stop", {
    threadId: THREAD_ID,
    providerThreadId: PROVIDER_THREAD_ID,
    intent: "release",
    activeTurnId: null,
  });
  await harness.waitForResponse(cleanupId).catch(() => undefined);
  harness.restore();
  vi.unstubAllEnvs();
  rmSync(workspaceDir, { recursive: true, force: true });
});

function threadEventsOfType(type: string) {
  return harness.messages.flatMap((message) => {
    if (message.method !== "thread/event") return [];
    const parsed = threadEventNotificationSchema.safeParse(message.params);
    if (!parsed.success) return [];
    return parsed.data.event.type === type ? [parsed.data.event] : [];
  });
}

function turnIdOf(event: { scope: { kind: string; turnId?: string } }) {
  if (event.scope.kind !== "turn" || event.scope.turnId === undefined) {
    throw new Error(`expected a turn-scoped event, got ${event.scope.kind}`);
  }
  return event.scope.turnId;
}

async function waitFor(predicate: () => boolean, label: string) {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

it("(with prototype fix) drops replayed token usage and thread-scopes replayed context usage on resume", async () => {
  // Session 1: resume + run one turn. The fake's first turn is `turn-fx-1`,
  // the same Codex turn id it replays usage for on the next resume — exactly
  // the live shape (last completed turn == replayed usage turn).
  harness.sendRequest(1, "thread/resume", {
    threadId: THREAD_ID,
    providerThreadId: PROVIDER_THREAD_ID,
    cwd: workspaceDir,
    instructionMode: "append",
    options: { ...sessionOptions },
  });
  const resumed1 = await harness.waitForResponse(1);
  expect(resumed1.error).toBeUndefined();

  harness.sendRequest(2, "turn/start", {
    threadId: THREAD_ID,
    providerThreadId: PROVIDER_THREAD_ID,
    clientRequestId: "creq_a2b3c4d5e6",
    input: [{ type: "text", text: "Reply only with ok.", mentions: [] }],
    options: { ...sessionOptions },
  });
  await harness.waitForResponse(2);
  await waitFor(
    () => threadEventsOfType("turn/completed").length === 1,
    "session 1 turn/completed",
  );

  const [turnStarted1] = threadEventsOfType("turn/started");
  expect(turnStarted1).toBeDefined();
  const storedTurnId = turnIdOf(turnStarted1!); // what the server persisted
  expect(storedTurnId).toMatch(BRIDGE_MINTED_ID_PATTERN);
  expect(storedTurnId.replace(BRIDGE_MINTED_ID_PATTERN, "")).toBe("turn-fx-1");

  // Release the session (idle reap / archive / daemon restart all end here).
  harness.sendRequest(3, "thread/stop", {
    threadId: THREAD_ID,
    providerThreadId: PROVIDER_THREAD_ID,
    intent: "release",
    activeTurnId: null,
  });
  await harness.waitForResponse(3);
  const usageCountBeforeResume = threadEventsOfType(
    "thread/tokenUsage/updated",
  ).length;
  const contextCountBeforeResume = threadEventsOfType(
    "thread/contextWindowUsage/updated",
  ).length;

  // Session 2: resume again. Codex replays the last turn's usage BEFORE any
  // new turn/started exists.
  harness.sendRequest(4, "thread/resume", {
    threadId: THREAD_ID,
    providerThreadId: PROVIDER_THREAD_ID,
    cwd: workspaceDir,
    instructionMode: "append",
    options: { ...sessionOptions },
  });
  const resumed2 = await harness.waitForResponse(4);
  expect(resumed2.error).toBeUndefined();
  // With the fix: no turn-scoped token usage is replayed for a turn this
  // session never started, and the replayed context-window usage arrives
  // thread-scoped (allowed by the scope policy) so the server stores it.
  await waitFor(
    () =>
      threadEventsOfType("thread/contextWindowUsage/updated").length >
      contextCountBeforeResume,
    "replayed context usage after resume",
  );
  expect(threadEventsOfType("thread/tokenUsage/updated").length).toBe(
    usageCountBeforeResume,
  );
  const replayedContext = threadEventsOfType(
    "thread/contextWindowUsage/updated",
  ).at(-1)!;
  expect(replayedContext.scope).toEqual({ kind: "thread" });
}, 30_000);
