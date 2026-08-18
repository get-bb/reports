// @vitest-environment jsdom
// Repro for get-bb/bb#1702: the Tasks List/Board choice is forgotten when a
// project is reopened without a `?view=` marker. FAILS on 16ceb3a54 (base),
// PASSES with PR #1704 applied.
import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

const app = await loadPluginApp(() => import("../app"));

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

const PROJECT_ID = "01HZZZZZZZZZZZZZZZZZZZZZP1";
const project = {
  id: PROJECT_ID,
  name: "Tasks Plugin",
  prefix: "TSK",
  nextTaskNumber: 5,
  color: "blue",
  folderId: null,
  linkedBbProjectId: null,
  createdAt: "2026-07-15T00:00:00.000Z",
};
const rpc = {
  listProjects: () => ({ projects: [project] }),
  listFolders: () => ({ folders: [] }),
  listPresets: () => ({ presets: [] }),
  listLabels: () => ({ labels: [] }),
  sidebarSummary: () => ({
    projects: [{ projectId: PROJECT_ID, taskCount: 3, activeAgentCount: 0 }],
  }),
  listTasks: () => ({ tasks: [] }),
  getTaskByKey: () => ({ task: null }),
};
const openProject = (subPath: string) =>
  renderSlot(app.navPanels[0]!, { subPath }, { rpc });

describe("#1702 project view persistence", () => {
  it("reopening a project without a marker restores the last chosen view", async () => {
    // 1. Pick Board via the topbar toggle (navigates to <id>?view=board).
    const first = openProject(PROJECT_ID);
    fireEvent.click(await first.findByRole("button", { name: "Board" }));
    expect(first.navigateCalls).toContainEqual({
      method: "toPluginPanel",
      path: "tasks",
      options: { subPath: `${PROJECT_ID}?view=board` },
    });
    first.lifecycle.unmount();

    // 2. Reopen the project the way the sidebar / breadcrumb / new-project
    //    dialog / deep link do: with no view marker.
    const reopened = openProject(PROJECT_ID);
    const board = await reopened.findByRole("button", { name: "Board" });
    // On base this is "false": the bare route parses to "list" and nothing
    // remembers the choice.
    expect(board.getAttribute("aria-pressed")).toBe("true");
  });
});
