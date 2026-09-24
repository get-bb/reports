// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createBbDesktopApi, createNoopDesktopBrowserApi } from "@/test/bb-desktop-test-utils";
import { BrowserTabLifecycleObserver } from "./BrowserTabDeck";
import { registerBrowserView, resetBrowserViewPersistence } from "./browserViewVisibilityCoordinator";

const originalDesktop = window.bbDesktop;
afterEach(() => {
  cleanup();
  window.bbDesktop = originalDesktop;
  resetBrowserViewPersistence();
});

it.each(["switch", "unmount"])("hides all retained owner views on %s without destroying pages", (action) => {
  const visible = new Set(["first", "second", "unrelated"]);
  const detach = vi.fn();
  const api = {
    ...createNoopDesktopBrowserApi(),
    detach,
    setVisible: vi.fn(({ tabId, visible: show }: { tabId: string; visible: boolean }) => {
      if (show) visible.add(tabId);
      else visible.delete(tabId);
    }),
  };
  window.bbDesktop = createBbDesktopApi({
    lastCheckedAt: null, latestVersion: null, pendingVersion: null,
    platform: "macos", updateAvailable: false, updateDownloaded: false, version: "test",
  }, api);
  for (const tabId of visible) {
    registerBrowserView({ environmentId: null, tabId, threadId: tabId === "unrelated" ? "other" : "owner" });
  }
  const view = render(<BrowserTabLifecycleObserver browserTabs={[]} threadId="owner" />);
  expect([...visible]).toEqual(["first", "second", "unrelated"]);
  if (action === "switch") view.rerender(<BrowserTabLifecycleObserver browserTabs={[]} threadId="destination" />);
  else view.unmount();
  expect(detach).not.toHaveBeenCalled();
  expect([...visible]).toEqual(["unrelated"]);
});
