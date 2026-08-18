// @vitest-environment jsdom
// Issue #1676 item 2: on a reload / deep link, PluginPanelView renders
// "This plugin panel is not available" before plugin frontends have booted
// (registrations arrive only after first paint). This test encodes the
// expected behaviour (stay quiet while nothing has booted yet) and therefore
// FAILS on main 16ceb3a54: the message is rendered synchronously on the very
// first render, with an empty registration store.
//
// Copy to apps/app/src/components/plugin/ and run:
//   cd apps/app && pnpm exec vitest run src/components/plugin/issue-1676-plugin-panel-route-before-boot.test.tsx
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { resetPluginSlotStoreForTest } from "@/lib/plugin-slots";
import { PLUGIN_PANEL_ROUTE_PATH } from "@/lib/route-paths";
import { PluginPanelView } from "@/views/PluginPanelView";

afterEach(() => {
  cleanup();
  resetPluginSlotStoreForTest();
});

describe("issue #1676: plugin panel deep link before plugin frontends boot", () => {
  it("does not announce 'not available' while no plugin frontend has registered yet", () => {
    // Fresh page load: the registration store is empty because
    // bootPluginFrontends() has not run (it waits for system config).
    render(
      <MemoryRouter initialEntries={["/plugins/tasks/tasks"]}>
        <Routes>
          <Route path={PLUGIN_PANEL_ROUTE_PATH} element={<PluginPanelView />} />
        </Routes>
      </MemoryRouter>,
    );
    // Expected: quiet shell. Actual on main: the "not available" copy.
    expect(screen.queryByText(/This plugin panel is not available/)).toBeNull();
  });
});
