import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const { createAgentRuntime } = await import(pathToFileURL(resolve(repoRoot, "packages/agent-runtime/src/runtime.ts")));
const { createScriptedEchoLaunch, fullRuntimeOptions, withBridgeLaunch, waitForRuntimeState } = await import(pathToFileURL(resolve(repoRoot, "packages/agent-runtime/src/test/runtime-test-harness.ts")));
const activeTurn = process.argv[2] === "active";
const workspaceDir = mkdtempSync(join(tmpdir(), "bb-acp-4939-runtime-"));
const readyFile = join(workspaceDir, "agent-ready");
const events = [];
const launch = createScriptedEchoLaunch({
  pluginId: "provider-acp",
  modulePath: resolve(repoRoot, "packages/provider-bridge-acp/src/bridge/bridge.ts"),
  capabilities: { fork: "tip" },
  providerOptions: {
    acpLaunchSpec: {
      displayName: "Local ACP fixture",
      command: process.execPath,
      args: [resolve(repoRoot, "packages/provider-bridge-acp/src/bridge/fake-acp-agent.mjs")],
      env: { FAKE_ACP_READY_FILE: readyFile, FAKE_ACP_LOAD_SESSION: "1" },
    },
  },
});
const runtime = withBridgeLaunch(createAgentRuntime({
  workspacePath: workspaceDir,
  env: {},
  onEvent: (event) => events.push(event),
  onToolCall: async () => ({ contentItems: [], success: true }),
}), launch);
const turnArgs = (text) => ({
  threadId: "repro-4939",
  input: [{ type: "text", text, mentions: [] }],
  clientRequestId: "creq_abcdefghjk",
  options: fullRuntimeOptions,
});
try {
  const started = await runtime.startThread({
    environmentId: "repro-environment",
    projectId: "repro-project",
    providerId: "acp",
    threadId: "repro-4939",
    options: fullRuntimeOptions,
  });
  await runtime.runTurn(turnArgs(activeTurn ? "hang" : "before"));
  await waitForRuntimeState({
    label: "initial turn state",
    predicate: () => activeTurn ? runtime.getActiveTurnId("repro-4939") !== null : events.some((event) => event.type === "turn/completed"),
  });
  process.kill(Number(readFileSync(readyFile, "utf8")), "SIGTERM");
  await waitForRuntimeState({
    label: "agent exit warning",
    predicate: () => events.some((event) => event.type === "provider/warning" && event.summary.includes("exited unexpectedly")),
  });
  console.log(JSON.stringify({ activeTurn, activeAfterExit: runtime.getActiveTurnId("repro-4939"), runningProviders: runtime.listRunningProviders() }));
  const completionCount = events.filter((event) => event.type === "turn/completed").length;
  await runtime.runTurn(turnArgs("after"));
  await waitForRuntimeState({
    label: "recovered turn completion",
    predicate: () => events.filter((event) => event.type === "turn/completed").length > completionCount,
  });
  assert.equal(runtime.getProviderSession("repro-4939")?.providerThreadId, started.providerThreadId);
  console.log("PASS: follow-up turn completes on the restored provider session");
} catch (error) {
  console.log("FAIL: " + error.message);
  process.exitCode = 1;
} finally {
  await runtime.shutdown();
  rmSync(workspaceDir, { recursive: true, force: true });
  rmSync(launch.dataDir, { recursive: true, force: true });
}
