// @vitest-environment jsdom

import { QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "@/lib/query-client";
import { sidebarNavigationQueryKey } from "./query-keys";

describe("issue 2533 sidebar bootstrap recovery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("leaves the failed bootstrap terminal until a realtime invalidation", async () => {
    const queryClient = createAppQueryClient({
      shouldRefetchOnWindowFocus: () => false,
      showMutationErrorToasts: false,
    });
    queryClient.mount();

    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue("projects loaded");
    const observer = new QueryObserver(queryClient, {
      queryKey: sidebarNavigationQueryKey(),
      queryFn,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});

    await vi.waitFor(() => {
      expect(observer.getCurrentResult().isError).toBe(true);
    });
    expect(queryFn).toHaveBeenCalledTimes(3);

    await new Promise((resolve) => setTimeout(resolve, 750));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(queryFn).toHaveBeenCalledTimes(3);
    expect(observer.getCurrentResult().isError).toBe(true);

    await queryClient.invalidateQueries({
      queryKey: sidebarNavigationQueryKey(),
    });
    await vi.waitFor(() => {
      expect(observer.getCurrentResult().data).toBe("projects loaded");
    });
    expect(queryFn).toHaveBeenCalledTimes(4);

    unsubscribe();
    queryClient.unmount();
    queryClient.clear();
  });
});
