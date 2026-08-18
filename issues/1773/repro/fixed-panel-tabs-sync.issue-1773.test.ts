// @vitest-environment jsdom
// Repro for get-bb/bb#1773 at the hook level: opening a plugin file-opener
// tab (what the Docs plugin's `.md` opener produces) in a thread never
// reaches PUT /threads/:id/tabs — `threadTabsSchema.parse` throws
// client-side because the contract's `plugin-panel` branch is strict and
// has no `fileOpenerOwner` — and the local strip is then reconciled back
// to the server list, dropping the tab.
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFileOpenerPanelTab } from "@/components/plugin/file-opener-tabs";
import { createThreadInfoFixedPanelTab } from "./fixed-panel-tabs-state";
import {
  useFixedPanelTabsState,
  useUpdateFixedPanelTabsState,
} from "./fixed-panel-tabs";

const apiMocks = vi.hoisted(() => ({
  getThreadTabs: vi.fn(),
  updateThreadTabs: vi.fn(),
}));
const toastMocks = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("./sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./sdk")>();
  return {
    ...actual,
    sdk: {
      threads: {
        tabs: {
          get: apiMocks.getThreadTabs,
          update: apiMocks.updateThreadTabs,
        },
      },
    },
  };
});
vi.mock("@/components/ui/app-toast", () => ({
  appToast: { error: toastMocks.error, success: vi.fn(), info: vi.fn() },
}));

function createQueryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

afterEach(() => {
  cleanup();
  apiMocks.getThreadTabs.mockReset();
  apiMocks.updateThreadTabs.mockReset();
  toastMocks.error.mockReset();
  window.localStorage.clear();
});

describe("issue #1773: docs file-opener tab sync", () => {
  it("persists a plugin file-opener tab instead of toasting and dropping it", async () => {
    const threadId = "thr-1773";
    const infoTab = createThreadInfoFixedPanelTab();
    const docsTab = buildFileOpenerPanelTab(
      { id: "docs", pluginId: "simple-notes" },
      {
        path: "README.md",
        source: {
          kind: "workspace",
          environmentId: "env-1",
          projectId: null,
          threadId,
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
        threadId,
      },
    );
    apiMocks.getThreadTabs.mockResolvedValue({ revision: 3, tabs: [infoTab] });
    apiMocks.updateThreadTabs.mockImplementation(async (args) => ({
      revision: 4,
      tabs: args.tabs,
    }));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => ({
        state: useFixedPanelTabsState(threadId, threadId),
        update: useUpdateFixedPanelTabsState(threadId, threadId),
      }),
      { wrapper: createQueryWrapper(queryClient) },
    );
    await waitFor(() => {
      expect(result.current.state.secondary.tabs).toEqual([infoTab]);
    });

    // What openTab() does when the Docs opener claims README.md.
    act(() => {
      result.current.update((current) => ({
        ...current,
        secondary: {
          activeTabId: docsTab.id,
          isOpen: true,
          tabs: [infoTab, docsTab],
        },
      }));
    });

    // Let the write queue settle.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Bug on main: no PUT is ever sent, the user gets the toast, and the tab
    // is reconciled away against the server list.
    expect(toastMocks.error).not.toHaveBeenCalled(); // FAILS on main
    expect(apiMocks.updateThreadTabs).toHaveBeenCalledTimes(1);
    expect(result.current.state.secondary.tabs.map((tab) => tab.id)).toEqual([
      infoTab.id,
      docsTab.id,
    ]);
  });
});
