// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  BottomAnchorContext,
  type BottomAnchorContextValue,
} from "@/components/ui/bottom-anchored-scroll-body.js";
import { ScrollPositionKeeper } from "@/components/ui/scroll-position-keeper.js";
import { useAutoLoadOlderRows } from "./useAutoLoadOlderRows.js";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it.each([300, 900])(
  "has the older page ready at the loaded edge with %i ms page latency",
  async (latencyMs) => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const scrollElement = document.createElement("div");
    const sentinel = document.createElement("div");
    document.body.append(scrollElement, sentinel);
    let distancePx = 1_600;
    let requestStartedMs: number | null = null;
    let requestDistancePx: number | null = null;
    let completedMs: number | null = null;
    let pageReady = false;
    vi.spyOn(scrollElement, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(0, 0, 400, 800),
    );
    vi.spyOn(sentinel, "getBoundingClientRect").mockImplementation(
      () => new DOMRect(0, -distancePx - 20, 400, 20),
    );
    const positionKeeper = new ScrollPositionKeeper({
      bottomThresholdPx: 4,
      deferWritesWhileScrolling: false,
      getContentElement: () => null,
      getFloorElement: () => null,
      getFooterElement: () => null,
      getScrollElement: () => scrollElement,
      getTopLevelRows: () => [],
      initiallyAttached: false,
    });
    const anchor: BottomAnchorContextValue = {
      getScrollElement: () => scrollElement,
      isAtBottom: false,
      scrollToBottom: vi.fn(),
      scrollElementIntoView: vi.fn(),
      holdContentPosition: vi.fn(),
      positionKeeper,
    };
    const onLoadOlderRows = vi.fn(() => {
      requestStartedMs = Date.now();
      requestDistancePx = distancePx;
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          pageReady = true;
          completedMs = Date.now();
          resolve();
        }, latencyMs);
      });
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <BottomAnchorContext.Provider value={anchor}>
        {children}
      </BottomAnchorContext.Provider>
    );
    const { result } = renderHook(
      () =>
        useAutoLoadOlderRows({
          hasOlderTimelineRows: true,
          isLoadingOlderTimelineRows: false,
          onLoadOlderRows,
        }),
      { wrapper },
    );
    act(() => result.current.sentinelRef(sentinel));

    for (let step = 1; step <= 16; step += 1) {
      await act(async () => vi.advanceTimersByTimeAsync(24));
      distancePx = 1_600 - step * 100;
      act(() => positionKeeper.reconcile());
      await act(async () => vi.advanceTimersByTimeAsync(1));
    }

    const readyAtEdge = pageReady;
    const observedEdgeMs = Date.now();
    await act(async () => vi.advanceTimersByTimeAsync(latencyMs));
    console.log(JSON.stringify({
      latencyMs,
      scrollSpeedPxPerSecond: 4_000,
      requestStartedMs,
      requestDistancePx,
      edgeMs: observedEdgeMs,
      completedMs,
      readyAtEdge,
      pageEventuallyReady: pageReady,
      requestCount: onLoadOlderRows.mock.calls.length,
    }));
    expect(onLoadOlderRows).toHaveBeenCalledTimes(1);
    expect(pageReady).toBe(true);
    expect(readyAtEdge).toBe(true);
  },
);
