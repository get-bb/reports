import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { PluginFileOpenerSlot } from "@/lib/plugin-slots";
import {
  createFileOpenerTabForRequest,
  parseFileOpenerParams,
} from "./file-opener-tabs";

const LEGACY_SOURCE_SCHEMA = z
  .object({
    kind: z.enum(["workspace", "host", "thread-storage"]),
    threadId: z.string().nullable(),
    environmentId: z.string().nullable(),
    projectId: z.string().nullable(),
  })
  .strict();

const LEGACY_OPENER = {
  component: () => null,
  extensions: ["json"],
  generation: 1,
  id: "legacy-json",
  pluginId: "legacy-opener",
  title: "Legacy opener",
} satisfies PluginFileOpenerSlot;

describe("issue #2519", () => {
  it("keeps a project-routed draft source compatible with a legacy opener", () => {
    const tab = createFileOpenerTabForRequest({
      fileOpeners: [LEGACY_OPENER],
      preference: {},
      projectHostId: "host_local",
      projectId: "proj_draft",
      request: {
        kind: "workspace-file-preview",
        tab: {
          lineRange: null,
          path: "package.json",
          source: { kind: "working-tree" },
          statusLabel: null,
        },
      },
      resolvedEnvironmentId: null,
      threadId: null,
    });

    const source = parseFileOpenerParams(tab?.paramsJson ?? null)?.source;
    const result = LEGACY_SOURCE_SCHEMA.safeParse(source);

    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(
      true,
    );
  });
});
