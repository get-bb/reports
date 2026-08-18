// @vitest-environment jsdom
//
// Repro for get-bb/bb#1304 ("Composer keystroke cost scales with the mounted
// timeline size"). Both tests model, at the hook level, the exact composition
// ThreadDetailViewInternal uses (apps/app/src/views/thread-detail/ThreadDetailView.tsx):
//
//  (1) It calls `usePromptDraftStorage(threadScope)` but only reads the stable
//      `addQuote` / `storageKey` members. `usePromptDraftStorage` is a
//      `useSyncExternalStore` subscription, so every keystroke the composer
//      writes with `setTextAndMentions` re-renders the whole ~3k-line view.
//  (2) On every one of those renders it calls `resolveEnvironmentOpenContext`
//      (a fresh `{ kind: "local" }` object) and feeds it to `useLocalOpenTargets`,
//      whose `openPathInFileTarget` callback therefore changes identity every
//      render; that callback is a dependency of `getLocalFileContextMenuItems`,
//      which is the value of `MarkdownLocalFileContextMenuContext.Provider`
//      wrapped around the entire timeline. React then has to scan the whole
//      timeline subtree (~18k fibers for a fully mounted 2.3k-event thread)
//      for context consumers on every keystroke.
//
// On main (16ceb3a54) both tests FAIL. With the fix in
// /tmp/bb-reports/issues/1304/repro/fix.diff (getPromptDraftAccessor.addQuote used
// by ThreadDetailView; structural memo of openContext in useLocalOpenTargets)
// both pass.

import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Environment } from "@bb/domain";
import {
  getPromptDraftAccessor,
  usePromptDraftStorage,
} from "@/hooks/usePromptDraftStorage";
import { useLocalOpenTargets } from "@/hooks/useLocalOpenTargets";
import { resolveEnvironmentOpenContext } from "./threadWorkspaceOpenPath";

const scope = {
  kind: "thread" as const,
  projectId: "proj-1304",
  threadId: "thr-1304",
};

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
});

describe("#1304 composer keystrokes re-render the thread view", () => {
  it("a view that only needs addQuote must not re-render on every composer keystroke", () => {
    let subscribedRenders = 0;
    let accessorRenders = 0;
    // What ThreadDetailViewInternal does on main: subscribes to the draft
    // store, but only uses `addQuote` (a stable callback) and `storageKey`.
    function SubscribedViewLike() {
      subscribedRenders += 1;
      const selectionPromptDraft = usePromptDraftStorage(scope);
      void selectionPromptDraft.addQuote;
      void selectionPromptDraft.storageKey;
      return null;
    }
    // What it should do: event-time access without a subscription. On main
    // `getPromptDraftAccessor` has no `addQuote`, so this view cannot be
    // written this way yet (the assertion below throws a TypeError).
    let accessor: ReturnType<typeof getPromptDraftAccessor> | null = null;
    function AccessorViewLike() {
      accessorRenders += 1;
      accessor = getPromptDraftAccessor(scope);
      return null;
    }
    render(
      <>
        <SubscribedViewLike />
        <AccessorViewLike />
      </>,
    );
    const subscribedBefore = subscribedRenders;
    const accessorBefore = accessorRenders;

    // The composer's per-keystroke write path (PromptBox -> setTextAndMentions).
    const composer = renderHook(() => usePromptDraftStorage(scope));
    const typed = "The quick brown fox";
    for (let index = 1; index <= typed.length; index += 1) {
      act(() => {
        composer.result.current.setTextAndMentions(typed.slice(0, index), []);
      });
    }

    // Sanity: the draft store itself works.
    expect(getPromptDraftAccessor(scope).getCurrent().text).toBe(typed);
    // The amplifier, by construction: one extra render of the subscribed view
    // per keystroke (this is what ThreadDetailViewInternal pays on main).
    expect(subscribedRenders - subscribedBefore).toBe(typed.length);
    // The accessor-based view renders zero extra times...
    expect(accessorRenders - accessorBefore).toBe(0);
    // ...and can still perform the only draft mutation the thread view needs.
    // FAILS on main: `accessor.addQuote is not a function`.
    act(() => {
      (accessor as unknown as { addQuote: (text: string) => void }).addQuote(
        "quoted selection",
      );
    });
    expect(getPromptDraftAccessor(scope).getCurrent().text).toContain(
      "> quoted selection",
    );
  });

  it("threadOpenContext -> useLocalOpenTargets must yield a stable openPathInFileTarget across renders", () => {
    const environment: Environment = {
      baseBranch: null,
      branchName: "main",
      createdAt: 1,
      defaultBranch: "main",
      hostId: "host_local",
      id: "env-1304",
      name: null,
      isGitRepo: true,
      isWorktree: false,
      managed: false,
      mergeBaseBranch: null,
      path: "/tmp/repo",
      projectId: "proj-1304",
      status: "ready",
      updatedAt: 1,
      workspaceProvisionType: "personal",
    };
    // Exactly what ThreadDetailViewInternal does on every render (l.1874-1892).
    const { result, rerender } = renderHook(() => {
      const threadOpenContext = resolveEnvironmentOpenContext({
        environment,
        serverOrigin: "http://localhost",
        threadEnvironmentIsLocal: true,
      });
      return useLocalOpenTargets({
        enabled: threadOpenContext !== null,
        ...(threadOpenContext ? { openContext: threadOpenContext } : {}),
      });
    });
    const first = result.current.openPathInFileTarget;
    rerender();
    const second = result.current.openPathInFileTarget;
    // BUG on main: a fresh `{ kind: "local" }` object per render busts the
    // memo chain in useLocalOpenTargets, so this callback (and with it the
    // MarkdownLocalFileContextMenuContext value) changes identity every render.
    expect(second).toBe(first);
  });
});
