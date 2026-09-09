// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ThreadContextWindowIndicator } from "../../thread/timeline/ThreadContextWindowIndicator";
import { CompactViewportOverrideProvider } from "@bb/shared-ui/hooks/use-compact-viewport";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("keeps the compact indicator closed when a fine pointer only hovers", () => {
  vi.useFakeTimers();
  const view = render(<CompactViewportOverrideProvider isCompactViewport={true}>
    <ThreadContextWindowIndicator usage={{ usedTokens: 25000, modelContextWindow: 100000, estimated: false }} />
  </CompactViewportOverrideProvider>);
  const trigger = view.getByRole("button", { name: "Context window 25% used" });
  fireEvent.pointerEnter(trigger);
  act(() => vi.advanceTimersByTime(200));
  expect(trigger.getAttribute("data-state")).toBe("closed");
});
