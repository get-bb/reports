// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import {
  useBrowserDimmingOverlay,
  useIsBrowserDimmingModalOpen,
} from "./useBrowserDimmingModal";
import { useBrowserDimmingModal as usePluginDimming } from "../../../../packages/shared-ui/src/hooks/useBrowserDimmingModal";

function Probe({ active, plugin }: { active: boolean; plugin: boolean }) {
  useBrowserDimmingOverlay(active && !plugin);
  usePluginDimming(active && plugin);
  const hidden = useIsBrowserDimmingModalOpen();
  return <output data-testid="visibility">{hidden ? "hidden" : "visible"}</output>;
}

afterEach(cleanup);

test("host overlay hides the native view and restores it on close", () => {
  const store = createStore();
  const view = render(<Provider store={store}><Probe active={false} plugin={false} /></Provider>);
  expect(screen.getByTestId("visibility").textContent).toBe("visible");
  view.rerender(<Provider store={store}><Probe active={true} plugin={false} /></Provider>);
  expect(screen.getByTestId("visibility").textContent).toBe("hidden");
  view.rerender(<Provider store={store}><Probe active={false} plugin={false} /></Provider>);
  expect(screen.getByTestId("visibility").textContent).toBe("visible");
});

test("plugin registry overlay must hide the same native view while open", () => {
  const store = createStore();
  const view = render(<Provider store={store}><Probe active={false} plugin={true} /></Provider>);
  expect(screen.getByTestId("visibility").textContent).toBe("visible");
  view.rerender(<Provider store={store}><Probe active={true} plugin={true} /></Provider>);
  expect(screen.getByTestId("visibility").textContent).toBe("hidden");
});
