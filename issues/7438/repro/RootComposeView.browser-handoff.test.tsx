// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { afterEach, expect, it, vi } from "vitest";
import type { NewThreadComposerProps } from "@/components/promptbox/NewThreadComposer";
import {
  createBrowserFixedPanelTab,
  createEmptyFixedPanelTabsState,
  getFixedPanelTabsStateStorageKey,
  serializeFixedPanelTabsState,
} from "@/lib/fixed-panel-tabs-state";
import {
  resetFixedPanelTabsStateForTest,
  useFixedPanelTabsState,
} from "@/lib/fixed-panel-tabs";
import { RootComposeView } from "./RootComposeView";
import { ROOT_COMPOSE_FIXED_PANEL_STATE_ID } from "./RootComposePanelTabContent";

const controls = vi.hoisted(() => ({
  createThread: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/hooks/mutations/thread-runtime-mutations", () => ({
  useCreateThread: () => ({ mutateAsync: controls.createThread }),
}));

vi.mock("@/views/thread-detail/PaneContext", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/views/thread-detail/PaneContext")
  >()),
  usePaneContext: () => ({ navigateInPane: controls.navigate }),
}));

vi.mock("@/components/promptbox/NewThreadComposer", () => ({
  NewThreadComposer: ({ onSubmit }: NewThreadComposerProps) => (
    <button
      onClick={() =>
        void onSubmit({
          projectId: "project-repro",
          providerId: "provider-repro",
          model: "model-repro",
          reasoningLevel: "high",
          permissionMode: "auto",
          executionInputSources: {},
          environment: { type: "project-default" },
          input: [{ type: "text", text: "Ownership probe", mentions: [] }],
        })
      }
    >
      Create conversation
    </button>
  ),
}));

function PanelProbe({ stateId }: { stateId: string }) {
  const state = useFixedPanelTabsState(stateId, null);
  return (
    <output data-testid={stateId}>{JSON.stringify(state.secondary)}</output>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  resetFixedPanelTabsStateForTest();
  vi.clearAllMocks();
});

it("moves the root browser tab into the created conversation and clears the next composer", async () => {
  resetFixedPanelTabsStateForTest();
  const browser = createBrowserFixedPanelTab({
    environmentId: null,
    url: "about:blank",
  });
  const initial = createEmptyFixedPanelTabsState();
  const root = {
    ...initial,
    lastUsedAt: Date.now(),
    secondary: { isOpen: true, activeTabId: browser.id, tabs: [browser] },
  };
  window.localStorage.setItem(
    getFixedPanelTabsStateStorageKey({
      threadId: ROOT_COMPOSE_FIXED_PANEL_STATE_ID,
    }),
    serializeFixedPanelTabsState({ state: root }),
  );
  controls.createThread.mockResolvedValue({
    id: "thread-created",
    projectId: "project-repro",
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <Provider store={createStore()}>
        <PanelProbe stateId={ROOT_COMPOSE_FIXED_PANEL_STATE_ID} />
        <PanelProbe stateId="thread-created" />
        <RootComposeView />
      </Provider>
    </QueryClientProvider>,
  );
  expect(
    screen.getByTestId(ROOT_COMPOSE_FIXED_PANEL_STATE_ID).textContent,
  ).toContain(browser.id);
  await act(async () =>
    fireEvent.click(screen.getByText("Create conversation")),
  );
  expect(controls.navigate).toHaveBeenCalledWith({
    projectId: "project-repro",
    threadId: "thread-created",
  });
  const created = JSON.parse(
    screen.getByTestId("thread-created").textContent ?? "null",
  );
  const remaining = JSON.parse(
    screen.getByTestId(ROOT_COMPOSE_FIXED_PANEL_STATE_ID).textContent ?? "null",
  );
  console.log(
    JSON.stringify(
      { createdThread: created, nextComposer: remaining },
      null,
      2,
    ),
  );
  expect.soft(created.tabs).toEqual([browser]);
  expect.soft(created.isOpen).toBe(true);
  expect.soft(remaining.tabs).toEqual([]);
  queryClient.clear();
});
