// @vitest-environment jsdom
//
// Hostile test for PR #1384 (issue #1301 review): crossing the 40-item
// windowing threshold on a compact viewport swaps every row's wrapper element
// type (plain <div> -> TimelineWindowedListItem), which remounts the whole
// timeline subtree and drops row-local state.

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CompactViewportOverrideProvider } from "@bb/shared-ui/hooks/use-compact-viewport";
import {
  BottomAnchorContext,
  type BottomAnchorContextValue,
} from "@/components/ui/bottom-anchored-scroll-body";
import { conversationRow } from "@/test/fixtures/thread-timeline-rows";
import { ThreadTimelineRows } from "./ThreadTimelineRows";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function makeRows(count: number) {
  return Array.from({ length: count }, (_, index) =>
    conversationRow({
      id: `message_${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      text: `Timeline message ${index}`,
      sourceSeqStart: index + 1,
      sourceSeqEnd: index + 1,
      threadId: "thr_threshold",
    }),
  );
}

describe("PR #1384 windowing threshold", () => {
  it("remounts every timeline row when the 40th item arrives on a compact viewport", () => {
    vi.stubGlobal(
      "IntersectionObserver",
      class IntersectionObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const scrollElement = document.createElement("div");
    scrollElement.getBoundingClientRect = () =>
      ({ top: 0, bottom: 800 }) as DOMRect;
    const bottomAnchor: BottomAnchorContextValue = {
      captureScrollAnchor: vi.fn(),
      getScrollElement: () => scrollElement,
      isAtBottom: true,
      scrollElementIntoView: vi.fn(),
      scrollElementIntoViewClampedToMaxScroll: vi.fn(),
      scrollToBottom: vi.fn(),
    };
    const renderTimeline = (rowCount: number) => (
      <MemoryRouter>
        <BottomAnchorContext.Provider value={bottomAnchor}>
          <CompactViewportOverrideProvider isCompactViewport>
            <ThreadTimelineRows
              threadId="thr_threshold"
              timelineRows={makeRows(rowCount)}
              threadRuntimeDisplayStatus="idle"
              workspaceRootPath={undefined}
            />
          </CompactViewportOverrideProvider>
        </BottomAnchorContext.Provider>
      </MemoryRouter>
    );

    const { container, rerender } = render(renderTimeline(39));
    expect(container.querySelector('[data-timeline-windowed="true"]')).toBeNull();
    const before = container.querySelector('[data-timeline-row-id="message_0"]');
    expect(before).not.toBeNull();
    const beforeInner = before?.firstElementChild ?? null;
    expect(beforeInner).not.toBeNull();

    // Same thread, one more row appended (a new streamed message).
    act(() => {
      rerender(renderTimeline(40));
    });
    expect(
      container.querySelector('[data-timeline-windowed="true"]'),
    ).not.toBeNull();
    const after = container.querySelector('[data-timeline-row-id="message_0"]');
    const afterInner = after?.firstElementChild ?? null;

    // The row content for message_0 did not change, so a stable list keeps
    // the same DOM nodes. If these differ, React unmounted and remounted the
    // row (and every other row) purely because the wrapper type changed.
    expect(after).toBe(before);
    expect(afterInner).toBe(beforeInner);
  });
});
