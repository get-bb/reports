// @vitest-environment jsdom
//
// Repro for get-bb/bb#2130, surface 4: the Docs plugin's markdown file opener
// loads a file once and never re-reads it. Also covers the "Related" note in
// the issue: a conflicting save on unmount is silently dropped.

import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";

const app = await loadPluginApp(() => import("./app"));

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const preview = {
  baseUrl: "/api/v1/file-previews/lease",
  expiresAtMs: Date.now() + 60_000,
};

const source = {
  kind: "workspace" as const,
  threadId: "thr_1",
  environmentId: "env_1",
  projectId: "project_1",
};

describe("issue #2130 · Docs file opener", () => {
  it("re-reads or flags a file that changed on disk while the reader never typed", async () => {
    // What the file on disk currently holds. The test mutates it to stand in
    // for an agent/terminal writing the file while the tab is open.
    let disk = { content: "# Plan\n\nversion 1", sha256: "sha-1" };
    const slot = renderSlot(
      app.fileOpeners[0]!,
      {
        path: "PLAN.md",
        source,
        experimental_Original: () => null,
      },
      {
        rpc: {
          openFile: () => ({ file: disk, preview, previewPath: "PLAN.md" }),
          saveOpenedFile: () => ({ outcome: "written", sha256: "unused" }),
        },
      },
    );
    await slot.findByText("version 1");
    expect(
      slot.rpcCalls.filter((call) => call.method === "openFile"),
    ).toHaveLength(1);

    // Outside write.
    disk = { content: "# Plan\n\nversion 2", sha256: "sha-2" };

    // Give the component every chance: time passes, the window is hidden and
    // shown again. There is no poll, watcher, subscription, or focus handler
    // in DocsFileOpener, so nothing happens.
    await act(() => new Promise((resolve) => setTimeout(resolve, 1_500)));
    await act(async () => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("blur"));
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await act(() => new Promise((resolve) => setTimeout(resolve, 200)));

    // FAILS ON MAIN: one openFile call, no banner, editor still says version 1.
    const reRead =
      slot.rpcCalls.filter((call) => call.method === "openFile").length > 1;
    const banner = slot.queryByText("Changed on disk.") !== null;
    expect(
      reRead || banner,
      `expected a re-read or a "Changed on disk." banner; got rpcCalls=${JSON.stringify(
        slot.rpcCalls.map((call) => call.method),
      )}, banner=${banner}, editor="${slot.container.textContent}"`,
    ).toBe(true);
  });

  it("does not silently drop an edit whose unmount save conflicts with a newer file on disk", async () => {
    const slot = renderSlot(
      app.fileOpeners[0]!,
      {
        path: "PLAN.md",
        source,
        experimental_Original: () => null,
      },
      {
        rpc: {
          openFile: () => ({
            file: { content: "# Plan", sha256: "sha-1" },
            preview,
            previewPath: "PLAN.md",
          }),
          // The file changed on disk after it was opened, so the optimistic
          // save (expectedSha256: sha-1) is rejected.
          saveOpenedFile: () => ({ outcome: "conflict", sha256: "sha-2" }),
        },
      },
    );
    const body = await slot.findByText("Plan");
    body.textContent = "Plan with an edit";
    fireEvent.input(body);
    // Let ProseMirror's DOM observer deliver the edit to the editor (well
    // inside the 700ms autosave debounce), then close the tab.
    await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
    expect(slot.rpcCalls.map((call) => call.method)).toEqual(["openFile"]);
    slot.unmount();
    await waitFor(() =>
      expect(slot.rpcCalls.map((call) => call.method)).toEqual([
        "openFile",
        "saveOpenedFile",
      ]),
    );
    const save = slot.rpcCalls.find((call) => call.method === "saveOpenedFile")!;
    expect(save.input).toMatchObject({
      content: "# Plan with an edit",
      expectedSha256: "sha-1",
    });

    // FAILS ON MAIN: the conflict resolves into setConflict() on an unmounted
    // component. Nothing retries, nothing is persisted, nothing is reported:
    // there is no follow-up rpc call and no observable signal of any kind.
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(
      slot.rpcCalls.length,
      `expected a retry/forced save or some report after the conflict; rpc log=${JSON.stringify(
        slot.rpcCalls.map((call) => call.method),
      )}`,
    ).toBeGreaterThan(2);
  });
});
