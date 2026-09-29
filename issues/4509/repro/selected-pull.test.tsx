// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { act } from "react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";

const app = await loadPluginApp(() => import("./app"));

describe("GitHub app navigation", () => {
  it("saves a selected pull request for the thread before showing it", async () => {
    const saved: Array<{ threadId: string; repo: string; number: number }> = [];
    const slot = renderSlot(
      app.threadPanelActions[0]!,
      { threadId: "thr-1", params: null },
      {
        rpc: {
          pullForThread: () => ({ pull: null }),
          listItems: () => ({
            items: [{
              repo: "get-bb/bb",
              number: 42,
              kind: "pr",
              title: "A pull request",
              state: "OPEN",
              author: "octocat",
              labels: [],
              assignees: [],
              url: "https://github.com/get-bb/bb/pull/42",
              body: "",
              updatedAt: "2026-08-20T00:00:00.000Z",
            }],
          }),
          linkPullToThread: (input: { threadId: string; repo: string; number: number }) => {
            saved.push(input);
            return { ok: true };
          },
          getPull: () => Promise.reject(new Error("Detail not needed for this test")),
          listLinks: () => ({ links: {} }),
        },
      },
    );

    const pick = await slot.findByRole("button", { name: /A pull request/ });
    await act(async () => pick.click());
    expect(saved).toEqual([{ threadId: "thr-1", repo: "get-bb/bb", number: 42 }]);
    slot.lifecycle.unmount();
  });
});
