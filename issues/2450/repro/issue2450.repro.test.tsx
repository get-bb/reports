// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PanelGroup } from "react-resizable-panels";
import { TooltipProvider } from "@bb/shared-ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  createGitDiffFixedPanelTab,
  createThreadInfoFixedPanelTab,
} from "@/lib/fixed-panel-tabs-state";
import { createQueryClientTestHarness } from "@/test/queryClientTestHarness";
import {
  createSidebarSplitState,
  moveSidebarTab,
  serializeSidebarSplitState,
  sidebarSplitStorageKey,
} from "./sidebarSplitLayout";
import { ThreadSecondaryPanel } from "./ThreadSecondaryPanel";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const noop = () => {};

describe("issue 2450 reproduction", () => {
  it("gives every fixed-tab split pane a direct remove action", () => {
    const info = createThreadInfoFixedPanelTab();
    const diff = createGitDiffFixedPanelTab();
    const panelStateId = "issue-2450-fixed-split";
    const initial = createSidebarSplitState([info.id, diff.id], diff.id);
    const split = moveSidebarTab(
      initial,
      initial.layout.focusedPaneId,
      diff.id,
      { paneId: initial.layout.focusedPaneId, zone: "right" },
      { groupId: "group-diff" },
    );
    window.localStorage.setItem(
      sidebarSplitStorageKey(panelStateId),
      serializeSidebarSplitState(split),
    );

    const { wrapper: Wrapper } = createQueryClientTestHarness();
    render(
      <Wrapper>
        <SidebarProvider>
          <TooltipProvider>
            <PanelGroup direction="horizontal">
              <ThreadSecondaryPanel
                activeTab={diff}
                canUseGitUi
                fixedTabs={[
                  {
                    ariaLabel: "Show thread info panel",
                    label: "Info",
                    leadingVisual: null,
                    onSelect: noop,
                    tab: info,
                    title: "Thread info",
                  },
                  {
                    ariaLabel: "Show diff panel",
                    label: "Diff",
                    leadingVisual: null,
                    onSelect: noop,
                    tab: diff,
                    title: "Diff",
                  },
                ]}
                tabs={[]}
                isConversationCollapsed={false}
                isOpen
                metadataContent={<div>Thread metadata</div>}
                onClose={noop}
                onCollapse={noop}
                onTabReorder={noop}
                onOpenNewTab={noop}
                onPanelFocus={noop}
                onToggleConversationCollapse={noop}
                renderAsDrawer={false}
                splitPanelStateId={panelStateId}
              />
            </PanelGroup>
          </TooltipProvider>
        </SidebarProvider>
      </Wrapper>,
    );

    expect(document.querySelectorAll("[data-split-pane-id]")).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: "Remove split" }),
    ).toHaveLength(2);
  });
});
