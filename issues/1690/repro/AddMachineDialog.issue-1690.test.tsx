// @vitest-environment jsdom
// Repro for get-bb/bb#1690: on a loopback-bound server (the desktop default
// since #1125), the Add machine dialog falls back to the direct server URL when
// bb connect is unpaired and prints a curl command that another machine can
// never use (it dials the new machine's own 127.0.0.1).
//
// Place at apps/app/src/components/dialogs/AddMachineDialog.issue-1690.test.tsx
// Run:  cd apps/app && pnpm exec vitest run src/components/dialogs/AddMachineDialog.issue-1690.test.tsx
// Expected on main (16ceb3a54): FAILS — the loopback curl command is rendered.

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

describe("issue #1690", () => {
  it("does not hand the user a pairing command that targets 127.0.0.1", async () => {
    vi.mocked(sdk.hosts.createJoinCode).mockResolvedValue({
      joinCode: "bbde_test",
      hostId: "host_new",
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    // Exactly what the server returns for an unpaired connect plugin:
    // 500 {"ok":false,"error":{"code":"handler_error","message":"not_paired"}}
    vi.mocked(sdk.plugins.callRpc).mockRejectedValue(
      new BbHttpError({
        body: { ok: false, error: { code: "handler_error", message: "not_paired" } },
        code: "handler_error",
        message: "not_paired",
        status: 500,
      }),
    );
    vi.mocked(sdk.hosts.list).mockResolvedValue([existingHost]);

    const { wrapper } = createQueryClientTestHarness();
    render(
      <MemoryRouter>
        <AddMachineDialog open onOpenChange={vi.fn()} serverUrl="http://127.0.0.1:38886" />
      </MemoryRouter>,
      { wrapper },
    );

    // Wait for the mint to settle (either a command or some notice appears).
    await screen.findAllByText(/join-code|cannot use this address|Remote access/i, undefined, {
      timeout: 3000,
    });

    const loopbackCommand = screen.queryByText(
      /curl .*http:\/\/127\.0\.0\.1:38886\/install\.sh .*--server http:\/\/127\.0\.0\.1:38886/,
    );
    // BUG (main): this assertion fails — the dialog renders
    // "curl ... http://127.0.0.1:38886/install.sh | sh -s -- --join-code bbde_test
    //  --host-id host_new --server http://127.0.0.1:38886"
    expect(loopbackCommand).toBeNull();
  });
});
