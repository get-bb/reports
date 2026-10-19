// @vitest-environment jsdom

import { makeHost } from "@bb/test-helpers/domain-fixtures";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { sdk } from "@/lib/sdk";
import { createQueryClientTestHarness } from "@/test/queryClientTestHarness";
import { makeSystemConfig } from "@/test/fixtures/system-config";
import { AddMachineDialog } from "./AddMachineDialog";

vi.mock("@/lib/sdk", () => ({
  sdk: {
    hosts: {
      delete: vi.fn(),
      experimental_create: vi.fn(),
      experimental_getEnrollmentCommand: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
    },
    system: { config: vi.fn() },
  },
}));

vi.mock("@/lib/ws", () => ({
  wsManager: { subscribe: vi.fn(), unsubscribe: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("closes pending setup and reopens immediately while preserving the saved address", async () => {
  const serverUrl = "https://unreachable.example.invalid";
  const expiresAt = Date.now() + 15 * 60_000;
  vi.mocked(sdk.system.config).mockResolvedValue(
    makeSystemConfig({
      generalSettings: {
        ...makeSystemConfig().generalSettings,
        machineServerUrl: serverUrl,
      },
      serverAccess: {
        providers: [
          {
            id: "direct",
            displayName: "Manual",
            description: "Use a network address.",
            pluginId: null,
            availability: null,
          },
        ],
        defaultProviderId: "direct",
        effectiveUrl: serverUrl,
        urlSource: "setting",
      },
    }),
  );
  vi.mocked(sdk.hosts.list).mockResolvedValue([]);
  const pendingHost = makeHost({
    id: "host_pending_first",
    machineProviderId: "manual",
    lifecycle: {
      phase: "creating",
      suspendedAt: null,
      message: "Waiting for the machine",
      pendingLog: "",
      teardown: null,
    },
  });
  vi.mocked(sdk.hosts.experimental_create)
    .mockResolvedValueOnce(pendingHost)
    .mockResolvedValueOnce({ ...pendingHost, id: "host_pending_second" });
  vi.mocked(sdk.hosts.experimental_getEnrollmentCommand).mockResolvedValue({
    command: "fixture enrollment command",
    windowsCommand: "fixture windows command",
    expiresAt,
  });
  vi.mocked(sdk.hosts.get).mockImplementation(() => new Promise(() => {}));
  vi.mocked(sdk.hosts.delete).mockResolvedValue({ ok: true });
  const onOpenChange = vi.fn();
  const view = (open: boolean) => (
    <MemoryRouter>
      <AddMachineDialog open={open} onOpenChange={onOpenChange} />
    </MemoryRouter>
  );
  const { wrapper } = createQueryClientTestHarness();
  const rendered = render(view(true), { wrapper });
  await screen.findByText("fixture enrollment command");
  expect(screen.queryByRole("textbox", { name: "Server address" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  rendered.rerender(view(false));
  await waitFor(() => {
    expect(sdk.hosts.delete).toHaveBeenCalledWith({
      hostId: "host_pending_first",
    });
  });
  rendered.rerender(view(true));
  await screen.findByText("fixture enrollment command");
  expect(sdk.hosts.experimental_create).toHaveBeenCalledTimes(2);
  const calls = vi.mocked(sdk.hosts.experimental_create).mock.calls;
  expect(calls[1]![0].key).not.toBe(calls[0]![0].key);
  expect(Date.now()).toBeLessThan(expiresAt);
  expect(screen.queryByRole("textbox", { name: "Server address" })).toBeNull();
  rendered.unmount();
});
