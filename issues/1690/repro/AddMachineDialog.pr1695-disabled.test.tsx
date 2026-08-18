// @vitest-environment jsdom
// PR #1695 gap probe: the connect plugin is DISABLED (Settings -> Plugins),
// so /api/v1/plugins/connect/rpc/createMachineCode returns
//   503 {"ok":false,"error":"plugin \"connect\" is not running (status: disabled)"}
// PR #1695 classifies every 503 as "unavailable" (temporary) and renders
// "Remote access isn't ready yet." + "Try again". Retrying can never help; the
// user needs to enable the plugin. Nothing points them there.
import { cleanup, render, screen } from "@testing-library/react";
import type { Host } from "@bb/domain";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BbHttpError, sdk } from "@/lib/sdk";
import { createQueryClientTestHarness } from "@/test/queryClientTestHarness";
import { AddMachineDialog } from "./AddMachineDialog";

vi.mock("@/lib/sdk", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/sdk")>();
  return {
    ...original,
    sdk: {
      hosts: { createJoinCode: vi.fn(), list: vi.fn() },
      plugins: { callRpc: vi.fn() },
    },
  };
});
vi.mock("@/lib/ws", () => ({
  wsManager: { subscribe: vi.fn(), unsubscribe: vi.fn() },
}));

const existingHost: Host = {
  id: "host_primary",
  name: "MacBook Pro",
  type: "persistent",
  status: "connected",
  lastSeenAt: null,
  maxPermissionMode: "full",
  lastRejectedProtocolVersion: null,
  createdAt: 0,
  updatedAt: 0,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PR #1695 with the connect plugin disabled", () => {
  it("shows what the user sees when connect is disabled on a loopback server", async () => {
    vi.mocked(sdk.hosts.createJoinCode).mockResolvedValue({
      joinCode: "bbde_test",
      hostId: "host_new",
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    vi.mocked(sdk.plugins.callRpc).mockRejectedValue(
      new BbHttpError({
        body: {
          ok: false,
          error: 'plugin "connect" is not running (status: disabled)',
        },
        code: null,
        message: 'plugin "connect" is not running (status: disabled)',
        status: 503,
      }),
    );
    vi.mocked(sdk.hosts.list).mockResolvedValue([existingHost]);
    const { wrapper } = createQueryClientTestHarness();
    render(
      <MemoryRouter>
        <AddMachineDialog
          open
          onOpenChange={vi.fn()}
          serverUrl="http://127.0.0.1:38886"
        />
      </MemoryRouter>,
      { wrapper },
    );
    expect(
      await screen.findByText("Remote access isn't ready yet."),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
    // Good: no loopback command.
    expect(screen.queryByText(/--join-code bbde_test/)).toBeNull();
    // Gap: nothing routes the user to enable the plugin; "Try again" is a dead end.
    expect(
      screen.queryByRole("link", { name: "Set up remote access" }),
    ).toBeNull();
    // Still shows the misleading "Waiting for the machine to connect…" spinner.
    expect(
      screen.queryByText("Waiting for the machine to connect…"),
    ).not.toBeNull();
  });
});
