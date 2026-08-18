// @vitest-environment jsdom
//
// Repro for issue #1301: ThreadTimelineRows mounts every loaded row with its
// full content. There is no windowing, so mounted DOM grows linearly with the
// number of pages the user has scrolled through. This test FAILS on main
// (16ceb3a54): all 800 rows are mounted with real content.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CompactViewportOverrideProvider } from "@bb/shared-ui/hooks/use-compact-viewport";
import { conversationRow } from "@/test/fixtures/thread-timeline-rows";
import { ThreadTimelineRows } from "./ThreadTimelineRows";

afterEach(() => cleanup());

describe("issue #1301: timeline history is never unmounted", () => {
  it("bounds the number of rows mounted with real content on a compact viewport", () => {
    const rows = Array.from({ length: 800 }, (_, index) =>
      conversationRow({
        id: `message_${index}`,
        role: index % 2 === 0 ? "user" : "assistant",
        text: `Timeline message ${index}`,
        sourceSeqStart: index + 1,
        sourceSeqEnd: index + 1,
        threadId: "thr_1301",
      }),
    );
    const { container } = render(
      <MemoryRouter>
        <CompactViewportOverrideProvider isCompactViewport>
          <ThreadTimelineRows
            threadId="thr_1301"
            timelineRows={rows}
            threadRuntimeDisplayStatus="idle"
            workspaceRootPath={undefined}
          />
        </CompactViewportOverrideProvider>
      </MemoryRouter>,
    );
    const wrappers = container.querySelectorAll("[data-timeline-row-id]");
    const withContent = Array.from(wrappers).filter(
      (wrapper) => wrapper.textContent !== null && wrapper.textContent.length > 0,
    );
    // Every row wrapper is present (that is fine) ...
    expect(wrappers.length).toBe(800);
    // ... but a windowed list would realize only rows near the viewport.
    // On main every one of the 800 rows carries its full rendered content.
    expect(withContent.length).toBeLessThan(200);
  });
});
