// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompactViewportOverrideProvider } from "@bb/shared-ui/hooks/use-compact-viewport";
import { CompactLongPressMenu } from "@bb/shared-ui/compact-long-press-menu";
import { CompactLongPressMenu as BundledMenu } from "../../../../../packages/shared-ui/src/components/ui/compact-long-press-menu-repro-copy";
import { DropdownMenuItem } from "@bb/shared-ui/dropdown-menu";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("nested touch-menu ownership across bundle boundaries", () => {
  it.each([
    ["same module", CompactLongPressMenu],
    ["separately evaluated module", BundledMenu],
  ] as const)("opens only the inner drawer: %s", (_name, ProjectMenu) => {
    vi.useFakeTimers();
    const threadOpened = vi.fn();
    const projectOpened = vi.fn();
    render(
      <CompactViewportOverrideProvider isCompactViewport>
        <ProjectMenu
          label="Project actions"
          items={<DropdownMenuItem>Project settings</DropdownMenuItem>}
          onOpenChange={projectOpened}
        >
          <section>
            <CompactLongPressMenu
              label="Thread actions"
              items={<DropdownMenuItem>Pin thread</DropdownMenuItem>}
              onOpenChange={threadOpened}
            >
              <button type="button">Reproduction thread</button>
            </CompactLongPressMenu>
          </section>
        </ProjectMenu>
      </CompactViewportOverrideProvider>,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "Reproduction thread" }), {
      pointerId: 17,
      pointerType: "touch",
      isPrimary: true,
      clientX: 60,
      clientY: 100,
    });
    act(() => vi.advanceTimersByTime(800));
    expect(threadOpened).toHaveBeenCalledWith(true);
    expect(projectOpened).not.toHaveBeenCalled();
  });
});
