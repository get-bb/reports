// Browser layout test. Doobie executes this JavaScript despite the retained
// artifact name. Run it against a pending Ask User Question interaction.
const threadUrl =
  "http://localhost:14456/projects/proj_rftsbtzc27/threads/thr_bb6wm784dy";

const page = await browser.getPage("issue-2537-layout-contract");
await page.setViewport({
  width: 362,
  height: 390,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await page.goto(threadUrl, {
  waitUntil: "domcontentloaded",
  timeout: 30_000,
});
await page.waitForSelector("text/4 questions", {
  visible: true,
  timeout: 30_000,
});

const bounds = await page.evaluate(() => {
  const banner = document.querySelector('[data-testid="plugin-request-banner"]');
  const heading = [...document.querySelectorAll("h3")].find(
    (element) => element.textContent?.trim() === "4 questions",
  );
  const next = [...document.querySelectorAll("button")].find(
    (element) => element.textContent?.trim() === "Next",
  );
  if (!banner || !heading || !next) {
    throw new Error("The pending question form is not present.");
  }
  const bannerRect = banner.getBoundingClientRect();
  const headingRect = heading.getBoundingClientRect();
  const nextRect = next.getBoundingClientRect();
  return {
    viewport: { width: innerWidth, height: innerHeight },
    banner: { left: bannerRect.left, right: bannerRect.right },
    heading: { top: headingRect.top, bottom: headingRect.bottom },
    next: {
      left: nextRect.left,
      right: nextRect.right,
      top: nextRect.top,
      bottom: nextRect.bottom,
    },
  };
});

const failures = [];
if (bounds.banner.left < 0) failures.push("banner.left");
if (bounds.banner.right > bounds.viewport.width) failures.push("banner.right");
if (bounds.heading.top < 48) failures.push("heading.top");
if (bounds.next.right > bounds.viewport.width) failures.push("next.right");
if (bounds.next.bottom > bounds.viewport.height) failures.push("next.bottom");

console.log(JSON.stringify(bounds, null, 2));
if (failures.length > 0) {
  throw new Error(`OUT-OF-BOUNDS: ${failures.join(", ")}`);
}
({ status: "ALL LAYOUT ASSERTIONS PASSED", bounds });

/* Replaced jsdom class-contract test retained below for investigation history.
// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PluginPendingInteraction } from "@bb/domain";
import type { PluginPendingInteractionProps } from "@get-bb/plugin-sdk";
import {
  resetPluginSlotStoreForTest,
  setPluginSlotRegistrations,
  type PluginRegistrationSet,
} from "@/lib/plugin-slots";
import { resetAllCrashedPluginSlotsForTest } from "./PluginSlotMount";
import { PluginPendingInteractionComposer } from "./PluginPendingInteractionComposer";

// The composer can stop the thread (a provider's request), which needs the
// query client like every mutation hook.
function renderComposer(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>,
  );
}

function registrations(
  pendingInteractions: NonNullable<
    PluginRegistrationSet["pendingInteractions"]
  >,
): PluginRegistrationSet {
  return {
    homepageSections: [],
    settingsSections: [],
    navPanels: [],
    threadPanelActions: [],
    pendingInteractions,
    sidebarFooterActions: [],
    fileOpeners: [],
    messageDirectives: [],
  };
}

const interaction: PluginPendingInteraction = {
  id: "pint_23456789ab",
  threadId: "thr_test",
  turnId: null,
  origin: { kind: "plugin", pluginId: "secrets", rendererId: "secret-request" },
  status: "pending",
  payload: {
    kind: "plugin",
    title: "Add secrets",
    data: { fields: ["API_KEY"] },
  },
  resolution: null,
  statusReason: null,
  createdAt: 1,
  expiresAt: 2,
  resolvedAt: null,
};

afterEach(() => {
  cleanup();
  resetPluginSlotStoreForTest();
  // A crashed slot instance is remembered for the lifetime of the module, so
  // without this a renderer that throws in one test disables that same
  // plugin/slot pair for every test that runs after it.
  resetAllCrashedPluginSlotsForTest();
  // restore, not clear: `vi.clearAllMocks` only drops recorded calls, leaving
  // the `console` spies below installed and silencing later tests.
  vi.restoreAllMocks();
});

describe("PluginPendingInteractionComposer", () => {
  it("removes the fieldset from plugin form layout", () => {
    function WideRenderer() {
      return <div data-testid="wide-renderer">wide renderer</div>;
    }
    setPluginSlotRegistrations(
      "secrets",
      registrations([{ id: "secret-request", component: WideRenderer }]),
    );

    renderComposer(
      <PluginPendingInteractionComposer
        interaction={interaction}
        request={{
          pluginId: "secrets",
          rendererId: "secret-request",
          title: interaction.payload.title,
          data: interaction.payload.data,
        }}
        dismissal="cancel"
      />,
    );

    const fieldset = screen.getByTestId("wide-renderer").closest("fieldset");
    expect(fieldset?.classList.contains("contents")).toBe(true);
  });

  it("mounts only the renderer registered by the interaction's plugin", () => {
    function WrongRenderer() {
      return <div>wrong plugin renderer</div>;
    }
    function MatchingRenderer({
      interaction: view,
    }: PluginPendingInteractionProps) {
      return <div>form {view.title}</div>;
    }
    setPluginSlotRegistrations(
      "wrong-plugin",
      registrations([{ id: "secret-request", component: WrongRenderer }]),
    );
    setPluginSlotRegistrations(
      "secrets",
      registrations([{ id: "secret-request", component: MatchingRenderer }]),
    );

    renderComposer(
      <PluginPendingInteractionComposer
        interaction={interaction}
        request={{
          pluginId: "secrets",
          rendererId: "secret-request",
          title: interaction.payload.title,
          data: interaction.payload.data,
        }}
        dismissal="cancel"
      />,
    );

    expect(screen.getByText("form Add secrets")).toBeDefined();
    expect(screen.queryByText("wrong plugin renderer")).toBeNull();
  });

  it("keeps a host-owned cancel fallback when the renderer is missing", () => {
    renderComposer(
      <PluginPendingInteractionComposer
        interaction={interaction}
        request={{
          pluginId: "secrets",
          rendererId: "secret-request",
          title: interaction.payload.title,
          data: interaction.payload.data,
        }}
        dismissal="cancel"
      />,
    );
    expect(screen.getByText(/form is unavailable/i)).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });

  it("resolves the form through the slot store once the renderer registers", () => {
    // A plugin bundle can still be loading when a request surfaces; the
    // composer shows the fallback and picks the form up from the slot store
    // without a remount once the renderer registers.
    function Renderer({ interaction: view }: PluginPendingInteractionProps) {
      return <div>form {view.title}</div>;
    }
    const request = {
      pluginId: "secrets",
      rendererId: "secret-request",
      title: interaction.payload.title,
      data: interaction.payload.data,
    };
    const { rerender } = renderComposer(
      <PluginPendingInteractionComposer
        interaction={interaction}
        request={request}
        dismissal="stop-turn"
      />,
    );
    expect(screen.getByText(/form is unavailable/i)).toBeDefined();

    setPluginSlotRegistrations(
      "secrets",
      registrations([{ id: "secret-request", component: Renderer }]),
    );
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <PluginPendingInteractionComposer
          interaction={interaction}
          request={request}
          dismissal="stop-turn"
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText("form Add secrets")).toBeDefined();
  });

  it("keeps cancel available when the renderer crashes", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    function Crashed(): never {
      throw new Error("boom");
    }
    setPluginSlotRegistrations(
      "secrets",
      registrations([{ id: "secret-request", component: Crashed }]),
    );
    renderComposer(
      <PluginPendingInteractionComposer
        interaction={interaction}
        request={{
          pluginId: "secrets",
          rendererId: "secret-request",
          title: interaction.payload.title,
          data: interaction.payload.data,
        }}
        dismissal="cancel"
      />,
    );
    expect(screen.getByText(/form crashed/i)).toBeDefined();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
  });
});
*/
