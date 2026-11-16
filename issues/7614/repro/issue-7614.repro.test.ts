import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { experimental_captureBridgeJsonRpcOutput as captureBridgeJsonRpcOutput } from "@get-bb/plugin-sdk/provider-bridge/testing";
import { hostDaemonOnlineRpcCommandSchema } from "../../../../packages/host-daemon-contract/src/commands.js";
import { handleLine } from "./bridge.js";
import { getClaudeProviderInstallationStatus } from "./provider-maintenance.js";

let homeDir: string;
let executablePath: string;

beforeEach(async () => {
  homeDir = await mkdtemp(path.join(os.tmpdir(), "bb-7614-"));
  const emptyPath = path.join(homeDir, "path");
  executablePath = path.join(homeDir, "plugin", "claude");
  await mkdir(emptyPath);
  await mkdir(path.dirname(executablePath));
  await writeFile(
    executablePath,
    `#!${process.execPath}\nprocess.stdout.write("2.1.310 (Claude Code)\\n");\n`,
    { mode: 0o755 },
  );
  vi.stubEnv("HOME", homeDir);
  vi.stubEnv("PATH", emptyPath);
  vi.stubEnv(
    "BB_CLAUDE_CODE_EXECUTABLE",
    path.join(homeDir, "absent", "claude"),
  );
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(homeDir, { recursive: true, force: true });
});

it("control: the same executable is installed when present in process environment", async () => {
  vi.stubEnv("BB_CLAUDE_CODE_EXECUTABLE", executablePath);
  const status = await getClaudeProviderInstallationStatus(false);
  expect(status).toMatchObject({
    installed: true,
    executablePath,
    currentVersion: "2.1.310",
  });
});

it("installation status recognizes a request-scoped executable", async () => {
  const output = captureBridgeJsonRpcOutput();
  try {
    await handleLine(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 7614,
        method: "provider/installation/status",
        params: {
          providerId: "claude-code",
          checkUpdates: false,
          envVars: { BB_CLAUDE_CODE_EXECUTABLE: executablePath },
        },
      }),
    );
    const messages = output.takeMessages();
    await vi.waitFor(() => {
      messages.push(...output.takeMessages());
      expect(messages).toHaveLength(1);
    });
    console.info("installation response:", JSON.stringify(messages));
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 7614,
          result: expect.objectContaining({ installed: true, executablePath }),
        }),
      ]),
    );
  } finally {
    output.restore();
  }
});

it("health does not report a request-scoped executable as absent", async () => {
  const output = captureBridgeJsonRpcOutput();
  try {
    await handleLine(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 7615,
        method: "provider/health",
        params: {
          providerId: "claude-code",
          envVars: { BB_CLAUDE_CODE_EXECUTABLE: executablePath },
        },
      }),
    );
    const messages = output.takeMessages();
    await vi.waitFor(() => {
      messages.push(...output.takeMessages());
      expect(messages).toHaveLength(1);
    });
    console.info("health response:", JSON.stringify(messages));
    expect(messages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 7615,
          result: expect.objectContaining({
            health: expect.objectContaining({ status: "not_installed" }),
          }),
        }),
      ]),
    );
  } finally {
    output.restore();
  }
});

it("diagnostic: only the model command accepts contributed environment", () => {
  const bridgeLaunch = {
    pluginId: "provider-claude-code",
    source: { kind: "artifact", digest: "a".repeat(64), byteLength: 1 },
    capabilities: {
      providerInstallation: true,
      supportsServiceTier: false,
      permissionModes: ["accept-edits"],
      supportsThreadArchive: false,
      supportsThreadRename: false,
      fork: "none",
    },
    providerOptions: {},
    envPassthrough: [],
  };
  const contributedEnv = [
    {
      name: "BB_CLAUDE_CODE_EXECUTABLE",
      value: executablePath,
      source: { plugin: "repro-fixture" },
      reason: "isolated executable fixture",
    },
  ];
  for (const type of [
    "provider.list_models",
    "provider.installation.status",
    "provider.health",
  ]) {
    const baseCommand = { type, providerId: "claude-code", bridgeLaunch };
    if (type !== "provider.list_models") {
      expect(
        hostDaemonOnlineRpcCommandSchema.safeParse(baseCommand).success,
      ).toBe(true);
    }
    const parsed = hostDaemonOnlineRpcCommandSchema.safeParse({
      ...baseCommand,
      contributedEnv,
    });
    console.info(`${type} accepts contributedEnv: ${parsed.success}`);
    expect(parsed.success).toBe(type === "provider.list_models");
  }
});
