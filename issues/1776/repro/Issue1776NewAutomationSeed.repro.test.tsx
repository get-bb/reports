// @vitest-environment jsdom

/**
 * Repro for get-bb/bb#1776 — "Clicking 'Create automation' doesn't create an
 * automation, it just takes you to the Create thread UI".
 *
 * The Automations "New automation" button calls
 * `navigate.toCompose({ focusPrompt: true, initialPrompt: "Create a new bb automation to " })`
 * (plugins/automations/app.tsx). `useBbNavigate().toCompose` pushes the root
 * compose route with `{ initialPrompt, focusPrompt }` and NO
 * `replaceInitialPrompt`, so RootComposeView applies it through
 * `restorePromptDraftIfEmpty`, which is a no-op whenever the persisted
 * new-thread draft already has text. Result: the user lands on the plain
 * "New thread" composer showing their old draft, with no automation seed.
 *
 * Harness (mocks) copied from PluginNewThreadComposer.test.tsx.
 */

import type { ReactNode } from "react";
import { Provider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPromptDraftAccessor } from "@/hooks/usePromptDraftStorage";
import {
  RootComposeView,
  readInitialPromptFromLocationState,
} from "@/views/RootComposeView";

const mocks = vi.hoisted(() => ({
  promptBoxProps: [] as Array<Record<string, any>>,
  copyAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  threadsLoading: false,
}));

vi.mock("@/components/promptbox/NewThreadPromptBox", () => ({
  NewThreadPromptBox: (props: Record<string, unknown>) => {
    mocks.promptBoxProps.push(props);
    return <div data-testid="new-thread-prompt-box" />;
  },
}));

vi.mock("@/lib/sdk", () => ({
  sdk: { projects: { attachments: { copy: mocks.copyAttachments } } },
}));

const PROJECT = {
  id: "proj_1",
  name: "Project One",
  defaultExecutionOptions: {
    providerId: "codex",
    model: "gpt-5.6",
    serviceTier: undefined,
    reasoningLevel: "medium",
    permissionMode: "auto",
  },
  sources: [
    {
      id: "src_1",
      projectId: "proj_1",
      type: "local_path",
      hostId: "host_1",
      path: "/repo",
      isDefault: true,
      createdAt: 0,
      updatedAt: 0,
    },
  ],
  threads: [],
};

// A second project on the same host, so a record switch can differ ONLY by
// project id.
const OTHER_PROJECT = {
  ...PROJECT,
  id: "proj_2",
  name: "Project Two",
  sources: [{ ...PROJECT.sources[0], id: "src_2", projectId: "proj_2" }],
};

vi.mock("@/hooks/queries/sidebar-navigation-query", () => ({
  useSidebarNavigation: () => ({
    data: {
      projects: [PROJECT, OTHER_PROJECT],
      personalProject: {
        id: "personal",
        name: "Personal",
        sources: [],
        threads: [],
      },
    },
    isError: false,
    isSuccess: true,
  }),
}));

vi.mock("@/hooks/queries/host-queries", () => ({
  useHosts: () => ({ data: [{ id: "host_1", name: "Machine" }] }),
  selectPrimaryHost: (
    hosts: Array<{ id: string }> | undefined,
    primaryHostId: string | null,
  ) => hosts?.find((host) => host.id === primaryHostId) ?? hosts?.[0] ?? null,
}));

vi.mock("@/hooks/queries/system-queries", () => ({
  useOnboardingAgents: () => ({ data: undefined, isPending: false }),
  useHostProviderCliStatus: () => ({ data: undefined }),
  useSystemConfig: () => ({ data: { primaryHostId: "host_1" } }),
  useSystemExecutionOptions: () => ({
    data: {
      providers: [
        {
          id: "codex",
          displayName: "Codex",
          logoUrl: null,
          capabilities: {
            supportsServiceTier: false,
            permissionModes: ["auto", "accept-edits", "full"],
          },
          composerActions: [],
        },
        {
          id: "claude-code",
          displayName: "Claude Code",
          logoUrl: null,
          capabilities: {
            supportsServiceTier: false,
            permissionModes: ["auto", "accept-edits", "full"],
          },
          composerActions: [],
        },
      ],
      models: [
        {
          model: "gpt-5.6",
          displayName: "GPT-5.6",
          isDefault: true,
          supportedReasoningEfforts: [
            { reasoningEffort: "low" },
            { reasoningEffort: "medium" },
            { reasoningEffort: "high" },
          ],
        },
        {
          model: "gpt-5.6-sol",
          displayName: "GPT-5.6 Sol",
          isDefault: false,
          supportedReasoningEfforts: [
            { reasoningEffort: "medium" },
            { reasoningEffort: "high" },
          ],
        },
      ],
      selectedOnlyModels: [],
      modelLoadError: null,
    },
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
  }),
}));

vi.mock("@/hooks/queries/thread-queries", () => ({
  useThreads: () => ({ data: [], isLoading: mocks.threadsLoading }),
  useThreadStorageFiles: () => ({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useThreadStorageFilePreview: () => ({
    data: undefined,
    error: null,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/queries/project-queries", () => ({
  stripProjectThreads: (project: unknown) => project,
  useProjectPromptHistory: () => ({ data: [] }),
  useProjectSourceBranches: () => ({
    data: {
      branches: ["main", "release"],
      branchesTruncated: false,
      checkout: { kind: "branch", branchName: "main" },
      defaultBranch: "main",
      defaultBranchRelation: null,
      hasUncommittedChanges: false,
      operation: { kind: "none" },
      originDefaultBranch: null,
      remoteBranches: [],
      remoteBranchesTruncated: false,
      selectedBranch: null,
      defaultWorktreeBaseBranch: null,
    },
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/queries/project-default-execution-options-query", () => ({
  useProjectDefaultExecutionOptions: () => ({ data: undefined }),
}));

vi.mock("@/hooks/mutations/project-mutations", () => ({
  useUploadPromptAttachment: () => ({
    mutateAsync: mocks.uploadAttachment,
    isPending: false,
  }),
}));

vi.mock("@/hooks/usePromptMentions", () => ({
  usePromptMentions: () => ({
    triggers: [],
    suggestions: [],
    isLoading: false,
    isError: false,
    setQuery: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCommandSuggestions", () => ({
  useCommandSuggestions: () => ({
    trigger: null,
    suggestions: [],
    isLoading: false,
    isError: false,
    hasMore: false,
    isLoadingMore: false,
    loadMore: vi.fn(),
  }),
}));

vi.mock("@/hooks/useQuickCreateProject", () => ({
  useQuickCreateProjectController: () => ({
    hostId: null,
    hostName: null,
    hosts: [],
    isAvailable: false,
    isCreating: false,
    openCreateDialog: vi.fn(),
    platform: null,
    projectPathDialog: {
      isOpen: false,
      onOpenChange: vi.fn(),
      target: null,
    },
    submitProjectPath: vi.fn(),
  }),
}));

vi.mock("@/components/dialogs/ProjectMachineSetupDialog", () => ({
  ProjectMachineSetupDialog: () => null,
}));

vi.mock("@/views/RootComposeSecondaryContent", () => ({
  ROOT_COMPOSE_PINNED_PANEL_TOGGLE_POSITION_CLASS: "",
  RootComposeSecondaryContent: ({ children }: { children: ReactNode }) =>
    children,
}));

function latestPromptBoxProps(): Record<string, any> {
  const props = mocks.promptBoxProps.at(-1);
  expect(props).toBeDefined();
  return props as Record<string, any>;
}

describe("issue #1776: New automation -> root compose seed", () => {
  beforeEach(() => {
    mocks.promptBoxProps.length = 0;
    mocks.copyAttachments.mockReset();
    mocks.uploadAttachment.mockReset();
    mocks.threadsLoading = false;
    window.localStorage.clear();
    getPromptDraftAccessor({ kind: "new-thread" }).setDraft({
      text: "",
      mentions: [],
      attachments: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  function renderRootCompose(state: Record<string, unknown>) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    window.localStorage.setItem("bb.root-compose.project-id", "proj_1");
    const router = createMemoryRouter(
      [{ path: "/", element: <RootComposeView /> }],
      { initialEntries: [{ pathname: "/", state }] },
    );
    render(
      <Provider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </Provider>,
    );
    return router;
  }

  // Exactly what plugins/automations "New automation" sends through
  // useBbNavigate().toCompose (apps/app/src/lib/plugin-sdk-hooks.ts).
  const NEW_AUTOMATION_STATE = {
    focusPrompt: true,
    initialPrompt: "Create a new bb automation to ",
  };

  it("PASSES on main: seeds the automation prompt when the new-thread draft is empty", async () => {
    const router = renderRootCompose(NEW_AUTOMATION_STATE);
    await waitFor(() => {
      expect(latestPromptBoxProps().value).toBe(
        "Create a new bb automation to ",
      );
    });
    await waitFor(() => {
      expect(
        readInitialPromptFromLocationState(router.state.location.state),
      ).toBeNull();
    });
  });

  it("FAILS on main: the automation seed is silently dropped when a new-thread draft already exists", async () => {
    const rootDraft = getPromptDraftAccessor({ kind: "new-thread" });
    rootDraft.setDraft({
      text: "fix the flaky test",
      mentions: [],
      attachments: [],
    });
    const router = renderRootCompose(NEW_AUTOMATION_STATE);
    // Wait for the location-state effect to consume the seed.
    await waitFor(() => {
      expect(
        readInitialPromptFromLocationState(router.state.location.state),
      ).toBeNull();
    });
    // What the user sees: the composer still holds the leftover draft.
    // Expected (per the button's intent): the automation prompt is visible.
    expect(latestPromptBoxProps().value).toContain(
      "Create a new bb automation to ",
    );
  });
});
