import { commandListResponseSchema } from "@bb/server-contract";
import { expect, it } from "vitest";
import { resolveThreadRuntimeCommandConfig } from "../../src/services/threads/thread-runtime-config.js";
import { registerHostRpcResponder } from "../helpers/host-rpc.js";
import { readJson } from "../helpers/json.js";
import {
  seedEnvironment,
  seedHostSession,
  seedPrimaryHost,
  seedProjectWithSource,
  seedThread,
} from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";

it.each(["codex", "claude-code"])(
  "omits deselected plugin skills from commands for %s",
  async (providerId) => {
    await withTestHarness(async (harness) => {
      const entry = await harness.pluginService.install("builtin:bb-guide", {
        kind: "root",
      });
      expect(entry.status).toBe("running");
      const { host, session } = seedHostSession(harness.deps);
      seedPrimaryHost(harness.deps, host.id);
      const { project } = seedProjectWithSource(harness.deps, {
        hostId: host.id,
        path: "/tmp/issue-5215-workspace",
      });
      const environment = seedEnvironment(harness.deps, {
        hostId: host.id,
        projectId: project.id,
        path: "/tmp/issue-5215-workspace",
      });
      const thread = seedThread(harness.deps, {
        projectId: project.id,
        environmentId: environment.id,
        providerId,
      });
      registerHostRpcResponder(harness, {
        hostId: host.id,
        sessionId: session.id,
        handle: (request) => {
          switch (request.command.type) {
            case "host.list_files":
              return { ok: true, result: { files: [], truncated: false } };
            case "host.list_commands":
              return { ok: true, result: { commands: [] } };
            case "host.list_skills":
              return { ok: true, result: { skills: [] } };
            case "host.read_file":
              return {
                ok: false,
                errorCode: "ENOENT",
                errorMessage: "No workspace instructions",
              };
            default:
              throw new Error(`Unexpected RPC ${request.command.type}`);
          }
        },
      });
      const runtime = () =>
        resolveThreadRuntimeCommandConfig(harness.deps, {
          environment,
          thread,
          model: "test-model",
        });
      const commands = async () => {
        const response = await harness.app.request(
          `/api/v1/projects/${project.id}/commands?provider=${providerId}&environmentId=${environment.id}`,
        );
        expect(response.status).toBe(200);
        return commandListResponseSchema.parse(await readJson(response))
          .commands;
      };
      const isGuideSkill = (command: {
        name: string;
        pluginId: string | null;
      }) => command.name === "skill-creator" && command.pluginId === "bb-guide";
      expect((await commands()).some(isGuideSkill)).toBe(true);
      expect(
        (await runtime()).injectedSkillSources.map((source) => source.name),
      ).toContain("skill-creator");
      const settings = await harness.pluginService.updateSettings("bb-guide", {
        skillCreator: false,
      });
      expect(settings?.values.skillCreator).toBe(false);
      const injected = (await runtime()).injectedSkillSources.map(
        (source) => source.name,
      );
      expect(injected).not.toContain("skill-creator");
      const remaining = (await commands()).filter(isGuideSkill);
      console.log(
        JSON.stringify({
          providerId,
          skillCreator: settings?.values.skillCreator,
          injectedSkillNames: injected,
          menuEntries: remaining,
        }),
      );
      expect(remaining).toEqual([]);
    });
  },
);
