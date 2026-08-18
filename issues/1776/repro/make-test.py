import sys
p = sys.argv[1]
s = open(p).read()
lines = s.split("\n")
idx = next(i for i, l in enumerate(lines) if l.startswith("function RootReuseProbe"))
head = "\n".join(lines[:idx])
head = head.replace("""/**
 * Round-trip guarantee of the `default*` seed props: submitting a seeded,
 * untouched composer must reproduce the request the seeds came from, and a
 * seed change after mount must re-seed even user-touched selections. This is
 * what lets a plugin store a `NewThreadRequest`, re-open it for editing, and
 * save without silently resetting the user's provider/model/permission/
 * environment to project defaults.
 */""", """/**
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
 */""")
head = head.replace('import { useEffect, type ReactNode } from "react";', 'import type { ReactNode } from "react";')
head = head.replace('''import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";''', '''import { cleanup, render, waitFor } from "@testing-library/react";''')
head = head.replace('''import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";''', '''import { createMemoryRouter, RouterProvider } from "react-router-dom";''')
head = head.replace('import type { NewThreadRequest } from "@get-bb/plugin-sdk";\n', '')
head = head.replace('''import {
  NewThreadComposer,
  type NewThreadComposerState,
} from "@/components/promptbox/NewThreadComposer";
import { encodeReuseValue } from "@/components/pickers/environment-picker-value";
import { useRootComposeReuseEnvironment } from "@/lib/root-compose-selection";
''', '')
head = head.replace('import { buildThreadHandoffLocationState } from "@/lib/thread-handoff-request";\n', '')
head = head.replace('import { PluginNewThreadComposer } from "./PluginNewThreadComposer";\n', '')
tail = '''
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
      expect(router.state.location.state).toEqual({ focusPrompt: true });
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
      expect(router.state.location.state).toEqual({ focusPrompt: true });
    });
    // What the user sees: the composer still holds the leftover draft.
    // Expected (per the button's intent): the automation prompt is visible.
    expect(latestPromptBoxProps().value).toContain(
      "Create a new bb automation to ",
    );
  });
});
'''
open(p, "w").write(head + tail)
