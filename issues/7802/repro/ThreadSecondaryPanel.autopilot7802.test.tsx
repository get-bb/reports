// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { PanelGroup } from "react-resizable-panels";
import { TooltipProvider } from "@bb/shared-ui/tooltip";
import {
  collectPluginAppRegistrations,
  definePluginApp,
} from "@/lib/plugin-app-definition";
import {
  resetPluginSlotStoreForTest,
  setPluginSlotRegistrations,
} from "@/lib/plugin-slots";
import {
  markPluginFrontendsSettled,
  resetPluginFrontendBootStateForTest,
} from "@/lib/plugin-frontend-boot-state";
import { createThreadInfoFixedPanelTab } from "@/lib/fixed-panel-tabs-state";
import { createQueryClientTestHarness } from "@/test/queryClientTestHarness";
import {
  createThreadFixedTabDescriptor,
  useThreadFixedTabs,
} from "../plugin/PluginThreadFixedTabs";
import { ThreadSecondaryPanel } from "./ThreadSecondaryPanel";

const noop = () => {};
const setups: string[] = [];

function Content({ threadId }: { threadId: string }) {
  useEffect(() => {
    setups.push(threadId);
  }, [threadId]);
  return <div>Active info for {threadId}</div>;
}

function Host({ threadId, drawer }: { threadId: string; drawer: boolean }) {
  const fixed = useThreadFixedTabs({ threadId, environmentId: null });
  return (
    <>
      {fixed.observers}
      <TooltipProvider>
        <PanelGroup direction="horizontal">
          <ThreadSecondaryPanel
            activeTab={createThreadInfoFixedPanelTab()}
            areFixedTabsReady={fixed.isReady}
            fixedTabs={[
              ...fixed.entries.map((entry) =>
                createThreadFixedTabDescriptor(entry, threadId, null, noop),
              ),
            ]}
            tabs={[]}
            isConversationCollapsed={false}
            isOpen
            metadataContent={<Content threadId={threadId} />}
            onClose={noop}
            onCollapse={noop}
            onTabReorder={noop}
            onOpenNewTab={noop}
            onPanelFocus={noop}
            onToggleConversationCollapse={noop}
            renderAsDrawer={drawer}
            splitPanelStateId={threadId}
          />
        </PanelGroup>
      </TooltipProvider>
    </>
  );
}

beforeEach(() => {
  setups.length = 0;
  markPluginFrontendsSettled();
  setPluginSlotRegistrations(
    "mount-check",
    collectPluginAppRegistrations(
      definePluginApp((app) => {
        app.slots.experimental_tab({
          context: { kind: "thread" },
          availability: "fixed",
          id: "details",
          title: "Details",
          icon: "Info",
          useVisible: () => true,
          component: () => null,
        });
      }),
    ),
  );
});

afterEach(() => {
  cleanup();
  resetPluginSlotStoreForTest();
  resetPluginFrontendBootStateForTest();
  window.localStorage.clear();
});

it.each([false, true])(
  "activates content once per thread switch (drawer=%s)",
  (drawer) => {
    const { wrapper } = createQueryClientTestHarness();
    const view = render(<Host threadId="thr_first" drawer={drawer} />, {
      wrapper,
    });
    setups.length = 0;
    const counts: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      const threadId = index % 2 === 0 ? "thr_second" : "thr_first";
      const previousCount = setups.length;
      view.rerender(<Host threadId={threadId} drawer={drawer} />);
      expect(screen.getByText(`Active info for ${threadId}`)).toBeTruthy();
      counts.push(setups.length - previousCount);
    }
    console.log(JSON.stringify({ drawer, activationsPerSwitch: counts }));
    expect(counts).toEqual(Array.from({ length: 10 }, () => 1));
  },
);
