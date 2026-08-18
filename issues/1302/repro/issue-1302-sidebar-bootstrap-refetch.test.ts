import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryObserver } from "@tanstack/react-query";
import { createAppQueryClient } from "@/lib/query-client";
import { sidebarNavigationQueryKey } from "./queries/query-keys";
import { REALTIME_OWNED_STATIC_CACHE_QUERY_POLICY } from "./queries/query-policies";
import { createRealtimeCacheEffects } from "./realtime-cache-effects";

// Issue #1302: every `status-changed` realtime push for ANY thread (even one
// that is not in the sidebar payload at all) invalidates the single
// `sidebarNavigation` query, which refetches the whole
// GET /api/v1/sidebar-bootstrap document (~1 KB per unarchived thread) instead
// of patching the affected row. One turn = two status transitions = two full
// refetches. This test documents that behavior on main; it passes today and
// would start failing once status changes are patched into the cache.

function sidebarFixture() {
  return {
    sections: [],
    projects: [
      {
        id: "project-1",
        threads: [{ id: "thr_1", status: "idle" }],
      },
    ],
    personalProject: { id: "proj_personal", threads: [] },
  };
}

describe("issue #1302: sidebar-bootstrap refetches wholesale on status-changed", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refetches the whole bootstrap on every status transition, even for threads outside the sidebar", async () => {
    const queryClient = createAppQueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
      showMutationErrorToasts: false,
    });
    const effects = createRealtimeCacheEffects({ queryClient });
    const fetchSidebarBootstrap = vi.fn(async () => sidebarFixture());

    // Mount an active observer exactly like useSidebarNavigation() does
    // (staleTime: Infinity, so nothing but invalidation can refetch it).
    const observer = new QueryObserver(queryClient, {
      queryKey: sidebarNavigationQueryKey(),
      queryFn: fetchSidebarBootstrap,
      ...REALTIME_OWNED_STATIC_CACHE_QUERY_POLICY,
    });
    const unsubscribe = observer.subscribe(() => {});
    const settled = () =>
      vi.waitFor(() =>
        expect(
          queryClient.getQueryState(sidebarNavigationQueryKey())?.fetchStatus,
        ).toBe("idle"),
      );
    await settled();
    expect(fetchSidebarBootstrap).toHaveBeenCalledTimes(1);

    // Turn start: idle -> active for the one thread in the sidebar.
    effects.handleChanged({
      type: "changed",
      entity: "thread",
      id: "thr_1",
      metadata: { projectId: "project-1" },
      changes: ["status-changed"],
    });
    await settled();
    expect(fetchSidebarBootstrap).toHaveBeenCalledTimes(2);

    // Turn end: active -> idle. Another full refetch.
    effects.handleChanged({
      type: "changed",
      entity: "thread",
      id: "thr_1",
      metadata: { projectId: "project-1" },
      changes: ["status-changed"],
    });
    await settled();
    expect(fetchSidebarBootstrap).toHaveBeenCalledTimes(3);

    // A status change for a thread that is NOT in the cached sidebar payload
    // (hidden child, archived thread, other project) still refetches the world:
    // the invalidation is not scoped to the affected project or row.
    effects.handleChanged({
      type: "changed",
      entity: "thread",
      id: "thr_not_in_sidebar",
      metadata: { projectId: "project-not-in-sidebar" },
      changes: ["status-changed"],
    });
    await settled();
    // Nothing in the cache was patched in place; the row only changes because a
    // brand new document replaced it.
    expect(fetchSidebarBootstrap).toHaveBeenCalledTimes(4);

    unsubscribe();
    effects.dispose();
  });
});
