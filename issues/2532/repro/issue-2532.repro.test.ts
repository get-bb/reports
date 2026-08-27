import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { createThreadFromRequest } from "../../../src/services/threads/thread-create.js";
import { waitForQueuedCommand } from "../../helpers/commands.js";
import { textInput } from "../../helpers/prompt-input.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
} from "../../helpers/seed.js";
import { createTestAppHarness } from "../../helpers/test-app.js";

it("mounts a plugin closure tool before a new owned lane starts", async () => {
  const harness = await createTestAppHarness();
  const workDir = await mkdtemp(join(tmpdir(), "bb-2532-repro-"));
  const ownedThreadIds = new Set<string>();
  (globalThis as Record<string, unknown>).__issue2532OwnedThreadIds =
    ownedThreadIds;

  try {
    const rootDir = join(workDir, "bb-plugin-lane-owner");
    await mkdir(rootDir, { recursive: true });
    await writeFile(
      join(rootDir, "package.json"),
      JSON.stringify({
        name: "bb-plugin-lane-owner",
        version: "0.1.0",
        bb: {
          name: "Lane owner",
          description: "Issue 2532 reproduction fixture.",
          branding: { icon: "Zap" },
          server: "./server.ts",
        },
      }),
    );
    await writeFile(
      join(rootDir, "server.ts"),
      `export default function plugin(bb: any) {
        bb.agents.registerTool({
          name: "required_closure",
          description: "Close the durable lane attempt",
          parameters: { type: "object" },
          execute: () => "closed",
        });
        bb.events.on("thread.created", async ({ thread }: any) => {
          if (thread.originPluginId !== bb.pluginId) return;
          await new Promise((resolve) => setTimeout(resolve, 250));
          (globalThis as any).__issue2532OwnedThreadIds.add(thread.id);
        });
        bb.agents.configure((context: any) => ({
          tools: (globalThis as any).__issue2532OwnedThreadIds.has(context.thread.id)
            ? ["required_closure"]
            : [],
          skills: [],
        }));
      }`,
    );
    const entry = await harness.pluginService.installPath(rootDir);
    expect(entry.status).toBe("running");

    const { host } = seedHostSession(harness.deps, {
      id: "host-issue-2532",
    });
    const workspacePath = join(harness.config.dataDir, "issue-2532-workspace");
    const { project } = seedProjectWithSource(harness.deps, {
      hostId: host.id,
      path: workspacePath,
    });
    const environment = seedEnvironment(harness.deps, {
      hostId: host.id,
      projectId: project.id,
      path: workspacePath,
    });

    const thread = await createThreadFromRequest(harness.deps, {
      environment: { type: "reuse", environmentId: environment.id },
      input: textInput("Start the managed lane"),
      origin: "plugin",
      originPluginId: "lane-owner",
      projectId: project.id,
      providerId: "codex",
      startedOnBehalfOf: null,
      visibility: "hidden",
    });
    const queuedStart = await waitForQueuedCommand(
      harness,
      ({ command }) =>
        command.type === "thread.start" && command.threadId === thread.id,
    );
    if (queuedStart.command.type !== "thread.start") {
      throw new Error("Expected a thread.start command");
    }
    const startDynamicToolNames = queuedStart.command.dynamicTools.map(
      (tool) => tool.name,
    );
    await vi.waitFor(() => expect(ownedThreadIds.has(thread.id)).toBe(true));
    console.log(
      JSON.stringify({
        startDynamicToolNames,
        ownershipObservedAfterDispatch: ownedThreadIds.has(thread.id),
      }),
    );

    expect(startDynamicToolNames).toContain("required_closure");
  } finally {
    delete (globalThis as Record<string, unknown>).__issue2532OwnedThreadIds;
    await harness.pluginService.stop();
    await harness.cleanup();
    await rm(workDir, { recursive: true, force: true });
  }
});
