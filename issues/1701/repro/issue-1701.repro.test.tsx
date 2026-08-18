// @vitest-environment jsdom
// Repro for get-bb/bb#1701: Tasks -> Manage -> Folders has no delete control,
// even though the `deleteFolder` RPC exists. On main this test FAILS at the
// `findByRole("button", { name: /delete folder/i })` assertion.
import { cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
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

const app = await loadPluginApp(() => import("../../app"));
afterEach(cleanup);

const folder = {
  id: "01HZZZZZZZZZZZZZZZZZZZZZF1",
  name: "Old stuff",
  parentFolderId: null,
  createdAt: "2026-07-15T00:00:00.000Z",
};

describe("issue #1701 – folders cannot be deleted from Manage", () => {
  it("offers a delete control on each folder row and calls deleteFolder", async () => {
    const deleteCalls: unknown[] = [];
    const slot = renderSlot(
      app.navPanels[0]!,
      { subPath: "manage" },
      {
        rpc: {
          listProjects: () => ({ projects: [] }),
          listFolders: () => ({ folders: [folder] }),
          listPresets: () => ({ presets: [] }),
          sidebarSummary: () => ({ projects: [] }),
          listTasks: () => ({ tasks: [] }),
          listLabels: () => ({ labels: [] }),
          deleteFolder: (input: unknown) => {
            deleteCalls.push(input);
            return { deleted: true };
          },
        },
      },
    );
    fireEvent.mouseDown(await slot.findByRole("tab", { name: "Folders" }));
    // The row exists (rename control proves the Folders tab rendered) ...
    await slot.findByRole("button", { name: "Rename folder Old stuff" });
    // ... but there is no delete control at all. This is the failing line on main.
    const deleteButton = await slot.findByRole(
      "button",
      { name: /delete folder/i },
      { timeout: 1500 },
    );
    fireEvent.click(deleteButton);
    // Confirm and expect the RPC to be called.
    fireEvent.click(await slot.findByRole("button", { name: "Delete folder" }));
    await slot.findByRole("tab", { name: "Folders" });
    expect(deleteCalls).toEqual([{ folderId: folder.id }]);
  });
});
