import { buildThreadHandoffCreateRequest } from "@bb/client-core";
import { createThread, createThreadSection } from "@bb/db";
import { threadResponseSchema } from "@bb/server-contract";
import { describe, expect, it } from "vitest";
import { readJson } from "../helpers/json.js";
import {
  seedEnvironment,
  seedHostSession,
  seedProjectWithSource,
} from "../helpers/seed.js";
import { withTestHarness } from "../helpers/test-app.js";
import { buildSectionThreadList } from "../../../../plugins/thread-list/app/model/project-thread-groups.js";
import {
  makeSidebarEnvironment,
  makeSidebarThread,
} from "../../../../plugins/thread-list/app/model/fixtures.js";

describe("issue 7984 continuation placement", () => {
  it.each([false, true])(
    "retains the source environment and section (section: %s)",
    async (withSection) => {
      await withTestHarness(async (harness) => {
        const { host } = seedHostSession(harness.deps);
        const { project } = seedProjectWithSource(harness.deps, {
          hostId: host.id,
        });
        const environment = seedEnvironment(harness.deps, {
          hostId: host.id,
          projectId: project.id,
          branchName: "bb/test",
        });
        const sectionId = withSection
          ? createThreadSection(harness.db, harness.deps.hub, {
              name: "Reproduction section",
            }).section.id
          : null;
        const source = createThread(harness.db, harness.deps.hub, {
          projectId: project.id,
          providerId: "codex",
          environmentId: environment.id,
          sectionId,
        });
        const seed = {
          environmentId: source.environmentId,
          projectId: source.projectId,
          sourceThreadId: source.id,
          sourceThreadTitle: "Source thread",
          sectionId: source.sectionId,
        };
        const request = buildThreadHandoffCreateRequest({
          draft: { text: "Keep going", mentions: [], attachments: [] },
          execution: {
            providerId: "codex",
            model: "gpt-5",
            reasoningLevel: "high",
            serviceTier: undefined,
            supportsServiceTier: false,
            permissionMode: "full",
          },
          seed,
          sendAt: Date.now() + 3_600_000,
        });
        const response = await harness.app.request("/api/v1/threads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...request, origin: "app" }),
        });
        expect(response.status).toBe(201);
        const continuation = threadResponseSchema.parse(
          await readJson(response),
        );
        const sidebarEnvironment = makeSidebarEnvironment({
          id: environment.id,
          branchName: environment.branchName,
          isWorktree: true,
        });
        const sidebarItems = buildSectionThreadList(
          [
            makeSidebarThread({
              id: source.id,
              sectionId: source.sectionId,
              environment: sidebarEnvironment,
            }),
            makeSidebarThread({
              id: "thr_peer",
              sectionId: source.sectionId,
              environment: sidebarEnvironment,
            }),
            makeSidebarThread({
              id: continuation.id,
              sectionId: continuation.sectionId,
              environment: sidebarEnvironment,
            }),
          ],
          undefined,
          sectionId === null
            ? []
            : [{ id: sectionId, name: "Reproduction section" }],
          true,
        );
        const sidebarSummary = sidebarItems.map((item) =>
          item.kind === "environment"
            ? { kind: item.kind, threads: item.group.nodes.length }
            : { kind: item.kind },
        );
        console.log(
          JSON.stringify({
            withSection,
            environmentRetained:
              continuation.environmentId === source.environmentId,
            sourceSection: source.sectionId,
            continuationSection: continuation.sectionId,
            sidebarSummary,
          }),
        );
        expect(continuation.environmentId).toBe(source.environmentId);
        expect(continuation.sectionId).toBe(source.sectionId);
        expect(sidebarSummary).toEqual(
          withSection
            ? [{ kind: "section" }]
            : [{ kind: "environment", threads: 3 }],
        );
      });
    },
  );
});
