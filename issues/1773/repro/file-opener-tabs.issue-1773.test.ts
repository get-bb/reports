// Repro for get-bb/bb#1773: plugin file-opener tabs carry `fileOpenerOwner`,
// but the strict server-contract `threadTabsSchema` (used by
// persistThreadTabs before every PUT /api/v1/threads/:id/tabs) rejects it.
import { threadTabsSchema } from "@bb/server-contract";
import { describe, expect, it } from "vitest";
import { buildFileOpenerPanelTab } from "./file-opener-tabs";

describe("issue #1773: docs file-opener tab vs thread-tabs contract", () => {
  const openerTab = buildFileOpenerPanelTab(
    { id: "docs-editor", pluginId: "docs" },
    {
      path: "README.md",
      source: {
        kind: "workspace",
        environmentId: "env-1",
        projectId: null,
        threadId: "thr-1",
      },
    },
    {
      kind: "workspace-file-preview",
      environmentId: "env-1",
      projectId: null,
      tab: {
        lineRange: null,
        path: "README.md",
        source: { kind: "working-tree" },
        statusLabel: null,
      },
      threadId: "thr-1",
    },
  );

  it("the opener tab carries fileOpenerOwner (this is what the app persists)", () => {
    expect(openerTab.kind).toBe("plugin-panel");
    expect(openerTab.fileOpenerOwner).toBeDefined();
  });

  it("threadTabsSchema accepts the opener tab (FAILS on main: unrecognized key)", () => {
    const result = threadTabsSchema.safeParse([openerTab]);
    if (!result.success) {
      // This is exactly what the "Couldn't sync tabs" toast shows as description.
      console.log("ZodError.message:\n" + result.error.message);
    }
    expect(result.success).toBe(true);
  });
});
