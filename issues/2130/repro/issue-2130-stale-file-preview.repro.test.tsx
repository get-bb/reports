// @vitest-environment jsdom
//
// Repro for get-bb/bb#2130: built-in file previews that have no refresh owner.
//
// Each test mounts one of the preview hooks against a mocked SDK, lets it load
// "version 1", then changes what the SDK would return ("version 2") to stand in
// for an outside write to the file. It then exercises every refresh trigger the
// app wires for that hook and asserts the hook refetched. On main the
// assertions marked FAILS ON MAIN fail, which is the bug.

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { focusManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createQueryClientTestHarness } from "@/test/queryClientTestHarness";
import { useHostFilePreview } from "./host-file-preview-query";
import { useProjectFilePreview } from "./project-queries";

const filesSdk = vi.hoisted(() => ({
  createPreview: vi.fn(),
  read: vi.fn(),
}));
const projectsSdk = vi.hoisted(() => ({
  fileContent: vi.fn(),
}));

vi.mock("@/lib/sdk", () => ({
  sdk: { files: filesSdk, projects: projectsSdk },
}));
vi.mock("@/hooks/useRealtimeSubscription", () => ({
  useProjectDetailRealtimeSubscription: () => undefined,
  useThreadDetailRealtimeSubscription: () => undefined,
}));
vi.mock("@/lib/api", () => ({
  getThreadHostFilePreview: vi.fn(),
}));

function textRead(content: string) {
  return {
    path: "/tmp/queue.txt",
    content,
    contentEncoding: "utf8" as const,
    mimeType: "text/plain",
    modifiedAtMs: 1,
    sha256: content,
    sizeBytes: content.length,
  };
}

/** Simulate the browser tab being hidden and shown again (the only "focus"
 *  signal the app feeds React Query; see apps/app/src/lib/query-client.ts). */
function hideAndShowWindow() {
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
  act(() => {
    focusManager.setFocused(undefined);
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("issue #2130 · host-scoped preview (useHostFilePreview)", () => {
  it("refetches after the file changes on disk and the window regains focus within 30s", async () => {
    filesSdk.createPreview.mockResolvedValue(null);
    filesSdk.read.mockResolvedValue(textRead("version 1\n"));
    const { wrapper } = createQueryClientTestHarness();
    const { result } = renderHook(
      () => useHostFilePreview("host-1", "/tmp/queue.txt"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(filesSdk.read).toHaveBeenCalledTimes(1);

    // Outside write.
    filesSdk.read.mockResolvedValue(textRead("version 2\n"));

    // Trigger 1: nothing in the app invalidates hostFilePreviewQueryKey, so
    // there is no realtime path to exercise. Trigger 2: focus. The hook sets
    // staleTime: 30_000, so a focus within 30s is ignored.
    hideAndShowWindow();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    // FAILS ON MAIN: still one read, view still shows version 1.
    expect(filesSdk.read).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(
        result.current.data?.kind === "text" ? result.current.data.content : "",
      ).toBe("version 2\n"),
    );
  });
});

describe("issue #2130 · project preview on the new-thread view (useProjectFilePreview)", () => {
  it("refetches after the file changes on disk and the window regains focus", async () => {
    projectsSdk.fileContent.mockResolvedValue({
      content: "version 1\n",
      contentEncoding: "utf8",
      mimeType: "text/plain",
    });
    const { wrapper } = createQueryClientTestHarness();
    const { result } = renderHook(
      () =>
        useProjectFilePreview("proj_1", "status.txt", {
          environmentId: null,
          hostId: "host-1",
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectsSdk.fileContent).toHaveBeenCalledTimes(1);

    projectsSdk.fileContent.mockResolvedValue({
      content: "version 2\n",
      contentEncoding: "utf8",
      mimeType: "text/plain",
    });

    // Wait past the 2s default staleTime, then a focus cycle. The hook uses
    // EXPENSIVE_MANUAL_QUERY_POLICY (refetchOnWindowFocus: false) and no
    // realtime dirty function names projectFilePreviewQueryKey.
    await act(() => new Promise((resolve) => setTimeout(resolve, 2_100)));
    hideAndShowWindow();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    // FAILS ON MAIN: still one fetch; the panel keeps version 1 forever.
    expect(projectsSdk.fileContent).toHaveBeenCalledTimes(2);
  }, 10_000);
});

// Control: the thread-scoped host preview (RESUME_REFETCH_QUERY_POLICY) does
// refetch on a focus cycle once its 2s staleTime has elapsed. This passes on
// main and proves the focus simulation above is real; it also documents that
// this surface only recovers on focus, never while the user watches it.
describe("issue #2130 · control: thread host preview refetches on focus only", () => {
  it("refetches on a focus cycle after staleTime, but never without one", async () => {
    const api = await import("@/lib/api");
    const { useThreadHostFilePreview } = await import("./thread-queries");
    const read = vi.mocked(api.getThreadHostFilePreview);
    const preview = (content: string) => ({
      kind: "text" as const,
      content,
      mimeType: "text/plain",
      name: "outside.txt",
      path: "/tmp/outside.txt",
      url: "/tmp/outside.txt",
    });
    read.mockResolvedValue(preview("version 1\n"));
    const { wrapper } = createQueryClientTestHarness();
    const { result } = renderHook(
      () => useThreadHostFilePreview("thr_1", "env_1", "/tmp/outside.txt"),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(read).toHaveBeenCalledTimes(1);

    read.mockResolvedValue(preview("version 2\n"));
    await act(() => new Promise((resolve) => setTimeout(resolve, 2_100)));
    // No trigger yet: the view keeps version 1 no matter how long we wait.
    expect(read).toHaveBeenCalledTimes(1);

    hideAndShowWindow();
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  }, 10_000);
});
