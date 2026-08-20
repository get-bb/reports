// @vitest-environment jsdom
// Repro for get-bb/bb#1837: the inline-vis loading state does not reserve the
// requested preview height, so the timeline grows when the iframe replaces it.
import { cleanup, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";

const app = await loadPluginApp(() => import("./app"));

afterEach(cleanup);

const message = {
  id: "msg_1",
  threadId: "thr_1",
  turnId: "turn_1",
  projectId: "proj_1",
};

describe("issue #1837: inline-vis loading state reserves preview height", () => {
  it("loading container keeps the same height as the final iframe", async () => {
    let resolvePreview = (_r: { file: string }) => {};
    const pending = new Promise<{ file: string }>((resolve) => {
      resolvePreview = resolve;
    });
    const slot = renderSlot(
      app.messageDirectives[0]!,
      {
        attributes: { file: "demo.html", height: "480" },
        source: '::inline-vis{file="demo.html" height="480"}',
        message,
        openWorkspaceFile: vi.fn(() => true),
      },
      { rpc: { prepareHtmlPreview: () => pending } },
    );

    // The loading state is a single-line text box with no explicit height.
    const loader = await waitFor(() => {
      const el = slot.container.querySelector('[aria-busy="true"]');
      if (!(el instanceof HTMLElement)) throw new Error("loader not rendered");
      return el;
    });
    const reserved =
      loader.style.height !== ""
        ? loader
        : loader.querySelector<HTMLElement>("[style*='height']");
    // FAILS on c7c66423d: nothing in the loader carries the 480px height.
    expect(reserved?.style.height).toBe("480px");

    resolvePreview({ file: "demo.html" });
    const iframe = await waitFor(() => {
      const el = slot.container.querySelector("iframe");
      if (!(el instanceof HTMLIFrameElement)) throw new Error("no iframe");
      return el;
    });
    // The final iframe IS 480px tall, so the timeline grows by ~480px
    // (plus the header row) the moment the RPC resolves.
    expect(iframe.style.height).toBe("480px");
  });
});
